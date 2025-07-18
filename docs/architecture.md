# アーキテクチャドキュメント

## システム概要

Azure Data Collector は、マルチテナント対応のAzureデータ収集・可視化サービスです。エンドユーザーのAzureテナントからリソース情報、課金情報、モニタリングデータを自動収集し、Webダッシュボードで可視化・分析を提供します。

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Side                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   React App     │    │ Azure Entra ID  │                     │
│  │   (Frontend)    │◄──►│ Authentication  │                     │
│  │                 │    │ (Multi-tenant)  │                     │
│  └─────────────────┘    └─────────────────┘                     │
│           │                       │                             │
└───────────┼───────────────────────┼─────────────────────────────┘
            │                       │
            ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Firebase Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Firebase        │    │ Cloud Functions │                     │
│  │ Hosting         │    │ (Python)        │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                   │                             │
│  ┌─────────────────┐              │                             │
│  │ Firebase        │◄─────────────┘                             │
│  │ Firestore       │                                            │
│  │ (Database)      │                                            │
│  └─────────────────┘                                            │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Azure Platform                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Azure Resource  │    │ Azure Cost      │                     │
│  │ Manager (ARM)   │    │ Management      │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Azure Monitor   │    │ Microsoft Graph │                     │
│  │ Metrics & Logs  │    │ (Tenant Info)   │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## コンポーネント詳細

### フロントエンド (React)

#### 技術スタック
- **React 18** - UIライブラリ
- **TypeScript** - 型安全性
- **Material-UI (MUI)** - UIコンポーネント
- **React Router** - ルーティング
- **React Query** - サーバーステート管理
- **Chart.js / Recharts** - データ可視化
- **Azure MSAL** - Entra ID認証

#### 主要コンポーネント
```
src/
├── components/
│   ├── Layout/           # レイアウトコンポーネント
│   ├── Charts/           # グラフ・可視化コンポーネント
│   ├── DataTable/        # データテーブル
│   └── Auth/             # 認証関連
├── pages/
│   ├── Dashboard/        # ダッシュボード
│   ├── Resources/        # リソース管理
│   ├── Costs/            # コスト分析
│   └── Settings/         # 設定
├── hooks/                # カスタムHooks
├── services/             # API通信
├── stores/               # 状態管理
└── utils/                # ユーティリティ
```

### バックエンド (Python/Firebase Functions)

#### 技術スタック
- **Python 3.11** - 実行環境
- **Firebase Functions** - サーバーレス実行
- **Azure SDK for Python** - Azure API連携
- **Firebase Admin SDK** - Firestore操作

#### 主要機能

##### データ収集エンジン
```python
class AzureDataCollector:
    def collect_resources()     # ARMリソース情報収集
    def collect_costs()         # コスト情報収集
    def collect_metrics()       # メトリクス収集
    def collect_security()      # セキュリティ情報収集
```

##### スケジューラー
- **実行頻度**: 1時間に1回
- **対象**: 登録済み全テナント
- **バッチ処理**: 並列実行でパフォーマンス最適化

### データベース (Firestore)

#### データ構造
```
users/
└── {userId}/
    ├── profile: ユーザープロフィール
    └── tenants/
        └── {tenantId}/
            ├── config: テナント設定
            ├── resources/          # リソース情報
            │   └── {resourceId}
            ├── costs/              # コスト情報
            │   └── {costId}
            ├── metrics/            # メトリクス情報
            │   └── {metricId}
            └── alerts/             # アラート設定
                └── {alertId}
```

#### インデックス設計
- **ユーザー別クエリ**: userId + timestamp
- **テナント別クエリ**: tenantId + resourceType + timestamp
- **コスト分析用**: userId + date + serviceType

## セキュリティアーキテクチャ

### 認証フロー
1. **ユーザー認証**: Azure Entra ID (Multi-tenant)
2. **トークン取得**: OAuth 2.0 / OpenID Connect
3. **スコープ**: Azure Management API へのアクセス権限
4. **Firebase認証**: カスタムトークンでFirebase認証

### データアクセス制御
- **Firestore Rules**: ユーザーごとのデータ分離
- **API権限**: 最小権限の原則
- **暗号化**: 保存時・転送時の暗号化

### Azure権限管理
```json
{
  "requiredResourceAccess": [
    {
      "resourceAppId": "https://management.azure.com/",
      "resourceAccess": [
        {
          "id": "user_impersonation",
          "type": "Scope"
        }
      ]
    }
  ]
}
```

## データフロー

### 1. 初期セットアップ
```
ユーザー → Entra ID認証 → テナント登録 → Azure権限付与
```

### 2. 定期データ収集
```
Scheduler → Cloud Functions → Azure APIs → Firestore保存
```

### 3. リアルタイム可視化
```
React App → Firestore クエリ → Chart.js レンダリング
```

## スケーラビリティ考慮

### パフォーマンス最適化
- **バッチ処理**: Firestore バッチライト
- **キャッシュ戦略**: React Query キャッシュ
- **ページネーション**: 大量データの分割読み込み
- **インデックス最適化**: クエリパフォーマンス向上

### コスト最適化
- **Functions実行時間**: 効率的なデータ処理
- **Firestore使用量**: 適切なデータ構造設計
- **Azure API呼び出し**: レート制限対応

### 可用性・信頼性
- **エラーハンドリング**: 包括的な例外処理
- **リトライ機能**: 一時的な障害対応
- **ログ・監視**: Firebase Analytics & Azure Monitor
- **バックアップ**: Firestore 自動バックアップ

## 監視・運用

### ログ戦略
- **アプリケーションログ**: Firebase Functions Logs
- **エラートラッキング**: Firebase Crashlytics
- **パフォーマンス**: Firebase Performance Monitoring

### アラート設定
- **コスト異常**: 予算超過時のアラート
- **API障害**: Azure API エラー率監視
- **リソース使用量**: 異常なリソース増加検知

## 今後の拡張予定

### フェーズ2機能
- **レポート自動生成**: PDF/Excel形式
- **ML予測分析**: コスト予測・リソース最適化提案
- **Slack/Teams連携**: アラート通知

### インテグレーション
- **Power BI**: 高度な分析ダッシュボード
- **Azure DevOps**: CI/CDパイプライン監視
- **GitHub**: リポジトリメトリクス連携
