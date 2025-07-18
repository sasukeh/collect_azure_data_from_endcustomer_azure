import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { AzureTenant, UserProfile } from '../types/azure';

// Microsoft Graph API のベース URL
const GRAPH_API = 'https://graph.microsoft.com/v1.0';

// Graph API 呼び出し用のヘルパー関数
async function callGraphAPI(endpoint: string, accessToken: string) {
  const response = await fetch(`${GRAPH_API}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Graph API Error: ${response.status} - ${response.statusText}`);
  }

  return response.json();
}

// ユーザープロファイルを取得
export function useUserProfile() {
  const { accounts, instance } = useMsal();
  
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async (): Promise<UserProfile> => {
      if (accounts.length === 0) {
        throw new Error('No authenticated account found');
      }

      const account = accounts[0];
      console.log('User profile - Account info:', {
        username: account.username,
        homeAccountId: account.homeAccountId,
        environment: account.environment,
        tenantId: account.tenantId,
        accountType: account.username.includes('@outlook.com') || account.username.includes('@hotmail.com') || account.username.includes('@live.com') ? 'personal' : 'work'
      });

      // Detect if this is a personal account
      const isPersonalAccount = account.username.includes('@outlook.com') || 
                               account.username.includes('@hotmail.com') || 
                               account.username.includes('@live.com') ||
                               account.tenantId === '9188040d-6c67-4c5b-b112-36a304b66dad'; // Microsoft personal account tenant

      const silentRequest = {
        scopes: ['User.Read'],
        account: account,
        ...(isPersonalAccount && { authority: 'https://login.microsoftonline.com/consumers' })
      };

      console.log('User profile - Silent request:', silentRequest);

      try {
        const response = await instance.acquireTokenSilent(silentRequest);
        console.log('User profile - Token acquired successfully:', {
          tokenType: response.tokenType,
          scopes: response.scopes,
          expiresOn: response.expiresOn,
          account: response.account?.username
        });
        
        const data = await callGraphAPI('/me', response.accessToken);
        
        return {
          id: data.id,
          displayName: data.displayName,
          userPrincipalName: data.userPrincipalName,
          mail: data.mail,
          jobTitle: data.jobTitle,
          officeLocation: data.officeLocation,
          preferredLanguage: data.preferredLanguage,
        };
      } catch (error) {
        console.error('User profile - Silent token acquisition failed:', {
          error: error,
          errorCode: (error as any)?.errorCode,
          errorMessage: (error as any)?.errorMessage,
          correlationId: (error as any)?.correlationId,
          isPersonalAccount
        });
        
        try {
          const popupRequest = {
            scopes: ['User.Read'],
            ...(isPersonalAccount && { authority: 'https://login.microsoftonline.com/consumers' })
          };
          
          console.log('User profile - Trying popup with request:', popupRequest);
          const response = await instance.acquireTokenPopup(popupRequest);
          console.log('User profile - Popup token acquired successfully');
          
          const data = await callGraphAPI('/me', response.accessToken);
          
          return {
            id: data.id,
            displayName: data.displayName,
            userPrincipalName: data.userPrincipalName,
            mail: data.mail,
            jobTitle: data.jobTitle,
            officeLocation: data.officeLocation,
            preferredLanguage: data.preferredLanguage,
          };
        } catch (popupError) {
          console.error('Popup token acquisition also failed:', popupError);
          throw popupError;
        }
      }
    },
    enabled: accounts.length > 0,
    staleTime: 10 * 60 * 1000, // 10分間キャッシュ
  });
}

