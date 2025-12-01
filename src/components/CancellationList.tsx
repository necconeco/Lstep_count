/**
 * キャンセル一覧コンポーネント
 */
import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from '@mui/material';
import { EventBusy as EventBusyIcon } from '@mui/icons-material';
import { useReviewStore } from '../store/reviewStore';

export const CancellationList = () => {
  const { cancellationRecords } = useReviewStore();

  if (cancellationRecords.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventBusyIcon color="error" />
        キャンセル一覧
        <Chip label={`${cancellationRecords.length}件`} color="error" size="small" />
      </Typography>

      <Card elevation={2}>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>予約ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>予約日</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>名前</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>初回/2回目</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>キャンセル日</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>担当者</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cancellationRecords.map((cancellation) => (
                  <TableRow key={cancellation.record.予約ID} hover>
                    <TableCell>{cancellation.record.予約ID}</TableCell>
                    <TableCell>{cancellation.record.予約日}</TableCell>
                    <TableCell>{cancellation.record.名前}</TableCell>
                    <TableCell>
                      <Chip
                        label={cancellation.visitType}
                        color={cancellation.visitType === '初回' ? 'primary' : 'secondary'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{cancellation.cancellationDate}</TableCell>
                    <TableCell>{cancellation.record.担当者 || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};
