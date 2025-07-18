import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Snackbar,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Cloud as CloudIcon,
  Storage as StorageIcon,
  Computer as ComputeIcon,
  NetworkCheck as NetworkIcon,
  Dataset as DatabaseIcon,
  Sync as SyncIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useSubscriptions, useResourceGroups, useResources } from '../../hooks/useAzureResources';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { useCurrentTenant } from '../../hooks/useTenantInfo';
import PersonalAccountInfo from '../../components/PersonalAccountInfo/PersonalAccountInfo';
import { useMsal } from '@azure/msal-react';
import { getAccountType, canAccessAzureManagement } from '../../config/authConfig';

// リソースタイプのアイコンマッピング
const getResourceIcon = (resourceType: string) => {
  if (resourceType.includes('storage')) return <StorageIcon />;
  if (resourceType.includes('compute') || resourceType.includes('virtualMachines')) return <ComputeIcon />;
  if (resourceType.includes('network')) return <NetworkIcon />;
  if (resourceType.includes('database') || resourceType.includes('sql')) return <DatabaseIcon />;
  return <CloudIcon />;
};

// リソースタイプの色分け
const getResourceTypeColor = (resourceType: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
  if (resourceType.includes('storage')) return 'info';
  if (resourceType.includes('compute')) return 'primary';
  if (resourceType.includes('network')) return 'secondary';
  if (resourceType.includes('database')) return 'success';
  if (resourceType.includes('web')) return 'warning';
  return 'primary';
};

interface ResourceRowProps {
  resource: any;
  isOpen: boolean;
  onToggle: () => void;
}

