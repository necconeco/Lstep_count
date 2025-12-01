# Lステップ集計ツール - 開発者ガイド

## 📚 目次

1. [開発環境のセットアップ](#開発環境のセットアップ)
2. [アーキテクチャ概要](#アーキテクチャ概要)
3. [プロジェクト構造](#プロジェクト構造)
4. [コーディング規約](#コーディング規約)
5. [状態管理（Zustand）](#状態管理zustand)
6. [データフロー](#データフロー)
7. [主要なロジック](#主要なロジック)
8. [テスト](#テスト)
9. [新機能の追加方法](#新機能の追加方法)
10. [デバッグ](#デバッグ)
11. [パフォーマンス最適化](#パフォーマンス最適化)
12. [トラブルシューティング](#トラブルシューティング)

---

## 開発環境のセットアップ

### 前提条件

- **Node.js**: 18以上
- **npm**: 9以上
- **Git**: 2.x以上
- **エディタ**: VS Code推奨（TypeScript対応）

### セットアップ手順

```bash
# リポジトリのクローン
git clone <repository-url>
cd Lstep集計ツール

# 依存パッケージのインストール
npm install

# 開発サーバーの起動（ポート3247）
npm run dev

# 別ターミナルでテストの実行
npm test

# ビルド
npm run build

# プレビュー（本番環境シミュレーション）
npm run preview
```

### VS Code推奨拡張機能

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### 環境変数

このプロジェクトは環境変数を使用しません（完全にブラウザ内で動作）。

---

## アーキテクチャ概要

### 技術スタック

```yaml
フロントエンド:
  - React 18: UIライブラリ
  - TypeScript 5: 型安全性
  - Vite 5: ビルドツール（高速HMR）
  - MUI v7: UIコンポーネント

状態管理:
  - Zustand 5.0.9: シンプルな状態管理

データ処理:
  - PapaParse 5.5.3: CSV解析
  - TanStack Table 8.21.3: テーブル表示
  - Recharts 3.5.1: グラフ表示
  - SheetJS 0.18.5: スプレッドシート生成

データ保存:
  - IndexedDB: ブラウザ内永続化

テスト:
  - Vitest 4.0.14: テストフレームワーク
  - React Testing Library: コンポーネントテスト
  - jsdom: DOM環境シミュレーション

デプロイ:
  - Vercel: ホスティング（無料プラン）
```

### アーキテクチャの特徴

#### 1. フロントエンドのみ（No Backend）

- すべての処理がブラウザ内で完結
- サーバー不要
- オフラインで動作可能

#### 2. 究極のMVP（1ページ構成）

- シングルページアプリケーション（SPA）
- ルーティング不要
- シンプルで保守しやすい

#### 3. データプライバシー重視

- 外部サーバーへの送信なし
- IndexedDBでローカル保存
- GDPR/個人情報保護法準拠

---

## プロジェクト構造

```
Lstep集計ツール/
├── docs/                          # ドキュメント
│   ├── requirements.md            # 要件定義書
│   ├── SCOPE_PROGRESS.md          # 進捗管理
│   ├── DEPLOYMENT.md              # デプロイガイド
│   ├── USER_MANUAL.md             # ユーザーマニュアル
│   └── DEVELOPER_GUIDE.md         # このファイル
├── src/
│   ├── components/                # Reactコンポーネント
│   │   ├── CsvUploader.tsx        # CSVアップロード
│   │   ├── SummaryCard.tsx        # サマリーカード
│   │   ├── StaffTable.tsx         # 相談員別実績テーブル
│   │   ├── DailyChart.tsx         # 日別グラフ
│   │   ├── MonthlyChart.tsx       # 月別グラフ
│   │   ├── ReviewList.tsx         # 要確認リスト
│   │   ├── CancellationList.tsx   # キャンセル一覧
│   │   └── HistoryView.tsx        # 履歴表示
│   ├── utils/                     # ユーティリティ関数
│   │   ├── csvParser.ts           # CSV解析
│   │   ├── dataAggregator.ts      # データ集計
│   │   ├── reviewDetector.ts      # 要確認リスト検出
│   │   ├── spreadsheetGenerator.ts # スプレッドシート生成
│   │   ├── masterDataManager.ts   # 履歴マスタ管理（IndexedDB）
│   │   └── aggregationHistoryManager.ts # 集計履歴管理（IndexedDB）
│   ├── store/                     # Zustand状態管理
│   │   ├── csvStore.ts            # CSVデータストア
│   │   ├── masterStore.ts         # 履歴マスタストア
│   │   ├── aggregationStore.ts    # 集計結果ストア
│   │   └── reviewStore.ts         # 要確認リストストア
│   ├── types/                     # TypeScript型定義
│   │   └── index.ts               # 全型定義
│   ├── test/                      # テスト設定
│   │   └── setup.ts               # Vitestセットアップ
│   ├── App.tsx                    # メインアプリケーション
│   ├── App.css                    # アプリスタイル
│   ├── main.tsx                   # エントリーポイント
│   └── index.css                  # グローバルスタイル
├── .eslintrc.cjs                  # ESLint設定
├── .prettierrc                    # Prettier設定
├── .gitignore                     # Git除外設定
├── CLAUDE.md                      # プロジェクト設定
├── package.json                   # npm設定
├── tsconfig.json                  # TypeScript設定
├── vite.config.ts                 # Vite設定
├── vitest.config.ts               # Vitest設定
└── vercel.json                    # Vercel設定
```

---

## コーディング規約

### 命名規則

#### ファイル名

```typescript
// コンポーネント: PascalCase
CsvUploader.tsx
SummaryCard.tsx

// ユーティリティ: camelCase
csvParser.ts
dataAggregator.ts

// 型定義
types/index.ts
```

#### 変数・関数

```typescript
// 変数: camelCase
const csvData = ...;
const aggregationResult = ...;

// 関数: camelCase
function parseCSV(...) { ... }
function calculateConversionRate(...) { ... }

// 定数: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMPLEMENTED_STATUSES = ['予約済み'];

// 型/インターフェース: PascalCase
interface CsvRecord { ... }
type AggregationResult = { ... };
```

### TypeScript strictモード

すべてのファイルで`strict`モードを有効にしています。

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### コード品質基準

```yaml
関数行数: 100行以下（推奨: 50行以下）
ファイル行数: 700行以下
複雑度: 10以下
行長: 120文字以下

必須:
  - 未使用の変数/import禁止
  - console.log本番環境禁止（console.warn, console.errorは許可）
  - エラーハンドリング必須
  - 型定義必須（anyの使用禁止）
```

### フォーマット（Prettier）

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 120,
  "trailingComma": "es5"
}
```

---

## 状態管理（Zustand）

### 4つのストア構成

```typescript
// 1. csvStore: CSVデータの管理
interface CsvStore {
  csvData: CsvRecord[];
  setCsvData: (data: CsvRecord[]) => void;
  clearCsvData: () => void;
}

// 2. masterStore: 履歴マスタ管理
interface MasterStore {
  masterData: Map<string, UserHistoryMaster>;
  getAllMasterData: () => Promise<void>;
  updateMasterData: (newRecords: UserHistoryMaster[]) => Promise<void>;
  clearMasterData: () => Promise<void>;
}

// 3. aggregationStore: 集計結果管理
interface AggregationStore {
  summary: AggregationSummary | null;
  staffResults: StaffResult[];
  dailyResults: DailyResult[];
  monthlyResults: MonthlyResult[];
  spreadsheetData: SpreadsheetOutputData | null;
  processData: (csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>) => Promise<void>;
  clearAggregation: () => void;
}

// 4. reviewStore: 要確認リスト管理
interface ReviewStore {
  pattern1: ReviewRecord[];
  pattern2: ReviewRecord[];
  pattern3: ReviewRecord[];
  cancellations: CancellationRecord[];
  detectReviews: (csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>) => void;
  clearReviews: () => void;
}
```

### ストアの使用方法

```typescript
// コンポーネント内での使用
import { useCsvStore } from './store/csvStore';
import { useAggregationStore } from './store/aggregationStore';

function MyComponent() {
  // ストアから状態とアクションを取得
  const { csvData, setCsvData } = useCsvStore();
  const { summary, processData } = useAggregationStore();

  // アクションの実行
  const handleUpload = async (file: File) => {
    const data = await parseCSV(file);
    setCsvData(data);
    await processData(data, masterData);
  };

  return <div>...</div>;
}
```

---

## データフロー

### 1. CSVアップロードから集計まで

```
1. ユーザー: CSVファイルをアップロード
   ↓
2. CsvUploader: ファイルバリデーション（validateCSVFile）
   ↓
3. csvParser: CSV解析（parseCSV）
   ↓
4. csvStore: CSVデータを保存（setCsvData）
   ↓
5. masterStore: 履歴マスタを読み込み（getAllMasterData）
   ↓
6. aggregationStore: データ集計（processData）
   ├─ dataAggregator.aggregateAll: 全集計実行
   │  ├─ aggregateSummary: サマリー集計
   │  ├─ aggregateByStaff: 相談員別集計
   │  ├─ aggregateByDate: 日別集計
   │  ├─ aggregateByMonth: 月別集計
   │  └─ generateSpreadsheetData: スプレッドシート用データ生成
   └─ aggregationHistoryManager.saveHistory: 履歴保存
   ↓
7. reviewStore: 要確認リスト検出（detectReviews）
   ├─ reviewDetector.detectPattern1: パターン1検出
   ├─ reviewDetector.detectPattern2: パターン2検出
   ├─ reviewDetector.detectPattern3: パターン3検出
   └─ reviewDetector.generateCancellationList: キャンセル一覧生成
   ↓
8. masterStore: 履歴マスタを更新（updateMasterData）
   ├─ dataAggregator.updateMasterData: 実施済みレコードからマスタ更新
   └─ masterDataManager.saveMasterDataBatch: IndexedDBに保存
   ↓
9. UIコンポーネント: 集計結果を表示
```

### 2. スプレッドシート出力

```
1. ユーザー: 「スプレッドシート出力」ボタンをクリック
   ↓
2. App.tsx: handleDownloadSpreadsheet実行
   ↓
3. spreadsheetGenerator: Excel生成（generateSpreadsheet）
   ├─ データ行作成（AB~AM列）
   ├─ TTL行追加
   ├─ セルスタイル設定
   └─ ファイル名生成
   ↓
4. ブラウザ: ファイルダウンロード
```

### 3. 履歴管理

```
1. aggregationStore.processData実行時
   ↓
2. aggregationHistoryManager.saveHistory
   ↓
3. IndexedDB: aggregation-historyストアに保存
   ├─ ID: YYYYMM（例: 202512）
   ├─ month: YYYY-MM
   ├─ summary, staffResults, dailyResults, monthlyResults
   ├─ spreadsheetData
   └─ createdAt, updatedAt
   ↓
4. HistoryView: 履歴表示
   ├─ aggregationHistoryManager.getAllHistories
   └─ 新しい順にソート表示
```

---

## 主要なロジック

### 1. CSV解析（csvParser.ts）

#### ファイルバリデーション

```typescript
export function validateCSVFile(file: File): { valid: boolean; error?: string | null } {
  // ファイルタイプチェック
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    return { valid: false, error: 'CSVファイルを選択してください（拡張子: .csv）' };
  }

  // ファイルサイズチェック（10MB制限）
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `ファイルサイズが大きすぎます（最大: 10MB）` };
  }

  // 空ファイルチェック
  if (file.size === 0) {
    return { valid: false, error: 'ファイルが空です' };
  }

  return { valid: true, error: null };
}
```

#### CSV解析

```typescript
export async function parseCSV(file: File): Promise<CsvRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        // 必須カラムの検証
        const requiredColumns = ['予約ID', '友だちID', '予約日', 'ステータス', '来店/来場', '名前', '申込日時'];
        const headers = results.meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
          reject(new Error(`必須カラムが不足しています: ${missingColumns.join(', ')}`));
          return;
        }

        resolve(results.data as CsvRecord[]);
      },
      error: (error) => reject(error),
    });
  });
}
```

### 2. データ集計（dataAggregator.ts）

#### 実施判定

```typescript
export function isImplemented(record: CsvRecord): boolean {
  return record.ステータス === '予約済み' && record['来店/来場'] === '済み';
}
```

**重要**: この2つの条件を**両方満たす**必要があります。

#### 初回/2回目以降判定

```typescript
export function getVisitType(friendId: string, masterData: Map<string, UserHistoryMaster>): VisitType {
  const master = masterData.get(friendId);

  if (!master || master.implementationCount === 0) {
    return '初回';
  } else if (master.implementationCount === 1) {
    return '2回目';
  } else {
    return '3回目以降';
  }
}
```

#### サマリー集計

```typescript
export function aggregateSummary(csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>): AggregationSummary {
  let firstTotal = 0, firstImplemented = 0, firstCancelled = 0;
  let repeatTotal = 0, repeatImplemented = 0, repeatCancelled = 0;

  csvData.forEach(record => {
    const visitType = getVisitType(record.友だちID, masterData);
    const implemented = isImplemented(record);
    const cancelled = record.ステータス === 'キャンセル済み';

    if (visitType === '初回') {
      firstTotal++;
      if (implemented) firstImplemented++;
      if (cancelled) firstCancelled++;
    } else {
      repeatTotal++;
      if (implemented) repeatImplemented++;
      if (cancelled) repeatCancelled++;
    }
  });

  return {
    first: {
      total: firstTotal,
      implemented: firstImplemented,
      cancelled: firstCancelled,
      implementationRate: firstTotal > 0 ? (firstImplemented / firstTotal) * 100 : 0,
    },
    repeat: {
      total: repeatTotal,
      implemented: repeatImplemented,
      cancelled: repeatCancelled,
      implementationRate: repeatTotal > 0 ? (repeatImplemented / repeatTotal) * 100 : 0,
    },
  };
}
```

### 3. 要確認リスト検出（reviewDetector.ts）

#### パターン1: データ不整合

```typescript
export function detectPattern1(csvData: CsvRecord[]): ReviewRecord[] {
  return csvData
    .filter(record => record.ステータス === 'キャンセル済み' && record['来店/来場'] === '済み')
    .map(record => ({
      ...record,
      pattern: 'pattern1' as const,
      reason: 'ステータスが「キャンセル済み」なのに「来店/来場」が「済み」です。データの整合性を確認してください。',
    }));
}
```

#### パターン2: 未来店

```typescript
export function detectPattern2(csvData: CsvRecord[]): ReviewRecord[] {
  return csvData
    .filter(record => record.ステータス === '予約済み' && record['来店/来場'] === 'なし')
    .map(record => ({
      ...record,
      pattern: 'pattern2' as const,
      reason: 'ステータスが「予約済み」ですが「来店/来場」が「なし」です。来店/来場の記録を確認してください。',
    }));
}
```

#### パターン3: 通常キャンセル

```typescript
export function detectPattern3(csvData: CsvRecord[]): ReviewRecord[] {
  return csvData
    .filter(record => record.ステータス === 'キャンセル済み' && record['来店/来場'] === 'なし')
    .map(record => ({
      ...record,
      pattern: 'pattern3' as const,
      reason: '通常のキャンセルです。必要に応じて理由を確認してください。',
    }));
}
```

### 4. スプレッドシート生成（spreadsheetGenerator.ts）

```typescript
export function generateSpreadsheet(data: SpreadsheetOutputData, month: string): void {
  const workbook = XLSX.utils.book_new();

  // AB~AM列への8項目データ出力
  const sheetData: unknown[][] = [
    // ヘッダー行（27列分のスペース + 8項目）
    ['', '', '', ...Array(27).fill(''),
     '初回予約合計', '初回予約率(%)', '初回実施合計', '初回実施率(%)',
     '', '', '', '',
     '2回目以降予約合計', '2回目以降予約率(%)', '2回目以降実施合計', '2回目以降実施率(%)'],

    // データ行
    ['', '', '', ...Array(27).fill(''),
     data.AB, data.AC, data.AD, data.AE,
     '', '', '', '',
     data.AJ, data.AK, data.AL, data.AM],
  ];

  // TTL行追加
  sheetData.push(['TTL', '', '', ...Array(27).fill(''),
    data.AB, data.AC, data.AD, data.AE,
    '', '', '', '',
    data.AJ, data.AK, data.AL, data.AM]);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // ファイル名生成
  const year = month.split('-')[0];
  const monthNum = month.split('-')[1];
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `Lステップ集計_${year}年${monthNum}月_${dateStr}.xlsx`;

  // ダウンロード
  XLSX.writeFile(workbook, fileName);
}
```

### 5. IndexedDB管理

#### 履歴マスタ管理（masterDataManager.ts）

```typescript
const DB_NAME = 'lstep-aggregation-db';
const MASTER_STORE_NAME = 'user-history-master';

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 履歴マスタストア作成
      if (!db.objectStoreNames.contains(MASTER_STORE_NAME)) {
        const masterStore = db.createObjectStore(MASTER_STORE_NAME, { keyPath: 'friendId' });
        masterStore.createIndex('friendId', 'friendId', { unique: true });
        masterStore.createIndex('lastImplementationDate', 'lastImplementationDate', { unique: false });
      }

      // 集計履歴ストア作成
      if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        const historyStore = db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
        historyStore.createIndex('month', 'month', { unique: false });
        historyStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}
