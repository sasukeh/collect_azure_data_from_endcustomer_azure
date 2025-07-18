# Azure Data Collector - 本番環境要件

## 📋 本番環境における基本方針

### 🚫 禁止事項
1. **モックデータの使用禁止**
   - テスト用のダミーデータは本番環境では一切使用しない
   - `collect_azure_data` 関数のモックデータ生成機能は削除する
   - ユーザーの混乱を避けるため、明確に実データのみを扱う

2. **認証情報の要求**
   - 実際のAzure認証情報（tenant_id, client_id, client_secret）が必須
   - 認証情報が不足している場合は明確なエラーメッセージを返す
   - セキュリティを考慮した認証情報の管理

### ✅ 必須要件

#### 1. データ収集の透明性
- 収集されるデータが実際のAzure環境からのものであることを明示
- データソースと収集日時を必ず記録
- 収集に失敗した場合は具体的なエラー情報を提供

#### 2. Azure API連携
- **使用する関数**: `collect_real_azure_data` のみ
- **削除する関数**: `collect_azure_data` (モック用)
- **必要な認証**: Service Principal (App Registration)

#### 3. エラーハンドリング
- Azure API認証エラーの適切な処理
- アクセス権限不足の場合の明確な案内
- ネットワーク接続エラーの対処

#### 4. セキュリティ要件
- 認証情報の暗号化保存
- アクセスログの記録
- 最小権限の原則に基づくAzure権限設定

## 🔧 技術仕様

### Cloud Functions構成
```
✅ collect_real_azure_data     # 実Azure API専用
✅ collect_tenant_data         # テナント別データ収集
✅ get_user_data              # データ取得
✅ create_custom_token        # 認証トークン作成
✅ scheduled_data_collection   # 定期実行
❌ collect_azure_data         # 削除対象（モック用）
```

### Firestore データ構造（本番用）
```
users/{userId}/
├── subscriptions/            # Azure サブスクリプション
├── resources/               # Azure リソース（実データのみ）
├── costs/                  # コスト情報（実データのみ）
├── syncLogs/               # 同期ログ（実行結果記録）
└── tenants/{tenantId}/     # テナント別設定
    ├── config/             # 認証情報（暗号化）
    └── permissions/        # アクセス権限
```

### Azure App Registration 必要権限
```
API Permissions:
├── Microsoft Graph
│   ├── User.Read
│   └── Directory.Read.All
└── Azure Service Management
    ├── user_impersonation
    ├── Resource Manager (Reader)
    ├── Cost Management (Reader)
    └── Monitor (Reader)
```

## 🚨 移行作業

### Phase 1: モック機能削除
1. `collect_azure_data` 関数の削除
2. フロントエンドからのモック関数呼び出し削除
3. テスト用データ生成ボタンの削除

### Phase 2: 実装の強化
1. `collect_real_azure_data` 関数の改善
2. エラーハンドリングの強化
3. セキュリティ設定の強化

### Phase 3: ユーザー体験の改善
1. Azure設定ガイドの作成
2. 認証エラー時の詳細な案内
3. データ収集状況の可視化

## 📚 ユーザーガイド要件

### セットアップ手順書
1. **Azure App Registration作成**
   - 必要な権限の詳細説明
   - 設定手順のスクリーンショット
   - トラブルシューティング

2. **初回データ収集**
   - 認証情報の入力方法
   - 初回実行時の注意事項
   - データ収集完了の確認方法

3. **継続運用**
   - 定期実行の設定
   - データ更新頻度の説明
   - アクセス権限の管理

## 🎯 成功指標

### 技術的指標
- [ ] モック関数の完全削除
- [ ] 実Azure APIからのデータ収集100%
- [ ] 認証エラー時の適切な案内
- [ ] セキュリティ要件の充足

### ユーザー体験指標
- [ ] 初回セットアップの成功率
- [ ] データ収集エラーの明確な原因表示
- [ ] 実データであることの明確な表示
- [ ] 継続的なデータ更新の安定性

## ⚠️ 重要な注意事項

1. **データの信頼性**
   - すべてのデータが実際のAzure環境から取得されることを保証
   - データソースの明確な表示（Azure API経由であることを明示）

2. **ユーザーの混乱防止**
   - テストデータと実データの区別を明確に
   - 収集失敗時は「データなし」として表示（モックデータで補完しない）

3. **セキュリティ**
   - 認証情報の適切な管理
   - 最小権限でのAzureアクセス
   - ログとモニタリングの実装

---

**最重要**: この要件に基づき、本番環境ではモックデータ機能を完全に削除し、実Azure APIからのデータのみを扱います。
