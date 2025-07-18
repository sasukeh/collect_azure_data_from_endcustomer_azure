import { Configuration, LogLevel } from '@azure/msal-browser'

// MSAL configuration for multi-tenant Azure AD app supporting both work/school and personal accounts
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'YOUR_AZURE_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    knownAuthorities: [
      'login.microsoftonline.com',
    ], // Simplified known authorities
    navigateToLoginRequestUrl: false, // Helps with spa scenarios
    clientCapabilities: ['CP1'], // Enable Conditional Access policies
  },
  cache: {
    cacheLocation: 'sessionStorage', // Use sessionStorage to preserve multi-tenant tokens
    storeAuthStateInCookie: false,
    secureCookies: false, // Set to true if your site is served over https
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message)
            return
          case LogLevel.Info:
            console.info(message)
            return
          case LogLevel.Verbose:
            console.debug(message)
            return
          case LogLevel.Warning:
            console.warn(message)
            return
        }
      },
      logLevel: LogLevel.Info, // Reduce log level for production
    },
    allowNativeBroker: false, // ネイティブブローカーを無効化
    windowHashTimeout: 60000, // Increase timeout
    iframeHashTimeout: 6000,
    tokenRenewalOffsetSeconds: 300, // Renew tokens 5 minutes before expiry
  },
}

// Request scopes for Azure Resource Manager and other Azure APIs
export const loginRequest = {
  scopes: [
    'User.Read', // Microsoft Graph - basic user profile only
  ],
  forceRefresh: false,
  prompt: 'select_account', // Allow users to select between personal and work accounts
  extraQueryParameters: {
    'prompt': 'select_account', // Force account picker to allow tenant selection
  },
}

// Personal account specific login request (for MSA/hotmail.com accounts)
export const personalAccountLoginRequest = {
  scopes: [
    'User.Read', // Basic user profile for personal accounts
  ],
  forceRefresh: false,
  prompt: 'select_account',
  authority: 'https://login.microsoftonline.com/consumers', // Force personal account flow
  extraQueryParameters: {
    domain_hint: 'consumers' // Hint for personal accounts
  },
}

// Personal account with Azure tenant (*.onmicrosoft.com) - hybrid approach
export const personalTenantLoginRequest = {
  scopes: [
    'User.Read', // Start with basic scope
  ],
  forceRefresh: false,
  prompt: 'select_account',
  authority: 'https://login.microsoftonline.com/common', // Allow both personal and org accounts
}

// Work/School account specific login request - separate Azure Management request
export const workAccountLoginRequest = {
  scopes: [
    'User.Read', // Start with basic scope only
  ],
  forceRefresh: false,
  prompt: 'select_account',
  authority: 'https://login.microsoftonline.com/common', // Allow multi-tenant work accounts
  extraQueryParameters: {
    'prompt': 'select_account', // Force account picker to allow tenant selection
  },
}

// Default token request for personal accounts
export const personalAccountTokenRequest = {
  scopes: [
    'User.Read', // Only basic profile for personal accounts
  ],
  forceRefresh: false,
  authority: 'https://login.microsoftonline.com/consumers',
}

// Token request for personal accounts with Azure tenant (*.onmicrosoft.com)
export const personalTenantTokenRequest = {
  scopes: [
    'User.Read',
  ],
  forceRefresh: false,
  authority: 'https://login.microsoftonline.com/common',
}

// Default token request for work accounts - Azure Management scope acquired separately
export const workAccountTokenRequest = {
  scopes: [
    'User.Read',
  ],
  forceRefresh: false,
  authority: 'https://login.microsoftonline.com/common',
}

// Optional: Azure Resource Manager scope (use after basic auth works)
export const azureResourceManagerRequest = {
  scopes: [
    'https://management.azure.com/user_impersonation',
  ],
}

// Additional scopes for specific Azure services
export const azureScopes = {
  management: 'https://management.azure.com/user_impersonation',
  graph: 'https://graph.microsoft.com/.default',
  costManagement: 'https://management.azure.com/user_impersonation',
  monitor: 'https://management.azure.com/user_impersonation',
}

// Microsoft Graph API scopes for tenant management
export const graphApiScopes = {
  userRead: 'https://graph.microsoft.com/User.Read',
  organizationRead: 'https://graph.microsoft.com/Organization.Read.All',
  directoryRead: 'https://graph.microsoft.com/Directory.Read.All',
  memberOf: 'https://graph.microsoft.com/Directory.Read.All', // Required for memberOf
}