// 利用可能なテナント一覧を取得
export function useAvailableTenants() {
  const { accounts, instance } = useMsal();
  
  return useQuery({
    queryKey: ['availableTenants'],
    queryFn: async (): Promise<AzureTenant[]> => {
      if (accounts.length === 0) {
        throw new Error('No authenticated account found');
      }

      const account = accounts[0]
      
      // Check if this is a personal account
      const isPersonalAccount = account.username.includes('@outlook.com') || 
                               account.username.includes('@hotmail.com') || 
                               account.username.includes('@live.com') ||
                               account.tenantId === '9188040d-6c67-4c5b-b112-36a304b66dad'

      if (isPersonalAccount) {
        const personalTenant: AzureTenant = {
          id: account.tenantId || '9188040d-6c67-4c5b-b112-36a304b66dad',
          displayName: 'Personal Microsoft Account',
          tenantType: 'Personal',
          defaultDomain: account.username?.split('@')[1] || 'hotmail.com',
        };
        return [personalTenant];
      }

      // Try Directory.Read.All first (requires admin consent)
      try {
        const adminRequest = {
          scopes: ['https://graph.microsoft.com/Directory.Read.All'],
          account: account,
        };

        const response = await instance.acquireTokenSilent(adminRequest);
        
        // 組織情報を取得
        const orgData = await callGraphAPI('/organization', response.accessToken);
        
        // 現在のテナント情報を構築
        const currentTenant: AzureTenant = {
          id: account.tenantId || '',
          displayName: orgData.value[0]?.displayName || 'Unknown Organization',
          tenantType: orgData.value[0]?.organizationType || 'Unknown',
          defaultDomain: orgData.value[0]?.verifiedDomains?.find((d: any) => d.isDefault)?.name || '',
        };

        return [currentTenant];
        
      } catch (adminError) {
        console.log('Directory.Read.All not available, trying basic user access:', adminError);
        
        // Fall back to basic user scope
        try {
          const basicRequest = {
            scopes: ['https://graph.microsoft.com/User.Read'],
            account: account,
          };

          const response = await instance.acquireTokenSilent(basicRequest);
          
          // Get basic user info instead of organization info
          const userData = await callGraphAPI('/me', response.accessToken);
          
          const basicTenant: AzureTenant = {
            id: account.tenantId || '',
            displayName: userData.companyName || account.username?.split('@')[1] || 'Current Organization',
            tenantType: 'Work/School',
            defaultDomain: account.username?.split('@')[1] || '',
          };

          return [basicTenant];
          
        } catch (basicError) {
          console.error('Token acquisition failed for tenants:', basicError);
          
          // 個人のAzureテナント（*.onmicrosoft.com）の場合
          const username = account.username?.toLowerCase() || '';
          if (username.includes('.onmicrosoft.com')) {
            // Check for external user pattern (#EXT#) - indicates personal account invited to tenant
            const isExternalUser = username.includes('#ext#') || username.includes('#EXT#');
            
            const personalAzureTenant: AzureTenant = {
              id: account.tenantId || '',
              displayName: isExternalUser ? 'Personal Azure Tenant (External User)' : 'Personal Azure Tenant',
              tenantType: 'Personal Azure',
              defaultDomain: username.split('@')[1] || '',
            };
            return [personalAzureTenant];
          }
          
          // フォールバック: アカウント情報から基本的なテナント情報を構築
          const fallbackTenant: AzureTenant = {
            id: account.tenantId || '',
            displayName: account.name || 'Current Organization',
            tenantType: 'Unknown',
            defaultDomain: account.username?.split('@')[1] || '',
          };
          
          return [fallbackTenant];
        }
      }
    },
    enabled: accounts.length > 0,
    staleTime: 15 * 60 * 1000, // 15分間キャッシュ
  });
}

// 現在のテナント情報を取得
export function useCurrentTenant() {
  const { accounts } = useMsal();
  const { data: availableTenants } = useAvailableTenants();
  
  return useQuery({
    queryKey: ['currentTenant', accounts[0]?.tenantId],
    queryFn: (): AzureTenant | null => {
      if (accounts.length === 0) {
        return null;
      }

      const account = accounts[0];
      
      // 個人アカウント（Microsoft Account）の検出
      const isPersonalAccount = 
        account.idTokenClaims?.tid === '9188040d-6c67-4c5b-b112-36a304b66dad' ||
        account.username?.endsWith('@hotmail.com') ||
        account.username?.endsWith('@outlook.com') ||
        account.username?.endsWith('@live.com') ||
        account.username?.endsWith('@gmail.com');

      if (isPersonalAccount) {
        return {
          id: '9188040d-6c67-4c5b-b112-36a304b66dad',
          displayName: 'Personal Microsoft Account',
          tenantType: 'Personal',
          defaultDomain: account.username?.split('@')[1] || 'personal'
        };
      }

      // 組織アカウントの場合、利用可能なテナントリストから取得
      if (!availableTenants || availableTenants.length === 0) {
        // フォールバック: アカウント情報から基本的なテナント情報を構築
        return {
          id: account.tenantId || account.idTokenClaims?.tid || '',
          displayName: (account.idTokenClaims as any)?.['org'] || account.name || 'Organization',
          tenantType: 'Organization',
          defaultDomain: account.username?.split('@')[1] || 'unknown'
        };
      }
      
      const currentTenantId = account.tenantId;
      return availableTenants.find(t => t.id === currentTenantId) || availableTenants[0];
    },
    enabled: accounts.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

// テナント切り替え機能（将来の拡張用）
export function useTenantSwitcher() {
  const { instance, accounts } = useMsal();
  
  const switchTenant = async (_tenantId: string) => {
    try {
      // 現在のアカウントをログアウト
      if (accounts.length > 0) {
        await instance.logoutRedirect({
          account: accounts[0],
          postLogoutRedirectUri: window.location.origin,
        });
      }
    } catch (error) {
      console.error('Tenant switch failed:', error);
      throw error;
    }
  };
  
  const requestTenantSwitch = async (tenantId: string) => {
    try {
      // ポップアップで新しいテナントにログイン
      const loginRequest = {
        scopes: ['User.Read', 'https://management.azure.com/user_impersonation'],
        authority: `https://login.microsoftonline.com/${tenantId}`,
        prompt: 'select_account' as const
      };
      
      const response = await instance.loginPopup(loginRequest);
      console.log('Switched to tenant:', response);
      
      // アプリケーションをリロードして新しいコンテキストを適用
      window.location.reload();
      
      return response;
    } catch (error) {
      console.error('Tenant switch popup failed:', error);
      throw error;
    }
  };

  const canSwitchTenant = accounts.length > 0;
  
  return { 
    switchTenant, 
    requestTenantSwitch,
    canSwitchTenant 
  };
}
