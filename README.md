# Azure Data Collection & Visualization Service

マルチテナント対応のAzureデータ収集・可視化サービス

## 概要

エンドユーザーのAzureテナントからリソース情報や課金情報を収集し、ダッシュボードを通じてAzureの利用状況を可視化・分析するサービスです。

## 主な機能

- **Azureデータ収集**
  - Azure Resource Manager（ARM）リソース情報
  - Azure Cost Management 課金情報
  - Azure Monitor メトリクス・ログ
  - Azure AD（Entra ID）情報
  - セキュリティ関連情報

- **可視化・分析**
  - コスト分析（時系列、リソース別、サービス別）
  - リソース使用状況分析
  - アラート・通知機能
  - レポート機能

## 技術スタック

### Frontend
- **React 18** - モダンなWebフレームワーク
- **TypeScript** - 型安全性
- **Material-UI (MUI)** - UIコンポーネント
- **Chart.js / Recharts** - データ可視化
- **Azure MSAL** - Microsoft認証ライブラリ

### Backend
- **Python 3.11+** - バックエンド言語
- **Azure Functions** - サーバーレス実行環境
- **Azure SDK for Python** - Azure API連携
- **FastAPI** - REST API（必要に応じて）

### データベース・認証
- **Azure Cosmos DB** - NoSQLデータベース
- **Azure Entra ID B2C** - 認証管理
- **Azure Entra ID** - マルチテナント認証

### インフラ・デプロイ
- **Azure Static Web Apps** - フロントエンドホスティング
- **Azure Functions** - バックエンド処理
- **Azure Logic Apps** - スケジュール実行
- **GitHub Actions** - CI/CD

## アーキテクチャ

```mermaid
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │    │ Azure Entra ID   │    │ Azure Tenant A  │
│  (Frontend)     │◄──►│ B2C (Auth)       │◄──►│ (Customer)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Azure Cosmos    │    │ Azure Functions  │    │ Azure Tenant B  │
│ DB              │◄──►│ (Python)         │◄──►│ (Customer)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Data Storage    │    │ Logic Apps       │    │ Azure APIs      │
│ (Collections)   │    │ (Scheduled Jobs) │    │ (ARM, Cost, etc)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## データ収集スケジュール

- **頻度**: 1時間に1度
- **方式**: Azure Logic Apps + Azure Functions
- **範囲**: 登録済みの全テナント

## セキュリティ

- マルチテナントアプリケーション（Entra ID）
- OAuth 2.0 / OpenID Connect
- 最小権限の原則（適切なAzure RBACスコープ）
- データ暗号化（保存時・転送時）

## 開発・デプロイ

詳細は各ディレクトリの README を参照してください。

- [Frontend Setup](./frontend/README.md)
- [Backend Setup](./backend/README.md)
- [Deployment Guide](./docs/deployment.md)

## ライセンス

MIT License
