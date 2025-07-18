# Azure Migration Deployment Guide

## 🎯 デプロイメント情報

## Azure Active Directory アプリケーション設定

### 必要な設定
- **Client ID**: `YOUR_AZURE_CLIENT_ID`
- **Tenant ID**: `YOUR_AZURE_TENANT_ID`
- **デプロイメントテナント**: `16b3c013-d300-468d-ac64-7eda0820b6d3`

### Azureリソース
- **Static Web Apps**: https://blue-sky-072b04900.1.azurestaticapps.net
- **Azure Functions**: https://azure-data-collector-functions.azurewebsites.net
- **Cosmos DB**: https://azure-data-collector-cosmos.documents.azure.com:443/

## 🔧 必要なEntra ID設定

### 1. App Registrationの構成

Azure Portal → Entra ID → App Registrations → [アプリケーション] で以下を設定：

#### Redirect URIs
- **Production**: `https://blue-sky-072b04900.1.azurestaticapps.net`
- **Development**: `http://localhost:5173`

#### API権限
以下の権限を追加・管理者同意が必要：
- `https://management.azure.com/user_impersonation`
- `Microsoft Graph`: `User.Read`
- `Microsoft Graph`: `Directory.Read.All` (管理者同意必要)

#### 認証設定
- **Public client flows**: 有効化
- **Access tokens**: 有効化  
- **ID tokens**: 有効化

### 2. テナント管理者の同意

管理者同意URL:
```
https://login.microsoftonline.com/1d6a8635-6904-4cbf-bedd-c849732cbb39/adminconsent?client_id=7a6d794f-1aff-48c4-926c-f96d757247b1
```

## 🚀 デプロイメントコマンド

### 本番環境デプロイ
```bash
cd frontend
npm run build
cp staticwebapp.config.json dist/
npx @azure/static-web-apps-cli deploy dist/ --deployment-token [TOKEN] --env production
```

### 開発環境デプロイ
```bash
cd frontend
npm run dev
```

## 🔍 動作確認チェックリスト

- [ ] Static Web Apps が正常に表示される
- [ ] ログイン機能が動作する
- [ ] Azure Functions API との連携が動作する
- [ ] Cosmos DB からのデータ取得が動作する
- [ ] 管理者権限によるAzureリソースアクセスが動作する

## 📝 設定ファイル

### Frontend Environment Variables
- `.env.production`: 本番環境用設定
- `.env.development`: 開発環境用設定
- `staticwebapp.config.json`: SWA ルーティング・MIME設定

### Backend Configuration
- Azure Functions: 環境変数でCosmos DB接続情報設定済み
- Cosmos DB: Serverless設定でコスト最適化済み

## 🔐 セキュリティ考慮事項

1. **HTTPS必須**: 本番環境は必ずHTTPS
2. **CORS設定**: Azure Functions にて適切なCORS設定
3. **認証フロー**: PKCE対応のOAuth2.0フロー使用
4. **トークン管理**: セッションストレージにて適切に管理

## 📊 モニタリング

- Azure Monitor: リソース使用状況監視
- Application Insights: アプリケーションパフォーマンス監視
- Cosmos DB Metrics: データベースパフォーマンス監視