```

---

## テスト

### テストフレームワーク

- **Vitest**: 高速なテストフレームワーク（Vite統合）
- **React Testing Library**: コンポーネントテスト
- **jsdom**: DOM環境シミュレーション

### テストコマンド

```bash
# インタラクティブモード（開発中）
npm test

# UIダッシュボード
npm run test:ui

# CI用一回実行
npm run test:run

# カバレッジレポート
npm run test:coverage
```

### テスト構成

```
src/
├── utils/
│   ├── csvParser.ts
│   ├── csvParser.test.ts         # 5件のテスト
│   ├── dataAggregator.ts
│   ├── dataAggregator.test.ts    # 14件のテスト
│   ├── reviewDetector.ts
│   └── reviewDetector.test.ts    # 10件のテスト
└── test/
    └── setup.ts                   # テストセットアップ
```

### テスト例

#### ユニットテスト（csvParser.test.ts）

```typescript
import { describe, it, expect } from 'vitest';
import { validateCSVFile } from './csvParser';

describe('validateCSVFile', () => {
  it('should accept valid CSV file', () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const result = validateCSVFile(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should reject non-CSV file', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const result = validateCSVFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('CSVファイルを選択してください');
  });
});
```

#### ロジックテスト（dataAggregator.test.ts）

```typescript
describe('isImplemented', () => {
  it('should return true for implemented record', () => {
    const record: CsvRecord = {
      予約ID: '001',
      友だちID: 'friend001',
      予約日: '2025-12-01',
      ステータス: '予約済み',
      '来店/来場': '済み',
      名前: 'テスト太郎',
      申込日時: '2025-11-30 10:00',
    };
    expect(isImplemented(record)).toBe(true);
  });

  it('should return false for non-implemented record', () => {
    const record: CsvRecord = {
      ...
      ステータス: 'キャンセル済み',
      '来店/来場': '済み',
    };
    expect(isImplemented(record)).toBe(false);
  });
});
```

### モック（src/test/setup.ts）

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// IndexedDB モック
const indexedDBMock = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};
global.indexedDB = indexedDBMock as unknown as IDBFactory;

// Blob URL モック
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();
```

