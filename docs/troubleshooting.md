# トラブルシューティング

Azure Data Collector の開発・運用時によくある問題とその解決方法をまとめています。

## 🔐 認証関連の問題

### MSAL認証エラー

#### ❌ `InteractionRequiredAuthError`

**症状:**

```javascript
InteractionRequiredAuthError: silent_sso_error: User interaction is required
```

**原因:**

- ユーザーのセッションが期限切れ
- 新しいスコープへの同意が必要
- テナント切り替え時の権限不足

**解決方法:**

```typescript
// 1. ポップアップ認証にフォールバック
const handleSilentAuthError = async (error: AuthError) => {
  if (error instanceof InteractionRequiredAuthError) {
    try {
      const response = await msalInstance.acquireTokenPopup(loginRequest);
      return response.accessToken;
    } catch (popupError) {
      console.error('Popup authentication failed:', popupError);
      // ログイン画面にリダイレクト
      await msalInstance.loginRedirect(loginRequest);
    }
  }
};

// 2. スコープを段階的に要求
const baseScopes = ["User.Read"];
const extendedScopes = ["Directory.Read.All", "https://management.azure.com/user_impersonation"];

// まず基本スコープで認証
const baseToken = await msalInstance.acquireTokenSilent({
  scopes: baseScopes,
  account: account
});

// 必要に応じて追加スコープを要求
const extendedToken = await msalInstance.acquireTokenSilent({
  scopes: extendedScopes,
  account: account
});
```

#### ❌ `consent_required` エラー

**症状:**

```javascript
ServerError: consent_required: AADSTS65001: The user or administrator has not consented to use the application
```

**原因:**

- 管理者同意が未実行
- アプリケーションの権限設定が不適切

**解決方法:**

```bash
# 1. Azure Portal で管理者同意を実行
# Azure AD > アプリの登録 > [アプリ名] > API のアクセス許可 > [テナント名] に管理者の同意を与えます

# 2. 管理者同意 URL を生成
https://login.microsoftonline.com/{tenant-id}/adminconsent?client_id={client-id}&redirect_uri={redirect-uri}
```

```typescript
// 3. コードで管理者同意を促す
const requestAdminConsent = () => {
  const adminConsentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin)}`;
  window.location.href = adminConsentUrl;
};
```

#### ❌ テナント切り替え失敗

**症状:**

```javascript
BrowserAuthError: multiple_matching_tokens_detected
```

**原因:**

- キャッシュに複数テナントのトークンが存在
- アカウント選択の不整合

**解決方法:**

```typescript
// 1. キャッシュクリア
const clearCacheAndReauth = async () => {
  // MSALキャッシュクリア
  await msalInstance.clearCache();
  
  // ローカルストレージクリア
  localStorage.removeItem('selectedTenant');
  sessionStorage.clear();
  
  // 再認証
  await msalInstance.loginRedirect(loginRequest);
};

// 2. 特定テナントでの認証
const authenticateWithTenant = async (tenantId: string) => {
  const tenantAuthority = `https://login.microsoftonline.com/${tenantId}`;
  
  const tenantRequest = {
    scopes: ["User.Read"],
    authority: tenantAuthority,
    prompt: "select_account"
  };
  
  try {
    const response = await msalInstance.acquireTokenPopup(tenantRequest);
    return response;
  } catch (error) {
    console.error(`Failed to authenticate with tenant ${tenantId}:`, error);
    throw error;
  }
};
```

### Firebase認証エラー

#### ❌ `auth/invalid-custom-token`

**症状:**

```javascript
FirebaseError: auth/invalid-custom-token
```

**原因:**

- Azure ID トークンの検証失敗
- Firebase カスタムトークンの生成エラー
- 時刻同期の問題

**解決方法:**

```python
# 1. バックエンドでのトークン検証を強化
import jwt
from cryptography.hazmat.primitives import serialization
import requests

async def verify_azure_token(token: str) -> dict:
    # JWKSエンドポイントから公開鍵を取得
    jwks_url = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
    jwks = requests.get(jwks_url).json()
    
    # JWT ヘッダーから kid を取得
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header['kid']
    
    # 対応する公開鍵を検索
    public_key = None
    for key in jwks['keys']:
        if key['kid'] == kid:
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
            break
    
    if not public_key:
        raise ValueError("Public key not found")
    
    # トークン検証
    decoded_token = jwt.decode(
        token,
        public_key,
        algorithms=['RS256'],
        audience="7a6d794f-1aff-48c4-926c-f96d757247b1"  # Client ID
    )
    
    return decoded_token

