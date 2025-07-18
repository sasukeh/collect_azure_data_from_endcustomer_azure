# 開発ガイド

Azure Data Collector の開発環境、コーディング規約、デバッグ方法について説明します。

## 🚀 開発環境構築

### 推奨開発環境

- **IDE**: Visual Studio Code
- **Node.js**: 18.0.0 以上
- **Python**: 3.9 以上
- **Git**: 最新版

### VS Code 拡張機能

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-vscode.vscode-typescript-next", 
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "ms-azuretools.vscode-azurefunctions",
    "toba.vsfire",
    "esbenp.prettier-vscode",
    "ms-python.flake8"
  ]
}
```

### 開発サーバー起動

```bash
# フロントエンド開発サーバー
cd frontend
npm run dev        # localhost:3000

# バックエンド開発サーバー  
cd backend
firebase emulators:start  # localhost:4000 (Firebase UI)

# 並列起動（推奨）
npm run dev:all    # 両方を同時起動
```

## 📁 プロジェクト構造

### フロントエンド構造

```text
frontend/
├── public/              # 静的ファイル
├── src/
│   ├── components/      # 再利用可能コンポーネント
│   │   ├── Layout/      # レイアウト関連
│   │   ├── Charts/      # グラフコンポーネント
│   │   ├── Forms/       # フォームコンポーネント
│   │   └── UI/          # 基本UIコンポーネント
│   ├── pages/           # ページコンポーネント
│   │   ├── Dashboard/   # ダッシュボード
│   │   ├── Resources/   # リソース管理
│   │   ├── Costs/       # コスト分析
│   │   └── Settings/    # 設定画面
│   ├── hooks/           # カスタムHooks
│   │   ├── useAuth.ts   # 認証関連
│   │   ├── useApi.ts    # API通信
│   │   └── useFirestore.ts # Firestore操作
│   ├── services/        # API通信ロジック
│   │   ├── azure.ts     # Azure API
│   │   ├── firebase.ts  # Firebase API
│   │   └── auth.ts      # 認証サービス
│   ├── stores/          # 状態管理（Zustand）
│   │   ├── authStore.ts # 認証状態
│   │   ├── uiStore.ts   # UI状態
│   │   └── dataStore.ts # データ状態
│   ├── types/           # TypeScript型定義
│   │   ├── azure.ts     # Azure関連型
│   │   ├── auth.ts      # 認証関連型
│   │   └── api.ts       # API関連型
│   ├── utils/           # ユーティリティ関数
│   │   ├── formatters.ts # データフォーマット
│   │   ├── validators.ts # バリデーション
│   │   └── constants.ts  # 定数定義
│   └── config/          # 設定ファイル
│       ├── authConfig.ts # MSAL設定
│       └── firebase.ts   # Firebase設定
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.local           # 環境変数
```

### バックエンド構造

```text
backend/
├── functions/           # Cloud Functions
│   ├── main.py         # メイン関数
│   ├── auth/           # 認証ロジック
│   │   ├── azure_auth.py
│   │   └── firebase_auth.py
│   ├── collectors/     # データ収集ロジック
│   │   ├── resource_collector.py
│   │   ├── cost_collector.py
│   │   └── metrics_collector.py
│   ├── processors/     # データ処理ロジック
│   │   ├── data_transformer.py
│   │   └── aggregator.py
│   ├── services/       # 外部サービス連携
│   │   ├── azure_service.py
│   │   └── firestore_service.py
│   └── utils/          # ユーティリティ
│       ├── logger.py
│       ├── config.py
│       └── exceptions.py
├── requirements.txt
├── .env                # 環境変数
└── firebase.json       # Firebase設定
```

## 📝 コーディング規約

### TypeScript/JavaScript 規約

```typescript
// ✅ Good: 明確な型定義
interface AzureResource {
  id: string;
  name: string;
  type: string;
  location: string;
  resourceGroup: string;
  subscription: string;
  tags: Record<string, string>;
}

// ✅ Good: 関数の型注釈
const fetchResources = async (tenantId: string): Promise<AzureResource[]> => {
  // 実装
};

// ❌ Bad: any型の使用
const fetchData = async (id: any): Promise<any> => {
  // 実装
};

// ✅ Good: エラーハンドリング
try {
  const data = await apiCall();
  return data;
} catch (error) {
  console.error('API call failed:', error);
  throw new Error(`Failed to fetch data: ${error.message}`);
}

// ✅ Good: コンポーネント定義
interface Props {
  title: string;
  data: AzureResource[];
  onSelect: (resource: AzureResource) => void;
}

export const ResourceList: React.FC<Props> = ({ title, data, onSelect }) => {
  return (
    <div>
      <h2>{title}</h2>
      {data.map(resource => (
        <div key={resource.id} onClick={() => onSelect(resource)}>
          {resource.name}
        </div>
      ))}
    </div>
  );
};
```

### Python 規約

```python
# ✅ Good: 型ヒント付き関数定義
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class AzureResource:
    id: str
    name: str
    type: str
    location: str
    resource_group: str
    
