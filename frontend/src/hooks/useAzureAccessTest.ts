import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';

interface AzureAccessTest {
  canAccessManagement: boolean;
  canAccessGraph: boolean;
  isLoading: boolean;
  error?: string;
}

export const useAzureAccessTest = () => {
  const { instance, accounts } = useMsal();
  const [accessTest, setAccessTest] = useState<AzureAccessTest>({
    canAccessManagement: false,
    canAccessGraph: false,
    isLoading: true,
  });

  useEffect(() => {
    const testAccess = async () => {
      if (!accounts || accounts.length === 0) {
        setAccessTest({
          canAccessManagement: false,
          canAccessGraph: false,
          isLoading: false,
        });
        return;
      }

      const currentAccount = accounts[0];
      setAccessTest(prev => ({ ...prev, isLoading: true }));

      let canAccessManagement = false;
      let canAccessGraph = false;
      let error: string | undefined;

      // Test Graph API access
      try {
        await instance.acquireTokenSilent({
          scopes: ['User.Read'],
          account: currentAccount,
        });
        canAccessGraph = true;
        console.log('Graph API access: SUCCESS');
      } catch (graphError) {
        console.log('Graph API access: FAILED', graphError);
      }

      // Test Azure Management API access
      try {
        const mgmtResponse = await instance.acquireTokenSilent({
          scopes: ['https://management.azure.com/user_impersonation'],
          account: currentAccount,
        });
        canAccessManagement = true;
        console.log('Azure Management API access: SUCCESS');

        // If we can get the token, try to make a simple API call
        try {
          const apiResponse = await fetch('https://management.azure.com/subscriptions?api-version=2020-01-01', {
            headers: {
              'Authorization': `Bearer ${mgmtResponse.accessToken}`,
            },
          });
          
          console.log('Azure Management API call result:', apiResponse.status);
        } catch (apiError) {
          console.log('Azure Management API call failed:', apiError);
        }
      } catch (mgmtError) {
        console.log('Azure Management API access: FAILED', mgmtError);
        error = mgmtError instanceof Error ? mgmtError.message : 'Management API access failed';
      }

      setAccessTest({
        canAccessManagement,
        canAccessGraph,
        isLoading: false,
        error,
      });
    };

    // Only run the test after a short delay to ensure MSAL is fully initialized
    const timer = setTimeout(testAccess, 1000);
    return () => clearTimeout(timer);
  }, [instance, accounts]);

  return accessTest;
};
