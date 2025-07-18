# Azure Data Collector Backend

Firebase Cloud Functions for Python を使用したサーバーレスバックエンド

## 機能

- **Azure データ収集**: マルチテナント対応のAzure API連携
- **スケジューラー**: 1時間毎の自動データ収集
- **REST API**: フロントエンド向けのデータ配信API
- **認証**: Firebase Authentication連携
- **データ保存**: Firestore への効率的なデータ保存

## 技術スタック

- **Python 3.11** - 実行環境
- **Firebase Functions** - サーバーレス実行基盤
- **Azure SDK for Python** - Azure API連携
- **Firebase Admin SDK** - Firestore操作
- **Pydantic** - データバリデーション

## セットアップ

### 1. 依存関係のインストール

```bash
pip install -r requirements.txt
```

### 2. Firebase 設定

```bash
# Firebase CLI のインストール
npm install -g firebase-tools

# プロジェクトの初期化
firebase init functions

# 環境変数の設定
firebase functions:config:set \
  azure.client_id="your-client-id" \
  azure.client_secret="your-client-secret"
```

### 3. サービスアカウントキーの配置

Firebase Admin SDK 用のサービスアカウントキーを配置：
```bash
cp path/to/service-account-key.json ./service-account-key.json
```

### 4. ローカル開発

```bash
# エミュレーターの起動
firebase emulators:start --only functions,firestore

# 別ターミナルで関数のテスト
curl -X POST http://localhost:5001/your-project/us-central1/collect_tenant_data \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "tenant_id": "test"}'
```

## プロジェクト構造

```
backend/
├── main.py              # メイン関数定義
├── config.py            # 設定管理
├── requirements.txt     # Python依存関係
├── azure_collector/     # Azure データ収集モジュール
│   ├── __init__.py
│   ├── resource_collector.py
│   ├── cost_collector.py
│   └── metrics_collector.py
├── services/            # ビジネスロジック
│   ├── __init__.py
│   ├── data_service.py
│   └── auth_service.py
├── utils/               # ユーティリティ
│   ├── __init__.py
│   ├── logger.py
│   └── validators.py
└── tests/               # テストファイル
    ├── __init__.py
    ├── test_main.py
    └── test_collectors.py
```

## 主要機能

### データ収集エンジン

#### AzureDataCollector クラス
```python
class AzureDataCollector:
    def get_subscriptions() -> List[Dict]
    def collect_resources(subscription_id: str) -> List[Dict]
    def collect_costs(subscription_id: str) -> List[Dict]
    def collect_metrics(subscription_id: str) -> List[Dict]
```

#### 収集データ
- **リソース情報**: ARM経由でリソース一覧・詳細
- **コスト情報**: Cost Management API経由で課金データ
- **メトリクス**: Monitor API経由でパフォーマンスデータ
- **セキュリティ**: Security Center API経由でセキュリティ情報

### Cloud Functions

#### 1. scheduled_data_collection (スケジューラー)
```python
@scheduler_fn.on_schedule(schedule="0 */1 * * *")
def scheduled_data_collection(event) -> None:
```
- 実行頻度: 1時間毎
- 処理内容: 全登録テナントからのデータ収集
- エラーハンドリング: リトライ機能付き

#### 2. collect_tenant_data (手動収集)
```python
@https_fn.on_request()
def collect_tenant_data(req: https_fn.Request) -> https_fn.Response:
```
- トリガー: HTTP POST リクエスト
- 用途: 特定テナントの即座データ収集
- レスポンス: 収集結果のサマリー

#### 3. get_user_data (データ取得)
```python
@https_fn.on_request()
def get_user_data(req: https_fn.Request) -> https_fn.Response:
```
- トリガー: HTTP GET リクエスト
- 用途: フロントエンド向けデータ配信
- フィルタリング: ユーザー・テナント・日付範囲

### データ保存戦略

#### Firestore コレクション構造
```
users/{userId}/
├── tenants/{tenantId}/
│   ├── resources/{resourceId}
│   ├── costs/{costId}
│   ├── metrics/{metricId}
│   └── config
```

#### バッチ処理
- Firestore バッチライトで効率的な保存
- トランザクション整合性の保証
- レート制限対応

## 開発ガイドライン

### コーディングスタイル
- PEP 8 準拠
- Type Hints 必須
- Docstring による関数説明
- Black による自動フォーマット

### エラーハンドリング
```python
try:
    # Azure API 呼び出し
    result = azure_client.some_operation()
except AzureError as e:
    logger.error(f"Azure API error: {str(e)}")
    # リトライまたはフォールバック処理
except Exception as e:
    logger.error(f"Unexpected error: {str(e)}")
    # エラー報告
```

### ログ出力
```python
import logging

logger = logging.getLogger(__name__)

logger.info("Data collection started")
logger.warning("Rate limit approaching")
logger.error("Failed to collect data", exc_info=True)
```

## デプロイ

### 1. 本番デプロイ
```bash
# Functions のデプロイ
firebase deploy --only functions

# 特定の関数のみデプロイ
firebase deploy --only functions:collect_tenant_data
```

### 2. 環境変数の管理
```bash
# 設定の追加
firebase functions:config:set someservice.key="THE API KEY"

# 設定の確認
firebase functions:config:get

# ローカルへの設定取得
firebase functions:config:get > .runtimeconfig.json
```

## 監視・ログ

### ログの確認
```bash
# リアルタイムログ
firebase functions:log

# 特定の関数
firebase functions:log --only collect_tenant_data

# エラーのみ
firebase functions:log --filter="severity>=WARNING"
```

### パフォーマンス監視
- **実行時間**: Cloud Functions メトリクス
- **メモリ使用量**: リソース使用状況監視
- **エラー率**: 異常検知アラート
- **API呼び出し数**: Azure API 使用量追跡

## テスト

### 単体テスト
```bash
# 全テスト実行
pytest

# カバレッジ付き
pytest --cov=. --cov-report=html

# 特定のテスト
pytest tests/test_collectors.py
```

### 統合テスト
```bash
# Firebase エミュレーター使用
firebase emulators:exec --only firestore,functions "pytest tests/integration/"
```

## トラブルシューティング

### よくある問題

1. **Azure 認証エラー**
   ```bash
   # サービスプリンシパルの確認
   az ad sp show --id your-client-id
   
   # 権限の確認
   az role assignment list --assignee your-client-id
   ```

2. **Firebase Functions タイムアウト**
   ```python
   # タイムアウト設定の調整
   @https_fn.on_request(timeout_sec=540)
   def long_running_function(req):
   ```

3. **Firestore 書き込み制限**
   ```python
   # バッチサイズの調整
   batch_size = 100  # デフォルト500から削減
   ```

### デバッグ方法
- ローカルエミュレーターでのテスト
- Cloud Logging でのエラー追跡
- Firebase Functions シェルでの対話的テスト

## セキュリティ考慮事項

### 認証・認可
- Firebase Authentication による認証確認
- ユーザーごとのデータアクセス制限
- Azure API の最小権限アクセス

### データ保護
- Azure 認証情報の暗号化保存
- ログからの機密情報除外
- HTTPS 通信の強制

### 監査ログ
- データアクセスログの記録
- API 呼び出し履歴の保存
- 異常検知アラートの設定
