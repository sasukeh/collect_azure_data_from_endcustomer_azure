#!/bin/bash

# Azure CLI を使用してアプリケーションを作成する代替方法
# Azure Portal での手動設定ができない場合に使用

echo "=== Azure アプリケーション登録（個人アカウント対応） ==="

# Azure CLI にログイン（必要に応じて）
echo "Azure CLI にログインしています..."
az login

# 新しいアプリケーションを作成（個人 + 組織アカウント対応）
echo "新しいアプリケーションを作成しています..."
APP_ID=$(az ad app create \
  --display-name "Azure Data Collector (Personal + Work)" \
  --sign-in-audience "AzureADandPersonalMicrosoftAccount" \
  --web-redirect-uris "http://localhost:3001" "http://localhost:3000" \
  --query appId \
  --output tsv)

echo "作成されたアプリケーション ID: $APP_ID"

# 必要な API 権限を追加
echo "API 権限を設定しています..."

# Microsoft Graph - User.Read
az ad app permission add \
  --id $APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope

# Azure Service Management - user_impersonation  
az ad app permission add \
  --id $APP_ID \
  --api 797f4846-ba00-40b9-8bf1-6c21dd8fe327 \
  --api-permissions 41094075-9dad-400e-a0bd-54e686782033=Scope

# 暗黙的フローを有効化
echo "暗黙的フローを有効化しています..."
az ad app update \
  --id $APP_ID \
  --web-implicit-grant-settings '{"enableAccessTokenIssuance": true, "enableIdTokenIssuance": true}'

# 管理者の同意（オプション）
echo "管理者の同意を与えています..."
az ad app permission admin-consent --id $APP_ID

echo ""
echo "=== 設定完了 ==="
echo "新しいアプリケーション ID: $APP_ID"
echo ""
echo "次のステップ:"
echo "1. .env ファイルの VITE_AZURE_CLIENT_ID を以下に更新:"
echo "   VITE_AZURE_CLIENT_ID=$APP_ID"
echo ""
echo "2. アプリケーションを再起動"
echo "   npm run dev"
echo ""
echo "3. 個人アカウントでのログインをテスト"
