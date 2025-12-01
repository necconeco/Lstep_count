# プロジェクト設定

**最終更新**: 2025-12-01
**バージョン**: 2.1（実CSV構造対応版）

## 基本設定
```yaml
プロジェクト名: Lステップ集計ツール
開始日: 2025-11-30
バージョン: 2.1
技術スタック:
  frontend: React 18 + TypeScript 5 + Vite 5 + MUI v6
  backend: なし（フロントエンドのみで完結）
  database: IndexedDB（ブラウザ内蔵）
```

## 開発環境
```yaml
ポート設定:
  # 複数プロジェクト並行開発のため、一般的でないポートを使用
  frontend: 3247
  backend: 不要
  database: 不要（IndexedDB使用）

環境変数:
  設定ファイル: .env.local（ルートディレクトリ）
  必須項目:
    # このプロジェクトでは外部APIを使用しないため、環境変数は不要
```

## テスト認証情報
```yaml
# このプロジェクトは認証機能がないため、テスト認証情報は不要

外部サービス:
  Vercel: オプション（ホスティング用、無料プラン）
```

## コーディング規約

### 命名規則
```yaml
ファイル名:
  - コンポーネント: PascalCase.tsx (例: CsvUploader.tsx, MasterDataManager.tsx, ReviewList.tsx)
  - ユーティリティ: camelCase.ts (例: csvParser.ts, masterManager.ts, reviewDetector.ts)
  - 定数: UPPER_SNAKE_CASE.ts (例: STATUS_MAPPING.ts, CONFIG.ts)
  - 型定義: types.ts または index.ts（types/フォルダ内）

変数・関数:
  - 変数: camelCase (例: csvData, masterData, reviewList)
  - 関数: camelCase (例: parseCSV, updateMaster, detectReviewNeeded)
  - 定数: UPPER_SNAKE_CASE (例: MAX_FILE_SIZE, IMPLEMENTED_STATUS, VISITED_STATUS)
  - 型/インターフェース: PascalCase (例: CsvRecord, UserHistoryMaster, ReviewPattern)
```

### コード品質
```yaml
必須ルール:
  - TypeScript: strictモード有効
  - 未使用の変数/import禁止
  - console.log本番環境禁止（console.warn, console.errorは許可）
  - エラーハンドリング必須
  - 関数行数: 100行以下（96.7%カバー）
  - ファイル行数: 700行以下（96.9%カバー）
  - 複雑度: 10以下
  - 行長: 120文字

フォーマット:
  - インデント: スペース2つ
  - セミコロン: あり
  - クォート: シングル
  - Prettier設定に準拠（.prettierrc参照）
```

## プロジェクト固有ルール

### CSV処理
```yaml
パーサー:
  - PapaParse使用
  - 文字コード: UTF-8（BOM付きも対応）
  - ヘッダー行: 自動認識
  - エラーハンドリング: 必須（不正なCSV形式の警告）

データ集計:
  - 自前実装（シンプルなロジックで実装）
  - Danfo.jsは不使用（依存関係を最小化）
  - Array.prototype.reduce、filter、mapなどの標準メソッドを活用
  - 必要に応じてgroupByなどのヘルパー関数を自作

バリデーション:
  - 必須カラムの存在確認（友だちID、予約日、ステータス、来店/来場、名前、申込日時）
  - ファイルサイズ制限: 10MB
  - MIME type確認: text/csv
```

### 型定義
```yaml
配置:
  frontend: src/types/index.ts

主要な型:
  - CsvRecord: CSVの1レコードを表す型
  - UserHistoryMaster: マスターデータ（履歴テーブル）を表す型
  - AggregationResult: 集計結果を表す型
  - DailyResult: 日別集計を表す型
  - SpreadsheetOutput: スプレッドシート出力用データを表す型
  - ReviewPattern: 要確認リストのパターンを表す型（パターン1、2、3）
  - CancellationRecord: キャンセル一覧のレコードを表す型
  - StaffResult: 相談員別実績を表す型（オプション）
```

