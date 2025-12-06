/**
 * 履歴一覧表示コンポーネント（新設計）
 *
 * - 全履歴を表示（キャンセル含む）
 * - 実施のみ表示の切り替え
 * - 検索・ページング
 * - CSV出力
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
  Refresh as RefreshIcon,
  RemoveCircleOutline as ExcludeIcon,
  AddCircleOutline as IncludeIcon,
  Cancel as CancelIcon,
  EventBusy as SameDayCancelIcon,
  Schedule as PreviousDayCancelIcon,
  Block as BlockIcon,
  DataObject as JsonIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore, DATE_BASE_TYPE_LABELS, PERIOD_PRESET_LABELS } from '../store/uiStore';
import { ReservationDetailDrawer } from './ReservationDetailDrawer';
import { getCancelTimingFromStrings } from '../domain/logic';
import type { FlatRecord, CancelTiming } from '../domain/types';
import { CANCEL_TIMING_LABELS } from '../domain/types';

/**
 * ステータスフィルタタイプ
 */
type StatusFilter = 'all' | 'implemented' | 'cancelled' | 'sameDayCancel' | 'previousDayCancel' | 'excluded';

/**
 * レコードのキャンセルタイミングを取得
 */
function getRecordCancelTiming(record: FlatRecord): CancelTiming {
  return getCancelTimingFromStrings(
    record.sessionDateStr,
    record.applicationDateStr,
    record.status
  );
}

/**
 * 当日キャンセルかどうかを判定
 */
function isSameDayCancel(record: FlatRecord): boolean {
  return getRecordCancelTiming(record) === 'same-day';
}

/**
 * 前日キャンセルかどうかを判定
 */
function isPreviousDayCancel(record: FlatRecord): boolean {
  return getRecordCancelTiming(record) === 'previous-day';
}

/**
 * ステータス表示ラベルを取得（キャンセルタイミングを含む）
 */
function getStatusDisplayLabel(record: FlatRecord): string {
  if (record.status === '予約済み') {
    return '予約';
  }

  // キャンセルの場合はタイミングに応じたラベル
  const timing = getRecordCancelTiming(record);
  return CANCEL_TIMING_LABELS[timing] || 'キャンセル';
}