const ResourceRow = ({ resource, isOpen, onToggle }: ResourceRowProps) => {
  return (
    <>
      <TableRow>
        <TableCell>
          <IconButton size="small" onClick={onToggle}>
            {isOpen ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box display="flex" alignItems="center" gap={1}>
            {getResourceIcon(resource.type)}
            <Typography variant="body2" fontWeight="medium">
              {resource.name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Chip 
            label={resource.type.split('/').pop()} 
            color={getResourceTypeColor(resource.type)}
            size="small"
          />
        </TableCell>
        <TableCell>{resource.resourceGroup}</TableCell>
        <TableCell>{resource.location}</TableCell>
        <TableCell>
          {resource.tags && Object.keys(resource.tags).length > 0 ? (
            <Box display="flex" gap={0.5} flexWrap="wrap">
              {Object.entries(resource.tags).slice(0, 2).map(([key, value]) => (
                <Chip
                  key={key}
                  label={`${key}: ${value}`}
                  size="small"
                  variant="outlined"
                />
              ))}
              {Object.keys(resource.tags).length > 2 && (
                <Chip label={`+${Object.keys(resource.tags).length - 2}`} size="small" />
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">-</Typography>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box margin={1}>
              <Typography variant="h6" gutterBottom>
                リソース詳細
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>基本情報</Typography>
                    <Box component="div">
                      <Typography variant="body2" component="span">
                        <Box component="span" sx={{ fontWeight: 'bold' }}>ID:</Box> {resource.id}
                      </Typography>
                    </Box>
                    <Box component="div">
                      <Typography variant="body2" component="span">
                        <Box component="span" sx={{ fontWeight: 'bold' }}>タイプ:</Box> {resource.type}
                      </Typography>
                    </Box>
                    <Box component="div">
                      <Typography variant="body2" component="span">
                        <Box component="span" sx={{ fontWeight: 'bold' }}>種類:</Box> {resource.kind || 'N/A'}
                      </Typography>
                    </Box>
                    {resource.sku && (
                      <>
                        <Box component="div">
                          <Typography variant="body2" component="span">
                            <Box component="span" sx={{ fontWeight: 'bold' }}>SKU名:</Box> {resource.sku.name}
                          </Typography>
                        </Box>
                        <Box component="div">
                          <Typography variant="body2" component="span">
                            <Box component="span" sx={{ fontWeight: 'bold' }}>SKUティア:</Box> {resource.sku.tier}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>タグ</Typography>
                    {resource.tags && Object.keys(resource.tags).length > 0 ? (
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {Object.entries(resource.tags).map(([key, value]) => (
                          <Chip
                            key={key}
                            label={`${key}: ${value}`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">タグが設定されていません</Typography>
                    )}
                  </Paper>
                </Grid>
                {resource.properties && (
                  <Grid item xs={12}>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2">プロパティ詳細</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box 
                          component="div" 
                          sx={{ 
                            fontSize: '12px', 
                            overflow: 'auto', 
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            backgroundColor: 'grey.100',
                            p: 1,
                            borderRadius: 1
                          }}
                        >
                          {JSON.stringify(resource.properties, null, 2)}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const ResourcesPage = () => {
  const [selectedSubscription, setSelectedSubscription] = useState<string>('');
  const [selectedResourceGroup, setSelectedResourceGroup] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [showSnackbar, setShowSnackbar] = useState<boolean>(false);

  // MSAL情報取得
  const { accounts } = useMsal();
  const currentAccount = accounts[0];
  const accountType = getAccountType(currentAccount);
  const hasAzureAccess = canAccessAzureManagement(accountType);

  // テナント情報取得
  const { data: currentTenant } = useCurrentTenant();
  
  // 個人アカウント（Azure アクセス権限なし）かどうかのチェック
  const isPersonalAccount = currentTenant?.tenantType === 'Personal' || !hasAzureAccess;

  // Azure データ取得フック（個人アカウントの場合はスキップ）
  const { data: subscriptions, isLoading: subscriptionsLoading, error: subscriptionsError } = useSubscriptions();
  const { data: resourceGroups, isLoading: resourceGroupsLoading } = useResourceGroups(selectedSubscription);
  const { data: resources, isLoading: resourcesLoading, error: resourcesError } = useResources(
    selectedSubscription, 
    selectedResourceGroup || undefined
  );

  // Firebase同期フック
  const { saveSubscriptions, saveResourceGroups, saveResources, saveSyncLog } = useFirebaseSync();

  // 個人アカウント（Azureアクセス権限なし）の場合は専用の画面を表示
  if (isPersonalAccount) {
    return <PersonalAccountInfo account={currentAccount} />;
  }

  // フィルタリングされたリソース
  const filteredResources = useMemo(() => {
    if (!resources) return [];

    return resources.filter(resource => {
      const matchesSearch = searchQuery === '' || 
        resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = filterType === '' || resource.type.includes(filterType);

      return matchesSearch && matchesType;
    });
  }, [resources, searchQuery, filterType]);

  // リソースタイプの一覧（フィルタ用）
  const resourceTypes = useMemo(() => {
    if (!resources) return [];
    const types = [...new Set(resources.map(r => r.type))];
    return types.sort();
  }, [resources]);

  const handleRowToggle = (resourceId: string) => {
    const newOpenRows = new Set(openRows);
    if (newOpenRows.has(resourceId)) {
      newOpenRows.delete(resourceId);
    } else {
      newOpenRows.add(resourceId);
    }
    setOpenRows(newOpenRows);
  };

  // CSVエクスポート機能
  const handleExportCSV = () => {
    if (!filteredResources || filteredResources.length === 0) {
      setSyncStatus('エクスポートするデータがありません');
      setShowSnackbar(true);
      return;
    }

    // CSVヘッダー
    const headers = ['名前', 'タイプ', 'リソースグループ', '場所', 'サブスクリプション', 'SKU', 'タグ'];
    
    // CSVデータ
    const csvData = filteredResources.map(resource => [
      resource.name,
      resource.type,
      resource.resourceGroup,
      resource.location,
      resource.subscriptionId,
      resource.sku ? `${resource.sku.name} (${resource.sku.tier})` : '',
      resource.tags ? Object.entries(resource.tags).map(([k, v]) => `${k}:${v}`).join('; ') : ''
    ]);

    // CSV文字列を作成
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // ダウンロード
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `azure-resources-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    setSyncStatus(`${filteredResources.length}件のリソースをCSVでエクスポートしました`);
    setShowSnackbar(true);
  };
  const handleSyncToFirebase = async () => {
    if (!subscriptions || !resourceGroups || !resources) {
      setSyncStatus('同期するデータがありません');
      setShowSnackbar(true);
      return;
    }

    setIsSyncing(true);
    setSyncStatus('');

    try {
      // テナントIDは実際の実装では認証情報から取得
      const tenantId = 'current-tenant'; // 仮のテナントID

      // 並列で各データタイプを保存
      await Promise.all([
        saveSubscriptions(subscriptions, tenantId),
        saveResourceGroups(resourceGroups, tenantId),
        saveResources(resources, tenantId),
      ]);

      await saveSyncLog('resources_sync', 'success', {
        subscriptionsCount: subscriptions.length,
        resourceGroupsCount: resourceGroups.length,
        resourcesCount: resources.length,
      }, tenantId);

      setSyncStatus(`同期完了: ${subscriptions.length}サブスクリプション, ${resourceGroups.length}リソースグループ, ${resources.length}リソース`);
      setShowSnackbar(true);

    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('同期中にエラーが発生しました');
      setShowSnackbar(true);

      // エラーログを保存
      await saveSyncLog('resources_sync', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'current-tenant');
    } finally {
      setIsSyncing(false);
    }
  };

  if (subscriptionsError || resourcesError) {
    return (
      <Container maxWidth="xl">
        <Alert severity="error" sx={{ mt: 2 }}>
          データの取得中にエラーが発生しました: {subscriptionsError?.message || resourcesError?.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Azureリソース
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportCSV}
            disabled={!filteredResources || filteredResources.length === 0}
          >
            CSVエクスポート
          </Button>
          <Button
            variant="contained"
            startIcon={isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSyncToFirebase}
            disabled={isSyncing || !selectedSubscription}
            sx={{ minWidth: 180 }}
          >
            {isSyncing ? '同期中...' : 'Firebaseに同期'}
          </Button>
        </Box>
      </Box>

      {/* フィルタ・検索エリア */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>サブスクリプション</InputLabel>
              <Select
                value={selectedSubscription}
                onChange={(e: any) => {
                  setSelectedSubscription(e.target.value);
                  setSelectedResourceGroup(''); // リセット
                }}
                disabled={subscriptionsLoading}
              >
                {subscriptions?.map((sub) => (
                  <MenuItem key={sub.subscriptionId} value={sub.subscriptionId}>
                    {sub.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>リソースグループ</InputLabel>
              <Select
                value={selectedResourceGroup}
                onChange={(e: any) => setSelectedResourceGroup(e.target.value)}
                disabled={!selectedSubscription || resourceGroupsLoading}
              >
                <MenuItem value="">すべて</MenuItem>
                {resourceGroups?.map((rg) => (
                  <MenuItem key={rg.name} value={rg.name}>
                    {rg.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>リソースタイプ</InputLabel>
              <Select
                value={filterType}
                onChange={(e: any) => setFilterType(e.target.value)}
              >
                <MenuItem value="">すべて</MenuItem>
                {resourceTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type.split('/').pop()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="検索"
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
              placeholder="リソース名、タイプ、場所で検索"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* サマリーカード */}
      {resources && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  総リソース数
                </Typography>
                <Typography variant="h4">
                  {filteredResources.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  リソースタイプ数
                </Typography>
                <Typography variant="h4">
                  {new Set(filteredResources.map(r => r.type)).size}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  場所数
                </Typography>
                <Typography variant="h4">
                  {new Set(filteredResources.map(r => r.location)).size}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  リソースグループ数
                </Typography>
                <Typography variant="h4">
                  {new Set(filteredResources.map(r => r.resourceGroup)).size}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* リソース一覧テーブル */}
      <Paper>
        {resourcesLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : !selectedSubscription ? (
          <Box p={4} textAlign="center">
            <Typography variant="h6" color="textSecondary">
              サブスクリプションを選択してください
            </Typography>
          </Box>
        ) : filteredResources.length === 0 ? (
          <Box p={4} textAlign="center">
            <Typography variant="h6" color="textSecondary">
              リソースが見つかりません
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width="50px"></TableCell>
                  <TableCell>名前</TableCell>
                  <TableCell>タイプ</TableCell>
                  <TableCell>リソースグループ</TableCell>
                  <TableCell>場所</TableCell>
                  <TableCell>タグ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredResources.map((resource) => (
                  <ResourceRow
                    key={resource.id}
                    resource={resource}
                    isOpen={openRows.has(resource.id)}
                    onToggle={() => handleRowToggle(resource.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 同期状況スナックバー */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={6000}
        onClose={() => setShowSnackbar(false)}
        message={syncStatus}
      />
    </Container>
  );
};

export default ResourcesPage;
