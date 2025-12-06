# 実装計画: 手動調整・変更履歴・スナップショット機能

**最終更新**: 2025-12-06
**ステータス**: ユーザー確認済み

## 概要

CSVマスターは「事実」を保存する層として維持しつつ、以下を追加実装する:
1. **audit-log**: 手動変更の履歴を記録
2. **aggregation-snapshot**: 確定した集計結果を保存（フォルダ分け・ピン留め・名前変更対応）
3. **staff-master**: 担当者マスター（ハイブリッド方式）
4. **手動編集UI**: おまかせ担当者割り当て、キャンセル/実施切替、同日統合
5. **担当者別集計ビュー**: 新規追加

## 確認済み仕様

- **担当者リスト**: ハイブリッド方式
  - CSVから自動抽出 → 担当者マスターで手動調整（追加/削除/統合）
  - 最終集計では担当者マスターを参照
- **groupId形式**: `{friendId}_{sessionDate}` 形式
- **スナップショット管理**:
  - 削除可能（管理者のみ）
  - フォルダ分け（カテゴリー管理）
  - ピン留め（お気に入り）
  - 名前変更（label編集）

---

## 実装ステップ

### Step 1: 型定義の拡張

**ファイル**: `src/domain/types.ts`

```typescript
// ReservationHistory に追加
interface ReservationHistory {
  // ... 既存フィールド ...
  wasOmakase: boolean;       // NEW: CSVで担当者がおまかせだった
  groupId: string | null;    // NEW: 同日複数申込の統合ID（形式: friendId_YYYY-MM-DD）
}

// 新規: 監査ログ
interface AuditLog {
  id: string;                // UUID
  reservationId: string;     // 対象の予約ID
  field: string;             // 変更フィールド名（staff / isCancelled / isImplemented / groupId 等）
  oldValue: any;             // 変更前の値
  newValue: any;             // 変更後の値
  changedAt: Date;           // 変更日時
  changedBy: string;         // 変更者（当面 'goma'）
}

// 新規: 担当者マスター
interface StaffMaster {
  staffId: string;           // UUID
  staffName: string;         // 表示名（正規化後）
  aliases: string[];         // 表記揺れ一覧（CSVで検出された名前）
  isActive: boolean;         // 有効/無効
  sortOrder: number;         // 表示順
  createdAt: Date;
  updatedAt: Date;
}

// 新規: 集計スナップショット（拡張版）
interface AggregationSnapshot {
  id: string;                // UUID
  type: 'monthly' | 'campaign' | 'staff';
  label: string;             // 例: "2025-11 月次（実施日）"
  createdAt: Date;
  createdBy: string;
  dateBaseType: 'application' | 'session';
  periodFrom: Date;
  periodTo: Date;
  campaignId?: string;       // キャンペーン集計の場合のみ
  payload: any;              // 集計結果JSON

  // 管理機能
  folderName: string | null; // フォルダ/カテゴリー名（null = ルート）
  isPinned: boolean;         // ピン留め（お気に入り）
  updatedAt: Date;           // 更新日時（名前変更時など）
}

// 新規: スナップショットフォルダ
interface SnapshotFolder {
  folderId: string;          // UUID
  folderName: string;        // フォルダ名
  sortOrder: number;         // 表示順
  createdAt: Date;
}
```

### Step 2: IndexedDB スキーマ更新

**ファイル**: `src/infrastructure/repository.ts`

- DBバージョンを `1` → `2` に上げる
- 新規ストア追加:
  - `audit-log` (keyPath: `id`, index: `reservationId`)
  - `aggregation-snapshot` (keyPath: `id`, index: `folderName`, `isPinned`, `type`)
  - `snapshot-folder` (keyPath: `folderId`)
  - `staff-master` (keyPath: `staffId`, index: `staffName`, `isActive`)
- `reservation-history` にインデックス追加:
  - `wasOmakase`
  - `groupId`

### Step 3: リポジトリ関数追加

**ファイル**: `src/infrastructure/repository.ts`

