import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { Box } from '@mui/material'
import { useEffect } from 'react'
import Layout from './components/Layout/Layout'
import LoginPage from './pages/Login/LoginPage'
import DashboardPage from './pages/Dashboard/DashboardPageAzure'
import ResourcesPage from './pages/Resources/ResourcesPage'
import CostsPage from './pages/Costs/CostsPage'
import SettingsPage from './pages/Settings/SettingsPage'
import LoadingPage from './components/Loading/LoadingPage'
import { loginRequest } from './config/azure'

function App() {
  const isAuthenticated = useIsAuthenticated()
  const { inProgress, instance } = useMsal()
  const [searchParams, setSearchParams] = useSearchParams()

  // デバッグ用: 開発環境でのテストモード
  const isDevelopment = import.meta.env.VITE_ENV === 'development'
  const isTestMode = isDevelopment && import.meta.env.VITE_DEV_MODE === 'true'

  // テナント切り替え用のURLパラメータを処理
  useEffect(() => {
    const tenantId = searchParams.get('tenant')
    const domain = searchParams.get('domain')
    
    if (tenantId && domain && !isAuthenticated) {
      // テナント指定でのログインを実行
      instance.loginRedirect({
        ...loginRequest,
        prompt: 'select_account',
        domainHint: domain,
        extraQueryParameters: {
          tenant: tenantId,
          domain_hint: domain,
        },
      }).then(() => {
        // ログイン後にURLパラメータをクリア
        setSearchParams({})
      }).catch((error) => {
        console.error('Auto tenant login failed:', error)
        setSearchParams({})
      })
    }
  }, [searchParams, isAuthenticated, instance, setSearchParams])

  // Show loading while MSAL is in progress
  if (inProgress !== 'none') {
    return <LoadingPage />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/costs" element={<CostsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </Box>
  )
}

export default App
