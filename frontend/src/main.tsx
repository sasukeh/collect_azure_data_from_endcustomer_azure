import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './config/authConfig'
import App from './App'
import './index.css'

// MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL instance before handling redirect
const initializeMsal = async () => {
  try {
    // Debug: Check environment variables
    console.log('Environment variables:', {
      VITE_AZURE_CLIENT_ID: import.meta.env.VITE_AZURE_CLIENT_ID,
      VITE_AZURE_TENANT_ID: import.meta.env.VITE_AZURE_TENANT_ID,
      VITE_REDIRECT_URI: import.meta.env.VITE_REDIRECT_URI,
      VITE_ENV: import.meta.env.VITE_ENV,
      VITE_DEV_MODE: import.meta.env.VITE_DEV_MODE
    });
    
    await msalInstance.initialize();
    console.log('MSAL instance initialized successfully');
    
    // Handle redirect promise after initialization
    const response = await msalInstance.handleRedirectPromise();
    if (response) {
      console.log('Redirect response received:', {
        account: response.account?.username,
        scopes: response.scopes,
        tokenType: response.tokenType
      });
    } else {
      console.log('No redirect response - fresh page load');
    }
  } catch (error) {
    console.error('MSAL initialization or redirect handling failed:', error);
    // Reset the application state if there's an authentication error
    if (error instanceof Error && error.message && error.message.includes('invalid_scope')) {
      console.warn('Invalid scope detected, clearing cached authentication state');
      try {
        await msalInstance.clearCache();
      } catch (clearError) {
        console.error('Failed to clear cache:', clearError);
      }
    }
  }
};

// Initialize MSAL
initializeMsal();

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
})

// Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#0078d4',
      light: '#40a9ff',
      dark: '#004578',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
})

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(MsalProvider, { instance: msalInstance },
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(ThemeProvider, { theme },
          React.createElement(CssBaseline),
          React.createElement(BrowserRouter, {
            future: {
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }
          },
            React.createElement(App)
          )
        )
      )
    )
  )
);
