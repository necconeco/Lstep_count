# Lステップ集計ツール

月1回の集計作業を **60分→3分** に短縮する、Lステップ用の集計ツールです。

## 🎯 主な機能

- **CSVアップロード**: ドラッグ&ドロップ対応
- **自動集計**: 申込数、実施数、キャンセル数、実施率を自動計算
- **初回/2回目判定**: 履歴マスタを使用して自動判定
- **要確認リスト**: 3パターンの要確認レコードを自動検出
- **相談員別実績**: 担当者ごとの実績を集計
- **グラフ表示**: 日別推移・月別実績を視覚化
- **スプレッドシート出力**: AB~AM列への自動転記（Excel形式）
- **履歴管理**: IndexedDBによる過去の集計データ保存

## 🚀 クイックスタート

### 前提条件

- Node.js 18以上
- npm 9以上

### インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd Lstep集計ツール

# 依存パッケージのインストール
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3247 にアクセス

### ビルド

```bash
npm run build
```

## 📊 使い方

1. **CSVアップロード**: LステップからエクスポートしたCSVファイルをアップロード
2. **自動集計**: 集計結果が自動的に表示されます
3. **スプレッドシート出力**: 「スプレッドシート出力」ボタンでExcelファイルをダウンロード
4. **履歴確認**: 過去の集計結果を「集計履歴」セクションで確認

## 🧪 テスト

```bash
# テストの実行（インタラクティブモード）
npm test

# テストの実行（CI用）
npm run test:run

# カバレッジレポート
npm run test:coverage

# UIダッシュボード
npm run test:ui
```

## 🏗️ 技術スタック

- **フロントエンド**: React 18 + TypeScript 5
- **ビルドツール**: Vite 5
- **UIライブラリ**: MUI v7
- **状態管理**: Zustand 5
- **CSV処理**: PapaParse 5
- **データ表示**: TanStack Table 8 + Recharts 3
- **スプレッドシート生成**: SheetJS (xlsx)
- **データ保存**: IndexedDB
- **テスト**: Vitest 4 + React Testing Library

## 📁 プロジェクト構造

```
Lstep集計ツール/
├── docs/                      # ドキュメント
│   ├── requirements.md        # 要件定義書
│   └── SCOPE_PROGRESS.md      # 進捗管理
├── src/
│   ├── components/            # Reactコンポーネント
│   │   ├── CsvUploader.tsx
│   │   ├── SummaryCard.tsx
│   │   ├── StaffTable.tsx
│   │   ├── DailyChart.tsx
│   │   ├── MonthlyChart.tsx
│   │   ├── ReviewList.tsx
│   │   ├── CancellationList.tsx
│   │   └── HistoryView.tsx
│   ├── utils/                 # ユーティリティ関数
│   │   ├── csvParser.ts
│   │   ├── dataAggregator.ts
│   │   ├── reviewDetector.ts
│   │   ├── spreadsheetGenerator.ts
│   │   ├── masterDataManager.ts
│   │   └── aggregationHistoryManager.ts
│   ├── store/                 # Zustand状態管理
│   │   ├── csvStore.ts
│   │   ├── masterStore.ts
│   │   ├── aggregationStore.ts
│   │   └── reviewStore.ts
│   ├── types/                 # 型定義
│   │   └── index.ts
│   ├── test/                  # テスト設定
│   │   └── setup.ts
│   ├── App.tsx                # メインアプリ
│   └── main.tsx               # エントリーポイント
├── .eslintrc.cjs              # ESLint設定
├── .prettierrc                # Prettier設定
├── vitest.config.ts           # Vitest設定
├── vercel.json                # Vercel設定
└── package.json
```

## 🌐 デプロイ

### Vercelへのデプロイ（推奨）

#### 方法1: Vercel CLI

```bash
# Vercel CLIのインストール
npm i -g vercel

# ログイン
vercel login

# デプロイ
vercel

# 本番環境へデプロイ
vercel --prod
```

#### 方法2: GitHub連携

1. GitHubリポジトリにpush
2. [Vercel](https://vercel.com)にアクセス
3. 「Import Project」からGitHubリポジトリを選択
4. 自動的にビルド・デプロイが開始されます

### 環境変数

このプロジェクトは環境変数を使用しません（すべてブラウザ内で完結）

## 📝 主要な集計ロジック

### 実施判定

```typescript
実施 = ステータス === '予約済み' AND 来店/来場 === '済み'
```

### 初回/2回目判定

- 履歴マスタを参照して実施回数をカウント
- 0回 → 初回
- 1回 → 2回目
- 2回以上 → 3回目以降

### 要確認リスト（3パターン）

1. **パターン1（データ不整合）**: ステータス="キャンセル済み" AND 来店/来場="済み"
2. **パターン2（未来店）**: ステータス="予約済み" AND 来店/来場="なし"
3. **パターン3（通常キャンセル）**: ステータス="キャンセル済み" AND 来店/来場="なし"

## 🔒 データプライバシー

- すべてのデータはブラウザ内で処理
- 外部サーバーへの送信なし
- IndexedDBでローカル保存
- 完全にオフラインで動作可能

## 📄 ライセンス

Private（個人利用）

## 🤝 コントリビューション

このプロジェクトは個人利用を目的としています。

## 📞 サポート

質問や問題がある場合は、Issueを作成してください。

---

**バージョン**: 2.1
**最終更新**: 2025-12-01
**開発状況**: Phase 8（デプロイ）完了