### 状態管理
```yaml
ライブラリ: Zustand

ストア構成:
  - csvStore: CSVデータの管理
  - masterStore: マスターデータの管理（必須）
  - aggregationStore: 集計結果の管理
  - reviewStore: 要確認リスト・キャンセル一覧の管理（新規追加）
  - historyStore: 過去の集計結果の管理（IndexedDB連携、オプション）

命名規則:
  - ストアファイル: src/store/xxxStore.ts
  - アクション: 動詞で開始（例: setCsvData, updateMaster, loadMasterFromDB, setReviewList）
```

### データ表示
```yaml
テーブル: TanStack Table
  - ソート機能必須
  - ページング推奨（大量データ対応）
  - カスタムカラム定義

グラフ: Recharts（オプション）
  - レスポンシブ設定必須
  - アクセシビリティ考慮（aria-label設定）
  - 色はMUIテーマカラーを使用
```

### レポート生成
```yaml
Excel出力: SheetJS (xlsx)
  - ファイル名: 日別データ_YYYY年MM月_YYYYMMDD.xlsx
  - シート構成: AB～AM列のデータ
  - セルスタイル: ヘッダー太字、数値右寄せ

CSV出力: 自前実装
  - ファイル名: 日別データ_YYYY年MM月_YYYYMMDD.csv
  - AB～AM列のデータのみ
  - 1日 = 1行 + TTL行（月次合計）

要確認リスト出力: Excel/CSV
  - ファイル名: 要確認リスト_YYYY年MM月_YYYYMMDD.xlsx/csv
  - パターンごとにシート/ファイルを分ける

キャンセル一覧出力: Excel/CSV
  - ファイル名: キャンセル一覧_YYYY年MM月_YYYYMMDD.xlsx/csv

PDF出力: 不要
  - スプレッドシート出力のみで十分
```

### エラーハンドリング
```yaml
必須項目:
  - CSVパースエラー: ユーザーフレンドリーなメッセージ表示
  - ファイルサイズ超過: 警告表示
  - 必須カラム不足: 不足カラム名を表示（特に「来店/来場」列）
  - IndexedDBエラー: フォールバック処理
  - マスターデータ未生成エラー: 初回セットアップへ誘導

ログレベル:
  - console.error: 致命的エラー
  - console.warn: 警告（処理は継続可能）
  - console.log: 本番環境では使用禁止
```

## 🆕 最新技術情報（知識カットオフ対応）

```yaml
# Web検索で解決した破壊的変更を記録

React 19:
  - 2024年12月リリース
  - use() APIの追加
  - Server Componentsの安定版
  - 注意: まだ安定版ではないため、React 18を使用

PapaParse:
  - 最新版: 5.4.1（2024年）
  - Worker Thread対応強化
  - 破壊的変更なし

MUI v6:
  - 2024年リリース
  - デザイントークン刷新
  - アクセシビリティ強化

TanStack Table v8:
  - 最新版: 8.10.x（2024年）
  - ヘッドレスUI、フレームワーク非依存
  - 破壊的変更: v7からのマイグレーション必要

Recharts:
  - 最新版: 2.10.x（2024年）
  - TypeScript型サポート強化
  - React 18対応

IndexedDB:
  - ブラウザAPIのため、バージョンなし
  - 全モダンブラウザで安定サポート
```

## プロジェクト構造