// Graph API endpoints
export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphTenantEndpoint: 'https://graph.microsoft.com/v1.0/organization',
}

// Azure Management API endpoints
export const azureConfig = {
  managementEndpoint: 'https://management.azure.com',
  costManagementEndpoint: 'https://management.azure.com',
  monitorEndpoint: 'https://management.azure.com',
}

// Helper functions to determine account type
export const getAccountType = (account: any) => {
  if (!account) {
    console.log('No account provided for type detection');
    return 'unknown';
  }
  
  console.log('Account details for type detection:', {
    username: account.username,
    homeAccountId: account.homeAccountId,
    environment: account.environment,
    tenantId: account.tenantId,
    localAccountId: account.localAccountId,
    name: account.name,
    idTokenClaims: account.idTokenClaims,
  });
  
  const username = account.username?.toLowerCase() || '';
  const homeAccountId = account.homeAccountId || '';
  const tenantId = account.tenantId || '';
  const idTokenClaims = account.idTokenClaims || {};
  
  // Check idTokenClaims for more detailed tenant information
  const upn = idTokenClaims.upn?.toLowerCase() || '';
  const email = idTokenClaims.email?.toLowerCase() || '';
  const uniqueName = idTokenClaims.unique_name?.toLowerCase() || '';
  const preferredUsername = idTokenClaims.preferred_username?.toLowerCase() || '';
  
  console.log('Additional account identifiers:', {
    upn,
    email,
    uniqueName,
    preferredUsername,
    tenantId,
    isExternal: upn.includes('#ext#') || email.includes('#ext#') || uniqueName.includes('#ext#') || preferredUsername.includes('#ext#')
  });
  
  // Special case: Check for specific known tenant IDs that are personal-tenant
  const knownPersonalTenantIds = [
    '768832c1-aa1c-4716-9446-eb7174bb8f4c', // Creative Life Lab (marumaro33hotmail.onmicrosoft.com)
  ];
  
  if (knownPersonalTenantIds.includes(tenantId)) {
    console.log('Detected as personal-tenant (known personal tenant ID)');
    return 'personal-tenant';
  }
  
  // Check for external user patterns in ID token claims - this is more reliable
  const allIdentifiers = [upn, email, uniqueName, preferredUsername].filter(Boolean);
  const hasExternalPattern = allIdentifiers.some(id => 
    id.includes('#ext#') || id.includes('#EXT#')
  );
  const hasOnMicrosoftDomain = allIdentifiers.some(id => 
    id.includes('.onmicrosoft.com')
  );
  
  // If we find #EXT# pattern in any identifier AND .onmicrosoft.com, it's a personal account invited to tenant
  if (hasExternalPattern && hasOnMicrosoftDomain && tenantId !== '9188040d-6c67-4c5b-b112-36a304b66dad') {
    console.log('Detected as personal-tenant (external user in ID token claims)');
    return 'personal-tenant';
  }
  
  // Check for organization-specific domains
  if (username.includes('@1cll.com') || upn.includes('@1cll.com') || 
      email.includes('@1cll.com') || uniqueName.includes('@1cll.com') || 
      preferredUsername.includes('@1cll.com')) {
    console.log('Detected as work account (1cll.com domain)');
    return 'work';
  }
  
  // Check if it's a personal Microsoft account (MSA) - standard personal account detection
  if (tenantId === '9188040d-6c67-4c5b-b112-36a304b66dad' ||
      username.includes('@outlook.com') || 
      username.includes('@hotmail.com') || 
      username.includes('@live.com') ||
      username.includes('@msn.com') ||
      username.includes('@gmail.com') ||
      username.includes('@yahoo.com')) {
    
    // Double-check: if this is MSA tenant but we have external user claims, it might be personal-tenant
    if (tenantId === '9188040d-6c67-4c5b-b112-36a304b66dad' && hasExternalPattern && hasOnMicrosoftDomain) {
      console.log('Detected as personal-tenant (MSA account with external claims)');
      return 'personal-tenant';
    }
    
    console.log('Detected as personal account (consumer email or MSA tenant)');
    return 'personal';
  }
  
  // Check homeAccountId pattern for more accurate detection
  // Personal accounts: typically have homeAccountId like: "00000000-0000-0000-xxxx-xxxxxxxxxxxx.9188040d-6c67-4c5b-b112-36a304b66dad"
  if (homeAccountId.includes('9188040d-6c67-4c5b-b112-36a304b66dad')) {
    // Again, check for external patterns even with MSA homeAccountId
    if (hasExternalPattern && hasOnMicrosoftDomain) {
      console.log('Detected as personal-tenant (MSA homeAccountId with external claims)');
      return 'personal-tenant';
    }
    
    console.log('Detected as personal account (homeAccountId pattern)');
    return 'personal';
  }
  
  // Check if it's a personal account with Azure tenant (*.onmicrosoft.com)
  // 個人のAzureテナントは異なるテナントIDを持つ
  if (username.includes('.onmicrosoft.com') && tenantId !== '9188040d-6c67-4c5b-b112-36a304b66dad') {
    console.log('Detected .onmicrosoft.com domain with non-MSA tenant, checking if personal tenant');
    
    // Check for external user pattern (#EXT#) - indicates personal account invited to tenant
    if (username.includes('#ext#') || username.includes('#EXT#')) {
      console.log('Detected as personal-tenant (external user pattern)');
      return 'personal-tenant';
    }
    
    // Further check if it's likely a personal tenant
    // Personal tenants often have specific patterns in tenant ID or are single-user
    const usernamePart = username.split('@')[0];
    if (!usernamePart.includes('admin') && 
        !usernamePart.includes('svc') && 
        !usernamePart.includes('service') &&
        usernamePart.length < 30) { // Personal usernames tend to be shorter (increased for #EXT# pattern)
      console.log('Detected as personal-tenant');
      return 'personal-tenant';
    }
  }
  
  // Check if it's clearly an organizational account
  if (username.includes('@') && !username.includes('.onmicrosoft.com')) {
    console.log('Detected as work account (custom domain)');
    return 'work';
  }
  
  // Default to work/school for other *.onmicrosoft.com cases
  if (username.includes('.onmicrosoft.com')) {
    console.log('Defaulting to work account for .onmicrosoft.com');
    return 'work';
  }
  
  // Default to work/school for other cases
  console.log('Defaulting to work account');
  return 'work';
};