```typescript
// ========== 監査ログ操作 ==========
export async function saveAuditLog(log: AuditLog): Promise<void>;
export async function getAuditLogsByReservationId(reservationId: string): Promise<AuditLog[]>;
export async function getAllAuditLogs(): Promise<AuditLog[]>;

// ========== 担当者マスター操作 ==========
export async function getAllStaff(): Promise<StaffMaster[]>;
export async function saveStaff(staff: StaffMaster): Promise<void>;
export async function deleteStaff(staffId: string): Promise<void>;
export async function getStaffByName(name: string): Promise<StaffMaster | undefined>;

// ========== スナップショット操作 ==========
export async function getAllSnapshots(): Promise<AggregationSnapshot[]>;
export async function saveSnapshot(snapshot: AggregationSnapshot): Promise<void>;
export async function updateSnapshot(id: string, updates: Partial<AggregationSnapshot>): Promise<void>;
export async function deleteSnapshot(id: string): Promise<void>;

// ========== フォルダ操作 ==========
export async function getAllFolders(): Promise<SnapshotFolder[]>;
export async function saveFolder(folder: SnapshotFolder): Promise<void>;
export async function deleteFolder(folderId: string): Promise<void>;
```

### Step 4: historyStore の拡張

**ファイル**: `src/store/historyStore.ts`

```typescript
// 新規アクション
updateStaff: (reservationId: string, staff: string) => Promise<void>;
updateCancelStatus: (reservationId: string, isCancelled: boolean) => Promise<void>;
updateImplementedStatus: (reservationId: string, isImplemented: boolean) => Promise<void>;
mergeAsGroup: (reservationIds: string[]) => Promise<void>;

// 取得用
getOmakaseUnassigned: () => ReservationHistory[];  // wasOmakase=true, staff=null
getSameDayMultiple: () => Map<string, ReservationHistory[]>;  // friendId+sessionDate単位
```

### Step 5: CSVパーサーの拡張

**ファイル**: `src/utils/csvParser.ts`

- 「おまかせ」判定を検出し、`wasOmakase: true` をセット
- 既存の `staff: null` 判定ロジックはそのまま

### Step 6: 手動編集UIコンポーネント

**新規ファイル**: `src/components/ManualEditPanel.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ 手動調整パネル                                              │
├─────────────────────────────────────────────────────────────┤
│ [タブ: おまかせ担当者割り当て | キャンセル/実施変更 | 同日統合] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ■ おまかせ担当者割り当て (3件)                              │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 実施日    │ 名前     │ 担当者     │ 操作               ││
│ ├───────────┼──────────┼────────────┼────────────────────┤│
│ │ 2025-12-01│ 田中さん │ [セレクト▼]│ [適用]             ││
│ │ 2025-12-02│ 鈴木さん │ [セレクト▼]│ [適用]             ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 7: 担当者別集計ビュー

**新規ファイル**: `src/components/StaffAggregationView.tsx`

表示項目:
- 担当者名
- 総件数
- 実施件数
- キャンセル件数
- 初回 / 2回目 / 3回目以降
- おまかせからの配分件数
- ユニークユーザー数
- groupId でまとめた件数

### Step 8: スナップショット機能

**新規ファイル**: `src/store/snapshotStore.ts`

```typescript
interface SnapshotStoreState {
  snapshots: AggregationSnapshot[];
  folders: SnapshotFolder[];
  isLoading: boolean;
  error: string | null;