---

## 新機能の追加方法

### 例: 新しい集計指標を追加

#### ステップ1: 型定義を追加（src/types/index.ts）

```typescript
export interface AggregationSummary {
  first: {
    total: number;
    implemented: number;
    cancelled: number;
    implementationRate: number;
    // 新しい指標を追加
    averageDaysToVisit: number; // 申込から来店までの平均日数
  };
  repeat: {
    // 同様に追加
  };
}
```

#### ステップ2: 集計ロジックを実装（src/utils/dataAggregator.ts）

```typescript
export function aggregateSummary(csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>): AggregationSummary {
  // 既存のロジック...

  // 新しい指標の計算
  const averageDaysToVisit = calculateAverageDaysToVisit(csvData);

  return {
    first: {
      // 既存フィールド...
      averageDaysToVisit,
    },
    // ...
  };
}

function calculateAverageDaysToVisit(csvData: CsvRecord[]): number {
  // 計算ロジックを実装
  const implementedRecords = csvData.filter(isImplemented);

  const totalDays = implementedRecords.reduce((sum, record) => {
    const applyDate = new Date(record.申込日時);
    const visitDate = new Date(record.予約日);
    const days = (visitDate.getTime() - applyDate.getTime()) / (1000 * 60 * 60 * 24);
    return sum + days;
  }, 0);

  return implementedRecords.length > 0 ? totalDays / implementedRecords.length : 0;
}
```

