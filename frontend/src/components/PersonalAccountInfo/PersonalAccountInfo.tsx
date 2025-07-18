import React from 'react';
import {
  Alert,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Info as InfoIcon,
  Launch as LaunchIcon,
  Business as BusinessIcon,
  Cloud as CloudIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as BugIcon
} from '@mui/icons-material';
import { useMsal } from '@azure/msal-react';
import { getAccountType, canAccessAzureManagement } from '../../config/authConfig';
import { useAccountDetails } from '../../hooks/useAccountDetails';
import { useUserIdentityInfo } from '../../hooks/useUserIdentityInfo';
import TenantSwitcher from '../TenantSwitcher/TenantSwitcher';

interface PersonalAccountInfoProps {
  account?: any;
}

const PersonalAccountInfo: React.FC<PersonalAccountInfoProps> = ({ account }) => {
  const { accounts } = useMsal();
  const currentAccount = account || accounts[0];
  
  // 新しいフックを使って詳細なアカウント情報を取得
  const accountDetails = useAccountDetails();
  const userIdentityInfo = useUserIdentityInfo();
  
  // フォールバックとして従来の判定も使用
  const fallbackAccountType = getAccountType(currentAccount);
  const accountType = accountDetails.isLoading ? fallbackAccountType : accountDetails.accountType;
  const hasAzureAccess = canAccessAzureManagement(accountType);

  // デバッグ情報を表示
  console.log('PersonalAccountInfo - Current account:', currentAccount);
  console.log('PersonalAccountInfo - Account details:', accountDetails);
  console.log('PersonalAccountInfo - User identity info:', userIdentityInfo);
  console.log('PersonalAccountInfo - Fallback account type:', fallbackAccountType);
  console.log('PersonalAccountInfo - Final account type:', accountType);
  console.log('PersonalAccountInfo - Has Azure access:', hasAzureAccess);

  return (
    <Box sx={{ p: 3 }}>
      {/* 詳細デバッグ情報をアコーディオンで表示 */}
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <BugIcon color="warning" />
            <Typography variant="h6">詳細デバッグ情報</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>基本アカウント情報:</strong><br />
                ユーザー名: {currentAccount?.username || 'N/A'}<br />
                テナントID: {currentAccount?.tenantId || 'N/A'}<br />
                ホームアカウントID: {currentAccount?.homeAccountId || 'N/A'}<br />
                検出されたアカウントタイプ: {accountType} {accountDetails.isLoading && '(読み込み中...)'}<br />
                Azureアクセス: {hasAzureAccess ? 'あり' : 'なし'}
              </Typography>
            </Alert>
            
            {userIdentityInfo.identityInfo && (
              <Alert severity="success">
                <Typography variant="body2">
                  <strong>Graph API から取得した詳細情報:</strong><br />
                  外部ユーザー: {userIdentityInfo.identityInfo.isExternalUser ? 'はい' : 'いいえ'}<br />
                  実際のテナントID: {userIdentityInfo.identityInfo.actualTenantId || 'N/A'}<br />
                  ホームテナントID: {userIdentityInfo.identityInfo.homeTenantId || 'N/A'}<br />
                  UPN: {userIdentityInfo.identityInfo.userPrincipalName || 'N/A'}<br />
                  外部ユーザー状態: {userIdentityInfo.identityInfo.externalUserState || 'N/A'}<br />
                  外部ユーザー状態変更日時: {userIdentityInfo.identityInfo.externalUserStateChangeDateTime || 'N/A'}
                </Typography>
              </Alert>
            )}
            
            {(accountDetails.error || userIdentityInfo.error) && (
              <Alert severity="error">
                <Typography variant="body2">
                  <strong>エラー情報:</strong><br />
                  アカウント詳細: {accountDetails.error || 'なし'}<br />
                  ユーザー情報: {userIdentityInfo.error || 'なし'}
                </Typography>
              </Alert>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
      
      {/* テナント切り替えコンポーネント */}
      <TenantSwitcher variant="card" />
      
      <Alert severity={hasAzureAccess ? "success" : "info"} sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {accountType === 'personal-tenant' ? '個人Azureテナントでログイン中' : '個人アカウントでログイン中'}
        </Typography>
        <Typography>
          {accountType === 'personal-tenant' 
            ? '個人のAzureテナント（*.onmicrosoft.com）でログインしています。Azureリソースの管理が可能です。'
            : '現在、個人のMicrosoft アカウント（hotmail.com、outlook.com等）でログインしています。Azureリソースの管理には、組織アカウントまたはAzureサブスクリプションが必要です。'
          }
        </Typography>
      </Alert>

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              {hasAzureAccess ? <CloudIcon color="primary" /> : <InfoIcon color="primary" />}
              <Typography variant="h6">
                {hasAzureAccess ? '個人Azureテナントについて' : '個人アカウントについて'}
              </Typography>
            </Box>
            <Typography variant="body1" paragraph>
              {hasAzureAccess 
                ? '個人のAzureテナントアカウントは、以下のサービスにアクセスできます：'
                : '個人のMicrosoft アカウントは、以下のサービスにアクセスできます：'
              }
            </Typography>
            <Box component="ul" sx={{ pl: 3 }}>
              <li>基本的なユーザープロファイル情報</li>
              <li>Microsoft Graph API（個人データ）</li>
              {hasAzureAccess && (
                <>
                  <li>Azure Management API（制限あり）</li>
                  <li>Azureサブスクリプション情報</li>
                  <li>Azure リソースの管理（権限に応じて）</li>
                </>
              )}
              {!hasAzureAccess && <li>OneDrive、Outlook.com等の個人向けサービス</li>}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {hasAzureAccess 
                ? '※ アクセス可能なリソースは、Azureテナントでの権限設定によります'
                : '※ Azure Management API やサブスクリプション情報へのアクセスはできません'
              }
            </Typography>
          </CardContent>
        </Card>

        {!hasAzureAccess && (
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <BusinessIcon color="secondary" />
                <Typography variant="h6">
                  Azureリソースを管理するには
                </Typography>
              </Box>
              <Typography variant="body1" paragraph>
                Azureリソースの監視とコスト分析を行うには、以下のいずれかが必要です：
              </Typography>
              <Box component="ul" sx={{ pl: 3, mb: 2 }}>
                <li>組織のMicrosoft アカウント（会社・学校アカウント）</li>
                <li>Azureサブスクリプションへのアクセス権限</li>
                <li>Azure Entra ID（旧Azure AD）テナントのメンバーシップ</li>
                <li>個人のAzureテナント（*.onmicrosoft.com）</li>
              </Box>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<LaunchIcon />}
                  component={Link}
                  href="https://azure.microsoft.com/free/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Azure無料アカウント作成
                </Button>
                <Button
                  variant="text"
                  component={Link}
                  href="https://docs.microsoft.com/azure/active-directory/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Azure Entra IDについて詳しく
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {hasAzureAccess && (
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <CloudIcon color="success" />
                <Typography variant="h6">
                  Azureリソースアクセス可能
                </Typography>
              </Box>
              <Typography variant="body1" paragraph>
                個人のAzureテナントでログインしているため、Azureリソースの管理が可能です。
                左側のメニューから各種リソースの確認やコスト分析を行うことができます。
              </Typography>
              <Typography variant="body2" color="text.secondary">
                注意: 一部の機能は組織アカウントでのみ利用可能な場合があります。
              </Typography>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              次のステップ
            </Typography>
            <Typography variant="body1" paragraph>
              {hasAzureAccess 
                ? 'このアプリケーションの全機能が利用可能です。左側のメニューから各種リソースの確認やコスト分析を行うことができます。'
                : 'このアプリケーションの全機能を使用するには：'
              }
            </Typography>
            {!hasAzureAccess && (
              <Box component="ol" sx={{ pl: 3 }}>
                <li>組織アカウントまたはAzureサブスクリプションを取得</li>
                <li>適切なアカウントで再ログイン</li>
                <li>必要に応じて管理者にアクセス権限を依頼</li>
              </Box>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default PersonalAccountInfo;
