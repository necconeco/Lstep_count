/**
 * サマリー表示コンポーネント
 * 集計結果のサマリーを表示
 */
import { Box, Card, CardContent, Typography, Grid, Divider, Chip } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useAggregationStore } from '../store/aggregationStore';

export const SummaryCard = () => {
  const { summary } = useAggregationStore();

  if (!summary) {
    return (
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" align="center">
            CSVファイルをアップロードすると、集計結果が表示されます
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUpIcon />
        集計サマリー
      </Typography>

      {/* 全体集計 */}
      <Card elevation={2} sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
            全体実績
          </Typography>
          <Grid container spacing={2}>
            {/* @ts-expect-error MUI v7 Grid API compatibility */}
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <PeopleIcon color="primary" sx={{ fontSize: 40 }} />
                <Typography variant="h4">{summary.totalApplications}</Typography>
                <Typography variant="body2" color="text.secondary">
                  申込数
                </Typography>
              </Box>
            </Grid>
            {/* @ts-expect-error MUI v7 Grid API compatibility */}
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <CheckIcon color="success" sx={{ fontSize: 40 }} />
                <Typography variant="h4">{summary.totalImplementations}</Typography>
                <Typography variant="body2" color="text.secondary">
                  実施数
                </Typography>
              </Box>
            </Grid>
            {/* @ts-expect-error MUI v7 Grid API compatibility */}
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <CancelIcon color="error" sx={{ fontSize: 40 }} />
                <Typography variant="h4">{summary.totalCancellations}</Typography>
                <Typography variant="body2" color="text.secondary">
                  キャンセル数
                </Typography>
              </Box>
            </Grid>
            {/* @ts-expect-error MUI v7 Grid API compatibility */}
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <TrendingUpIcon color="info" sx={{ fontSize: 40 }} />
                <Typography variant="h4">{summary.implementationRate.toFixed(1)}%</Typography>
                <Typography variant="body2" color="text.secondary">
                  実施率
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 初回 vs 2回目以降 */}
      <Grid container spacing={2}>
        {/* 初回 */}
        {/* @ts-expect-error MUI v7 Grid API compatibility */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  初回
                </Typography>
                <Chip label="新規顧客" color="primary" size="small" />
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {/* @ts-expect-error MUI v7 Grid API compatibility */}
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    申込数
                  </Typography>
                  <Typography variant="h5">{summary.firstTimeApplications}</Typography>
                  <Typography variant="caption" color="primary">
                    ({summary.firstTimeApplicationRate.toFixed(1)}%)
                  </Typography>
                </Grid>
                {/* @ts-expect-error MUI v7 Grid API compatibility */}
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    実施数
                  </Typography>
                  <Typography variant="h5">{summary.firstTimeImplementations}</Typography>
                  <Typography variant="caption" color="success.main">
                    ({summary.firstTimeImplementationRate.toFixed(1)}%)
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 2回目以降 */}
        {/* @ts-expect-error MUI v7 Grid API compatibility */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  2回目以降
                </Typography>
                <Chip label="リピーター" color="secondary" size="small" />
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {/* @ts-expect-error MUI v7 Grid API compatibility */}
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    申込数
                  </Typography>
                  <Typography variant="h5">{summary.repeatApplications}</Typography>
                  <Typography variant="caption" color="secondary">
                    ({summary.repeatApplicationRate.toFixed(1)}%)
                  </Typography>
                </Grid>
                {/* @ts-expect-error MUI v7 Grid API compatibility */}
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    実施数
                  </Typography>
                  <Typography variant="h5">{summary.repeatImplementations}</Typography>
                  <Typography variant="caption" color="success.main">
                    ({summary.repeatImplementationRate.toFixed(1)}%)
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