#### ステップ3: UIコンポーネントを更新（src/components/SummaryCard.tsx）

```typescript
export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <Card>
      {/* 既存の表示... */}

      {/* 新しい指標を追加 */}
      <Typography variant="body2">
        平均来店日数: {summary.first.averageDaysToVisit.toFixed(1)}日
      </Typography>
    </Card>
  );
}
```

#### ステップ4: テストを追加（src/utils/dataAggregator.test.ts）

```typescript
describe('averageDaysToVisit', () => {
  it('should calculate average days correctly', () => {
    const csvData: CsvRecord[] = [
      {
        予約ID: '001',
        友だちID: 'friend001',
        予約日: '2025-12-10',
        申込日時: '2025-12-01 10:00',
        ステータス: '予約済み',
        '来店/来場': '済み',
        名前: 'テスト太郎',
      },
      // 9日後に来店 → 平均9日
    ];

    const masterData = new Map();
    const result = aggregateSummary(csvData, masterData);

    expect(result.first.averageDaysToVisit).toBeCloseTo(9, 1);
  });
});
```

#### ステップ5: ドキュメントを更新

- `docs/USER_MANUAL.md`: 新機能の使い方を説明
- `docs/DEVELOPER_GUIDE.md`: 実装の詳細を記録

---

## デバッグ

