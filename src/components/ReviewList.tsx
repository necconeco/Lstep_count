/**
 * 要確認リストコンポーネント
 * 3パターンの要確認レコードを表示
 */
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, Chip, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { Warning as WarningIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useReviewStore } from '../store/reviewStore';

export const ReviewList = () => {
  const { reviewRecords } = useReviewStore();

  if (reviewRecords.length === 0) {
    return null;
  }

  // パターンごとにグループ化
  const pattern1Records = reviewRecords.filter((r) => r.pattern === 'pattern1');
  const pattern2Records = reviewRecords.filter((r) => r.pattern === 'pattern2');
  const pattern3Records = reviewRecords.filter((r) => r.pattern === 'pattern3');

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        要確認リスト
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        データの不整合や確認が必要なレコードが検出されました。内容を確認してください。
      </Alert>

      {/* パターン1: データ不整合 */}
      {pattern1Records.length > 0 && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                パターン1: データ不整合
              </Typography>
              <Chip label={`${pattern1Records.length}件`} color="error" size="small" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                ステータス「キャンセル済み」だが来店/来場が「済み」
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>予約ID</TableCell>
                    <TableCell>予約日</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell>ステータス</TableCell>
                    <TableCell>来店/来場</TableCell>
                    <TableCell>確認理由</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pattern1Records.map((review) => (
                    <TableRow key={review.record.予約ID} hover>
                      <TableCell>{review.record.予約ID}</TableCell>
                      <TableCell>{review.record.予約日}</TableCell>
                      <TableCell>{review.record.名前}</TableCell>
                      <TableCell>
                        <Chip label={review.record.ステータス} color="error" size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={review.record['来店/来場']} color="success" size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="error">
                          {review.reason}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {/* パターン2: 未来店 */}
      {pattern2Records.length > 0 && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                パターン2: 未来店
              </Typography>
              <Chip label={`${pattern2Records.length}件`} color="warning" size="small" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                ステータス「予約済み」だが来店/来場が「なし」
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>予約ID</TableCell>
                    <TableCell>予約日</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell>ステータス</TableCell>
                    <TableCell>来店/来場</TableCell>
                    <TableCell>確認理由</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pattern2Records.map((review) => (
                    <TableRow key={review.record.予約ID} hover>
                      <TableCell>{review.record.予約ID}</TableCell>
                      <TableCell>{review.record.予約日}</TableCell>
                      <TableCell>{review.record.名前}</TableCell>
                      <TableCell>
                        <Chip label={review.record.ステータス} color="primary" size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={review.record['来店/来場']} color="default" size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="warning.main">
                          {review.reason}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {/* パターン3: 通常キャンセル */}
      {pattern3Records.length > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                パターン3: 通常キャンセル
              </Typography>
              <Chip label={`${pattern3Records.length}件`} color="info" size="small" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                ステータス「キャンセル済み」で来店/来場が「なし」
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>予約ID</TableCell>
                    <TableCell>予約日</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell>ステータス</TableCell>
                    <TableCell>来店/来場</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pattern3Records.map((review) => (
                    <TableRow key={review.record.予約ID} hover>
                      <TableCell>{review.record.予約ID}</TableCell>
                      <TableCell>{review.record.予約日}</TableCell>
                      <TableCell>{review.record.名前}</TableCell>
                      <TableCell>
                        <Chip label={review.record.ステータス} color="error" size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={review.record['来店/来場']} color="default" size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};