```
Lstep集計ツール/
├── docs/
│   ├── requirements.md         # 要件定義書 v2.1
│   └── SCOPE_PROGRESS.md       # 進捗管理
├── src/
│   ├── components/             # Reactコンポーネント
│   │   ├── MasterDataManager.tsx  # マスターデータ管理コンポーネント
│   │   ├── CsvUploader.tsx     # CSVアップロードコンポーネント
│   │   ├── SummaryCard.tsx     # サマリーカード
│   │   ├── ReviewList.tsx      # 要確認リスト（新規）
│   │   ├── CancellationList.tsx # キャンセル一覧（新規）
│   │   ├── SpreadsheetOutput.tsx  # スプシ出力コンポーネント
│   │   ├── StaffTable.tsx      # 相談員別実績テーブル（オプション）
│   │   └── HistoryView.tsx     # 履歴表示（オプション）
│   ├── utils/                  # ユーティリティ関数
│   │   ├── csvParser.ts        # CSVパース処理
│   │   ├── masterManager.ts    # マスターデータ管理
│   │   ├── dataAggregator.ts   # データ集計処理
│   │   ├── reviewDetector.ts   # 要確認リスト検出（新規）
│   │   ├── spreadsheetGenerator.ts  # スプシ出力データ生成
│   │   └── excelGenerator.ts   # Excel生成
│   ├── store/                  # Zustand状態管理
│   │   ├── csvStore.ts
│   │   ├── masterStore.ts      # マスターデータ管理
│   │   ├── aggregationStore.ts
│   │   ├── reviewStore.ts      # 要確認リスト・キャンセル一覧管理（新規）
│   │   └── historyStore.ts     # オプション
│   ├── types/                  # 型定義
│   │   └── index.ts
│   ├── config/                 # 設定ファイル
│   │   └── statusMapping.ts    # ステータスマッピング
│   ├── db/                     # IndexedDB管理
│   │   └── indexedDBManager.ts # IndexedDBラッパー
│   ├── App.tsx                 # メインアプリケーション
│   └── main.tsx                # エントリーポイント
├── .eslintrc.cjs               # ESLint設定
├── .prettierrc                 # Prettier設定
├── CLAUDE.md                   # このファイル
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 開発フロー

### 1. 環境構築
```bash
# Node.js 18以上が必要
npm create vite@latest . -- --template react-ts
npm install
```

### 2. 開発サーバー起動
```bash
npm run dev
# ポート3247で起動
```

### 3. ビルド
```bash
npm run build
# dist/フォルダに出力
```

### 4. デプロイ（Vercel）
```bash
# Vercel CLIインストール
npm i -g vercel

# デプロイ
vercel
```

## 重要な実装ノート

### CSV列構成（実データ）

**Lステップからダウンロードされる実際のCSV列**:

```typescript
interface CsvRecord {
  予約ID: string;
  友だちID: string;              // 必須、マスターデータの主キー
  メッセージID?: string;
  予約日: string;                // 必須、日別集計のキー
  コース?: string;               // 補助的に使用
  予約枠（担当者名）?: string;  // 相談員別集計に使用
  ステータス: '予約済み' | 'キャンセル済み';  // 必須、2種類のみ
  予約メモ?: string;             // 補助情報
  名前: string;                  // 必須、表示用
  メールアドレス?: string;
  申込日時: string;              // 必須
  相談回数?: string;             // 「初めて」「2回目以上」など、毎回入っているとは限らない
  '来店/来場': '済み' | 'なし';  // 必須、実施判定の最重要列
}
```

**重要な仕様**:
- **ステータスは「予約済み」「キャンセル済み」の2種類のみ**
- **「完了」「前日キャンセル」「当日キャンセル」などの詳細ステータスは存在しない**
- **「来店/来場」列が実施判定の最重要項目**

---

### マスターデータ（履歴テーブル）の管理

**目的**: 初回/2回目以降の判定を精度100%で行うため

**構造**:
```typescript
interface UserHistoryMaster {
  friendId: string;              // 友だちID（主キー）
  implementationCount: number;   // 過去実施回数
  lastImplementationDate: Date | null;  // 最終実施日
  createdAt: Date;               // 作成日時
  updatedAt: Date;               // 更新日時
}
```

**IndexedDBストア**:
- データベース名: `lstep-aggregation-db`
- ストア名: `user-history-master`
- キー: `friendId`
- インデックス: なし（主キーのみ）

**運用フロー**:
1. **初回セットアップ**: 過去CSVを読み込んでマスター生成
2. **通常運用**: 新規CSVを読み込み、マスター参照 → 初回/2回目判定 → マスター更新

**実施回数のカウント対象**:
```typescript
// ステータスが「予約済み」かつ「来店/来場」が「済み」のレコードのみカウント
const isImplemented = (record: CsvRecord) => {
  return record.ステータス === '予約済み' && record['来店/来場'] === '済み';
};
```

---

### 実施判定のロジック

**実施済みの定義**:
```typescript
// ステータスが「予約済み」かつ「来店/来場」が「済み」
const isImplemented = (record: CsvRecord) => {
  return record.ステータス === '予約済み' && record['来店/来場'] === '済み';
};
```

**重要**: ステータスだけでは判定できない。必ず「来店/来場」列も確認する必要がある。

---

### 初回/2回目判定のロジック

**マスターデータ方式**:
```typescript
// 1. マスターデータを取得
const master = await getMasterByFriendId(friendId);