# 2. カスタムトークン生成を修正
def create_custom_token(azure_claims: dict) -> str:
    uid = azure_claims.get('oid')
    
    # 必要な追加クレーム
    additional_claims = {
        'azure_tenant_id': azure_claims.get('tid'),
        'azure_upn': azure_claims.get('upn'),
        'exp': int(time.time()) + 3600  # 1時間後に期限切れ
    }
    
    custom_token = auth.create_custom_token(uid, additional_claims)
    return custom_token.decode('utf-8')
```

## 🔗 API接続の問題

### Azure Management API エラー

#### ❌ `403 Forbidden`

**症状:**

```javascript
{"error": {"code": "AuthorizationFailed", "message": "The client does not have authorization to perform action"}}
```

**原因:**

- 不適切なRBAC権限
- サブスクリプション レベルでの権限不足
- Service Principal の権限設定ミス

**解決方法:**

```bash
# 1. Azure CLI で権限確認
az role assignment list --assignee <service-principal-object-id>

# 2. 必要な権限を付与
az role assignment create \
  --assignee <service-principal-object-id> \
  --role "Reader" \
  --scope "/subscriptions/<subscription-id>"

# 3. Cost Management 権限を追加
az role assignment create \
  --assignee <service-principal-object-id> \
  --role "Cost Management Reader" \
  --scope "/subscriptions/<subscription-id>"
```

```python
# 4. Python コードでの権限確認
from azure.mgmt.authorization import AuthorizationManagementClient

def check_permissions(credential, subscription_id):
    auth_client = AuthorizationManagementClient(credential, subscription_id)
    
    # 現在の権限を確認
    permissions = auth_client.permissions.list_for_resource_group("resource-group-name")
    
    for permission in permissions:
        print(f"Action: {permission.actions}")
        print(f"Not Actions: {permission.not_actions}")
```

#### ❌ レート制限エラー

**症状:**

```javascript
{"error": {"code": "TooManyRequests", "message": "Rate limit exceeded"}}
```

**解決方法:**

```python
import asyncio
import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
async def make_api_request(url: str, headers: dict) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as response:
            if response.status == 429:  # Too Many Requests
                retry_after = int(response.headers.get('Retry-After', 60))
                await asyncio.sleep(retry_after)
                raise Exception("Rate limit exceeded, retrying...")
            
            response.raise_for_status()
            return await response.json()

# バッチ処理での遅延追加
async def collect_resources_with_delay(tenant_ids: List[str]):
    results = []
    for i, tenant_id in enumerate(tenant_ids):
        try:
            result = await collect_tenant_resources(tenant_id)
            results.append(result)
            
            # API 制限を回避するための遅延
            if i % 10 == 0:  # 10リクエストごとに遅延
                await asyncio.sleep(2)
                
        except Exception as e:
            logger.error(f"Failed to collect resources for {tenant_id}: {e}")
    
    return results
```

### Microsoft Graph API エラー

#### ❌ `InvalidAuthenticationToken`

**症状:**

```javascript
{"error": {"code": "InvalidAuthenticationToken", "message": "Access token is empty"}}
```

**解決方法:**

```typescript
// 1. トークン取得の確認
const getGraphToken = async () => {
  const graphScopes = ["https://graph.microsoft.com/User.Read"];
  
  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: graphScopes,
      account: msalInstance.getActiveAccount()
    });
    
    return response.accessToken;
  } catch (error) {
    // サイレント認証失敗時はポップアップ
    const response = await msalInstance.acquireTokenPopup({
      scopes: graphScopes
    });
    
    return response.accessToken;
  }
};