export const HistoryViewer = () => {
  const {
    histories,
    userCounts,
    isLoading,
    initialize,
    clearAllData,
    recalculateVisitIndexes,
    getFlatRecords,
    exportToCSV,
    exportToJSON,
    toggleExcluded,
  } = useHistoryStore();

  // UIストアからフィルタ条件を取得
  const { dateBaseType, periodPreset, getEffectivePeriod } = useUiStore();

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // 詳細ドロワー
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FlatRecord | null>(null);

  // 初回読み込み
  useEffect(() => {
    initialize();
  }, [initialize]);

  // フラットレコードを取得
  const allRecords = useMemo<FlatRecord[]>(() => {
    return getFlatRecords();
  }, [getFlatRecords]);

  // 有効な期間を取得
  const effectivePeriod = useMemo(() => getEffectivePeriod(), [getEffectivePeriod]);

  // 期間フィルタを適用
  const periodFilteredRecords = useMemo(() => {
    const { from, to } = effectivePeriod;

    // 全期間の場合はフィルタなし
    if (!from && !to) {
      return allRecords;
    }

    return allRecords.filter((record) => {
      // 基準日を決定
      const targetDateStr = dateBaseType === 'application'
        ? record.applicationDateStr
        : record.sessionDateStr;

      // YYYY-MM-DD形式からDateに変換
      const datePart = targetDateStr.split(' ')[0];
      if (!datePart) return false;
      const targetDate = new Date(datePart); // 時刻部分を除去

      // 期間内かチェック
      if (from && targetDate < from) return false;
      if (to) {
        // toの日付は23:59:59までを含める
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        if (targetDate > toEnd) return false;
      }

      return true;
    });
  }, [allRecords, effectivePeriod, dateBaseType]);

  // 統計情報（フィルタ後のレコードに基づく）
  const stats = useMemo(() => {
    const total = periodFilteredRecords.length;
    const implemented = periodFilteredRecords.filter((r) => r.isImplemented).length;
    const cancelled = periodFilteredRecords.filter((r) => r.status === 'キャンセル済み').length;
    const sameDayCancel = periodFilteredRecords.filter((r) => isSameDayCancel(r)).length;
    const previousDayCancel = periodFilteredRecords.filter((r) => isPreviousDayCancel(r)).length;
    const firstTime = periodFilteredRecords.filter((r) => r.visitIndex === 1).length;
    const repeat = implemented - firstTime;
    const excluded = periodFilteredRecords.filter((r) => r.isExcluded).length;

    // 全体の統計（フィルタ前）
    const totalAll = allRecords.length;

    return {
      totalUsers: userCounts.size,
      totalRecords: total,
      totalAll,
      implemented,
      cancelled,
      sameDayCancel,
      previousDayCancel,
      pending: total - implemented - cancelled,
      firstTime,
      repeat,
      excluded,
    };
  }, [periodFilteredRecords, allRecords.length, userCounts.size]);

  // ステータスフィルタを適用（期間フィルタ後のレコードを対象）
  const statusFilteredRecords = useMemo(() => {
    switch (statusFilter) {
      case 'implemented':
        return periodFilteredRecords.filter((r) => r.isImplemented);
      case 'cancelled':
        return periodFilteredRecords.filter((r) => r.status === 'キャンセル済み');
      case 'sameDayCancel':
        return periodFilteredRecords.filter((r) => isSameDayCancel(r));
      case 'previousDayCancel':
        return periodFilteredRecords.filter((r) => isPreviousDayCancel(r));
      case 'excluded':
        return periodFilteredRecords.filter((r) => r.isExcluded);
      case 'all':
      default:
        return periodFilteredRecords;
    }
  }, [periodFilteredRecords, statusFilter]);

  // 検索でフィルタ（ステータスフィルタ後のレコードを対象）
  const filteredRecords = useMemo(() => {
    if (!searchText.trim()) return statusFilteredRecords;

    const lowerSearch = searchText.toLowerCase();
    return statusFilteredRecords.filter(
      (record) =>
        record.friendId.toLowerCase().includes(lowerSearch) ||
        record.reservationId.toLowerCase().includes(lowerSearch) ||
        record.name.toLowerCase().includes(lowerSearch) ||
        (record.staff && record.staff.toLowerCase().includes(lowerSearch))
    );
  }, [statusFilteredRecords, searchText]);

  // ページ変更時にリセット
  useEffect(() => {
    setPage(0);
  }, [searchText, statusFilter]);

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
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `履歴一覧_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [allRecords.length, exportToCSV]);

  /**
   * JSONダウンロード（全データバックアップ）
   */
  const handleDownloadJSON = useCallback(() => {
    if (histories.size === 0) {
      alert('履歴データが空です');
      return;
    }

    const json = exportToJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lstep集計_バックアップ_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [histories.size, exportToJSON]);

  /**
   * 全削除確認
   */
  const handleClearConfirm = useCallback(async () => {
    await clearAllData();
    setClearDialogOpen(false);
    alert('データを全削除しました');
  }, [clearAllData]);

  /**
   * visitIndex再計算
   */
  const handleRecalculate = useCallback(async () => {
    if (confirm('visitIndexを再計算しますか？')) {
      await recalculateVisitIndexes();
      alert('再計算が完了しました');
    }
  }, [recalculateVisitIndexes]);

  const handleChangePage = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(0);
    },
    []
  );

  const handleStatusFilterChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newFilter: StatusFilter | null) => {
      if (newFilter !== null) {
        setStatusFilter(newFilter);
      }
    },
    []
  );

  /**
   * 除外フラグのトグル
   */
  const handleToggleExcluded = useCallback(
    async (reservationId: string, event: React.MouseEvent) => {
      event.stopPropagation(); // 行クリックを防ぐ
      await toggleExcluded(reservationId);
    },
    [toggleExcluded]
  );

  /**
   * 行クリックで詳細ドロワーを開く
   */
  const handleRowClick = useCallback((record: FlatRecord) => {
    setSelectedRecord(record);
    setDrawerOpen(true);
  }, []);

  /**
   * ドロワーを閉じる
   */
  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  /**
   * ドロワーが閉じた後、選択中のレコードを更新（isExcludedの変更を反映）
   */
  useEffect(() => {
    if (selectedRecord && drawerOpen) {
      // 最新のレコードを取得
      const updatedRecord = filteredRecords.find(
        (r) => r.reservationId === selectedRecord.reservationId
      );
      if (updatedRecord && updatedRecord.isExcluded !== selectedRecord.isExcluded) {
        setSelectedRecord(updatedRecord);
      }
    }
  }, [filteredRecords, selectedRecord, drawerOpen]);

  // データがない場合
  if (histories.size === 0 && !isLoading) {
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
          履歴一覧
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleRecalculate}
          >
            再計算
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadCSV}
          >
            CSV出力
          </Button>
          <Tooltip title="全データをJSON形式でバックアップ">
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<JsonIcon />}
              onClick={handleDownloadJSON}
            >
              JSONバックアップ
            </Button>
          </Tooltip>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setClearDialogOpen(true)}
          >
            全削除
          </Button>
        </Box>
      </Box>

      {/* 統計サマリー */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" component="span">
            <strong>フィルタ条件:</strong>{' '}
            <Chip
              size="small"
              label={`基準: ${DATE_BASE_TYPE_LABELS[dateBaseType]}`}
              sx={{ mr: 0.5 }}
            />
            <Chip
              size="small"
              label={PERIOD_PRESET_LABELS[periodPreset]}
              color="primary"
              variant="outlined"
            />
            {stats.totalRecords !== stats.totalAll && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                （全{stats.totalAll}件中 {stats.totalRecords}件を表示）
              </Typography>
            )}
          </Typography>
        </Box>
        <Typography variant="body2">
          <strong>期間内:</strong> {stats.totalRecords}件 |
          <strong> 実施:</strong>{' '}
          <Chip
            size="small"
            label={`${stats.implemented}件`}
            color="success"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.75rem' }}
          />
          （初回: {stats.firstTime} / リピート: {stats.repeat}）|
          <strong> キャンセル:</strong>{' '}
          <Chip
            size="small"
            label={`${stats.cancelled}件`}
            color="error"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.75rem' }}
          />
          {(stats.sameDayCancel > 0 || stats.previousDayCancel > 0) && (
            <Typography variant="caption" color="text.secondary">
              {' '}(前日: {stats.previousDayCancel} / 当日: {stats.sameDayCancel})
            </Typography>
          )}
          {stats.excluded > 0 && (
            <>
              {' | '}
              <strong style={{ color: '#d32f2f' }}>除外:</strong>{' '}
              <Chip
                size="small"
                label={`${stats.excluded}件`}
                color="default"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
            </>
          )}
        </Typography>
      </Alert>

      {/* フィルターバー */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* ステータスフィルタ */}
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={handleStatusFilterChange}
          size="small"
        >
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
                実施
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="cancelled">
            <Tooltip title="キャンセルのみ">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CancelIcon fontSize="small" />
                キャンセル
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="previousDayCancel">
            <Tooltip title="前日キャンセル（実施日の前日に申込）">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PreviousDayCancelIcon fontSize="small" />
                前日
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="sameDayCancel">
            <Tooltip title="当日キャンセル（申込日と実施日が同じ）">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SameDayCancelIcon fontSize="small" />
                当日
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="excluded">
            <Tooltip title="集計から除外されているレコード">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <BlockIcon fontSize="small" />
                除外
              </Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* テキスト検索 */}
        <TextField
          size="small"
          placeholder="友だちID、名前で検索..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: 280 }}
        />

        {/* 件数表示 */}
        <Typography variant="body2" color="text.secondary">
          表示: {filteredRecords.length}件
          {statusFilter !== 'all' && ` / 全${stats.totalRecords}件`}
        </Typography>
      </Box>

      <Paper elevation={2} sx={{ p: 3 }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: 60 }}>集計</TableCell>
                <TableCell>友だちID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>予約ID</TableCell>
                <TableCell>実施日</TableCell>
                <TableCell>申込日時</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell align="center">来店</TableCell>
                <TableCell align="center">回数</TableCell>
                <TableCell>区分</TableCell>
                <TableCell>担当者</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRecords.map((record, index) => (
                <TableRow
                  key={`${record.reservationId}-${index}`}
                  hover
                  onClick={() => handleRowClick(record)}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: record.isExcluded
                      ? 'rgba(158, 158, 158, 0.15)'
                      : record.status === 'キャンセル済み'
                      ? 'rgba(211, 47, 47, 0.04)'
                      : record.isImplemented
                      ? 'rgba(46, 125, 50, 0.04)'
                      : 'inherit',
                    opacity: record.isExcluded ? 0.7 : 1,
                    textDecoration: record.isExcluded ? 'line-through' : 'none',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  {/* 集計対象トグル */}
                  <TableCell align="center" sx={{ py: 0 }}>
                    <Tooltip
                      title={record.isExcluded ? '集計に含める' : '集計から除外'}
                    >
                      <Chip
                        icon={record.isExcluded ? <IncludeIcon /> : <ExcludeIcon />}
                        label={record.isExcluded ? '除外中' : '対象'}
                        size="small"
                        color={record.isExcluded ? 'default' : 'success'}
                        variant={record.isExcluded ? 'outlined' : 'filled'}
                        onClick={(e) => handleToggleExcluded(record.reservationId, e)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                    >
                      {record.friendId}
                    </Typography>
                  </TableCell>
                  <TableCell>{record.name}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                    >
                      {record.reservationId || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{record.sessionDateStr}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {record.applicationDateStr}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {(() => {
                      const label = getStatusDisplayLabel(record);
                      const timing = getRecordCancelTiming(record);
                      let color: 'primary' | 'error' | 'warning' = 'primary';
                      if (record.status === 'キャンセル済み') {
                        if (timing === 'same-day') {
                          color = 'error';
                        } else if (timing === 'previous-day') {
                          color = 'warning';
                        } else {
                          color = 'error';
                        }
                      }
                      return (
                        <Chip
                          label={label}
                          size="small"
                          color={color}
                          variant={timing === 'same-day' || timing === 'previous-day' ? 'filled' : 'outlined'}
                        />
                      );
                    })()}
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
                          record.visitLabel === '初回'
                            ? 'success'
                            : record.visitLabel === '2回目'
                            ? 'info'
                            : 'default'
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
        <DialogTitle>データの全削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            全ての履歴データ（{stats.totalUsers}人、{stats.totalRecords}件）を削除しますか？
            <br />
            <strong>この操作は取り消せません。</strong>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleClearConfirm} color="error" variant="contained">
            全削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 詳細ドロワー */}
      <ReservationDetailDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        record={selectedRecord}
      />
    </Box>
  );
};
