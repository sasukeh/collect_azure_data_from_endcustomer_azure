import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  Box,
  Card,
  CardContent,
  CardActions,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
} from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Launch as LaunchIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useMsal } from '@azure/msal-react';
import { useUserTenants, UserTenant } from '../../hooks/useUserTenants';
import { createTenantSwitchRequest, getTenantSpecificTokenRequest } from '../../config/authConfig';

interface TenantSwitcherProps {
  variant?: 'button' | 'card';
}

export const TenantSwitcher: React.FC<TenantSwitcherProps> = ({ variant = 'button' }) => {
  const { instance } = useMsal();
  const { tenants, loading, error, refetch } = useUserTenants();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const currentTenant = tenants.find(t => t.isCurrentTenant);

  const handleOpen = () => {
    setOpen(true);
    refetch(); // ダイアログを開くときに最新のテナント情報を取得
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSwitchTenant = async (tenant: UserTenant) => {
    if (tenant.isCurrentTenant) {
      handleClose();
      return;
    }

    setSwitching(true);
    try {
      // Method 1: 同じユーザーの異なるテナントアカウントを探す
      const allAccounts = instance.getAllAccounts();
      const targetAccount = allAccounts.find(account => 
        account.tenantId === tenant.id &&
        account.username?.includes(tenant.defaultDomain)
      );

      if (targetAccount) {
        // 既存のアカウントが見つかった場合、そのアカウントでトークンを取得
        console.log('Found existing account for tenant:', tenant.id);
        
        try {
          // テナント固有のトークンリクエストを作成
          const tenantTokenRequest = getTenantSpecificTokenRequest(tenant.id, tenant.defaultDomain);
          
          // 既存アカウントでサイレントトークン取得を試行
          await instance.acquireTokenSilent({
            ...tenantTokenRequest,
            account: targetAccount,
          });
          
          // 成功した場合、ページをリロードして新しいアカウントでログイン状態にする
          window.location.reload();
          return;
        } catch (silentError) {
          console.log('Silent token acquisition failed, will try interactive:', silentError);
        }
      }

      // Method 2: サイレント切り替えを試行
      try {
        const silentSwitchRequest = createTenantSwitchRequest(tenant.id, tenant.defaultDomain);
        
        await instance.acquireTokenSilent({
          ...silentSwitchRequest,
          account: targetAccount || allAccounts[0], // フォールバック
        });
        
        // 成功した場合、ページをリロード
        window.location.reload();
        return;
      } catch (silentSwitchError) {
        console.log('Silent tenant switch failed, will redirect:', silentSwitchError);
      }

      // Method 3: インタラクティブリダイレクト（最後の手段）
      await instance.loginRedirect({
        scopes: ['https://graph.microsoft.com/User.Read'],
        prompt: 'select_account',
        authority: `https://login.microsoftonline.com/${tenant.id}`,
        extraQueryParameters: {
          domain_hint: tenant.defaultDomain || 'organizations',
          tenant: tenant.id,
        },
      });
    } catch (error) {
      console.error('テナント切り替えエラー:', error);
      setSwitching(false);
    }
  };

  const handleLogoutAndRelogin = async () => {
    setSwitching(true);
    try {
      await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (error) {
      console.error('ログアウトエラー:', error);
      setSwitching(false);
    }
  };

  const getTenantIcon = (tenantType: string) => {
    switch (tenantType) {
      case 'organization':
      case 'known':
        return <BusinessIcon />;
      case 'guest':
      case 'cached':
      default:
        return <PersonIcon />;
    }
  };

  const getTenantTypeLabel = (tenantType: string) => {
    switch (tenantType) {
      case 'organization':
        return '組織';
      case 'guest':
        return 'ゲスト';
      case 'cached':
        return 'キャッシュ';
      case 'known':
        return '既知';
      case 'current':
        return '現在';
      default:
        return '不明';
    }
  };

  if (variant === 'card') {
    return (
      <>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <BusinessIcon color="primary" />
              <Box flex={1}>
                <Typography variant="h6">現在のテナント</Typography>
                {currentTenant ? (
                  <>
                    <Typography variant="body1" fontWeight="bold">
                      {currentTenant.displayName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ユーザー: {currentTenant.defaultDomain}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      テナントID: {currentTenant.id}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    テナント情報を読み込み中...
                  </Typography>
                )}
              </Box>
              {tenants.length > 1 && (
                <Chip
                  label={`${tenants.length}個のテナント`}
                  color="info"
                  size="small"
                />
              )}
            </Box>
          </CardContent>
          <CardActions>
            <Button
              startIcon={<SwapHorizIcon />}
              onClick={handleOpen}
              disabled={loading || switching}
              variant="outlined"
            >
              テナント切り替え
            </Button>
          </CardActions>
        </Card>

        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={1}>
                <SwapHorizIcon />
                テナント切り替え
              </Box>
              <IconButton onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {loading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : (
              <>
                <Alert severity="info" sx={{ mb: 3 }}>
                  別のテナントでログインするには、適切なテナントを選択してください。
                </Alert>

                <Typography variant="h6" gutterBottom>
                  利用可能なテナント ({tenants.length}個)
                </Typography>

                <List>
                  {tenants.map((tenant, index) => (
                    <React.Fragment key={tenant.id}>
                      <ListItem disablePadding>
                        <ListItemButton
                          onClick={() => handleSwitchTenant(tenant)}
                          disabled={switching}
                          selected={tenant.isCurrentTenant}
                        >
                          <ListItemIcon>
                            {tenant.isCurrentTenant ? (
                              <CheckCircleIcon color="success" />
                            ) : (
                              getTenantIcon(tenant.tenantType)
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="subtitle1">
                                  {tenant.displayName}
                                </Typography>
                                <Chip
                                  label={getTenantTypeLabel(tenant.tenantType)}
                                  size="small"
                                  color={tenant.isCurrentTenant ? 'success' : 'default'}
                                />
                                {tenant.isCurrentTenant && (
                                  <Chip label="現在" size="small" color="primary" />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box>
                                {tenant.defaultDomain && (
                                  <Typography variant="body2" color="text.secondary">
                                    ドメイン: {tenant.defaultDomain}
                                  </Typography>
                                )}
                                <Typography variant="body2" color="text.secondary">
                                  テナントID: {tenant.id}
                                </Typography>
                              </Box>
                            }
                          />
                          {!tenant.isCurrentTenant && (
                            <LaunchIcon color="action" />
                          )}
                        </ListItemButton>
                      </ListItem>
                      {index < tenants.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>

                <Alert severity="warning" sx={{ mt: 3 }}>
                  注意: テナント切り替えにはページのリロードが必要です。現在の作業内容は保存されません。
                </Alert>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={switching}>
              キャンセル
            </Button>
            <Button
              onClick={handleLogoutAndRelogin}
              disabled={switching}
              startIcon={switching ? <CircularProgress size={20} /> : <LaunchIcon />}
              color="primary"
            >
              {switching ? '切り替え中...' : '完全にログアウトして再ログイン'}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // Button variant
  return (
    <>
      <Button
        startIcon={<SwapHorizIcon />}
        onClick={handleOpen}
        disabled={loading || switching}
        variant="outlined"
        size="small"
      >
        テナント切り替え
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <SwapHorizIcon />
              テナント切り替え
            </Box>
            <IconButton onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                別のテナントでログインするには、適切なテナントを選択してください。
              </Alert>

              <Typography variant="h6" gutterBottom>
                利用可能なテナント ({tenants.length}個)
              </Typography>

              <List>
                {tenants.map((tenant, index) => (
                  <React.Fragment key={tenant.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => handleSwitchTenant(tenant)}
                        disabled={switching}
                        selected={tenant.isCurrentTenant}
                      >
                        <ListItemIcon>
                          {tenant.isCurrentTenant ? (
                            <CheckCircleIcon color="success" />
                          ) : (
                            getTenantIcon(tenant.tenantType)
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="subtitle1">
                                {tenant.displayName}
                              </Typography>
                              <Chip
                                label={getTenantTypeLabel(tenant.tenantType)}
                                size="small"
                                color={tenant.isCurrentTenant ? 'success' : 'default'}
                              />
                              {tenant.isCurrentTenant && (
                                <Chip label="現在" size="small" color="primary" />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              {tenant.defaultDomain && (
                                <Typography variant="body2" color="text.secondary">
                                  ドメイン: {tenant.defaultDomain}
                                </Typography>
                              )}
                              <Typography variant="body2" color="text.secondary">
                                テナントID: {tenant.id}
                              </Typography>
                            </Box>
                          }
                        />
                        {!tenant.isCurrentTenant && (
                          <LaunchIcon color="action" />
                        )}
                      </ListItemButton>
                    </ListItem>
                    {index < tenants.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              <Alert severity="warning" sx={{ mt: 3 }}>
                注意: テナント切り替えにはページのリロードが必要です。現在の作業内容は保存されません。
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={switching}>
            キャンセル
          </Button>
          <Button
            onClick={handleLogoutAndRelogin}
            disabled={switching}
            startIcon={switching ? <CircularProgress size={20} /> : <LaunchIcon />}
            color="primary"
          >
            {switching ? '切り替え中...' : '完全にログアウトして再ログイン'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TenantSwitcher;
