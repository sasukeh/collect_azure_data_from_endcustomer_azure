# セットアップガイド

Azure Data Collector の詳細なセットアップ手順を説明します。

## 📋 前提条件

### 開発環境

- **Node.js**: 18.0.0 以上
- **Python**: 3.9 以上
- **Git**: 最新版
- **VS Code**: 推奨エディタ

### Azureアカウント

- **Azure サブスクリプション**: 有効なサブスクリプション
- **Global Administrator権限**: 管理者同意の実行用
- **Developer権限**: Azure AD アプリケーション登録用

### Firebaseアカウント

- **Googleアカウント**: Firebase プロジェクト作成用
- **Firebase CLI**: インストール必須

## 🔧 1. 開発環境セットアップ

### Node.js インストール

```bash
# Node.js バージョン確認
node --version

# 18.0.0 未満の場合は最新版をインストール
# macOS (Homebrew)
brew install node

# Windows (chocolatey)
choco install nodejs

# Linux (Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Python環境セットアップ

```bash
# Python バージョン確認
python3 --version

# 仮想環境作成
python3 -m venv venv

# 仮想環境アクティベート
# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### Firebase CLI インストール

```bash
# Firebase CLI インストール
npm install -g firebase-tools

# ログイン
firebase login

# プロジェクト確認
firebase projects:list
```

## 🏗️ 2. プロジェクトクローン・初期設定

### リポジトリクローン

```bash
# リポジトリクローン
git clone <repository-url>
cd collect_azure_data_from_endcustomer

# ブランチ確認
git branch -a

# 開発ブランチに切り替え（必要に応じて）
git checkout develop
```

### フロントエンド設定

```bash
# フロントエンドディレクトリに移動
cd frontend

# 依存関係インストール
npm install

# 環境変数ファイル作成
cp .env.example .env.local

# .env.local を編集
nano .env.local
```

**`.env.local` サンプル:**

```env
# Azure AD アプリケーション設定
VITE_AZURE_CLIENT_ID=7a6d794f-1aff-48c4-926c-f96d757247b1
VITE_AZURE_TENANT_ID=768832c1-aa1c-4716-9446-eb7174bb8f4c

# Firebase 設定
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id

# 開発環境設定
VITE_ENVIRONMENT=development
VITE_DEBUG_MODE=true
```

### バックエンド設定

```bash
# バックエンドディレクトリに移動
cd ../backend

# Python依存関係インストール
pip install -r requirements.txt

# 環境変数ファイル作成
cp .env.example .env

# .env を編集
nano .env
```

**`.env` サンプル:**

```env
# Azure Service Principal
AZURE_CLIENT_ID=your-service-principal-client-id
AZURE_CLIENT_SECRET=your-service-principal-secret
AZURE_TENANT_ID=your-tenant-id

# Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json

# 開発環境設定
PYTHON_ENV=development
DEBUG=true
```

## 🔑 3. Azure AD アプリケーション設定

### アプリケーション登録

1. **Azure Portal** にアクセス: <https://portal.azure.com>

2. **Azure Active Directory** > **アプリの登録** > **新規登録**

3. **基本情報入力:**

   - **名前**: `Azure Data Collector`
   - **サポートされているアカウントの種類**: `任意の組織ディレクトリ内のアカウント (任意の Azure AD ディレクトリ - マルチテナント)`
   - **リダイレクトURI**: `Web` - `http://localhost:3000`

4. **登録** ボタンをクリック

### API アクセス許可設定

1. **APIのアクセス許可** > **アクセス許可の追加**

2. **Microsoft Graph** を選択

3. **委任されたアクセス許可** で以下を追加:

   - `User.Read`
   - `Directory.Read.All`
   - `Organization.Read.All`

4. **Azure Service Management** を選択

5. **委任されたアクセス許可** で以下を追加:

   - `user_impersonation`

6. **管理者の同意を与える** をクリック

### 認証設定

1. **認証** メニューを選択

2. **詳細設定** で以下を有効化:

   - **パブリック クライアント フローを許可する**: `はい`
   - **ID トークン**: `はい`
   - **アクセス トークン**: `はい`

3. **暗黙的な許可とハイブリッド フロー**:

   - **アクセス トークン**: チェック
   - **ID トークン**: チェック

