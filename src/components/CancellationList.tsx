/**
 * キャンセル一覧コンポーネント
 * キャンセル理由のメモ入力 + 実施への手動変更機能付き
 */
import { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Button,
  IconButton,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  EventBusy as EventBusyIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useReviewStore } from '../store/reviewStore';
import { useCsvStore } from '../store/csvStore';
import type { CancellationRecord } from '../types';

export const CancellationList = () => {
  const { cancellationRecords } = useReviewStore();
  const { updateRecord } = useCsvStore();

  // メモ編集中の予約ID
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  // 編集中のメモ内容
  const [memoValue, setMemoValue] = useState('');
  // 保存メッセージ
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  // 実施変更確認ダイアログ
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    record: CancellationRecord | null;
  }>({ open: false, record: null });

  // メモ編集開始
  const handleStartEditMemo = useCallback((cancellation: CancellationRecord) => {
    setEditingMemoId(cancellation.record.予約ID);
    setMemoValue(cancellation.record.キャンセル理由 || '');
  }, []);

  // メモ保存
  const handleSaveMemo = useCallback(
    (予約ID: string) => {
      updateRecord(予約ID, { キャンセル理由: memoValue });
      setEditingMemoId(null);
      setMemoValue('');
      setSaveMessage('キャンセル理由を保存しました');
      setTimeout(() => setSaveMessage(null), 3000);
    },
    [memoValue, updateRecord]
  );

  // メモ編集キャンセル
  const handleCancelEditMemo = useCallback(() => {
    setEditingMemoId(null);
    setMemoValue('');
  }, []);

  // 実施変更確認ダイアログを開く
  const handleOpenConfirmDialog = useCallback((cancellation: CancellationRecord) => {
    setConfirmDialog({ open: true, record: cancellation });
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

      {saveMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {saveMessage}
        </Alert>
      )}

      <Card elevation={2}>
        <CardContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            キャンセル理由の記録や、相談員の入力漏れによる実施変更が可能です。
          </Alert>
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
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', minWidth: 200 }}>
                    キャンセル理由
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', width: 100 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cancellationRecords.map(cancellation => (
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
                    <TableCell>
                      {editingMemoId === cancellation.record.予約ID ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TextField
                            size="small"
                            value={memoValue}
                            onChange={e => setMemoValue(e.target.value)}
                            placeholder="キャンセル理由を入力"
                            fullWidth
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                handleSaveMemo(cancellation.record.予約ID);
                              } else if (e.key === 'Escape') {
                                handleCancelEditMemo();
                              }
                            }}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={() => handleSaveMemo(cancellation.record.予約ID)}
                          >
                            保存
                          </Button>
                          <Button size="small" variant="outlined" onClick={handleCancelEditMemo}>
                            取消
                          </Button>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {cancellation.record.キャンセル理由 || '-'}
                          </Typography>
                          <IconButton size="small" onClick={() => handleStartEditMemo(cancellation)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="実施済みに変更（相談員の入力漏れを補完）">
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => handleOpenConfirmDialog(cancellation)}
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
        </CardContent>
      </Card>

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
