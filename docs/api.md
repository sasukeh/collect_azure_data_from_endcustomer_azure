# API仕様

Azure Data Collector のAPI仕様について説明します。

## 📋 概要

このシステムでは以下のAPIを使用します：

1. **Azure Management API**: Azureリソース情報の取得
2. **Microsoft Graph API**: ユーザー・組織情報の取得
3. **Firebase Cloud Functions**: カスタムAPIエンドポイント
4. **Firestore REST API**: データベース操作

## 🔐 認証

### Azure APIs

Azure Management API と Microsoft Graph API は OAuth 2.0 / OpenID Connect を使用：

```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**スコープ:**

```javascript
// Azure Management API
const azureManagementScopes = [
  "https://management.azure.com/user_impersonation"
];

// Microsoft Graph API  
const graphScopes = [
  "User.Read",
  "Directory.Read.All",
  "Organization.Read.All"
];
```

### Firebase APIs

Firebase ID Token を使用：

```http
Authorization: Bearer {firebase_id_token}
Content-Type: application/json
```

## 🌍 Azure Management API

### リソース一覧取得

**エンドポイント:**

```http
GET https://management.azure.com/subscriptions/{subscription-id}/resources
```

**パラメータ:**

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|----|----|
| subscription-id | ✅ | string | Azure サブスクリプション ID |
| api-version | ✅ | string | API バージョン（例: 2021-04-01） |
| $filter | ❌ | string | フィルタークエリ |
| $top | ❌ | integer | 取得件数制限 |

**リクエスト例:**

```javascript
const fetchResources = async (subscriptionId: string, accessToken: string) => {
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/resources?api-version=2021-04-01`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
};
```

**レスポンス例:**

```json
{
  "value": [
    {
      "id": "/subscriptions/12345678-1234-1234-1234-123456789012/resourceGroups/myResourceGroup/providers/Microsoft.Compute/virtualMachines/myVM",
      "name": "myVM",
      "type": "Microsoft.Compute/virtualMachines",
      "location": "eastus",
      "properties": {
        "vmId": "abcd1234-5678-90ab-cdef-123456789012",
        "hardwareProfile": {
          "vmSize": "Standard_B2s"
        },
        "provisioningState": "Succeeded"
      },
      "tags": {
        "environment": "production",
        "team": "backend"
      }
    }
  ],
  "nextLink": "https://management.azure.com/subscriptions/.../resources?api-version=2021-04-01&$skiptoken=..."
}
```

### コスト情報取得

**エンドポイント:**

```http
POST https://management.azure.com/subscriptions/{subscription-id}/providers/Microsoft.CostManagement/query
```

**リクエスト例:**

```javascript
const fetchCostData = async (subscriptionId: string, accessToken: string) => {
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2021-10-01`;
  
  const requestBody = {
    type: "ActualCost",
    timeframe: "MonthToDate",
    dataset: {
      granularity: "Daily",
      aggregation: {
        totalCost: {
          name: "PreTaxCost",
          function: "Sum"
        }
      },
      grouping: [
        {
          type: "Dimension",
          name: "ResourceGroup"
        }
      ]
    }
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  return await response.json();
};
```

**レスポンス例:**

```json
{
  "id": "subscriptions/12345678-1234-1234-1234-123456789012/providers/Microsoft.CostManagement/query/...",
  "name": "...",
  "type": "microsoft.costmanagement/query",
  "properties": {
    "nextLink": null,
    "columns": [
      {
        "name": "PreTaxCost",
        "type": "Number"
      },
      {
        "name": "UsageDate",
        "type": "Number"
      },
      {
        "name": "ResourceGroup",
        "type": "String"
      }
    ],
    "rows": [
      [
        156.789,
        20241101,
        "myResourceGroup"
      ],
      [
        89.123,
        20241102,
        "anotherResourceGroup"
      ]
    ]
  }
}
```

## 👥 Microsoft Graph API

### ユーザー情報取得

**エンドポイント:**

```http
GET https://graph.microsoft.com/v1.0/me
```

**リクエスト例:**

```javascript
const fetchUserProfile = async (accessToken: string) => {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  return await response.json();
};
```

**レスポンス例:**

```json
{
  "id": "12345678-1234-1234-1234-123456789012",
  "displayName": "田中太郎",
  "userPrincipalName": "tanaka@company.onmicrosoft.com",
  "mail": "tanaka@company.com",
  "jobTitle": "システム管理者",
  "officeLocation": "東京",
  "businessPhones": ["+81-3-1234-5678"],
  "mobilePhone": "+81-90-1234-5678"
}
```

### 組織情報取得

**エンドポイント:**

```http
GET https://graph.microsoft.com/v1.0/organization
```

**レスポンス例:**

```json
{
  "value": [
    {
      "id": "87654321-4321-4321-4321-210987654321",
      "displayName": "Creative Life Lab",
      "businessPhones": ["+81-3-5678-1234"],
      "city": "Tokyo",
      "country": "Japan",
      "postalCode": "100-0001",
      "state": "Tokyo",
      "street": "丸の内1-1-1",
      "technicalNotificationMails": ["admin@1cll.com"],
      "verifiedDomains": [
        {
          "capabilities": "Email, OfficeCommunicationsOnline",
          "isDefault": true,
          "isInitial": false,
          "name": "1cll.com",
          "type": "Managed"
        }
      ]
    }
  ]
}
```

## 🔥 Firebase Cloud Functions

### データ収集関数

**エンドポイント:**

```http
POST https://us-central1-{project-id}.cloudfunctions.net/collectTenantData
```

**リクエスト:**

```json
{
  "tenantId": "87654321-4321-4321-4321-210987654321",
  "subscriptionIds": [
    "12345678-1234-1234-1234-123456789012"
  ],
  "dataTypes": ["resources", "costs", "metrics"]
}
```

**レスポンス:**

```json
{
  "status": "success",
  "message": "Data collection completed",
  "data": {
    "tenantId": "87654321-4321-4321-4321-210987654321",
    "resourceCount": 145,
    "costDataPoints": 30,
    "metricsCount": 89,
    "collectedAt": "2024-11-01T10:30:00Z"
  }
}
```

**実装例:**

```python
import functions_framework
from google.cloud import firestore
import json

@functions_framework.http
def collect_tenant_data(request):
    """テナントデータを収集してFirestoreに保存"""
    
    # CORS ヘッダー設定
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
        return ('', 204, headers)
    
    # 認証確認
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return {'error': 'Authentication required'}, 401
    
    try:
        # リクエストボディ解析
        request_json = request.get_json()
        tenant_id = request_json.get('tenantId')
        subscription_ids = request_json.get('subscriptionIds', [])
        data_types = request_json.get('dataTypes', ['resources'])
        
        # データ収集実行
        collected_data = {}
        
        if 'resources' in data_types:
            collected_data['resources'] = await collect_resources(tenant_id, subscription_ids)
        
        if 'costs' in data_types:
            collected_data['costs'] = await collect_costs(tenant_id, subscription_ids)
        
        if 'metrics' in data_types:
            collected_data['metrics'] = await collect_metrics(tenant_id, subscription_ids)
        
        # Firestore に保存
        db = firestore.Client()
        doc_ref = db.collection('tenants').document(tenant_id)
        doc_ref.set({
            'data': collected_data,
            'lastCollected': firestore.SERVER_TIMESTAMP,
            'collectionStatus': 'completed'
        }, merge=True)
        
        # レスポンス
        response_data = {
            'status': 'success',
            'message': 'Data collection completed',
            'data': {
                'tenantId': tenant_id,
                'resourceCount': len(collected_data.get('resources', [])),
                'costDataPoints': len(collected_data.get('costs', [])),
                'metricsCount': len(collected_data.get('metrics', [])),
                'collectedAt': datetime.utcnow().isoformat() + 'Z'
            }
        }
        
        headers = {'Access-Control-Allow-Origin': '*'}
        return (json.dumps(response_data), 200, headers)
        
    except Exception as e:
        logger.error(f"Data collection failed: {e}")
        error_response = {
            'status': 'error',
            'message': str(e)
        }
        headers = {'Access-Control-Allow-Origin': '*'}
        return (json.dumps(error_response), 500, headers)
```

### ユーザー設定取得

**エンドポイント:**

```http
GET https://us-central1-{project-id}.cloudfunctions.net/getUserSettings
```

**レスポンス:**

```json
{
  "userId": "firebase-user-id",
  "preferences": {
    "theme": "dark",
    "language": "ja",
    "timezone": "Asia/Tokyo",
    "notifications": {
      "email": true,
      "push": false,
      "costAlerts": true
    }
  },
  "tenants": [
    {
      "tenantId": "87654321-4321-4321-4321-210987654321",
      "displayName": "Creative Life Lab",
      "role": "reader",
      "isDefault": true
    }
  ]
}
```

## 💾 Firestore データ構造

### ユーザーデータ

**コレクション:** `users/{userId}`

```json
{
  "profile": {
    "displayName": "田中太郎",
    "email": "tanaka@company.com",
    "azureObjectId": "12345678-1234-1234-1234-123456789012",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-11-01T10:30:00Z"
  },
  "preferences": {
    "theme": "light",
    "language": "ja",
    "timezone": "Asia/Tokyo"
  },
  "tenants": {
    "87654321-4321-4321-4321-210987654321": {
      "displayName": "Creative Life Lab",
      "role": "reader",
      "isDefault": true,
      "addedAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### テナントデータ

**コレクション:** `tenants/{tenantId}`

```json
{
  "info": {
    "displayName": "Creative Life Lab",
    "tenantId": "87654321-4321-4321-4321-210987654321",
    "domain": "1cll.com",
    "country": "Japan"
  },
  "subscriptions": [
    {
      "subscriptionId": "12345678-1234-1234-1234-123456789012",
      "displayName": "Visual Studio Enterprise",
      "state": "Enabled"
    }
  ],
  "lastCollected": "2024-11-01T10:30:00Z",
  "collectionStatus": "completed",
  "dataStats": {
    "resourceCount": 145,
    "costDataPoints": 30,
    "metricsCount": 89
  }
}
```

### リソースデータ

**コレクション:** `tenants/{tenantId}/resources/{resourceId}`

```json
{
  "id": "/subscriptions/.../resourceGroups/myRG/providers/Microsoft.Compute/virtualMachines/myVM",
  "name": "myVM",
  "type": "Microsoft.Compute/virtualMachines",
  "location": "eastus",
  "resourceGroup": "myRG",
  "subscription": "12345678-1234-1234-1234-123456789012",
  "properties": {
    "vmSize": "Standard_B2s",
    "provisioningState": "Succeeded",
    "powerState": "running"
  },
  "tags": {
    "environment": "production",
    "team": "backend"
  },
  "cost": {
    "daily": 12.34,
    "monthly": 370.20,
    "currency": "USD"
  },
  "collectedAt": "2024-11-01T10:30:00Z"
}
```

## 🔍 エラーレスポンス

### 共通エラー形式

```json
{
  "error": {
    "code": "ErrorCode",
    "message": "Human readable error message",
    "details": {
      "timestamp": "2024-11-01T10:30:00Z",
      "requestId": "req-12345",
      "additionalInfo": "..."
    }
  }
}
```

### よくあるエラー

#### 認証エラー

```json
{
  "error": {
    "code": "Unauthorized",
    "message": "Authentication required",
    "details": {
      "hint": "Include Authorization header with Bearer token"
    }
  }
}
```

#### 権限エラー

```json
{
  "error": {
    "code": "Forbidden",
    "message": "Insufficient permissions",
    "details": {
      "requiredRole": "Reader",
      "currentRole": "None"
    }
  }
}
```

#### レート制限エラー

```json
{
  "error": {
    "code": "TooManyRequests",
    "message": "Rate limit exceeded",
    "details": {
      "retryAfter": 60,
      "limit": 100,
      "window": "1h"
    }
  }
}
```

## 📊 API使用例

### フロントエンドでの統合例

```typescript
// services/apiClient.ts
class ApiClient {
  private baseUrl: string;
  private getAccessToken: () => Promise<string>;
  
  constructor(baseUrl: string, tokenProvider: () => Promise<string>) {
    this.baseUrl = baseUrl;
    this.getAccessToken = tokenProvider;
  }
  
  async fetchResources(subscriptionId: string): Promise<AzureResource[]> {
    const token = await this.getAccessToken();
    
    const response = await fetch(
      `${this.baseUrl}/azure/subscriptions/${subscriptionId}/resources`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch resources: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value;
  }
  
  async triggerDataCollection(tenantId: string): Promise<void> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/collect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tenantId })
    });
    
    if (!response.ok) {
      throw new Error(`Data collection failed: ${response.statusText}`);
    }
  }
}

// 使用例
const apiClient = new ApiClient(
  'https://us-central1-project.cloudfunctions.net',
  () => getFirebaseIdToken()
);

const resources = await apiClient.fetchResources(subscriptionId);
```

### バックエンドでの統合例

```python
# services/azure_service.py
from azure.identity import ClientSecretCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.consumption import ConsumptionManagementClient
import aiohttp
import asyncio

class AzureService:
    def __init__(self, credential: ClientSecretCredential):
        self.credential = credential
    
    async def get_resources(self, subscription_id: str) -> List[dict]:
        client = ResourceManagementClient(self.credential, subscription_id)
        
        resources = []
        for resource in client.resources.list():
            resources.append({
                'id': resource.id,
                'name': resource.name,
                'type': resource.type,
                'location': resource.location,
                'resourceGroup': resource.id.split('/')[4],
                'properties': resource.additional_properties,
                'tags': resource.tags or {}
            })
        
        return resources
    
    async def get_cost_data(self, subscription_id: str, days: int = 30) -> List[dict]:
        client = ConsumptionManagementClient(self.credential, subscription_id)
        
        # 過去30日間のコストデータを取得
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        query_definition = {
            'type': 'ActualCost',
            'timeframe': 'Custom',
            'time_period': {
                'from': start_date.isoformat(),
                'to': end_date.isoformat()
            },
            'dataset': {
                'granularity': 'Daily',
                'aggregation': {
                    'totalCost': {
                        'name': 'PreTaxCost',
                        'function': 'Sum'
                    }
                }
            }
        }
        
        result = client.query.usage(subscription_id, query_definition)
        
        cost_data = []
        for row in result.rows:
            cost_data.append({
                'date': row[1],
                'cost': row[0],
                'currency': 'USD'  # Azure default
            })
        
        return cost_data
```

## 📚 参考資料

- [Azure REST API Reference](https://docs.microsoft.com/en-us/rest/api/azure/)
- [Microsoft Graph API Reference](https://docs.microsoft.com/en-us/graph/api/overview)
- [Firebase Functions API](https://firebase.google.com/docs/functions)
- [Firestore REST API](https://firebase.google.com/docs/firestore/use-rest-api)
- [Azure Cost Management API](https://docs.microsoft.com/en-us/rest/api/cost-management/)
