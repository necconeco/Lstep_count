# デプロイガイド

## 📦 本番環境ビルド

### ビルドコマンド

```bash
npm run build
```

### ビルド成果物

- **出力ディレクトリ**: `dist/`
- **エントリーポイント**: `dist/index.html`
- **アセット**: `dist/assets/`
- **バンドルサイズ**: 1,096KB（gzip: 339KB）

## 🌐 Vercelへのデプロイ

### 方法1: Vercel CLI（推奨）

#### 1. Vercel CLIのインストール

```bash
npm install -g vercel
```

#### 2. Vercelにログイン

```bash
vercel login
```

メールアドレスまたはGitHubアカウントでログインします。

#### 3. プロジェクトのデプロイ

```bash
# プレビューデプロイ
vercel

# 本番環境デプロイ
vercel --prod
```

#### 4. デプロイ設定の確認

初回デプロイ時に以下の質問が表示されます：

- **Set up and deploy "~/Lstep集計ツール"?** → `Y`
- **Which scope do you want to deploy to?** → 自分のアカウントを選択
- **Link to existing project?** → `N`
- **What's your project's name?** → `lstep-aggregation-tool`（デフォルトでOK）
- **In which directory is your code located?** → `./`（デフォルトでOK）
- **Want to override the settings?** → `N`

#### 5. デプロイ完了

デプロイが完了すると、以下のようなURLが表示されます：

```
✅  Production: https://lstep-aggregation-tool.vercel.app
```

### 方法2: GitHub連携（自動デプロイ）

#### 1. GitHubリポジトリの作成

```bash
# GitHubで新しいリポジトリを作成後
git remote add origin https://github.com/yourusername/lstep-aggregation-tool.git
git push -u origin main
```

#### 2. Vercelとの連携

1. [Vercel](https://vercel.com)にアクセス
2. 「Add New」→「Project」をクリック
3. GitHubアカウントを連携
4. リポジトリ「lstep-aggregation-tool」を選択
5. 「Import」をクリック

#### 3. ビルド設定の確認

以下の設定が自動検出されます：

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

#### 4. デプロイ開始

「Deploy」ボタンをクリックすると、自動的にビルド・デプロイが開始されます。

#### 5. 自動デプロイの有効化

今後、`main`ブランチにpushするたびに自動的にデプロイされます。

```bash
git add .
git commit -m "Update feature"
git push origin main
```

## 🔧 ビルド設定

### vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## 🧪 デプロイ前のチェックリスト

- [ ] すべてのテストが通過している (`npm run test:run`)
- [ ] ビルドが成功している (`npm run build`)
- [ ] ローカルプレビューで動作確認 (`npm run preview`)
- [ ] TypeScriptエラーがない (`tsc`)
- [ ] ESLintエラーがない (`npm run lint`)

## 📊 デプロイ後の確認

### 1. 動作確認

- [ ] CSVアップロード機能
- [ ] 集計結果の表示
- [ ] グラフの表示
- [ ] スプレッドシート出力
- [ ] 履歴表示

### 2. パフォーマンス確認

- [ ] Lighthouse スコア（推奨: 90以上）
- [ ] ページ読み込み時間（推奨: 3秒以内）
- [ ] バンドルサイズ（現在: 339KB gzip）

### 3. ブラウザ互換性

- [ ] Chrome（最新版）
- [ ] Firefox（最新版）
- [ ] Safari（最新版）
- [ ] Edge（最新版）

## 🔄 ロールバック

問題が発生した場合、Vercelダッシュボードから以前のデプロイに戻すことができます：

1. [Vercel Dashboard](https://vercel.com/dashboard)にアクセス
2. プロジェクトを選択
3. 「Deployments」タブを開く
4. 正常に動作していたデプロイを選択
5. 「Promote to Production」をクリック

## 🌍 カスタムドメイン

### 独自ドメインの設定

1. Vercelダッシュボードでプロジェクトを開く
2. 「Settings」→「Domains」に移動
3. 「Add Domain」をクリック
4. ドメイン名を入力（例: `lstep.yourdomain.com`）
5. DNSレコードを設定（Vercelが指示を表示）

## 📈 アナリティクス

Vercel Analyticsを有効にすると、以下の情報が確認できます：

- ページビュー数
- ユニークビジター数
- トップページ
- リファラー
- デバイス・ブラウザ情報

## 🔒 セキュリティ

### HTTPSの自動有効化

Vercelは自動的にHTTPSを有効にします：

- Let's Encrypt証明書の自動発行
- 証明書の自動更新
- HTTP→HTTPSの自動リダイレクト

### セキュリティヘッダー

`vercel.json`で以下のヘッダーを設定済み：

- `Cache-Control`: 静的アセットのキャッシュ制御

## 💰 コスト

### Vercel無料プラン

- **帯域幅**: 100GB/月
- **ビルド時間**: 6,000分/月
- **デプロイ数**: 無制限
- **チームメンバー**: 1名

このプロジェクトは無料プランで十分に運用可能です。

## 📞 トラブルシューティング

### ビルドエラー

```bash
# ローカルでビルドを確認
npm run build

# キャッシュをクリア
rm -rf node_modules dist
npm install
npm run build
```

### デプロイエラー

1. Vercelダッシュボードで「Deployments」を確認
2. エラーログを確認
3. ビルドログを確認
4. 必要に応じてロールバック

### パフォーマンス問題

```bash
# バンドルサイズの分析
npm run build -- --analyze

# 不要な依存パッケージの削除
npm prune
```

## 🔗 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Documentation](https://vitejs.dev/guide/build.html)
- [React Deployment](https://react.dev/learn/start-a-new-react-project#deploying-to-production)