async def collect_resources(tenant_id: str) -> List[AzureResource]:
    """
    指定されたテナントからAzureリソースを収集する
    
    Args:
        tenant_id: Azure AD テナントID
        
    Returns:
        収集されたリソースのリスト
        
    Raises:
        AuthenticationError: 認証に失敗した場合
        ApiError: Azure API呼び出しに失敗した場合
    """
    try:
        # 実装
        resources = await azure_client.list_resources(tenant_id)
        return [AzureResource(**resource) for resource in resources]
    except Exception as e:
        logger.error(f"Failed to collect resources: {e}")
        raise

# ✅ Good: エラーハンドリング
class CustomException(Exception):
    """カスタム例外クラス"""
    def __init__(self, message: str, error_code: Optional[str] = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)

# ✅ Good: ロギング
import logging

logger = logging.getLogger(__name__)

def process_data(data: Dict) -> Dict:
    logger.info(f"Processing data for {data.get('tenant_id')}")
    try:
        # 処理ロジック
        result = transform_data(data)
        logger.info("Data processing completed successfully")
        return result
    except Exception as e:
        logger.error(f"Data processing failed: {e}")
        raise
```

### ファイル命名規約

```bash
# React コンポーネント: PascalCase
DashboardPage.tsx
ResourceList.tsx
LoadingSpinner.tsx

# TypeScript ファイル: camelCase
authConfig.ts
apiClient.ts
useFirestore.ts

# Python ファイル: snake_case
azure_auth.py
data_collector.py
firestore_service.py

# 設定ファイル: kebab-case
.env.local
firebase.json
package.json
```

## 🧪 テスト

### フロントエンドテスト

```typescript
// __tests__/components/ResourceList.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceList } from '../components/ResourceList';

const mockResources = [
  {
    id: '1',
    name: 'test-vm',
    type: 'Microsoft.Compute/virtualMachines',
    location: 'East US',
    resourceGroup: 'test-rg',
    subscription: 'sub-1',
    tags: {}
  }
];

describe('ResourceList', () => {
  it('renders resource list correctly', () => {
    const onSelect = jest.fn();
    
    render(
      <ResourceList 
        title="Test Resources" 
        data={mockResources} 
        onSelect={onSelect} 
      />
    );
    
    expect(screen.getByText('Test Resources')).toBeInTheDocument();
    expect(screen.getByText('test-vm')).toBeInTheDocument();
  });
  
  it('calls onSelect when resource is clicked', () => {
    const onSelect = jest.fn();
    
    render(
      <ResourceList 
        title="Test Resources" 
        data={mockResources} 
        onSelect={onSelect} 
      />
    );
    
    fireEvent.click(screen.getByText('test-vm'));
    expect(onSelect).toHaveBeenCalledWith(mockResources[0]);
  });
});
```

### バックエンドテスト

```python
# tests/test_collectors.py
import pytest
from unittest.mock import Mock, patch
from collectors.resource_collector import ResourceCollector

class TestResourceCollector:
    
    def setup_method(self):
        self.collector = ResourceCollector()
    
    @patch('collectors.resource_collector.ResourceManagementClient')
    async def test_collect_resources_success(self, mock_client):
        # Mock setup
        mock_instance = Mock()
        mock_client.return_value = mock_instance
        mock_instance.resources.list.return_value = [
            Mock(id='1', name='test-vm', type='VM')
        ]
        
        # Test execution
        result = await self.collector.collect_resources('tenant-1', 'sub-1')
        
        # Assertions
        assert len(result) == 1
        assert result[0]['name'] == 'test-vm'
        mock_instance.resources.list.assert_called_once()
    
    @patch('collectors.resource_collector.ResourceManagementClient')
    async def test_collect_resources_auth_failure(self, mock_client):
        # Mock setup
        mock_client.side_effect = Exception("Authentication failed")
        
        # Test execution & assertion
        with pytest.raises(Exception, match="Authentication failed"):
            await self.collector.collect_resources('tenant-1', 'sub-1')
```

### テスト実行

```bash
# フロントエンドテスト
cd frontend
npm test                    # 全テスト実行
npm test -- --watch         # ウォッチモード
npm test -- --coverage      # カバレッジ付き

# バックエンドテスト
cd backend
pytest                      # 全テスト実行
pytest --cov=functions      # カバレッジ付き
pytest -v tests/            # 詳細出力
```

## 🐛 デバッグ

### フロントエンドデバッグ

```typescript
// デバッグ用Hooks
const useDebug = (name: string, value: any) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${name}:`, value);
    }
  }, [name, value]);
};

// 使用例
const Dashboard = () => {
  const [data, setData] = useState(null);
  
  useDebug('Dashboard data', data);
  
  return <div>...</div>;
};

// React DevTools での状態確認
// ブラウザ拡張機能: React Developer Tools
```

