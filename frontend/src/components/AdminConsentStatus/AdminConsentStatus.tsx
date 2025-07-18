import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Stack
} from '@mui/material'
import {
  AdminPanelSettings,
  CheckCircle,
  Warning,
  Launch
} from '@mui/icons-material'
import { useAdminConsent } from '../../hooks/useAdminConsent'

export const AdminConsentStatus: React.FC = () => {
  const { hasAdminConsent, loading, error, checkAdminConsent, getAdminConsentUrl } = useAdminConsent()

  const handleGrantAdminConsent = () => {
    const adminConsentUrl = getAdminConsentUrl()
    if (adminConsentUrl) {
      window.location.href = adminConsentUrl
    }
  }

  const getStatusColor = () => {
    if (hasAdminConsent === null) return 'default'
    return hasAdminConsent ? 'success' : 'warning'
  }

  const getStatusText = () => {
    if (loading) return '確認中...'
    if (hasAdminConsent === null) return '未確認'
    return hasAdminConsent ? '付与済み' : '必要'
  }

  const getStatusIcon = () => {
    if (loading) return <CircularProgress size={20} />
    if (hasAdminConsent === null) return <AdminPanelSettings />
    return hasAdminConsent ? <CheckCircle /> : <Warning />
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <AdminPanelSettings color="primary" />
            <Typography variant="h6">管理者同意ステータス</Typography>
            <Chip
              icon={getStatusIcon()}
              label={getStatusText()}
              color={getStatusColor()}
              variant="outlined"
            />
          </Box>

          <Typography variant="body2" color="text.secondary">
            Azure Management APIおよびMicrosoft Graph APIにアクセスするためには、
            テナント管理者による同意が必要です。
          </Typography>

          {error && (
            <Alert severity="error">
              エラー: {error}
            </Alert>
          )}

          {hasAdminConsent === false && (
            <Alert severity="warning">
              <Typography variant="body2" mb={1}>
                管理者同意が必要です。以下のAPIスコープにアクセスするためには、
                テナント管理者による許可が必要です：
              </Typography>
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                <li>Azure Management API (リソース情報の取得)</li>
                <li>Microsoft Graph API (ディレクトリ情報の読み取り)</li>
                <li>Microsoft Graph API (ユーザー情報の読み取り)</li>
              </ul>
            </Alert>
          )}

          {hasAdminConsent === true && (
            <Alert severity="success">
              ✅ 管理者同意が付与されています。すべてのAzure APIにアクセスできます。
            </Alert>
          )}

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={checkAdminConsent}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <AdminPanelSettings />}
            >
              {loading ? '確認中...' : 'ステータス再確認'}
            </Button>

            {hasAdminConsent === false && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleGrantAdminConsent}
                startIcon={<Launch />}
              >
                管理者同意を付与
              </Button>
            )}
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary">
              注意: 管理者同意は、組織のテナント管理者のみが実行できます。
              管理者ではない場合は、IT部門またはテナント管理者にお問い合わせください。
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}
