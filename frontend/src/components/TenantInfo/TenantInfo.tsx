import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Button,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  SwapHoriz as SwitchIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useMsal } from '@azure/msal-react';
import { useUserProfile, useCurrentTenant, useAvailableTenants, useTenantSwitcher } from '../../hooks/useTenantInfo';

const TenantInfo = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [tenantMenuAnchor, setTenantMenuAnchor] = useState<null | HTMLElement>(null);
  const { instance } = useMsal();
  
  const { data: userProfile, isLoading: userLoading } = useUserProfile();
  const { data: currentTenant, isLoading: tenantLoading } = useCurrentTenant();
  const { data: availableTenants } = useAvailableTenants();
  const { requestTenantSwitch } = useTenantSwitcher();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleTenantMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setTenantMenuAnchor(event.currentTarget);
  };

  const handleTenantMenuClose = () => {
    setTenantMenuAnchor(null);
  };

  const handleTenantSwitch = async (tenantId: string) => {
    try {
      await requestTenantSwitch(tenantId);
    } catch (error) {
      console.error('テナント切り替えに失敗しました:', error);
      // TODO: エラー表示をユーザーに
    }
    handleTenantMenuClose();
  };

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin,
    });
  };

  if (userLoading || tenantLoading) {
    return (
      <Card sx={{ minWidth: 300 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={24} />
          <Typography>テナント情報を読み込み中...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ minWidth: 300, maxWidth: 500 }}>
      <CardContent>
        {/* ユーザー情報セクション */}
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <PersonIcon />
          </Avatar>
          <Box flex={1}>
            <Typography variant="h6" noWrap>
              {userProfile?.displayName || 'ユーザー'}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {userProfile?.userPrincipalName || userProfile?.mail || ''}
            </Typography>
            {userProfile?.jobTitle && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {userProfile.jobTitle}
              </Typography>
            )}
          </Box>
          <Tooltip title="ユーザーメニュー">
            <IconButton onClick={handleMenuOpen} size="small">
              <ArrowDownIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* テナント情報セクション */}
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ bgcolor: 'secondary.main' }}>
            <BusinessIcon />
          </Avatar>
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Typography variant="subtitle1" fontWeight="medium">
                {currentTenant?.displayName || 'テナント情報なし'}
              </Typography>
              {currentTenant?.tenantType && (
                <Chip 
                  label={currentTenant.tenantType} 
                  size="small" 
                  variant="outlined"
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" noWrap>
              ID: {currentTenant?.id || 'N/A'}
            </Typography>
            {currentTenant?.defaultDomain && (
              <Typography variant="body2" color="text.secondary" noWrap>
                ドメイン: {currentTenant.defaultDomain}
              </Typography>
            )}
          </Box>
          
          {/* テナント切り替えボタン */}
          {availableTenants && availableTenants.length > 1 && (
            <Tooltip title="テナントを切り替える">
              <Button
                variant="outlined"
                size="small"
                startIcon={<SwitchIcon />}
                onClick={handleTenantMenuOpen}
                sx={{ minWidth: 100 }}
              >
                切り替え
              </Button>
            </Tooltip>
          )}
        </Box>

        {/* ユーザーメニュー */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>ログアウト</ListItemText>
          </MenuItem>
        </Menu>

        {/* テナント切り替えメニュー */}
        <Menu
          anchorEl={tenantMenuAnchor}
          open={Boolean(tenantMenuAnchor)}
          onClose={handleTenantMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          {availableTenants?.map((tenant) => (
            <MenuItem
              key={tenant.id}
              onClick={() => handleTenantSwitch(tenant.id)}
              selected={tenant.id === currentTenant?.id}
            >
              <ListItemIcon>
                <BusinessIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary={tenant.displayName}
                secondary={tenant.defaultDomain}
              />
            </MenuItem>
          ))}
        </Menu>
      </CardContent>
    </Card>
  );
};

export default TenantInfo;
