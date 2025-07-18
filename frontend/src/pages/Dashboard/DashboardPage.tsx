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
  const { accounts, instance } = useMsal();
  const { firebaseUser, isFirebaseAuthenticated, authenticateWithFirebase } = useFirebaseAuth();
  const { hasAdminConsent } = useAdminConsent();
  const [data, setData] = useState<DashboardData>({
    resources: [],
    costs: [],
    subscriptions: [],
    loading: true,
    lastUpdated: null
  });
  const [isAutoAuthenticating, setIsAutoAuthenticating] = useState(false);
  const [authAttempts, setAuthAttempts] = useState(0);
  const [lastAuthAttempt, setLastAuthAttempt] = useState<number | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    collectionsChecked: [],
    documentCounts: {},
    lastError: null
  });
  const [isCollecting, setIsCollecting] = useState(false);
  const [showDebug, setShowDebug] = useState(true);

  const currentUser = accounts[0];
  const userId = firebaseUser?.uid;

  // MSAL認証完了後に自動でFirebase認証を実行（無限ループ防止付き）
  useEffect(() => {
    const now = Date.now();
    const RETRY_INTERVAL = 30000; // 30秒間隔
    const MAX_ATTEMPTS = 3; // 最大3回試行

    if (
      accounts.length > 0 && 
      !isFirebaseAuthenticated && 
      !isAutoAuthenticating &&
      authAttempts < MAX_ATTEMPTS &&
      (!lastAuthAttempt || now - lastAuthAttempt > RETRY_INTERVAL)
    ) {
      setIsAutoAuthenticating(true);
      setLastAuthAttempt(now);
      
      authenticateWithFirebase()
        .then(() => {
          console.log('Auto Firebase authentication completed');
          setAuthAttempts(0); // 成功時はリセット
        })
        .catch((error) => {
          console.error('Auto Firebase authentication failed:', error);
          setAuthAttempts(prev => prev + 1);
        })
        .finally(() => {
          setIsAutoAuthenticating(false);
        });
    }
  }, [accounts, isFirebaseAuthenticated, authenticateWithFirebase, isAutoAuthenticating, authAttempts, lastAuthAttempt]);

  // Firestore データリスナーのセットアップ
  useEffect(() => {
    if (!userId) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    console.log('Setting up Firestore listeners for user:', userId);
    
    const unsubscribers: (() => void)[] = [];
    const newDebugInfo: DebugInfo = {
      collectionsChecked: [],
      documentCounts: {},
      lastError: null
    };

    // 複数のコレクション構造をチェック
    const checkCollections = async () => {
      try {
        // パターン1: ユーザー直下のコレクション
        const userResourcesRef = collection(db, 'users', userId, 'resources');
        const userCostsRef = collection(db, 'users', userId, 'costs');
        const userSubscriptionsRef = collection(db, 'users', userId, 'subscriptions');

        // パターン2: テナント構造
        const userTenantsRef = collection(db, 'users', userId, 'tenants');

        // ユーザー直下のコレクションをチェック
        const userResourcesSnapshot = await getDocs(userResourcesRef);
        const userCostsSnapshot = await getDocs(userCostsRef);
        const userSubscriptionsSnapshot = await getDocs(userSubscriptionsRef);
        const userTenantsSnapshot = await getDocs(userTenantsRef);

        newDebugInfo.collectionsChecked = [
          `users/${userId}/resources`,
          `users/${userId}/costs`,
          `users/${userId}/subscriptions`,
          `users/${userId}/tenants`
        ];
        newDebugInfo.documentCounts = {
          'user_resources': userResourcesSnapshot.size,
          'user_costs': userCostsSnapshot.size,
          'user_subscriptions': userSubscriptionsSnapshot.size,
          'user_tenants': userTenantsSnapshot.size
        };

        console.log('Debug info:', newDebugInfo);
        setDebugInfo(newDebugInfo);

        // データ初期化
        let allResources: any[] = [];
        let allCosts: any[] = [];
        let allSubscriptions: any[] = [];

        // ユーザー直下のデータを取得
        if (userResourcesSnapshot.size > 0) {
          allResources = userResourcesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        if (userCostsSnapshot.size > 0) {
          allCosts = userCostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        if (userSubscriptionsSnapshot.size > 0) {
          allSubscriptions = userSubscriptionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // テナント構造のデータもチェック
        if (userTenantsSnapshot.size > 0) {
          for (const tenantDoc of userTenantsSnapshot.docs) {
            const tenantId = tenantDoc.id;
            const tenantResourcesRef = collection(db, 'users', userId, 'tenants', tenantId, 'resources');
            const tenantCostsRef = collection(db, 'users', userId, 'tenants', tenantId, 'costs');
            const tenantSubscriptionsRef = collection(db, 'users', userId, 'tenants', tenantId, 'subscriptions');

            const [tenantResources, tenantCosts, tenantSubscriptions] = await Promise.all([
              getDocs(tenantResourcesRef),
              getDocs(tenantCostsRef),
              getDocs(tenantSubscriptionsRef)
            ]);

            newDebugInfo.documentCounts[`tenant_${tenantId}_resources`] = tenantResources.size;
            newDebugInfo.documentCounts[`tenant_${tenantId}_costs`] = tenantCosts.size;
            newDebugInfo.documentCounts[`tenant_${tenantId}_subscriptions`] = tenantSubscriptions.size;

            // テナントデータを結合
            allResources.push(...tenantResources.docs.map(doc => ({ id: doc.id, tenantId, ...doc.data() })));
            allCosts.push(...tenantCosts.docs.map(doc => ({ id: doc.id, tenantId, ...doc.data() })));
            allSubscriptions.push(...tenantSubscriptions.docs.map(doc => ({ id: doc.id, tenantId, ...doc.data() })));
          }
        }

        console.log('All collected data:', {
          resources: allResources.length,
          costs: allCosts.length,
          subscriptions: allSubscriptions.length
        });

        setData({
          resources: allResources,
          costs: allCosts,
          subscriptions: allSubscriptions,
          loading: false,
          lastUpdated: new Date().toLocaleString()
        });

        setDebugInfo({ ...newDebugInfo });

        // リアルタイムリスナーのセットアップ
        const resourcesUnsubscribe = onSnapshot(userResourcesRef, (snapshot) => {
          const resources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log('Resources updated:', resources.length);
          setData(prev => ({ ...prev, resources, lastUpdated: new Date().toLocaleString() }));
        });

        const costsUnsubscribe = onSnapshot(userCostsRef, (snapshot) => {
          const costs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log('Costs updated:', costs.length);
          setData(prev => ({ ...prev, costs, lastUpdated: new Date().toLocaleString() }));
        });

        const subscriptionsUnsubscribe = onSnapshot(userSubscriptionsRef, (snapshot) => {
          const subscriptions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log('Subscriptions updated:', subscriptions.length);
          setData(prev => ({ ...prev, subscriptions, lastUpdated: new Date().toLocaleString() }));
        });

        unsubscribers.push(resourcesUnsubscribe, costsUnsubscribe, subscriptionsUnsubscribe);

      } catch (error) {
        console.error('Error setting up Firestore listeners:', error);
        newDebugInfo.lastError = error instanceof Error ? error.message : 'Unknown error';
        setDebugInfo(newDebugInfo);
        setData(prev => ({ ...prev, loading: false }));
      }
    };

    checkCollections();

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [userId]);

  const collectData = async () => {
    if (!userId || !currentUser) return;

    setIsCollecting(true);
    try {
      // MSALからアクセストークンを取得（ユーザー認証）
      const request = {
        scopes: ['https://management.azure.com/.default'],
        account: currentUser
      };

      const response = await instance.acquireTokenSilent(request);
      const accessToken = response.accessToken;

      // ユーザーのアクセストークンを使ってAzure APIを呼び出し
      const apiResponse = await fetch('https://collect-real-azure-data-tdve4ode6q-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          tenantId: currentUser.tenantId,
          accessToken: accessToken,
          authMethod: 'user_token' // ユーザーのトークンを使用
        }),
      });

      const result = await apiResponse.json();
      console.log('Azure data collection result:', result);
      
      if (apiResponse.ok && result.success) {
        setDebugInfo(prev => ({
          ...prev,
          lastError: null
        }));
        console.log('✅ Real Azure data collected successfully:', result);
      } else {
        // エラーの詳細情報を表示
        const errorMessage = result.error || result.message || `HTTP ${apiResponse.status}`;
        const troubleshooting = result.troubleshooting ? 
          `\n\n推奨対処法:\n${result.troubleshooting.next_steps?.join('\n') || ''}` : '';
        
        setDebugInfo(prev => ({
          ...prev,
          lastError: `${errorMessage}${troubleshooting}`
        }));
      }
    } catch (error) {
      console.error('Error collecting data:', error);
      setDebugInfo(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Data collection failed'
      }));
    } finally {
      setIsCollecting(false);
    }
  };

  const clearAllData = async () => {
    if (!userId) return;

    try {
      const batch = writeBatch(db);
      
      // ユーザー直下のコレクションをクリア
      const collections = ['resources', 'costs', 'subscriptions'];
      
      for (const collectionName of collections) {
        const collectionRef = collection(db, 'users', userId, collectionName);
        const snapshot = await getDocs(collectionRef);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }

      await batch.commit();
      console.log('All data cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  };

  const [showCredentialForm, setShowCredentialForm] = useState(false);

  const collectDataWithUserToken = async () => {
    if (!userId || !currentUser) return;

    setIsCollecting(true);
    try {
      // MSALからアクセストークンを取得
      const request = {
        scopes: ['https://management.azure.com/.default'],
        account: currentUser
      };

      const response = await instance.acquireTokenSilent(request);
      const accessToken = response.accessToken;

      // ユーザーのアクセストークンを使ってAzure APIを呼び出し
      const apiResponse = await fetch('https://collect-real-azure-data-tdve4ode6q-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          tenantId: currentUser.tenantId,
          accessToken: accessToken, // Client ID/Secretの代わりにアクセストークン
          authMethod: 'user_token' // 新しい認証方式を指定
        }),
      });

      const result = await apiResponse.json();
      console.log('Azure data collection result:', result);
      
      if (apiResponse.ok && result.success) {
        setDebugInfo(prev => ({
          ...prev,
          lastError: null
        }));
        setShowCredentialForm(false); // 成功したらフォームを閉じる
        console.log('✅ Real Azure data collected successfully:', result);
      } else {
        // エラーの詳細情報を表示
        const errorMessage = result.error || result.message || `HTTP ${apiResponse.status}`;
        const troubleshooting = result.troubleshooting ? 
          `\n\n推奨対処法:\n${result.troubleshooting.next_steps?.join('\n') || ''}` : '';
        
        setDebugInfo(prev => ({
          ...prev,
          lastError: `${errorMessage}${troubleshooting}`
        }));
      }
    } catch (error) {
      console.error('Error collecting data:', error);
      setDebugInfo(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Data collection failed'
      }));
    } finally {
      setIsCollecting(false);
    }
  };

  const StatCard: React.FC<{ title: string; count: number; icon: React.ReactNode; color: string }> = ({ title, count, icon, color }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="h2" color={color}>
              {count}
            </Typography>
          </Box>
          <Box color={color}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (!isFirebaseAuthenticated) {
    // MSAL認証済みの場合は自動認証中のローディングを表示
    if (accounts.length > 0) {
      return (
        <Box sx={{ flexGrow: 1, p: 3, textAlign: 'center' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            認証処理中...
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Firebase認証を自動実行しています
          </Typography>
        </Box>
      );
    }

    // MSAL未認証の場合は手動認証ボタンを表示
    return (
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Alert severity="warning">
          認証が必要です。ログインしてください。
        </Alert>
        <Button onClick={authenticateWithFirebase} variant="contained" sx={{ mt: 2 }}>
          認証
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Azure Data Dashboard
      </Typography>
      
      {/* デバッグ情報 */}
      {showDebug && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
          <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
            <Typography variant="h6" color="textSecondary">
              <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              デバッグ情報
            </Typography>
            <Button size="small" onClick={() => setShowDebug(false)}>非表示</Button>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>ユーザーID:</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'white', p: 1, borderRadius: 1 }}>
                {userId || '未設定'}
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>最終更新:</Typography>
              <Typography variant="body2">
                {data.lastUpdated || 'なし'}
              </Typography>
              
              {debugInfo.lastError && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }} color="error">エラー:</Typography>
                  <Typography variant="body2" color="error">
                    {debugInfo.lastError}
                  </Typography>
                </>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>Firestoreコレクション:</Typography>
              <List dense>
                {debugInfo.collectionsChecked.map((collection, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemText 
                      primary={collection}
                      secondary={`ドキュメント数: ${Object.entries(debugInfo.documentCounts).find(([key]) => collection.includes(key.split('_').slice(-1)[0]))?.[1] || 0}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* 統計カード */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="リソース"
            count={data.resources.length}
            icon={<CloudIcon sx={{ fontSize: 40 }} />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="コスト項目"
            count={data.costs.length}
            icon={<MoneyIcon sx={{ fontSize: 40 }} />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="サブスクリプション"
            count={data.subscriptions.length}
            icon={<MetricsIcon sx={{ fontSize: 40 }} />}
            color="info.main"
          />
        </Grid>
      </Grid>

      {/* アクションボタン */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={isCollecting ? <CircularProgress size={20} /> : <RefreshIcon />}
          onClick={collectData}
          disabled={isCollecting || !hasAdminConsent}
        >
          {isCollecting ? 'データ収集中...' : 'データ収集'}
        </Button>
        <Button variant="outlined" onClick={() => setShowCredentialForm(true)}>
          認証情報確認
        </Button>
        <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={clearAllData}>
          データクリア
        </Button>
        {!showDebug && (
          <Button variant="text" startIcon={<InfoIcon />} onClick={() => setShowDebug(true)}>
            デバッグ情報表示
          </Button>
        )}
      </Stack>

      {/* 管理者同意の状態 */}
      {!hasAdminConsent && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          管理者の同意が必要です。データ収集を行うには管理者の同意を取得してください。
        </Alert>
      )}

      {/* データ表示領域 */}
      {data.loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* リソース一覧 */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <CloudIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Azure リソース
                </Typography>
                <List>
                  {data.resources.length === 0 ? (
                    <ListItem>
                      <ListItemText primary="データがありません" />
                    </ListItem>
                  ) : (
                    data.resources.slice(0, 5).map((resource, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={resource.name || resource.resourceName || `Resource ${index + 1}`}
                          secondary={`${resource.type || resource.resourceType || 'Unknown'} - ${resource.region || resource.location || 'Unknown'}`}
                        />
                      </ListItem>
                    ))
                  )}
                  {data.resources.length > 5 && (
                    <ListItem>
                      <ListItemText primary={`他 ${data.resources.length - 5} 件...`} />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* コスト一覧 */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <MoneyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  コスト分析
                </Typography>
                <List>
                  {data.costs.length === 0 ? (
                    <ListItem>
                      <ListItemText primary="データがありません" />
                    </ListItem>
                  ) : (
                    data.costs.slice(0, 5).map((cost, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={cost.service || cost.serviceName || `Service ${index + 1}`}
                          secondary={`${cost.cost || cost.amount || 0} ${cost.currency || 'USD'} / ${cost.period || 'month'}`}
                        />
                      </ListItem>
                    ))
                  )}
                  {data.costs.length > 5 && (
                    <ListItem>
                      <ListItemText primary={`他 ${data.costs.length - 5} 件...`} />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* サブスクリプション一覧 */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <MetricsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  サブスクリプション
                </Typography>
                <List>
                  {data.subscriptions.length === 0 ? (
                    <ListItem>
                      <ListItemText primary="データがありません" />
                    </ListItem>
                  ) : (
                    data.subscriptions.map((subscription, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={subscription.displayName || subscription.name || `Subscription ${index + 1}`}
                          secondary={
                            <>
                              {subscription.subscriptionId || subscription.id || 'Unknown ID'}
                              <Chip 
                                label={subscription.state || subscription.status || 'Unknown'} 
                                size="small" 
                                sx={{ ml: 1 }}
                                color={subscription.state === 'Enabled' || subscription.status === 'Active' ? 'success' : 'default'}
                              />
                            </>
                          }
                        />
                      </ListItem>
                    ))
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* テナント情報 */}
      <Box sx={{ mt: 3 }}>
        <TenantInfo />
      </Box>

      {/* Azure認証情報確認ダイアログ */}
      <Dialog open={showCredentialForm} onClose={() => setShowCredentialForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Azure認証情報</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            ユーザーのログイン情報を使用してAzureデータを収集します。
            追加の認証情報設定は不要です。
          </Alert>
          
          <TextField
            fullWidth
            label="ユーザーID"
            value={currentUser?.username || currentUser?.name || '未設定'}
            disabled
            margin="normal"
          />
          <TextField
            fullWidth
            label="テナントID"
            value={currentUser?.tenantId || '未設定'}
            disabled
            margin="normal"
          />
          <TextField
            fullWidth
            label="認証方式"
            value="MSALユーザートークン"
            disabled
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCredentialForm(false)}>閉じる</Button>
          <Button onClick={collectDataWithUserToken} variant="contained" disabled={isCollecting}>
            {isCollecting ? 'データ収集中...' : 'データ収集開始'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardPage;