// 2. 初回/2回目判定
if (!master || master.implementationCount === 0) {
  // 初回
  isFirst = true;
} else {
  // 2回目以降
  isFirst = false;
}

// 3. 実施済みの場合、マスター更新
if (isImplemented(record)) {
  await updateMaster(friendId, {
    implementationCount: (master?.implementationCount || 0) + 1,
    lastImplementationDate: new Date(record.予約日),
    updatedAt: new Date()
  });
}
```

**重要**: CSVを予約日順にソートし、1レコードずつ処理する必要がある

---

### 要確認リストの検出ロジック

**3つのパターン**を自動検出:

**パターン1: データ不整合の可能性**
```typescript
const isPattern1 = (record: CsvRecord) => {
  return record.ステータス === 'キャンセル済み' && record['来店/来場'] === '済み';
};
// キャンセルしたはずなのに来店済み → データ入力ミスの可能性
```

**パターン2: 未来店または入力漏れ**
```typescript
const isPattern2 = (record: CsvRecord) => {
  return record.ステータス === '予約済み' && record['来店/来場'] === 'なし';
};
// 予約したが来店していない、または来店情報が未入力 → 確認が必要
```

**パターン3: 正常なキャンセル（念のため確認）**
```typescript
const isPattern3 = (record: CsvRecord) => {
  return record.ステータス === 'キャンセル済み' && record['来店/来場'] === 'なし';
};
// キャンセルして来店していない → 正常だが、念のため確認したい
```

**表示方法**:
- タブまたはセクションで3パターンを分けて表示
- 各パターンの件数を警告/情報として表示
- CSV/Excel形式でダウンロード可能

---

### キャンセル一覧の生成ロジック

**すべてのキャンセル済みレコードを抽出**:
```typescript
const isCancelled = (record: CsvRecord) => {
  return record.ステータス === 'キャンセル済み';
};