// 2. API呼び出し時のエラーハンドリング
const callGraphAPI = async (endpoint: string) => {
  const token = await getGraphToken();
  
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Graph API error: ${error.error.message}`);
  }
  
  return response.json();
};
```

## 🔥 Firebase関連の問題

### Firestore接続エラー

#### ❌ `Permission denied`

**症状:**

```javascript
FirebaseError: Missing or insufficient permissions
```

**原因:**

- Firestore セキュリティルールの設定不備
- 認証状態の不整合

**解決方法:**

```javascript
// 1. セキュリティルールの確認・修正
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // デバッグ用（開発環境のみ）
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 本番用ルール
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /tenants/{tenantId} {
        allow read, write: if request.auth != null 
          && request.auth.uid == userId
          && (resource == null || resource.data.ownerId == request.auth.uid);
      }
    }
  }
}
```

```typescript
// 2. 認証状態の確認
const checkAuthState = () => {
  const user = auth.currentUser;
  
  if (!user) {
    console.error("User not authenticated");
    return false;
  }
  
  console.log("User ID:", user.uid);
  console.log("Custom claims:", user.customClaims);
  
  return true;
};

// 3. Firestore書き込み時の権限確認
const saveUserData = async (data: any) => {
  if (!checkAuthState()) {
    throw new Error("Authentication required");
  }
  
  const user = auth.currentUser!;
  
  try {
    await setDoc(doc(db, 'users', user.uid), {
      ...data,
      ownerId: user.uid,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Firestore write failed:", error);
    throw error;
  }
};
```

### Cloud Functions エラー

#### ❌ `Function execution timeout`

**症状:**

```javascript
Function execution took 60000 ms, finished with status: 'timeout'
```

**解決方法:**

```python
# 1. タイムアウト時間を延長（firebase.json）
{
  "functions": {
    "source": ".",
    "runtime": "python39",
    "timeout": "540s"  # 9分に延長
  }
}

# 2. 処理の並列化
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def collect_data_parallel(tenant_ids: List[str]) -> List[dict]:
    async def process_tenant(tenant_id: str):
        return await collect_tenant_data(tenant_id)
    
    # セマフォで同時実行数を制限
    semaphore = asyncio.Semaphore(5)  # 最大5並列
    
    async def limited_process_tenant(tenant_id: str):
        async with semaphore:
            return await process_tenant(tenant_id)
    
    tasks = [limited_process_tenant(tid) for tid in tenant_ids]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    return [r for r in results if not isinstance(r, Exception)]

# 3. 処理の分割
async def collect_data_chunked(tenant_ids: List[str], chunk_size: int = 10):
    all_results = []
    
    for i in range(0, len(tenant_ids), chunk_size):
        chunk = tenant_ids[i:i + chunk_size]
        chunk_results = await collect_data_parallel(chunk)
        all_results.extend(chunk_results)
        
        # 一定間隔でFirestoreに保存
        await save_to_firestore(chunk_results)
        
        # Cloud Functions の実行時間を延長するため短時間待機
        await asyncio.sleep(1)
    
    return all_results
```

## 🖥️ フロントエンド関連の問題

### React レンダリングエラー

#### ❌ `Cannot read properties of undefined`

**症状:**

```javascript
TypeError: Cannot read properties of undefined (reading 'name')
```

**解決方法:**

```typescript
// 1. オプショナルチェーンの使用
const ResourceCard = ({ resource }: { resource?: AzureResource }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">
          {resource?.name ?? 'Loading...'}
        </Typography>
        <Typography variant="body2">
          {resource?.type ?? ''}
        </Typography>
      </CardContent>
    </Card>
  );
};

// 2. デフォルト値の設定
const useResources = () => {
  const [resources, setResources] = useState<AzureResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ... 省略
  
  return { 
    resources: resources ?? [], 
    loading, 
    error 
  };
};

// 3. 型ガードの使用
const isValidResource = (resource: any): resource is AzureResource => {
  return resource && 
         typeof resource.id === 'string' &&
         typeof resource.name === 'string' &&
         typeof resource.type === 'string';
};

const ResourceList = ({ resources }: { resources: any[] }) => {
  const validResources = resources.filter(isValidResource);
  
  return (
    <div>
      {validResources.map(resource => (
        <ResourceCard key={resource.id} resource={resource} />
      ))}
    </div>
  );
};
```

### パフォーマンス問題

#### ❌ 大量データでの画面フリーズ

**解決方法:**

```typescript
// 1. React.memo でコンポーネント最適化
const ResourceCard = React.memo(({ resource }: { resource: AzureResource }) => {
  return <Card>{resource.name}</Card>;
}, (prevProps, nextProps) => {
  // カスタム比較関数
  return prevProps.resource.id === nextProps.resource.id &&
         prevProps.resource.name === nextProps.resource.name;
});

// 2. 仮想化によるリスト最適化
import { FixedSizeList as List } from 'react-window';

const VirtualizedList = ({ resources }: { resources: AzureResource[] }) => (
  <List
    height={600}
    itemCount={resources.length}
    itemSize={100}
    itemData={resources}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <ResourceCard resource={data[index]} />
      </div>
    )}
  </List>
);

// 3. useMemo でデータ変換最適化
const filteredResources = useMemo(() => {
  return resources.filter(resource => {
    return searchTerm === '' || 
           resource.name.toLowerCase().includes(searchTerm.toLowerCase());
  });
}, [resources, searchTerm]);

// 4. useCallback でイベントハンドラー最適化
const handleResourceClick = useCallback((resourceId: string) => {
  setSelectedResourceId(resourceId);
  analytics.track('resource_clicked', { resourceId });
}, []);
```

### CORS関連の問題

#### ❌ CORS policy blocked

**症状:**

```javascript
Access to fetch at 'https://management.azure.com/...' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**解決方法:**

```typescript
// 1. Vite プロキシ設定（開発環境）
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/azure': {
        target: 'https://management.azure.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/azure/, ''),
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN'
        }
      }
    }
  }
});

