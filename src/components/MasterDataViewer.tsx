/**
 * UI層 - マスターデータ一覧表示コンポーネント
 * フル履歴マスターを使用して予約1件=1行で表示
 * 実施行のみ / 全行切り替え可能
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TablePagination,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  DeleteForever as DeleteForeverIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  List as ListIcon,
} from '@mui/icons-material';
import { useMasterStoreV2 } from '../store/masterStoreV2';
import type { FlattenedRecord, MasterDataSummary } from '../domain';

type ViewMode = 'all' | 'implemented';

export const MasterDataViewer = () => {
  const { fullHistoryMasters, loadMasters, clearMasters, getFlattenedRecords, getSummary, exportToCSV, isLoading } =
    useMasterStoreV2();

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  // 初回読み込み
  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  // フラット化したレコードを取得
  const allRecords = useMemo<FlattenedRecord[]>(() => {
    return getFlattenedRecords();
  }, [getFlattenedRecords]);

  // 統計サマリーを取得
  const summary = useMemo<MasterDataSummary>(() => {
    return getSummary();
  }, [getSummary]);

  // 表示モードでフィルタリング
  const modeFilteredRecords = useMemo(() => {
    if (viewMode === 'implemented') {
      return allRecords.filter(r => r.isImplemented);
    }
    return allRecords;
  }, [allRecords, viewMode]);

  // 検索でフィルタリング
  const filteredRecords = useMemo(() => {
    if (!searchText.trim()) return modeFilteredRecords;

    const lowerSearch = searchText.toLowerCase();
    return modeFilteredRecords.filter(
      record =>
        record.friendId.toLowerCase().includes(lowerSearch) ||
        record.reservationId.toLowerCase().includes(lowerSearch) ||
        record.name.toLowerCase().includes(lowerSearch) ||
        (record.staff && record.staff.toLowerCase().includes(lowerSearch))
    );
  }, [modeFilteredRecords, searchText]);

  // ページ変更時にページをリセット
  useEffect(() => {
    setPage(0);
  }, [searchText, viewMode]);

  // 現在のページに表示するレコード
  const paginatedRecords = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredRecords.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  /**
   * CSVダウンロード
   */
  const handleDownloadCSV = useCallback(() => {
    if (allRecords.length === 0) {
      alert('履歴データが空です');
      return;
    }

    const csv = exportToCSV();

    // UTF-8 BOM付きでダウンロード
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `フル履歴一覧_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [allRecords.length, exportToCSV]);

  /**
   * 全削除の確認ダイアログを開く
   */
  const handleClearClick = () => {
    setClearDialogOpen(true);
  };

  /**
   * 全削除の実行
   */
  const handleClearConfirm = useCallback(async () => {
    await clearMasters();
    setClearDialogOpen(false);
    alert('マスターデータを全削除しました');
  }, [clearMasters]);

  /**
   * ページ変更ハンドラ
   */
  const handleChangePage = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  /**
   * 1ページあたりの行数変更ハンドラ
   */
  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  /**
   * 表示モード変更ハンドラ
   */
  const handleViewModeChange = useCallback((_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  }, []);

  // データがない場合は表示しない
  if (fullHistoryMasters.size === 0 && !isLoading) {
    return null;
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          履歴一覧（フル履歴マスター）
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" color="primary" startIcon={<DownloadIcon />} onClick={handleDownloadCSV}>
            CSVダウンロード
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={handleClearClick}>
            全削除（初期化）
          </Button>
        </Box>
      </Box>

      {/* 統計サマリー */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>ユニークユーザー:</strong> {summary.totalUsers}人 |<strong> 総レコード:</strong>{' '}
          {summary.totalRecords}件 |<strong> 実施:</strong> {summary.implementationCount}件 （初回:{' '}
          {summary.firstTimeCount}件 / 2回目以降: {summary.repeatCount}件）|
          <strong> キャンセル:</strong> {summary.cancellationCount}件 |<strong> 予約中:</strong> {summary.pendingCount}
          件
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          CSVの全行（キャンセル含む）を年度を跨いでマージ。予約1件=1行で表示。visitIndexは実施行のみに付与。
        </Typography>
      </Alert>

      {/* フィルターバー */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* 表示モード切替 */}
        <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
          <ToggleButton value="all">
            <Tooltip title="全履歴（キャンセル含む）">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ListIcon fontSize="small" />
                全件
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="implemented">
            <Tooltip title="実施済みのみ">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleIcon fontSize="small" />
                実施のみ
              </Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* 検索ボックス */}
        <TextField
          size="small"
          placeholder="友だちID、予約ID、名前、担当者で検索..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: 350 }}
        />

        {/* 検索結果件数 */}
        <Typography variant="body2" color="text.secondary">
          表示: {filteredRecords.length}件{viewMode === 'implemented' && ` / 実施${summary.implementationCount}件`}
          {viewMode === 'all' && ` / 全${summary.totalRecords}件`}
        </Typography>
      </Box>

      <Paper elevation={2} sx={{ p: 3 }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>友だちID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>予約ID</TableCell>
                <TableCell>予約日</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell align="center">来店</TableCell>
                <TableCell align="center">来店回数</TableCell>
                <TableCell>区分</TableCell>
                <TableCell>担当者</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRecords.map((record, index) => (
                <TableRow
                  key={`${record.friendId}-${record.reservationId}-${index}`}
                  hover
                  sx={{
                    backgroundColor:
                      record.status === 'キャンセル済み'
                        ? 'rgba(211, 47, 47, 0.04)'
                        : record.isImplemented
                          ? 'rgba(46, 125, 50, 0.04)'
                          : 'inherit',
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {record.friendId}
                    </Typography>
                  </TableCell>
                  <TableCell>{record.name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {record.reservationId || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{record.dateString}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={record.status === '予約済み' ? '予約' : 'キャンセル'}
                      size="small"
                      color={record.status === '予約済み' ? 'primary' : 'error'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={record.visitStatus}
                      size="small"
                      color={record.visitStatus === '済み' ? 'success' : 'default'}
                      variant={record.visitStatus === '済み' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {record.isImplemented ? (
                      <Chip label={record.visitIndex} size="small" color="primary" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.isImplemented ? (
                      <Chip
                        label={record.visitLabel}
                        size="small"
                        color={
                          record.visitLabel === '初回' ? 'success' : record.visitLabel === '2回目' ? 'info' : 'default'
                        }
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{record.staff || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ページネーション */}
        <TablePagination
          component="div"
          count={filteredRecords.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100, 200]}
          labelRowsPerPage="表示件数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
        />
      </Paper>

      {/* 全削除確認ダイアログ */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>マスターデータの全削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            全てのマスターデータ（{summary.totalUsers}人、{summary.totalRecords}件の履歴）を削除しますか？
            <br />
            <strong>この操作は取り消せません。</strong>
            <br />
            削除後は、過去のCSVから再構築する必要があります。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleClearConfirm} color="error" variant="contained">
            全削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
