import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';

export interface UserTenant {
  id: string;
  displayName: string;
  defaultDomain: string;
  tenantType: string;
  isCurrentTenant: boolean;
}

export const useUserTenants = () => {
  const { instance, accounts } = useMsal();
  const [tenants, setTenants] = useState<UserTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAccount = accounts[0];
  const currentTenantId = currentAccount?.tenantId;

  const fetchUserTenants = async () => {
    if (!currentAccount) {
      setError('ユーザーアカウントが見つかりません');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 基本的なUser.Readスコープのみを使用
      const graphResponse = await instance.acquireTokenSilent({
        scopes: ['https://graph.microsoft.com/User.Read'],
        account: currentAccount,
      });

      // ユーザーの基本情報を取得
      const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${graphResponse.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Graph API エラー: ${userResponse.status} ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();
      
      // 現在のテナント情報を基本情報から取得
      let currentOrgData = null;
      try {
        // organizationエンドポイントを試行（権限がある場合のみ）
        const currentOrgResponse = await fetch('https://graph.microsoft.com/v1.0/organization', {
          headers: {
            'Authorization': `Bearer ${graphResponse.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (currentOrgResponse.ok) {
          const orgData = await currentOrgResponse.json();
          currentOrgData = orgData.value?.[0];
        }
      } catch (orgError) {
        console.log('Organization API access not available:', orgError);
        // 権限がない場合は続行
      }

      // テナント情報を整理
      const tenantList: UserTenant[] = [];

      // 現在のテナントを追加（基本情報から）
      const tenantDisplayName = currentOrgData?.displayName || 
                                userData.companyName || 
                                currentAccount.username?.split('@')[1] || 
                                'Current Organization';
      
      const defaultDomain = currentOrgData?.verifiedDomains?.find((d: any) => d.isDefault)?.name || 
                           currentAccount.username?.split('@')[1] || 
                           '';

      tenantList.push({
        id: currentTenantId || '',
        displayName: tenantDisplayName,
        defaultDomain: defaultDomain,
        tenantType: 'organization',
        isCurrentTenant: true,
      });

      // MSALのアカウントキャッシュから他のテナント情報を取得
      const allAccounts = instance.getAllAccounts();
      for (const account of allAccounts) {
        if (account.tenantId && account.tenantId !== currentTenantId) {
          // 重複チェック
          if (!tenantList.find(t => t.id === account.tenantId)) {
            const accountDomain = account.username?.split('@')[1] || '';
            let displayName = accountDomain;
            
            // ドメインから組織名を推測
            if (accountDomain === '1cll.com') {
              displayName = 'Creative Life Lab';
            } else if (accountDomain.endsWith('.onmicrosoft.com')) {
              displayName = accountDomain.replace('.onmicrosoft.com', '') + ' (Microsoft)';
            } else {
              displayName = accountDomain + ' Organization';
            }

            tenantList.push({
              id: account.tenantId,
              displayName: displayName,
              defaultDomain: accountDomain,
              tenantType: 'cached',
              isCurrentTenant: false,
            });
          }
        }
      }

      // 既知のテナント情報を追加（Creative Life Lab）
      const knownTenants = [
        {
          id: '768832c1-aa1c-4716-9446-eb7174bb8f4c',
          displayName: 'Creative Life Lab',
          defaultDomain: '1cll.com',
          tenantType: 'known',
        }
      ];

      for (const knownTenant of knownTenants) {
        if (!tenantList.find(t => t.id === knownTenant.id)) {
          tenantList.push({
            ...knownTenant,
            isCurrentTenant: knownTenant.id === currentTenantId,
          });
        }
      }

      setTenants(tenantList);
    } catch (err) {
      console.error('テナント一覧の取得に失敗:', err);
      setError(err instanceof Error ? err.message : 'テナント一覧の取得に失敗しました');
      
      // フォールバック: 現在のテナントのみを表示
      if (currentTenantId) {
        setTenants([{
          id: currentTenantId,
          displayName: currentAccount.username?.split('@')[1] || 'Current Tenant',
          defaultDomain: currentAccount.username?.split('@')[1] || '',
          tenantType: 'current',
          isCurrentTenant: true,
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentAccount) {
      fetchUserTenants();
    }
  }, [currentAccount?.tenantId]);

  return {
    tenants,
    loading,
    error,
    refetch: fetchUserTenants,
  };
};
