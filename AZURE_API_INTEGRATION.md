# Azure API統合ガイド

## 概要

現在、アプリケーションはモックデータを削除し、実際のAzure APIからデータを収集するように変更されました。実際のAzureデータを取得するには、以下の設定が必要です。

## 必要な設定

### 1. Azure App Registrationの設定

Azure Portal (https://portal.azure.com) で以下を設定してください：

#### アプリケーション登録
1. Azure Active Directory → App registrations → New registration
2. アプリケーション名: "Azure Data Collector"
3. Supported account types: "Accounts in this organizational directory only"
4. Redirect URI: Web - `https://azure-data-collector-202507.web.app/`

#### API権限の追加
以下のMicrosoft Graph APIとAzure Management API権限を追加：

**Microsoft Graph**:
- `User.Read` (Delegated)
- `Directory.Read.All` (Application) - 管理者同意必要

**Azure Service Management**:
- `user_impersonation` (Delegated)

**Azure Resource Manager**:
- `user_impersonation` (Delegated)

#### Client Secretの作成
1. Certificates & secrets → New client secret
2. Description: "Azure Data Collector Secret"
3. Expires: 24 months
4. 作成後、Valueをコピーして安全に保存

### 2. Azure RBACの設定

データを収集したいAzureサブスクリプションで、以下のロールを割り当て：

1. **Reader** ロール - リソース情報の読み取り用
2. **Cost Management Reader** ロール - コスト データの読み取り用

### 3. 環境変数の設定

以下の情報をアプリケーションで使用：

```
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>
```

## 実装されている機能

### バックエンド (main.py)

#### 1. `collect_azure_data` 関数
- 現在：実際のAzure API統合が未実装のメッセージを返す
- 用途：既存のモックデータ収集エンドポイント

#### 2. `collect_real_azure_data` 関数 (新規追加)
- 実際のAzure APIを使用してデータ収集
- 必要なパラメータ：userId, tenantId, clientId, clientSecret
- 収集データ：subscriptions, resources, costs

#### 3. AzureDataCollectorクラス
- Azure SDK for Pythonを使用
- ResourceManagementClient - リソース情報取得
- CostManagementClient - コスト情報取得
- SubscriptionClient - サブスクリプション情報取得

### フロントエンド

#### 1. CostAnalysisPage
- 実際のFirestoreデータからコスト分析を表示
- データがない場合の適切なメッセージ表示
- 過去のコストトレンド分析
- サービス別コスト内訳
- 将来のコスト予測（線形回帰ベース）
- 無駄リソースの検出と最適化提案

#### 2. DashboardPage
- データがない場合の警告メッセージ
- 実際のAPI統合が必要な旨の説明

## データフロー

1. **認証**: Azure ADでユーザー認証
2. **権限確認**: 必要なAPI権限の確認
3. **データ収集**: `collect_real_azure_data`エンドポイント呼び出し
4. **保存**: Firestoreにデータ保存
5. **表示**: リアルタイムでUI更新

## セキュリティ考慮事項

1. **Client Secret管理**
   - 本番環境では環境変数またはKey Vaultに保存
   - フロントエンドには絶対に露出しない

2. **アクセス制御**
   - 最小権限の原則に従ったRBAC設定
   - 必要最小限のAPI権限のみ付与

3. **データ暗号化**
   - Firestore転送時・保存時暗号化
   - 機密情報のマスキング

## 次のステップ

### 1. Azure App Registrationの完了
- Portal上で権限設定とclient secret作成

### 2. バックエンドの更新
- 環境変数での認証情報管理
- プロダクション環境でのsecret管理

### 3. フロントエンドの更新
- Azure資格情報入力UI
- リアルタイムデータ収集状況表示

### 4. テスト
- 開発環境での実際のAzure API呼び出しテスト
- エラーハンドリングの検証

## トラブルシューティング

### よくある問題

1. **認証エラー**
   - tenant_id, client_id, client_secretの確認
   - App registrationの設定確認

2. **権限エラー**
   - 管理者同意の実行
   - RBAC権限の確認

3. **コストデータが取得できない**
   - Cost Management Readerロールの確認
   - サブスクリプションアクセス権の確認

## 参考リンク

- [Azure SDK for Python](https://docs.microsoft.com/en-us/azure/developer/python/)
- [Azure Cost Management API](https://docs.microsoft.com/en-us/rest/api/cost-management/)
- [Azure Resource Manager API](https://docs.microsoft.com/en-us/rest/api/resources/)
