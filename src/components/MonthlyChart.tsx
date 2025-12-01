/**
 * 月別グラフコンポーネント
 * Recharts使用
 */
import { Box, Card, CardContent, Typography } from '@mui/material';
import { DateRange as DateRangeIcon } from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAggregationStore } from '../store/aggregationStore';

const COLORS = ['#2e7d32', '#d32f2f', '#1976d2'];

export const MonthlyChart = () => {
  const { monthlyResults } = useAggregationStore();

  if (monthlyResults.length === 0) {
    return null;
  }

  // 円グラフ用のデータ（最新月のデータ）
  const latestMonth = monthlyResults[monthlyResults.length - 1];
  const pieData = latestMonth
    ? [
        { name: '実施', value: latestMonth.implementations },
        { name: 'キャンセル', value: latestMonth.cancellations },
        {
          name: '予約中',
          value: latestMonth.applications - latestMonth.implementations - latestMonth.cancellations,
        },
      ]
    : [];

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DateRangeIcon />
        月別実績
      </Typography>

      <Card elevation={2}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            月別申込・実施・キャンセル推移
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyResults} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="applications" fill="#1976d2" name="申込数" />
              <Bar dataKey="implementations" fill="#2e7d32" name="実施数" />
              <Bar dataKey="cancellations" fill="#d32f2f" name="キャンセル数" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {latestMonth && (
        <Card elevation={2} sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {latestMonth.month} の内訳
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}件`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="h6" color="primary">
                実施率: {latestMonth.implementationRate.toFixed(1)}%
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
