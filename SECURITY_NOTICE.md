# セキュリティ注意事項

## 重要: 本番環境での設定

このリポジトリをforkまたは使用する際は、以下の点に注意してください：

### 1. 環境変数の設定
以下のファイルには **プレースホルダー値** が設定されています。実際の値に置き換えてください：

- `frontend/.env.production`
- `frontend/.env.development`
- `azure-functions/.env.example`

### 2. 必要な実際の値
- `YOUR_AZURE_CLIENT_ID`: 実際のAzure ADアプリケーションのClient ID
- `YOUR_AZURE_TENANT_ID`: 実際のAzure ADテナントID
- `https://your-static-web-app.azurestaticapps.net`: 実際のStatic Web AppsのURL
- `https://your-function-app.azurewebsites.net`: 実際のAzure FunctionsのURL

### 3. .gitignoreの確認
以下のファイルが.gitignoreに含まれていることを確認してください：
```
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
service-account-key.json
```

### 4. GitHubでのシークレット管理
本番環境では、機密情報はGitHub Secretsまたは環境変数として管理してください：

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_SECRET`
- その他のAPI key類

## 機密情報を誤ってcommitした場合

1. Git履歴から削除
2. Azureリソースのキーを再生成
3. 新しいキーで環境変数を更新

詳細な手順については[GitHub Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)を参照してください。
