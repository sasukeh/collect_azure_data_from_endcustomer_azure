import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Box,
  Alert,
  CircularProgress,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { 
  Cloud as CloudIcon,
  AttachMoney as MoneyIcon,
  Assessment as MetricsIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useMsal } from '@azure/msal-react';
import { useAdminConsent } from '../../hooks/useAdminConsent';
import TenantInfo from '../../components/TenantInfo/TenantInfo';

interface DashboardData {
  resources: any[];
  costs: any[];
  subscriptions: any[];
  loading: boolean;
  lastUpdated: string | null;
}

interface DebugInfo {
  collectionsChecked: string[];
  documentCounts: Record<string, number>;
  lastError: string | null;
}

const DashboardPage: React.FC = () => {
  const { accounts } = useMsal();
  const { hasAdminConsent, loading: consentLoading, checkAdminConsent } = useAdminConsent();
  
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    resources: [],
    costs: [],
    subscriptions: [],
    loading: true,
    lastUpdated: null
  });
  
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    collectionsChecked: [],
    documentCounts: {},
    lastError: null
  });
  
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);

  const currentUser = accounts[0];
  const userId = currentUser?.homeAccountId;

  // Azure Functions APIからデータを取得（一時的にダミーデータを使用）
  const fetchAzureData = async () => {
    if (!userId || hasAdminConsent === null) return;
    
    setDashboardData(prev => ({ ...prev, loading: true }));
    
    try {
      // 一時的にダミーデータを使用してUI動作確認
      const resources = [
        { id: 'res1', name: 'Storage Account', type: 'Microsoft.Storage/storageAccounts', location: 'East Asia' },
        { id: 'res2', name: 'Function App', type: 'Microsoft.Web/sites', location: 'East Asia' },
        { id: 'res3', name: 'Cosmos DB', type: 'Microsoft.DocumentDB/databaseAccounts', location: 'East Asia' }
      ];
      
      const costs = [
        { service: 'Storage', cost: 5.23, currency: 'USD' },
        { service: 'Functions', cost: 2.15, currency: 'USD' },
        { service: 'Cosmos DB', cost: 12.45, currency: 'USD' }
      ];
      
      const subscriptions = [
        { id: 'sub1', name: 'Pay-As-You-Go', state: 'Enabled' }
      ];

      // 2秒の遅延を追加して実際のAPI呼び出しを模擬
      await new Promise(resolve => setTimeout(resolve, 2000));

      setDashboardData({
        resources,
        costs,
        subscriptions,
        loading: false,
        lastUpdated: new Date().toISOString()
      });

      setDebugInfo({
        collectionsChecked: ['resources', 'costs', 'subscriptions'],
        documentCounts: {
          resources: resources.length,
          costs: costs.length,
          subscriptions: subscriptions.length
        },
        lastError: null
      });

    } catch (error) {
      console.error('Error fetching Azure data:', error);
      setDebugInfo(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      }));
      setDashboardData(prev => ({ ...prev, loading: false }));
    }
  };

  // 初回データロード
  useEffect(() => {
    if (userId && hasAdminConsent === true) {
      fetchAzureData();
    }
  }, [userId, hasAdminConsent]);

  // データ収集の開始（一時的にダミー実装）
  const handleStartCollection = async () => {
    if (!userId || !hasAdminConsent) return;
    
    setIsCollecting(true);
    
    try {
      // 一時的にダミー実装：2秒待ってからデータを再取得
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Mock data collection completed');
      fetchAzureData();
    } catch (error) {
      console.error('Error starting data collection:', error);
    } finally {
      setIsCollecting(false);
    }
  };

  // 認証状態の確認
  if (!currentUser) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Alert severity="info">
          Azure認証が必要です。ログインしてください。
        </Alert>
      </Box>
    );
  }

  if (hasAdminConsent === null) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          権限を確認中...
        </Typography>
      </Box>
    );
  }

  if (hasAdminConsent === false) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Azure Management APIへのアクセス権限が必要です。管理者にアプリケーションの権限付与を依頼してください。
        </Alert>
        <TenantInfo />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Azure Data Dashboard
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button 
            startIcon={<InfoIcon />} 
            onClick={() => setShowDebugDialog(true)}
            variant="outlined"
          >
            Debug Info
          </Button>
          <Button 
            startIcon={<RefreshIcon />}
            onClick={fetchAzureData}
            variant="outlined"
            disabled={dashboardData.loading}
          >
            Refresh
          </Button>
          <Button 
            startIcon={<CloudIcon />}
            onClick={handleStartCollection}
            variant="contained"
            disabled={isCollecting}
          >
            {isCollecting ? <CircularProgress size={20} /> : 'Collect Data'}
          </Button>
        </Stack>
      </Box>

      {dashboardData.loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>
            データを読み込み中...
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* 概要カード */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <CloudIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h6">Azure Resources</Typography>
                    <Typography variant="h4">{dashboardData.resources.length}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <MoneyIcon color="secondary" sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h6">Cost Entries</Typography>
                    <Typography variant="h4">{dashboardData.costs.length}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <MetricsIcon color="success" sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h6">Subscriptions</Typography>
                    <Typography variant="h4">{dashboardData.subscriptions.length}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* 詳細データ */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Recent Resources
              </Typography>
              {dashboardData.resources.length > 0 ? (
                <List>
                  {dashboardData.resources.slice(0, 5).map((resource, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={resource.name || resource.id}
                        secondary={`Type: ${resource.type || 'Unknown'} | Location: ${resource.location || 'Unknown'}`}
                      />
                      <Chip label={resource.resourceGroup || 'No RG'} size="small" />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  リソースデータがありません。データ収集を実行してください。
                </Typography>
              )}
            </Paper>
          </Grid>

          {dashboardData.lastUpdated && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                最終更新: {new Date(dashboardData.lastUpdated).toLocaleString('ja-JP')}
              </Typography>
            </Grid>
          )}
        </Grid>
      )}

      {/* Debug Dialog */}
      <Dialog open={showDebugDialog} onClose={() => setShowDebugDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Debug Information</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>Collections Checked:</Typography>
          <List>
            {debugInfo.collectionsChecked.map((collection, index) => (
              <ListItem key={index}>
                <ListItemText 
                  primary={collection} 
                  secondary={`Documents: ${debugInfo.documentCounts[collection] || 0}`}
                />
              </ListItem>
            ))}
          </List>
          
          {debugInfo.lastError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="h6">Last Error:</Typography>
              <Typography>{debugInfo.lastError}</Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDebugDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardPage;
