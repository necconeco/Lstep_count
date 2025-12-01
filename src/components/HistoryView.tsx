/**
 * 履歴表示コンポーネント
 * IndexedDBから過去の集計結果を表示（Phase 5で実装予定）
 */
import { Box, Card, CardContent, Typography, Alert } from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';

export const HistoryView = () => {
  // TODO: Phase 5でIndexedDBからの履歴読み込みを実装

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon />
        集計履歴
      </Typography>

      <Card elevation={2}>
        <CardContent>
          <Alert severity="info">
            集計履歴機能は Phase 5 で実装予定です。
            <br />
            過去の集計結果を保存・比較できるようになります。
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
};