### Service Principal 作成

バックエンド用のService Principalを作成します。

```bash
# Azure CLI でログイン
az login

# Service Principal 作成
az ad sp create-for-rbac --name "Azure-Data-Collector-Backend" --role contributor

# 出力例（実際の値をメモ）
{
  "appId": "12345678-1234-1234-1234-123456789012",
  "displayName": "Azure-Data-Collector-Backend",
  "password": "your-secret-password",
  "tenant": "87654321-4321-4321-4321-210987654321"
}
```

## 🔥 4. Firebase プロジェクト設定

### プロジェクト作成

1. **Firebase Console** にアクセス: <https://console.firebase.google.com>

2. **プロジェクトを追加** をクリック

3. **プロジェクト名**: `azure-data-collector`

4. **Google Analytics**: 有効化（推奨）

5. **プロジェクトを作成**

### Firestore設定

1. **Firestore Database** > **データベースの作成**

2. **セキュリティルールで開始** を選択

3. **ロケーション**: `asia-northeast1` (東京リージョン)

4. **完了**

### Authentication設定

1. **Authentication** > **Sign-in method**

2. **カスタム** を有効化

3. **保存**

### Functions設定

1. **Functions** > **使用を開始する**

2. **Blaze プラン** にアップグレード（必要に応じて）

### Firebase設定ファイル取得

```bash
# Firebase プロジェクト初期化
firebase init

# 選択項目:
# - Functions: Y
# - Firestore: Y  
# - Hosting: Y

# Functions言語選択: Python

# 設定ファイル取得
firebase setup:web

# サービスアカウントキー取得
# Firebase Console > プロジェクト設定 > サービスアカウント > 新しい秘密鍵の生成
```

## 🚀 5. アプリケーション起動

### フロントエンド起動

```bash
# フロントエンドディレクトリに移動
cd frontend

# 開発サーバー起動
npm run dev

# ブラウザで確認
# http://localhost:3000
```

### バックエンド起動

```bash
# バックエンドディレクトリに移動
cd backend

# Firebase Emulator起動
firebase emulators:start

# 確認
# Functions: http://localhost:5001
# Firestore: http://localhost:8080
# Firebase UI: http://localhost:4000
```

## 🔍 6. 動作確認

### フロントエンド確認

1. **ブラウザアクセス**: <http://localhost:3000>

2. **ログインテスト**:

   - `ログイン` ボタンをクリック
   - Azure AD 認証画面が表示される
   - 正常にログインできることを確認

3. **ダッシュボード確認**:

   - ログイン後、ダッシュボードが表示される
   - エラーが発生していないか確認

### バックエンド確認

1. **Functions確認**:

   ```bash
   # Functions一覧表示
   firebase functions:list
   
   # ログ確認
   firebase functions:log
   ```

2. **Firestore確認**:

   - Firebase Console > Firestore
   - データが正常に保存されているか確認

### API統合確認

1. **Azure Management API**:

   ```bash
   # Azure CLI でテスト
   az account list
   az resource list
   ```

2. **Microsoft Graph API**:

   ```bash
   # Graph Explorer でテスト
   # https://developer.microsoft.com/en-us/graph/graph-explorer
   ```

## 🛠️ 7. トラブルシューティング

### よくある問題

#### CORS エラー

```javascript
// vite.config.ts でプロキシ設定
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
});
```

#### MSAL認証エラー

```typescript
// authConfig.ts の設定確認
export const msalConfig = {
  auth: {
    clientId: process.env.VITE_AZURE_CLIENT_ID!,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin,
  }
};
```

#### Firebase接続エラー

```bash
# Firebase プロジェクト確認
firebase use --list

# 正しいプロジェクトに切り替え
firebase use <project-id>
```

### ログ確認方法

```bash
# フロントエンドログ
# ブラウザ開発者ツール > Console

# バックエンドログ
firebase functions:log

# Firebase Emulatorログ
# http://localhost:4000 > Logs タブ
```

## 📝 次のステップ

セットアップが完了したら、以下のドキュメントを参照してください：

- [開発ガイド](./development.md)
- [認証フロー詳細](./authentication.md)
- [API仕様](./api.md)
- [デプロイメント](./deployment.md)
- [トラブルシューティング](./troubleshooting.md)
