import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/authConfig';

interface UserIdentityInfo {
  isExternalUser: boolean;
  actualTenantId?: string;
  homeTenantId?: string;
  userPrincipalName?: string;
  mailNickname?: string;
  identities?: any[];
  externalUserState?: string;
  externalUserStateChangeDateTime?: string;
}

export const useUserIdentityInfo = () => {
  const { instance, accounts } = useMsal();
  const [identityInfo, setIdentityInfo] = useState<UserIdentityInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserIdentityInfo = async () => {
      if (!accounts || accounts.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const currentAccount = accounts[0];
        
        // Get token for Microsoft Graph
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: currentAccount,
        });

        // Call Graph API /me endpoint with expanded properties
        const meResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,userPrincipalName,mailNickname,identities,externalUserState,externalUserStateChangeDateTime,creationType,userType,onPremisesDistinguishedName', {
          headers: {
            'Authorization': `Bearer ${response.accessToken}`,
          },
        });

        if (meResponse.ok) {
          const userData = await meResponse.json();
          console.log('Extended user data from Graph API:', userData);

          const identityInfo: UserIdentityInfo = {
            isExternalUser: userData.userType === 'Guest' || userData.externalUserState !== undefined,
            actualTenantId: currentAccount.tenantId,
            homeTenantId: currentAccount.homeAccountId?.split('.')[1],
            userPrincipalName: userData.userPrincipalName,
            mailNickname: userData.mailNickname,
            identities: userData.identities,
            externalUserState: userData.externalUserState,
            externalUserStateChangeDateTime: userData.externalUserStateChangeDateTime,
          };

          console.log('Analyzed identity info:', identityInfo);
          setIdentityInfo(identityInfo);
        } else {
          console.error('Failed to fetch user data:', meResponse.status);
          setError(`Graph API error: ${meResponse.status}`);
        }
      } catch (err) {
        console.error('Error fetching user identity info:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserIdentityInfo();
  }, [instance, accounts]);

  return { identityInfo, isLoading, error };
};