### ブラウザ開発者ツール

#### Chromeデバッグ

```
F12キー → Sources タブ → ブレークポイント設定
```

#### React DevTools

```bash
# Chrome拡張機能をインストール
# Componentsタブでコンポーネントツリーとpropsを確認
```

#### Zustand DevTools

```typescript
// store/xxxStore.ts に devtools を追加
import { devtools } from 'zustand/middleware';

export const useCsvStore = create<CsvStore>()(
  devtools(
    (set) => ({
      // ...
    }),
    { name: 'CsvStore' }
  )
);
```

### ロギング

```typescript
// 開発環境のみログ出力
if (import.meta.env.DEV) {
  console.log('Debug info:', data);
}

// エラーログ（本番環境でも出力）
console.error('Error occurred:', error);
console.warn('Warning:', warning);
```

### IndexedDBの確認

```
Chrome DevTools → Application → Storage → IndexedDB
```

- `lstep-aggregation-db`
  - `user-history-master`: 履歴マスタ
  - `aggregation-history`: 集計履歴

---

## パフォーマンス最適化

### 1. React.memo でコンポーネントの再レンダリング防止

```typescript
import { memo } from 'react';

export const SummaryCard = memo(({ summary }: SummaryCardProps) => {
  // コンポーネントのロジック
});
```