  // 基本操作
  loadSnapshots: () => Promise<void>;
  saveSnapshot: (snapshot: Omit<AggregationSnapshot, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  getSnapshotById: (id: string) => AggregationSnapshot | undefined;

  // 管理機能
  deleteSnapshot: (id: string) => Promise<void>;  // 管理者のみ
  renameSnapshot: (id: string, newLabel: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  moveToFolder: (id: string, folderName: string | null) => Promise<void>;

  // フォルダ操作
  createFolder: (folderName: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;

  // フィルタ
  getSnapshotsByType: (type: 'monthly' | 'campaign' | 'staff') => AggregationSnapshot[];
  getSnapshotsByFolder: (folderName: string | null) => AggregationSnapshot[];
  getPinnedSnapshots: () => AggregationSnapshot[];
}
```

**新規ファイル**: `src/components/SnapshotViewer.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ スナップショット一覧                                        │
├─────────────────────────────────────────────────────────────┤
│ [フィルタ: すべて | 月次 | キャンペーン | 担当者別]          │
│ [フォルダ: ▼ ルート]                                       │
├─────────────────────────────────────────────────────────────┤
│ ★ 2025-11 月次（実施日）確定版     2025-12-01  [👁] [✏️] [🗑] │
│ ★ キャリア相談11月 最終           2025-12-01  [👁] [✏️] [🗑] │
│ ─────────────────────────────────────────────────────────── │
│   2025-10 月次（申込日）           2025-11-01  [👁] [✏️] [🗑] │
│   キャリア相談10月                 2025-11-01  [👁] [✏️] [🗑] │
└─────────────────────────────────────────────────────────────┘
  ★ = ピン留め  👁 = 表示  ✏️ = 名前変更  🗑 = 削除
```

UIボタン（各集計ビューに追加）:
- 月次集計ビュー: 「この集計結果をスナップショット保存」
- キャンペーン集計ビュー: 同上
- 担当者別集計ビュー: 同上

### Step 9: 集計ロジックの拡張

**ファイル**: `src/domain/logic.ts`

```typescript
/**
 * 最終集計データを生成
 * = マスター（事実） + audit-log（手動変更） - isExcluded
 */
export function applyAuditLogs(
  history: ReservationHistory,
  auditLogs: AuditLog[]
): ReservationHistory;

/**
 * groupIdでまとめた件数を計算
 * (同日複数申込を1件としてカウント)
 */
export function countGroupedRecords(records: ReservationHistory[]): number;
```

### Step 10: CSVエクスポートの拡張

集計CSVに追加するフィールド:
- `wasModified`: boolean (手動変更あり)
- `lastModifiedAt`: Date | null
- `lastModifiedBy`: string | null
- `groupId`: string | null

---

## サイドバー更新

```
集計ビュー
├── 履歴一覧
├── 月次集計
├── キャンペーン別
├── 担当者別            ← 新規
├── ユーザー別
└── スナップショット     ← 新規

管理
├── 手動調整             ← 新規（おまかせ割当・キャンセル変更・統合）
├── 担当者マスター        ← 新規
└── 監査ログ             ← 新規（変更履歴閲覧）
```

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/domain/types.ts` | AuditLog, AggregationSnapshot, StaffMaster, SnapshotFolder 型追加、ReservationHistory拡張 |
| `src/infrastructure/repository.ts` | DBv2、audit-log/snapshot/staff-master/folder ストア追加 |
| `src/store/historyStore.ts` | 手動編集アクション追加 |
| `src/store/snapshotStore.ts` | 新規作成（フォルダ/ピン/名前変更対応） |
| `src/store/staffStore.ts` | 新規作成（担当者マスター管理） |
| `src/utils/csvParser.ts` | wasOmakase検出追加 |
| `src/domain/logic.ts` | applyAuditLogs, countGroupedRecords, resolveStaffName追加 |
| `src/components/ManualEditPanel.tsx` | 新規作成 |
| `src/components/StaffAggregationView.tsx` | 新規作成 |
| `src/components/StaffMasterManager.tsx` | 新規作成（担当者マスター管理画面） |
| `src/components/SnapshotViewer.tsx` | 新規作成（フォルダ/ピン/名前変更対応） |
| `src/components/AuditLogViewer.tsx` | 新規作成（変更履歴閲覧） |
| `src/components/Sidebar.tsx` | 担当者別・スナップショット・管理メニュー追加 |
| `src/components/MainContent.tsx` | 新ビュー対応 |
| `src/components/MonthlyAggregationView.tsx` | スナップショット保存ボタン追加 |
| `src/components/CampaignAggregationView.tsx` | スナップショット保存ボタン追加 |

---

## 推奨実装順序

### Phase A: 基盤構築
1. **Step 1**: 型定義の拡張
2. **Step 2**: IndexedDB スキーマ更新（DBv2）
3. **Step 3**: リポジトリ関数追加

### Phase B: マスター管理
4. **Step 5**: CSVパーサー拡張（wasOmakase検出）
5. **担当者マスター**: staffStore + StaffMasterManager.tsx

### Phase C: 手動編集機能
6. **Step 4**: historyStore拡張（手動編集アクション）
7. **Step 6**: 手動編集UI（ManualEditPanel.tsx）
8. **監査ログ閲覧**: AuditLogViewer.tsx

### Phase D: 集計機能
9. **Step 7**: 担当者別集計ビュー
10. **Step 9**: 集計ロジック拡張（applyAuditLogs等）
11. **Step 10**: CSVエクスポート拡張

### Phase E: スナップショット
12. **Step 8**: スナップショット機能（snapshotStore + SnapshotViewer.tsx）

### Phase F: 統合・テスト
13. Sidebar・MainContent 更新
14. ビルド・動作確認

---

## 工数見積もり

| Phase | 内容 | 見積もり |
|-------|------|---------|
| Phase A | 基盤構築（型・DB・リポジトリ） | 中 |
| Phase B | マスター管理 | 小 |
| Phase C | 手動編集機能 | 中 |
| Phase D | 集計機能 | 中 |
| Phase E | スナップショット | 中〜大 |
| Phase F | 統合・テスト | 小 |

**合計**: 大規模な機能追加（複数セッションに分けて実装推奨）
