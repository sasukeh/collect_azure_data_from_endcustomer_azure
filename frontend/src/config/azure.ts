import { Configuration, PublicClientApplication } from '@azure/msal-browser';

// MSAL Configuration
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'YOUR_AZURE_CLIENT_ID',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0: // LogLevel.Error
            console.error(message);
            return;
          case 1: // LogLevel.Warning
            console.warn(message);
            return;
          case 2: // LogLevel.Info
            console.info(message);
            return;
          case 3: // LogLevel.Verbose
            console.debug(message);
            return;
        }
      }
    }
  }
};

// MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Login request configuration
export const loginRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    'https://management.azure.com/user_impersonation'
  ],
};

// Azure API endpoints
export const API_CONFIG = {
  FUNCTIONS_BASE_URL: import.meta.env.VITE_FUNCTIONS_BASE_URL || 'https://your-function-app.azurewebsites.net',
  COSMOS_ENDPOINT: import.meta.env.VITE_COSMOS_ENDPOINT || '',
  API_SCOPE: 'https://management.azure.com/.default'
};

// Azure resource scopes for different APIs
export const AZURE_SCOPES = {
  RESOURCE_MANAGEMENT: ['https://management.azure.com/user_impersonation'],
  COST_MANAGEMENT: ['https://management.azure.com/user_impersonation'],
  MONITOR: ['https://management.azure.com/user_impersonation']
};