### バックエンドデバッグ

```python
# ログ設定
import logging
import sys

# 開発環境でのログ設定
if os.getenv('PYTHON_ENV') == 'development':
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('debug.log')
        ]
    )

# デバッグ用デコレータ
def debug_function(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling {func.__name__} with args: {args}, kwargs: {kwargs}")
        result = func(*args, **kwargs)
        logger.debug(f"{func.__name__} returned: {result}")
        return result
    return wrapper

# 使用例
@debug_function
async def collect_data(tenant_id: str):
    logger.debug(f"Starting data collection for tenant: {tenant_id}")
    # 実装
    return data
```

### Firebase Emulator デバッグ

```bash
# Emulator起動（デバッグモード）
firebase emulators:start --inspect-functions

# Functions ログ確認
firebase functions:log --only functions

# Firestore データ確認
# http://localhost:4000 -> Firestore タブ

# パフォーマンス監視
# http://localhost:4000 -> Performance タブ
```

## 🔧 開発ツール

### 便利なスクリプト

```json
// package.json の scripts セクション
{
  "scripts": {
    "dev": "vite",
    "dev:all": "concurrently \"npm run dev\" \"cd ../backend && firebase emulators:start\"",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint src --ext ts,tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "type-check": "tsc --noEmit"
  }
}
```

### Git Hooks

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# フロントエンド lint & format
cd frontend
npm run lint:fix
npm run format

# バックエンド lint
cd ../backend
flake8 functions/

# 型チェック
cd ../frontend
npm run type-check
```

### VSCode 設定

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "python.defaultInterpreterPath": "./backend/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "files.associations": {
    "*.json": "jsonc"
  },
  "editor.rulers": [80, 100],
  "files.exclude": {
    "**/node_modules": true,
    "**/.git": true,
    "**/.DS_Store": true,
    "**/dist": true,
    "**/build": true
  }
}
```

## 📈 パフォーマンス最適化

### フロントエンド最適化

```typescript
// React.memo でコンポーネント最適化
const ResourceCard = React.memo(({ resource }: { resource: AzureResource }) => {
  return <Card>{resource.name}</Card>;
});

// useMemo でデータ変換最適化
const processedData = useMemo(() => {
  return resources.filter(r => r.type === selectedType)
                  .map(r => transformResource(r));
}, [resources, selectedType]);

// useCallback でコールバック最適化
const handleResourceSelect = useCallback((resource: AzureResource) => {
  setSelectedResource(resource);
  analytics.track('resource_selected', { resourceId: resource.id });
}, []);

// 仮想化によるリスト最適化
import { FixedSizeList as List } from 'react-window';

const VirtualizedResourceList = ({ resources }: { resources: AzureResource[] }) => (
  <List
    height={600}
    itemCount={resources.length}
    itemSize={80}
    itemData={resources}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <ResourceCard resource={data[index]} />
      </div>
    )}
  </List>
);
```

### バックエンド最適化

```python
# 非同期処理による並列実行
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def collect_all_tenant_data(tenant_ids: List[str]) -> List[Dict]:
    async def collect_single_tenant(tenant_id: str):
        return await collect_tenant_data(tenant_id)
    
    # 並列実行
    tasks = [collect_single_tenant(tid) for tid in tenant_ids]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # エラーハンドリング
    successful_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Failed to collect data for tenant {tenant_ids[i]}: {result}")
        else:
            successful_results.append(result)
    
    return successful_results

# バッチ処理による効率化
async def batch_firestore_writes(data_list: List[Dict], batch_size: int = 500):
    firestore_client = firestore.Client()
    
    for i in range(0, len(data_list), batch_size):
        batch = firestore_client.batch()
        batch_data = data_list[i:i + batch_size]
        
        for data in batch_data:
            doc_ref = firestore_client.collection('resources').document()
            batch.set(doc_ref, data)
        
        await batch.commit()
        logger.info(f"Committed batch {i//batch_size + 1}")
```

## 🚀 デプロイメント

### 開発環境デプロイ

```bash
# Firebase プロジェクト選択
firebase use development

# Functions デプロイ
firebase deploy --only functions

# Firestore ルール デプロイ
firebase deploy --only firestore:rules

# フロントエンド ビルド & デプロイ
cd frontend
npm run build
firebase deploy --only hosting
```

### 本番環境デプロイ

```bash
# 本番プロジェクトに切り替え
firebase use production

# 全体デプロイ
firebase deploy

# 段階的デプロイ
firebase deploy --only functions:collectData
firebase deploy --only hosting
```

## 📚 さらなる学習

- [React公式ドキュメント](https://react.dev/)
- [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)
- [Firebase公式ドキュメント](https://firebase.google.com/docs)
- [Azure SDK for Python](https://docs.microsoft.com/en-us/azure/developer/python/)
- [MSAL.js ガイド](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-js-initializing-client-applications)
