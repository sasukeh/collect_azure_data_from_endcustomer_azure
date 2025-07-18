import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest, getAccountType } from '../config/authConfig';

interface AccountDetails {
  accountType: 'personal' | 'personal-tenant' | 'work' | 'unknown';
  tenantInfo?: any;
  isLoading: boolean;
  error?: string;
  detectedFromClaims?: boolean;
}

export const useAccountDetails = () => {
  const { instance, accounts } = useMsal();
  const [details, setDetails] = useState<AccountDetails>({
    accountType: 'unknown',
    isLoading: true,
  });

  useEffect(() => {
    const detectAccountType = async () => {
      if (!accounts || accounts.length === 0) {
        setDetails({ accountType: 'unknown', isLoading: false });
        return;
      }

      const currentAccount = accounts[0];
      setDetails(prev => ({ ...prev, isLoading: true }));

      console.log('useAccountDetails - Full current account object:', currentAccount);
      console.log('useAccountDetails - ID Token Claims:', currentAccount.idTokenClaims);

      // First, use our improved getAccountType function which checks ID token claims
      const detectedAccountType = getAccountType(currentAccount);
      
      // If we detected personal-tenant from claims, we can return early with high confidence
      if (detectedAccountType === 'personal-tenant') {
        setDetails({
          accountType: detectedAccountType,
          isLoading: false,
          detectedFromClaims: true,
        });
        return;
      }

      try {
        // Try to get a token for Microsoft Graph for additional verification
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: currentAccount,
        });

        console.log('Token acquired successfully:', response);

        // Try to call Graph API to get more tenant information (only for work/personal-tenant accounts)
        if (detectedAccountType !== 'personal') {
          try {
            const graphResponse = await fetch('https://graph.microsoft.com/v1.0/organization', {
              headers: {
                'Authorization': `Bearer ${response.accessToken}`,
              },
            });

            if (graphResponse.ok) {
              const orgInfo = await graphResponse.json();
              console.log('Organization info:', orgInfo);
              
              // If we can get organization info, it confirms work or personal-tenant account
              if (orgInfo.value && orgInfo.value.length > 0) {
                const org = orgInfo.value[0];
                const verifiedAccountType = org.verifiedDomains?.some((domain: any) => 
                  domain.name.includes('.onmicrosoft.com') && !domain.name.includes('.mail.onmicrosoft.com')
                ) ? 'personal-tenant' : 'work';
                
                setDetails({
                  accountType: verifiedAccountType,
                  tenantInfo: org,
                  isLoading: false,
                });
                return;
              }
            }
          } catch (graphError) {
            console.log('Graph API call failed:', graphError);
          }
        }

        // Use the account type detected from claims analysis
        setDetails({
          accountType: detectedAccountType,
          isLoading: false,
          detectedFromClaims: true,
        });

      } catch (error) {
        console.error('Failed to acquire token:', error);
        
        // Fallback to claims-based detection
        setDetails({
          accountType: detectedAccountType,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          detectedFromClaims: true,
        });
      }
    };

    detectAccountType();
  }, [instance, accounts]);

  return details;
};
