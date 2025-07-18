import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { AzureResource, AzureSubscription, ResourceGroup } from '../types/azure';

// Azure Management API のベース URL
const AZURE_MANAGEMENT_API = 'https://management.azure.com';

// Azure API 呼び出し用のヘルパー関数
async function callAzureAPI(endpoint: string, accessToken: string) {
  const response = await fetch(`${AZURE_MANAGEMENT_API}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Azure API Error: ${response.status} - ${response.statusText}`);
  }

  return response.json();
}

// サブスクリプション一覧を取得
export function useSubscriptions() {
  const { accounts, instance } = useMsal();
  
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: async (): Promise<AzureSubscription[]> => {
      if (accounts.length === 0) {
        throw new Error('No authenticated account found');
      }

      const account = accounts[0];
      
      // 個人アカウントかどうかをチェック
      const isPersonalAccount = 
        account.tenantId === '9188040d-6c67-4c5b-b112-36a304b66dad' ||
        account.username?.endsWith('@hotmail.com') ||
        account.username?.endsWith('@outlook.com') ||
        account.username?.endsWith('@live.com') ||
        account.username?.endsWith('@gmail.com');

      if (isPersonalAccount) {
        // 個人アカウントは Azure サブスクリプションを持たない
        console.log('Personal account detected - no Azure subscriptions available');
        return [];
      }

      const silentRequest = {
        scopes: ['https://management.azure.com/user_impersonation'],
        account: account,
      };

      try {
        const response = await instance.acquireTokenSilent(silentRequest);
        const data = await callAzureAPI('/subscriptions?api-version=2020-01-01', response.accessToken);
        return data.value || [];
      } catch (error) {
        console.error('Subscription token acquisition failed:', error);
        
        // Check if it's a consent error
        if ((error as any)?.errorCode === 'invalid_grant' || 
            (error as any)?.message?.includes('AADSTS65001') ||
            (error as any)?.message?.includes('consent')) {
          console.log('Admin consent required for Azure Management API');
          return [];
        }
        
        // Try popup as fallback
        try {
          const response = await instance.acquireTokenPopup(silentRequest);
          const data = await callAzureAPI('/subscriptions?api-version=2020-01-01', response.accessToken);
          return data.value || [];
        } catch (popupError) {
          console.error('Popup authentication failed:', popupError);
          return [];
        }
      }
    },
    enabled: accounts.length > 0,
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });
}

// リソースグループ一覧を取得
export function useResourceGroups(subscriptionId?: string) {
  const { accounts, instance } = useMsal();
  
  return useQuery({
    queryKey: ['resourceGroups', subscriptionId],
    queryFn: async (): Promise<ResourceGroup[]> => {
      if (!subscriptionId || accounts.length === 0) return [];

      const silentRequest = {
        scopes: ['https://management.azure.com/user_impersonation'],
        account: accounts[0],
      };

      try {
        const response = await instance.acquireTokenSilent(silentRequest);
        const data = await callAzureAPI(
          `/subscriptions/${subscriptionId}/resourcegroups?api-version=2021-04-01`,
          response.accessToken
        );
        return data.value;
      } catch (error) {
        console.error('Token acquisition failed:', error);
        const response = await instance.acquireTokenPopup(silentRequest);
        const data = await callAzureAPI(
          `/subscriptions/${subscriptionId}/resourcegroups?api-version=2021-04-01`,
          response.accessToken
        );
        return data.value;
      }
    },
    enabled: !!subscriptionId && accounts.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// リソース一覧を取得
export function useResources(subscriptionId?: string, resourceGroupName?: string) {
  const { accounts, instance } = useMsal();
  
  return useQuery({
    queryKey: ['resources', subscriptionId, resourceGroupName],
    queryFn: async (): Promise<AzureResource[]> => {
      if (!subscriptionId || accounts.length === 0) return [];

      let endpoint = `/subscriptions/${subscriptionId}/resources?api-version=2021-04-01`;
      if (resourceGroupName) {
        endpoint = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/resources?api-version=2021-04-01`;
      }

      const silentRequest = {
        scopes: ['https://management.azure.com/user_impersonation'],
        account: accounts[0],
      };

      try {
        const response = await instance.acquireTokenSilent(silentRequest);
        const data = await callAzureAPI(endpoint, response.accessToken);
        
        return data.value.map((resource: any) => ({
          id: resource.id,
          name: resource.name,
          type: resource.type,
          resourceGroup: resource.id.split('/')[4], // リソース ID からリソースグループ名を抽出
          location: resource.location,
          subscriptionId: subscriptionId,
          tags: resource.tags,
          kind: resource.kind,
          sku: resource.sku,
          properties: resource.properties,
          createdTime: resource.createdTime,
          changedTime: resource.changedTime,
        }));
      } catch (error) {
        console.error('Token acquisition failed:', error);
        const response = await instance.acquireTokenPopup(silentRequest);
        const data = await callAzureAPI(endpoint, response.accessToken);
        
        return data.value.map((resource: any) => ({
          id: resource.id,
          name: resource.name,
          type: resource.type,
          resourceGroup: resource.id.split('/')[4],
          location: resource.location,
          subscriptionId: subscriptionId,
          tags: resource.tags,
          kind: resource.kind,
          sku: resource.sku,
          properties: resource.properties,
          createdTime: resource.createdTime,
          changedTime: resource.changedTime,
        }));
      }
    },
    enabled: !!subscriptionId && accounts.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// 特定のリソースの詳細を取得
export function useResourceDetails(resourceId?: string) {
  const { accounts, instance } = useMsal();
  
  return useQuery({
    queryKey: ['resourceDetails', resourceId],
    queryFn: async (): Promise<AzureResource | null> => {
      if (!resourceId || accounts.length === 0) return null;

      const silentRequest = {
        scopes: ['https://management.azure.com/user_impersonation'],
        account: accounts[0],
      };

      try {
        const response = await instance.acquireTokenSilent(silentRequest);
        const data = await callAzureAPI(`${resourceId}?api-version=2021-04-01`, response.accessToken);
        
        return {
          id: data.id,
          name: data.name,
          type: data.type,
          resourceGroup: data.id.split('/')[4],
          location: data.location,
          subscriptionId: data.id.split('/')[2],
          tags: data.tags,
          kind: data.kind,
          sku: data.sku,
          properties: data.properties,
          createdTime: data.createdTime,
          changedTime: data.changedTime,
        };
      } catch (error) {
        console.error('Token acquisition failed:', error);
        const response = await instance.acquireTokenPopup(silentRequest);
        const data = await callAzureAPI(`${resourceId}?api-version=2021-04-01`, response.accessToken);
        
        return {
          id: data.id,
          name: data.name,
          type: data.type,
          resourceGroup: data.id.split('/')[4],
          location: data.location,
          subscriptionId: data.id.split('/')[2],
          tags: data.tags,
          kind: data.kind,
          sku: data.sku,
          properties: data.properties,
          createdTime: data.createdTime,
          changedTime: data.changedTime,
        };
      }
    },
    enabled: !!resourceId && accounts.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