### 2. useMemo で重い計算のメモ化

```typescript
import { useMemo } from 'react';

function MyComponent({ data }: Props) {
  const aggregatedData = useMemo(() => {
    // 重い集計処理
    return aggregateSummary(data, masterData);
  }, [data, masterData]);

  return <div>{aggregatedData.total}</div>;
}
```

### 3. useCallback でコールバック関数のメモ化

```typescript
import { useCallback } from 'react';

function MyComponent() {
  const handleUpload = useCallback(async (file: File) => {
    // 処理
  }, []);

  return <CsvUploader onUpload={handleUpload} />;
}
```

### 4. バンドルサイズの最適化

```bash
# ビルドサイズの分析
npm run build -- --analyze

# 不要な依存パッケージの削除
npm prune
```

### 5. 遅延ロード（Code Splitting）

```typescript
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

---

## トラブルシューティング

### ビルドエラー

#### TypeScriptエラー

```bash
# 型チェック
npx tsc --noEmit

# エラー詳細を確認
npx tsc --noEmit --pretty
```

#### ESLintエラー

```bash
# ESLintチェック
npm run lint

# 自動修正
npm run lint -- --fix
```

### テストエラー

```bash
# テストの詳細ログ
npm run test:run -- --reporter=verbose

# 特定のテストファイルのみ実行
npm run test:run -- csvParser.test.ts
```

### 開発サーバーの問題

#### ポート3247が使用中

```bash
# プロセスを確認
lsof -i :3247