// Get appropriate login request based on account type
export const getLoginRequestForAccountType = (accountType: string) => {
  switch (accountType) {
    case 'personal':
      return personalAccountLoginRequest;
    case 'personal-tenant':
      return personalTenantLoginRequest;
    case 'work':
    default:
      return workAccountLoginRequest;
  }
};

// Get appropriate token request based on account type
export const getTokenRequestForAccountType = (accountType: string) => {
  switch (accountType) {
    case 'personal':
      return personalAccountTokenRequest;
    case 'personal-tenant':
      return personalTenantTokenRequest;
    case 'work':
    default:
      return workAccountTokenRequest;
  }
};

// Check if account can access Azure Management APIs
export const canAccessAzureManagement = (accountType: string) => {
  return accountType === 'work' || accountType === 'personal-tenant';
};

// Get Azure Management token request for accounts that support it
export const getAzureManagementTokenRequest = (accountType: string) => {
  if (!canAccessAzureManagement(accountType)) {
    throw new Error('This account type does not support Azure Management API access');
  }
  
  return {
    scopes: ['https://management.azure.com/user_impersonation'],
    forceRefresh: false,
    authority: 'https://login.microsoftonline.com/common',
  };
};

// Tenant-specific token acquisition helper
export const getTenantSpecificTokenRequest = (tenantId: string, domain?: string) => {
  const extraParams: { [key: string]: string } = {};
  if (domain) {
    extraParams.domain_hint = domain;
  }
  
  return {
    scopes: ['https://graph.microsoft.com/User.Read'],
    authority: `https://login.microsoftonline.com/${tenantId}`, // Tenant-specific authority
    forceRefresh: false,
    extraQueryParameters: Object.keys(extraParams).length > 0 ? extraParams : undefined,
  };
};

// Helper function to switch between tenants without logout
export const createTenantSwitchRequest = (tenantId: string, domain?: string) => {
  const extraParams: { [key: string]: string } = {
    tenant: tenantId,
  };
  
  if (domain) {
    extraParams.domain_hint = domain;
  } else {
    extraParams.domain_hint = 'organizations';
  }
  
  return {
    scopes: ['https://graph.microsoft.com/User.Read'],
    prompt: 'none' as const, // Try silent login first
    authority: `https://login.microsoftonline.com/${tenantId}`,
    extraQueryParameters: extraParams,
  };
};
