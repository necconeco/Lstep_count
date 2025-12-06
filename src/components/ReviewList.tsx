/**
 * 要確認リストコンポーネント
 * 3パターンの要確認レコードを表示 + CSV出力
 * 詳細ステータスの編集はCsvDataTableコンポーネントで実施
 */
import { useEffect } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
} from '@mui/material';
import {
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useReviewStore } from '../store/reviewStore';
import { useCsvStore } from '../store/csvStore';
import { useMasterStore } from '../store/masterStore';
import { exportToCSV } from '../utils/csvExporter';
import { exportDailySpreadsheetCSV } from '../utils/dailySpreadsheetExporter';
import { autoPopulateUsageCount } from '../utils/dataAggregator';
import type { CsvRecord } from '../types';

export const ReviewList = () => {
  const { reviewRecords, detectReviewRecords } = useReviewStore();
  const { csvData, selectedMonth, getFilteredData } = useCsvStore();
  const { masterData } = useMasterStore();

  // 重要: csvDataまたはselectedMonthが更新されたら、reviewRecordsも自動的に再検出
  useEffect(() => {
    const filteredData = getFilteredData();
    if (filteredData.length > 0 && masterData.size > 0) {
      detectReviewRecords(filteredData, masterData);
    }
  }, [csvData, masterData, selectedMonth, detectReviewRecords, getFilteredData]);

  if (reviewRecords.length === 0) {
    return null;
  }

  // パターンごとにグループ化
  const pattern1Records = reviewRecords.filter((r) => r.pattern === 'pattern1');
  const pattern2Records = reviewRecords.filter((r) => r.pattern === 'pattern2');
  const pattern3Records = reviewRecords.filter((r) => r.pattern === 'pattern3');

  // CSVエクスポート（選択された月のデータのみ）
  const handleExportCSV = () => {
    const filteredData = getFilteredData();

    // Domain層: 回数フィールドを自動補完（ビジネスロジック）
    const processedData = autoPopulateUsageCount(filteredData, masterData);

    // Infrastructure層: CSV出力（純粋なファイル出力）
    const monthSuffix = selectedMonth ? `_${selectedMonth}` : '';
    const fileName = `Lstep集計_修正済み${monthSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(processedData, fileName);
  };

  // 日別集計CSVエクスポート（選択された月のデータのみ）
  const handleExportDailySpreadsheet = () => {
    const filteredData = getFilteredData();
    const monthSuffix = selectedMonth ? `_${selectedMonth}` : '';
    const fileName = `日別集計${monthSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    exportDailySpreadsheetCSV(filteredData, masterData, fileName);
  };

  // 詳細ステータスの表示用チップ
  const getStatusChip = (record: CsvRecord) => {
    const detailStatus = record.詳細ステータス;

    // 詳細ステータスが設定されている場合
    if (detailStatus === '前日キャンセル') {
      return <Chip label="前日キャンセル" color="warning" size="small" />;
    } else if (detailStatus === '当日キャンセル') {
      return <Chip label="当日キャンセル" color="warning" size="small" />;
    }

    // 詳細ステータスが未設定の場合は元のステータスを表示
    if (record.ステータス === 'キャンセル済み' && record['来店/来場'] === 'なし') {
      return <Chip label="通常キャンセル" color="error" size="small" />;
    } else if (record.ステータス === '予約済み' && record['来店/来場'] === '済み') {
      return <Chip label="済み" color="success" size="small" />;
    } else {
      return (
        <Chip
          label={`${record.ステータス} / ${record['来店/来場']}`}
          color="default"
          size="small"
        />
      );
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          要確認リスト
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleExportDailySpreadsheet}
          >
            日別集計をダウンロード
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleExportCSV}
          >
            修正済みCSVをダウンロード
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        データの不整合や確認が必要なレコードが検出されました。詳細ステータスの編集は上部の「CSVデータ一覧」から行えます。
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
                    <TableCell>申し込み日時</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell>詳細ステータス</TableCell>
                    <TableCell>確認理由</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pattern1Records.map((review) => (
                    <TableRow key={review.record.予約ID} hover>
                      <TableCell>{review.record.予約ID}</TableCell>
                      <TableCell>{review.record.予約日}</TableCell>
                      <TableCell>{review.record.申込日時}</TableCell>
                      <TableCell>{review.record.名前}</TableCell>
                      <TableCell>{getStatusChip(review.record)}</TableCell>
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

      {/* パターン2: 未来日予約 */}
      {pattern2Records.length > 0 && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                パターン2: 未来日予約
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
                    <TableCell>申し込み日時</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell>詳細ステータス</TableCell>
                    <TableCell>確認理由</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pattern2Records.map((review) => (
                    <TableRow key={review.record.予約ID} hover>
                      <TableCell>{review.record.予約ID}</TableCell>
                      <TableCell>{review.record.予約日}</TableCell>
                      <TableCell>{review.record.申込日時}</TableCell>
                      <TableCell>{review.record.名前}</TableCell>
                      <TableCell>{getStatusChip(review.record)}</TableCell>
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
                    <TableCell>申し込み日時</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell>詳細ステータス</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pattern3Records.map((review) => (
                    <TableRow key={review.record.予約ID} hover>
                      <TableCell>{review.record.予約ID}</TableCell>
                      <TableCell>{review.record.予約日}</TableCell>
                      <TableCell>{review.record.申込日時}</TableCell>
                      <TableCell>{review.record.名前}</TableCell>
                      <TableCell>{getStatusChip(review.record)}</TableCell>
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