# プロセスをキル
kill -9 <PID>
```

#### HMRが動作しない

```bash
# node_modules とキャッシュを削除
rm -rf node_modules dist .vite
npm install
npm run dev
```

### IndexedDBの問題

#### データが保存されない

1. ブラウザのプライベートモードを無効化
2. ストレージ容量を確認
3. IndexedDBをクリア: Chrome DevTools → Application → Clear storage

### パフォーマンスの問題

#### ビルドが遅い

```bash
# Viteの設定を確認（vite.config.ts）
# esbuildの最適化オプションを調整
```

#### 実行時パフォーマンスが悪い

1. React DevTools の Profiler で確認
2. 不要な再レンダリングを特定
3. `React.memo`、`useMemo`、`useCallback` を使用

---

## 参考リンク

### 公式ドキュメント

- [React 18](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Vite](https://vitejs.dev/)
- [MUI v7](https://mui.com/material-ui/getting-started/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [PapaParse](https://www.papaparse.com/docs)
- [TanStack Table](https://tanstack.com/table/v8)
- [Recharts](https://recharts.org/en-US/)
- [SheetJS](https://docs.sheetjs.com/)
- [Vitest](https://vitest.dev/)
- [Vercel](https://vercel.com/docs)

### プロジェクト内ドキュメント

- [要件定義書](./requirements.md)
- [デプロイガイド](./DEPLOYMENT.md)
- [ユーザーマニュアル](./USER_MANUAL.md)
- [進捗管理](./SCOPE_PROGRESS.md)
- [プロジェクト設定](../CLAUDE.md)

---

**最終更新日**: 2025-12-02
**バージョン**: 2.1
**ドキュメントバージョン**: 1.0
