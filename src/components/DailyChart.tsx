/**
 * 日別グラフコンポーネント
 * Recharts使用
 */
import { Box, Card, CardContent, Typography } from '@mui/material';
import { CalendarToday as CalendarIcon } from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAggregationStore } from '../store/aggregationStore';

export const DailyChart = () => {
  const { dailyResults } = useAggregationStore();

  if (dailyResults.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalendarIcon />
        日別推移
      </Typography>

      <Card elevation={2}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            申込・実施・キャンセルの日別推移
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyResults} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={value => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={value => {
                  const date = new Date(value);
                  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="applications"
                stroke="#1976d2"
                strokeWidth={2}
                name="申込数"
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="implementations"
                stroke="#2e7d32"
                strokeWidth={2}
                name="実施数"
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="cancellations"
                stroke="#d32f2f"
                strokeWidth={2}
                name="キャンセル数"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card elevation={2} sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            初回 vs 2回目以降（日別）
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyResults} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={value => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={value => {
                  const date = new Date(value);
                  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <Legend />
              <Bar dataKey="firstTimeCount" fill="#1976d2" name="初回" />
              <Bar dataKey="repeatCount" fill="#9c27b0" name="2回目以降" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Box>
  );
};
