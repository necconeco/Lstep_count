/**
 * 履歴表示コンポーネント
 * IndexedDBから過去の集計結果を表示
 * Phase 6: 実装完了
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  IconButton,
  Divider,
} from '@mui/material';
import {
  History as HistoryIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { AggregationHistory } from '../types';
import { getAllHistories, deleteHistory } from '../utils/aggregationHistoryManager';

export const HistoryView = () => {
  const [histories, setHistories] = useState<AggregationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 履歴読み込み
  const loadHistories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getAllHistories();
      // 新しい順にソート
      const sorted = data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setHistories(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : '履歴の読み込みに失敗しました';
      setError(message);
      console.error('履歴読み込みエラー:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 履歴削除
  const handleDelete = async (id: string) => {
    if (!window.confirm('この履歴を削除しますか？')) {
      return;
    }

    try {
      await deleteHistory(id);
      await loadHistories(); // 再読み込み
    } catch (err) {
      const message = err instanceof Error ? err.message : '履歴の削除に失敗しました';
      setError(message);
      console.error('履歴削除エラー:', err);
    }
  };

  // 初回読み込み
  useEffect(() => {
    loadHistories();
  }, []);

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon />
          集計履歴
        </Typography>
        <IconButton onClick={loadHistories} disabled={isLoading} size="small">
          <RefreshIcon />
        </IconButton>
      </Box>

      <Card elevation={2}>
        <CardContent>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : histories.length === 0 ? (
            <Alert severity="info">
              まだ集計履歴がありません。
              <br />
              CSVファイルをアップロードすると、自動的に履歴が保存されます。
            </Alert>
          ) : (
            <List>
              {histories.map((history, index) => (
                <Box key={history.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleDelete(history.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">{history.month} の集計</Typography>
                          <Chip
                            label={`申込: ${history.summary.totalApplications}件`}
                            size="small"
                            color="primary"
                          />
                          <Chip
                            label={`実施: ${history.summary.totalImplementations}件`}
                            size="small"
                            color="success"
                          />
                          <Chip
                            label={`実施率: ${history.summary.implementationRate.toFixed(1)}%`}
                            size="small"
                            color="info"
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" display="block">
                            集計日時: {history.createdAt.toLocaleString('ja-JP')}
                          </Typography>
                          <Typography variant="caption" display="block">
                            初回: {history.summary.firstTimeImplementations}件 / 2回目以降:{' '}
                            {history.summary.repeatImplementations}件
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
