# Azure Data Collector Frontend

React + TypeScript + Material-UI を使用したモダンなWebアプリケーション

## 機能

- **認証**: Azure Entra ID マルチテナント認証
- **ダッシュボード**: Azure利用状況の可視化
- **リソース管理**: Azureリソースの一覧・詳細表示
- **コスト分析**: 時系列・サービス別コスト分析
- **アラート**: コスト・リソース異常の通知
- **設定**: テナント管理・ユーザー設定

## 技術スタック

- **React 18** - UIライブラリ
- **TypeScript** - 型安全性
- **Vite** - 高速ビルドツール
- **Material-UI (MUI)** - UIコンポーネント
- **React Router** - ルーティング
- **React Query** - サーバーステート管理
- **Chart.js / Recharts** - データ可視化
- **Azure MSAL** - Azure認証
- **Firebase SDK** - バックエンド連携

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env.development` にコピーして設定：

```bash
cp .env.example .env
```

必要な環境変数：
- `VITE_AZURE_CLIENT_ID`: Azure Entra ID アプリのクライアントID
- `VITE_FIREBASE_*`: Firebase プロジェクトの設定値

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセス

## スクリプト

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# プレビューサーバー
npm run preview

# 型チェック
npm run type-check

# Lint実行
npm run lint

# Lint修正
npm run lint:fix
```

## プロジェクト構造

```
src/
├── components/           # 再利用可能なコンポーネント
│   ├── Layout/          # レイアウトコンポーネント
│   ├── Charts/          # グラフ・可視化
│   ├── DataTable/       # データテーブル
│   ├── Loading/         # ローディング表示
│   └── Auth/            # 認証関連
├── pages/               # ページコンポーネント
│   ├── Dashboard/       # ダッシュボード
│   ├── Resources/       # リソース管理
│   ├── Costs/           # コスト分析
│   ├── Settings/        # 設定
│   └── Login/           # ログイン
├── hooks/               # カスタムHooks
├── services/            # API通信サービス
├── stores/              # Zustand状態管理
├── utils/               # ユーティリティ関数
├── types/               # TypeScript型定義
└── config/              # 設定ファイル
    ├── firebase.ts      # Firebase設定
    └── authConfig.ts    # Azure認証設定
```

## 主要コンポーネント

### Authentication (認証)
- Azure Entra ID によるシングルサインオン
- マルチテナント対応
- トークン自動更新

### Dashboard (ダッシュボード)
- リアルタイムコスト表示
- リソース使用状況サマリー
- アラート・通知一覧

### Resources (リソース管理)
- Azure リソースの一覧表示
- フィルタリング・検索機能
- リソース詳細情報

### Costs (コスト分析)
- 時系列コストグラフ
- サービス別コスト分析
- 予算アラート設定

### Settings (設定)
- テナント追加・削除
- ユーザープロフィール管理
- 通知設定

## 開発ガイドライン

### コーディングスタイル
- ESLint + Prettier による自動フォーマット
- TypeScript strict mode
- 関数型コンポーネント + Hooks
- Material-UI コンポーネントの活用

### 状態管理
- **ローカル状態**: React useState/useReducer
- **グローバル状態**: Zustand
- **サーバー状態**: React Query
- **フォーム状態**: React Hook Form

### エラーハンドリング
- Error Boundary による例外キャッチ
- ユーザーフレンドリーなエラーメッセージ
- ログ記録とエラー報告

## ビルド・デプロイ

### 本番ビルド
```bash
npm run build
```

### Firebase Hosting デプロイ
```bash
firebase deploy --only hosting
```

## テスト

```bash
# 単体テスト実行
npm test

# カバレッジレポート生成
npm run test:coverage

# E2Eテスト実行
npm run test:e2e
```

## トラブルシューティング

### よくある問題

1. **認証エラー**
   - Azure アプリ登録の設定確認
   - リダイレクトURIの設定確認

2. **ビルドエラー**
   - Node.js バージョン確認 (18+)
   - 依存関係の再インストール: `rm -rf node_modules && npm install`

3. **開発サーバーエラー**
   - ポート3000の使用状況確認
   - 環境変数の設定確認

### ログの確認方法
- ブラウザ開発者ツール > Console
- Network タブでAPI通信確認
- Firebase デバッガーでFirestore通信確認

## パフォーマンス最適化

- **Code Splitting**: React.lazy による遅延読み込み
- **Memoization**: React.memo, useMemo, useCallback
- **Bundle Analysis**: `npm run build:analyze`
- **Image Optimization**: WebP形式の使用
- **Caching**: Service Worker による静的リソースキャッシュ
