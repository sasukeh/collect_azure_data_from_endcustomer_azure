import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Chip,
  Alert,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  ButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Savings as SavingsIcon,
  Assessment as AssessmentIcon,
  Money as MoneyIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { collection, onSnapshot, query, orderBy, limit } from '../../config/firebase';
import { db } from '../../config/firebase';
import { useFirebaseAuth } from '../../hooks/useFirebaseAuth';

interface CostData {
  id?: string;
  date: string;
  service_name: string;
  cost: number;
  currency: string;
  subscription_id: string;
  tenant_id: string;
  collected_at: string;
}

interface ResourceData {
  id?: string;
  name: string;
  type: string;
  location: string;
  resourceGroup: string;
  subscriptionId: string;
  tags: Record<string, string>;
  collected_at: string;
}

interface WasteAnalysis {
  type: 'unused_resource' | 'oversized_resource' | 'untagged_resource' | 'idle_resource';
  severity: 'high' | 'medium' | 'low';
  resource: string;
  estimatedMonthlySavings: number;
  description: string;
  recommendation: string;
}

interface PredictionData {
  month: string;
  predictedCost: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

const CostAnalysisPage: React.FC = () => {
  const { firebaseUser, isFirebaseAuthenticated } = useFirebaseAuth();
  const [costs, setCosts] = useState<CostData[]>([]);
  const [resources, setResources] = useState<ResourceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '365d'>('30d');
  const [viewMode, setViewMode] = useState<'overview' | 'predictions' | 'waste'>('overview');

  // リアルタイムデータ取得
  useEffect(() => {
    if (!firebaseUser?.uid || !isFirebaseAuthenticated) return;

    setLoading(true);

    const unsubscribers: (() => void)[] = [];

    try {
      // コストデータのリスナー
      const costsQuery = query(
        collection(db, 'users', firebaseUser.uid, 'costs'),
        orderBy('collected_at', 'desc'),
        limit(1000)
      );
      
      const unsubCosts = onSnapshot(costsQuery, (snapshot) => {
        const costsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CostData[];
        setCosts(costsData);
      });
      unsubscribers.push(unsubCosts);

      // リソースデータのリスナー
      const resourcesQuery = query(
        collection(db, 'users', firebaseUser.uid, 'resources'),
        orderBy('collected_at', 'desc'),
        limit(500)
      );
      
      const unsubResources = onSnapshot(resourcesQuery, (snapshot) => {
        const resourcesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ResourceData[];
        setResources(resourcesData);
        setLoading(false);
      });
      unsubscribers.push(unsubResources);

    } catch (error) {
      console.error('データ取得エラー:', error);
      setLoading(false);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [firebaseUser?.uid, isFirebaseAuthenticated]);

  // 時系列コストデータの処理
  const processedCostData = useMemo(() => {
    const now = new Date();
    const daysBack = parseInt(timeRange.replace('d', ''));
    const cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    const filteredCosts = costs.filter(cost => {
      const costDate = new Date(cost.date);
      return costDate >= cutoffDate;
    });

    // 日付別にグループ化
    const groupedByDate = filteredCosts.reduce((acc, cost) => {
      const date = cost.date.split('T')[0]; // YYYY-MM-DD形式
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += cost.cost;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(groupedByDate)
      .map(([date, totalCost]) => ({
        date,
        cost: Math.round(totalCost * 100) / 100
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [costs, timeRange]);

  // サービス別コスト分析
  const serviceBreakdown = useMemo(() => {
    const serviceMap = costs.reduce((acc, cost) => {
      if (!acc[cost.service_name]) {
        acc[cost.service_name] = 0;
      }
      acc[cost.service_name] += cost.cost;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(serviceMap)
      .map(([service, cost]) => ({
        service,
        cost: Math.round(cost * 100) / 100
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10); // トップ10
  }, [costs]);

  // 予測アルゴリズム（線形回帰ベース）
  const generatePredictions = (): PredictionData[] => {
    if (processedCostData.length < 7) return [];

    const recent7Days = processedCostData.slice(-7);
    const avgDailyCost = recent7Days.reduce((sum, day) => sum + day.cost, 0) / recent7Days.length;
    
    // 簡単な線形トレンド計算
    const trend = recent7Days.length > 1 
      ? (recent7Days[recent7Days.length - 1].cost - recent7Days[0].cost) / recent7Days.length
      : 0;

    const predictions: PredictionData[] = [];
    const currentDate = new Date();

    for (let i = 1; i <= 6; i++) {
      const futureDate = new Date(currentDate);
      futureDate.setMonth(futureDate.getMonth() + i);
      
      const predictedDailyCost = avgDailyCost + (trend * 30 * i);
      const predictedMonthlyCost = predictedDailyCost * 30;
      
      predictions.push({
        month: futureDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' }),
        predictedCost: Math.max(0, Math.round(predictedMonthlyCost * 100) / 100),
        confidence: Math.max(0.5, 0.9 - (i * 0.1)), // 信頼度は時間とともに下がる
        trend: trend > 5 ? 'increasing' : trend < -5 ? 'decreasing' : 'stable'
      });
    }

    return predictions;
  };

  const predictions = generatePredictions();

  // 無駄分析
  const wasteAnalysis: WasteAnalysis[] = useMemo(() => {
    const waste: WasteAnalysis[] = [];

    // タグなしリソース検出
    const untaggedResources = resources.filter(resource => 
      !resource.tags || Object.keys(resource.tags).length === 0
    );

    untaggedResources.forEach(resource => {
      waste.push({
        type: 'untagged_resource',
        severity: 'medium',
        resource: resource.name,
        estimatedMonthlySavings: 0,
        description: 'タグが付けられていないリソース',
        recommendation: 'コスト管理とアクセス制御のためにタグを追加してください'
      });
    });

    // 高コストサービスの検出（月額$100以上）
    serviceBreakdown.forEach(service => {
      if (service.cost > 100) {
        waste.push({
          type: 'oversized_resource',
          severity: 'high',
          resource: service.service,
          estimatedMonthlySavings: service.cost * 0.3, // 30%の節約可能性を仮定
          description: `高コストサービス: $${service.cost}/月`,
          recommendation: 'リソースサイズの最適化や不要なインスタンスの削除を検討してください'
        });
      }
    });

    return waste.sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings);
  }, [resources, serviceBreakdown]);

  const totalMonthlyCost = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return costs
      .filter(cost => new Date(cost.date) >= thirtyDaysAgo)
      .reduce((sum, cost) => sum + cost.cost, 0);
  }, [costs]);

  const potentialSavings = wasteAnalysis.reduce((sum, item) => sum + item.estimatedMonthlySavings, 0);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <LinearProgress />
          <Typography sx={{ mt: 2 }}>コストデータを読み込み中...</Typography>
        </Paper>
      </Container>
    );
  }

  // データがない場合の表示
  if (costs.length === 0 && resources.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1">
            <AssessmentIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
            コスト分析
          </Typography>
        </Box>
        
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <WarningIcon color="warning" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            コストデータがありません
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
            コスト分析を表示するには、まずAzureデータを収集してください。
            ダッシュボードページで「データ収集」を実行してから、再度このページを確認してください。
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            注意: 現在はモックデータが削除されており、実際のAzure APIとの連携が必要です。
          </Alert>
        </Paper>
      </Container>
    );
  }

  const handleTimeRangeChange = (event: SelectChangeEvent) => {
    setTimeRange(event.target.value as '7d' | '30d' | '90d' | '365d');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
          コスト分析
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>期間</InputLabel>
            <Select
              value={timeRange}
              label="期間"
              onChange={handleTimeRangeChange}
            >
              <MenuItem value="7d">7日間</MenuItem>
              <MenuItem value="30d">30日間</MenuItem>
              <MenuItem value="90d">90日間</MenuItem>
              <MenuItem value="365d">1年間</MenuItem>
            </Select>
          </FormControl>

          <ButtonGroup variant="outlined" size="small">
            <Button 
              variant={viewMode === 'overview' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('overview')}
            >
              概要
            </Button>
            <Button 
              variant={viewMode === 'predictions' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('predictions')}
            >
              予測
            </Button>
            <Button 
              variant={viewMode === 'waste' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('waste')}
            >
              無駄分析
            </Button>
          </ButtonGroup>
        </Box>
      </Box>

      {/* サマリーカード */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <MoneyIcon color="primary" sx={{ mr: 1 }} />
                <Typography color="textSecondary" gutterBottom>
                  月間コスト
                </Typography>
              </Box>
              <Typography variant="h5">
                ${totalMonthlyCost.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SavingsIcon color="success" sx={{ mr: 1 }} />
                <Typography color="textSecondary" gutterBottom>
                  節約可能額
                </Typography>
              </Box>
              <Typography variant="h5" color="success.main">
                ${potentialSavings.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon color="info" sx={{ mr: 1 }} />
                <Typography color="textSecondary" gutterBottom>
                  トレンド
                </Typography>
              </Box>
              <Typography variant="h6">
                {predictions.length > 0 ? 
                  (predictions[0].trend === 'increasing' ? '上昇' : 
                   predictions[0].trend === 'decreasing' ? '下降' : '安定') 
                  : '不明'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <WarningIcon color="warning" sx={{ mr: 1 }} />
                <Typography color="textSecondary" gutterBottom>
                  無駄項目
                </Typography>
              </Box>
              <Typography variant="h5">
                {wasteAnalysis.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* メインコンテンツ */}
      {viewMode === 'overview' && (
        <Grid container spacing={3}>
          {/* コストトレンドテーブル */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                コストトレンド（直近{timeRange}）
              </Typography>
              {processedCostData.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>日付</TableCell>
                        <TableCell align="right">コスト (USD)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {processedCostData.slice(-10).map((item) => (
                        <TableRow key={item.date}>
                          <TableCell>{item.date}</TableCell>
                          <TableCell align="right">${item.cost.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">
                  コストデータがありません。データ収集を実行してください。
                </Alert>
              )}
            </Paper>
          </Grid>

          {/* サービス別内訳テーブル */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                サービス別コスト (上位10件)
              </Typography>
              {serviceBreakdown.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>サービス</TableCell>
                        <TableCell align="right">コスト (USD)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {serviceBreakdown.map((item) => (
                        <TableRow key={item.service}>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{item.service}</TableCell>
                          <TableCell align="right">${item.cost.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">
                  サービス別データがありません。
                </Alert>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {viewMode === 'predictions' && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                コスト予測（今後6ヶ月）
              </Typography>
              {predictions.length > 0 ? (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>月</TableCell>
                          <TableCell align="right">予測コスト (USD)</TableCell>
                          <TableCell align="right">信頼度</TableCell>
                          <TableCell>トレンド</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {predictions.map((prediction) => (
                          <TableRow key={prediction.month}>
                            <TableCell>{prediction.month}</TableCell>
                            <TableCell align="right">${prediction.predictedCost.toFixed(2)}</TableCell>
                            <TableCell align="right">{(prediction.confidence * 100).toFixed(0)}%</TableCell>
                            <TableCell>
                              <Chip 
                                size="small"
                                label={
                                  prediction.trend === 'increasing' ? '上昇' : 
                                  prediction.trend === 'decreasing' ? '下降' : '安定'
                                }
                                color={
                                  prediction.trend === 'increasing' ? 'warning' : 
                                  prediction.trend === 'decreasing' ? 'success' : 'default'
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Alert severity="info" sx={{ mt: 2 }}>
                    予測は過去のデータトレンドに基づいています。実際のコストは使用パターンの変更により異なる場合があります。
                  </Alert>
                </>
              ) : (
                <Alert severity="warning">
                  予測を生成するには、少なくとも7日間のデータが必要です。
                </Alert>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {viewMode === 'waste' && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                無駄分析と最適化提案
              </Typography>
              
              {wasteAnalysis.length > 0 ? (
                <List>
                  {wasteAnalysis.map((waste, index) => (
                    <React.Fragment key={index}>
                      <ListItem alignItems="flex-start">
                        <ListItemIcon>
                          {waste.severity === 'high' ? (
                            <ErrorIcon color="error" />
                          ) : waste.severity === 'medium' ? (
                            <WarningIcon color="warning" />
                          ) : (
                            <ScheduleIcon color="info" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1">
                                {waste.resource}
                              </Typography>
                              <Chip 
                                label={waste.severity} 
                                color={
                                  waste.severity === 'high' ? 'error' : 
                                  waste.severity === 'medium' ? 'warning' : 'info'
                                }
                                size="small"
                              />
                              {waste.estimatedMonthlySavings > 0 && (
                                <Chip 
                                  label={`節約可能: $${waste.estimatedMonthlySavings.toFixed(2)}`}
                                  color="success"
                                  size="small"
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {waste.description}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1, fontWeight: 'medium' }}>
                                推奨対応: {waste.recommendation}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < wasteAnalysis.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Alert severity="success">
                  現在、明らかな無駄は検出されていません。良好な状態です！
                </Alert>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default CostAnalysisPage;