// 2. バックエンド経由でのAPI呼び出し
const fetchAzureData = async (endpoint: string) => {
  // 直接 Azure API を呼び出さず、バックエンド経由
  const response = await fetch(`/api/azure-proxy${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${await getFirebaseToken()}`
    }
  });
  
  return response.json();
};

// 3. Firebase Functions でのプロキシ実装
@require_auth
def azure_proxy(request):
    endpoint = request.args.get('endpoint')
    azure_token = get_azure_token_for_user(request.user['uid'])
    
    response = requests.get(
        f'https://management.azure.com{endpoint}',
        headers={'Authorization': f'Bearer {azure_token}'}
    )
    
    return response.json()
```

## 📝 ログとデバッグ

### ログレベルの設定

```typescript
// フロントエンド ログ設定
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel;
  
  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }
  
  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
  
  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }
  
  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }
  
  error(message: string, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

// 環境に応じたログレベル設定
const logger = new Logger(
  process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.WARN
);
```

```python
# バックエンド ログ設定
import logging
import os
from google.cloud import logging as cloud_logging

def setup_logging():
    if os.getenv('FUNCTIONS_EMULATOR'):
        # ローカル開発環境
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    else:
        # 本番環境（Cloud Logging）
        client = cloud_logging.Client()
        client.setup_logging()
        logging.getLogger().setLevel(logging.INFO)

# 構造化ログ
def log_with_context(level: str, message: str, **context):
    log_entry = {
        'message': message,
        'timestamp': datetime.utcnow().isoformat(),
        **context
    }
    
    if level == 'error':
        logging.error(log_entry)
    elif level == 'warn':
        logging.warning(log_entry)
    else:
        logging.info(log_entry)
```

## 🆘 緊急時の対処法

### サービス復旧手順

```bash
# 1. 現在の状態確認
firebase projects:list
firebase use <project-id>

# 2. Functions の状態確認
firebase functions:log --limit 50

# 3. Firestore の状態確認
# Firebase Console > Firestore でデータ確認

# 4. 認証の状態確認
# Firebase Console > Authentication でユーザー確認

# 5. エラーの特定
firebase functions:log --filter "ERROR"

# 6. 緊急時のロールバック
firebase deploy --only functions:backupFunction
firebase functions:delete problematicFunction

# 7. フロントエンドの緊急停止
# Hosting を一時的に停止
firebase hosting:disable
```

### 監視とアラート

```python
# Cloud Functions での異常検知
def health_check():
    try:
        # Firebase 接続確認
        firestore_client = firestore.Client()
        test_doc = firestore_client.collection('health').document('test')
        test_doc.set({'timestamp': datetime.utcnow()})
        
        # Azure API 接続確認
        azure_client = ResourceManagementClient(credential, subscription_id)
        list(azure_client.subscriptions.list())
        
        return {'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}
        
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        # Slack/Teams通知
        send_alert(f"Service health check failed: {e}")
        return {'status': 'unhealthy', 'error': str(e)}
```

このトラブルシューティングガイドで、開発・運用時の主要な問題に対処できるはずです。問題が解決しない場合は、詳細なログとエラーメッセージと共にサポートにご連絡ください。
