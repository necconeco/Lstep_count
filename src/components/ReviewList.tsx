/**
 * 要確認リストコンポーネント
 * 3パターンの要確認レコードを表示 + CSV出力
 * パターン2からの実施変更機能付き
 */
import { useEffect, useState, useCallback } from 'react';
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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useReviewStore } from '../store/reviewStore';
import { useCsvStore } from '../store/csvStore';
import { useMasterStore } from '../store/masterStore';
import { exportToCSV } from '../utils/csvExporter';
import { exportDailySpreadsheetCSV } from '../utils/dailySpreadsheetExporter';
import { autoPopulateUsageCount } from '../utils/dataAggregator';
import type { CsvRecord, ReviewRecord } from '../types';

export const ReviewList = () => {
  const { reviewRecords, detectReviewRecords } = useReviewStore();
  const { csvData, selectedMonth, getFilteredData, updateRecord } = useCsvStore();
  const { masterData } = useMasterStore();

  // 保存メッセージ
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  // 実施変更確認ダイアログ
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    record: ReviewRecord | null;
  }>({ open: false, record: null });

  // 実施変更確認ダイアログを開く
  const handleOpenConfirmDialog = useCallback((review: ReviewRecord) => {
    setConfirmDialog({ open: true, record: review });
  }, []);

  // 実施変更確認ダイアログを閉じる
  const handleCloseConfirmDialog = useCallback(() => {
    setConfirmDialog({ open: false, record: null });
  }, []);

  // 実施に変更（来店/来場を「済み」に変更）
  const handleChangeToImplemented = useCallback(() => {
    if (confirmDialog.record) {
      updateRecord(confirmDialog.record.record.予約ID, {
        '来店/来場': '済み',
        手動実施変更: true,
      });
      setSaveMessage(`${confirmDialog.record.record.名前}さんを実施済みに変更しました`);
      setTimeout(() => setSaveMessage(null), 3000);
    }
    handleCloseConfirmDialog();
  }, [confirmDialog.record, updateRecord, handleCloseConfirmDialog]);

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
  const pattern1Records = reviewRecords.filter(r => r.pattern === 'pattern1');
  const pattern2Records = reviewRecords.filter(r => r.pattern === 'pattern2');
  const pattern3Records = reviewRecords.filter(r => r.pattern === 'pattern3');

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
      return <Chip label={`${record.ステータス} / ${record['来店/来場']}`} color="default" size="small" />;
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
          <Button variant="contained" color="primary" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
            修正済みCSVをダウンロード
          </Button>
        </Box>
      </Box>

      {saveMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {saveMessage}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        データの不整合や確認が必要なレコードが検出されました。パターン2からは直接「実施済み」に変更できます。
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
                  {pattern1Records.map(review => (
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
                パターン2: 未来日予約 / 入力漏れ
              </Typography>
              <Chip label={`${pattern2Records.length}件`} color="warning" size="small" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                ステータス「予約済み」だが来店/来場が「なし」
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Alert severity="warning" sx={{ mb: 2 }}>
              相談員が「来店/来場」の入力を忘れた場合は、「実施」ボタンで実施済みに変更できます。
            </Alert>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>予約ID</TableCell>
                    <TableCell>予約日</TableCell>
                    <TableCell>申し込み日時</TableCell>
                    <TableCell>名前</TableCell>
                    <TableCell>担当者</TableCell>
                    <TableCell>詳細ステータス</TableCell>
                    <TableCell>確認理由</TableCell>
                    <TableCell sx={{ width: 100 }}>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pattern2Records.map(review => (
                    <TableRow key={review.record.予約ID} hover>
                      <TableCell>{review.record.予約ID}</TableCell>
                      <TableCell>{review.record.予約日}</TableCell>
                      <TableCell>{review.record.申込日時}</TableCell>
                      <TableCell>{review.record.名前}</TableCell>
                      <TableCell>{review.record.担当者 || '-'}</TableCell>
                      <TableCell>{getStatusChip(review.record)}</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="warning.main">
                          {review.reason}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="実施済みに変更（相談員の入力漏れを補完）">
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleOpenConfirmDialog(review)}
                          >
                            実施
                          </Button>
                        </Tooltip>
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
                  {pattern3Records.map(review => (
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

      {/* 実施変更確認ダイアログ */}
      <Dialog open={confirmDialog.open} onClose={handleCloseConfirmDialog}>
        <DialogTitle>実施済みに変更しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDialog.record && (
              <>
                <strong>{confirmDialog.record.record.名前}</strong>さん（予約日:{' '}
                {confirmDialog.record.record.予約日}）を実施済みに変更します。
                <br />
                <br />
                この操作は、相談員が「来店/来場」の入力を忘れた場合に使用してください。
                変更後は集計に「実施」としてカウントされます。
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmDialog}>キャンセル</Button>
          <Button variant="contained" color="success" onClick={handleChangeToImplemented}>
            実施済みに変更
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