// キャンセル一覧 = パターン1 + パターン3
```

**理由**: 現状、キャンセルは一件ずつ目視で確認しているため、一覧で出力できる機能が必須

**注意**: CSV上では前日/当日の区別が取得できないため、まとめて表示

---

### スプレッドシート出力データの生成

**出力対象列**:
```
AB列: 初回予約合計
AC列: 初回予約率（%）
AD列: 初回実施合計
AE列: 初回実施率（%）
AJ列: 2回目以降予約合計
AK列: 2回目以降予約率（%）
AL列: 2回目以降実施合計
AM列: 2回目以降実施率（%）
```

**データ形式**:
- 1日 = 1行
- 予約がない日は0件として表示
- TTL行（月次合計）も生成

**重要な仕様**:
- **申込数・実施数・キャンセル数は内部計算のみ**
- **スプレッドシートにはAB～AM列のみを出力**
- 既存のF～AA列には新しいデータを追加しない

---

### IndexedDBの使用方法

**データベース名**: `lstep-aggregation-db`

**ストア構成**:
1. `user-history-master`: マスターデータ（友だちID単位の履歴）
2. `aggregation-history`: 過去の集計結果（月別、オプション）

**容量制限**: ブラウザごとに異なるが、通常50MB以上

**エラーハンドリング**:
- ブラウザのプライベートモードでは制限あり
- 容量制限を超えた場合は古いデータを削除

---

### CSV処理のパフォーマンス

- 10万行以上の場合は、Web Workerでのバックグラウンド処理を検討
- ストリーミング処理でメモリ使用量を削減
- Array.prototype.reduce、filter、mapなどの標準メソッドを活用

---

### CSV仕様による制約（できないこと）

以下の情報はCSV上では取得できない:

1. **キャンセル日時**: 何日の何時にキャンセルしたか
2. **キャンセル理由**: なぜキャンセルしたか
3. **前日/当日キャンセルの区別**: キャンセル日時が存在しないため判定不可
4. **実施日時**: 完了報告のタイムスタンプ

→ これらは手動確認が必要

---

## トラブルシューティング

### よくある問題

**問題1: CSVが読み込めない**
- 文字コードを確認（UTF-8推奨）
- ファイルサイズを確認（10MB以下）
- 必須カラムの存在を確認（特に「来店/来場」列）

**問題2: マスターデータが生成されていない**
- 初回セットアップが完了しているか確認
- IndexedDBにデータが保存されているか確認
- ブラウザのプライベートモードでは動作しない可能性あり

**問題3: 実施数がおかしい**
- 「来店/来場」列の値を確認（「済み」以外は実施扱いにならない）
- ステータスが「予約済み」であることを確認

**問題4: 要確認リストが大量に表示される**
- パターン2（未来店または入力漏れ）が多い場合、「来店/来場」の入力漏れの可能性
- パターン1（データ不整合）がある場合、データ入力ミスの可能性

**問題5: メモリ不足エラー**
- ファイルサイズが大きすぎる可能性
- チャンク処理またはWeb Workerを検討

**問題6: IndexedDBエラー**
- ブラウザのプライベートモードでは制限あり
- 容量制限を超えている可能性
- 古いデータを削除

---

## テスト方針

### 単体テスト（Vitest）
- CSVパース処理
- マスターデータ管理ロジック
- データ集計ロジック
- 要確認リスト検出（3パターン）
- キャンセル一覧生成

### 統合テスト
- CSVアップロードから集計結果表示まで
- マスターデータの生成・更新
- スプレッドシート出力
- 要確認リスト・キャンセル一覧の生成

### E2Eテスト（Phase 11で検討）
- ユーザーフロー全体のテスト

---

## セキュリティ

### データプライバシー
- すべてのデータはブラウザ内で処理
- 外部サーバーへの送信なし
- IndexedDBは同一オリジンのみアクセス可能

### セキュリティ対策
- CSVインジェクション対策
- XSS対策（React標準のエスケープ）
- ファイルサイズ制限
- MIME typeバリデーション

---

## パフォーマンス目標

```yaml
CSVアップロード: 1秒以内（10万行まで）
マスターデータ生成: 5秒以内（10万行）
集計処理: 3秒以内（10万行）
要確認リスト検出: 1秒以内
スプシ出力データ生成: 1秒以内
ページ読み込み: 1秒以内（初回）
```

---

## アクセシビリティ

```yaml
必須:
  - キーボード操作対応
  - スクリーンリーダー対応（aria-label設定）
  - 色覚バリアフリー（色のみに依存しない）
  - コントラスト比4.5:1以上
```

---

## 変更履歴

- **v2.1 (2025-12-01)**: 実CSV構造対応版、要確認リスト・キャンセル一覧機能追加
- **v2.0 (2025-12-01)**: マスターデータ対応版、スプレッドシート出力仕様の明確化
- **v1.0 (2025-11-30)**: 初版作成
