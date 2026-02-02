/**
 * キャンセル一覧ビューコンポーネント
 *
 * - キャンセル予約のみを抽出表示
 * - 前日キャンセル/当日キャンセルの区別
 * - 担当者別表示
 * - CSV出力
 */
import { useState, useCallback, useMemo } from 'react';
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
  TablePagination,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
  List as ListIcon,
  EventBusy as SameDayCancelIcon,
  Schedule as PreviousDayCancelIcon,
  Phone as PhoneIcon,
  EventAvailable as RebookIcon,
  Done as DoneIcon,
  Block as BlockIcon,
  HelpOutline as UnhandledIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore, DATE_BASE_TYPE_LABELS, PERIOD_PRESET_LABELS } from '../store/uiStore';
import { ReservationDetailDrawer } from './ReservationDetailDrawer';
import {
  getCancelTimingFromStrings,
  historyToFlatRecord,
  parseLocalDate,
  CANCEL_TIMING_LABELS,
  CANCEL_HANDLING_STATUS_LABELS,
  CANCEL_HANDLING_STATUS_COLORS,
} from '../domain';
import type { FlatRecord, CancelTiming, CancelHandlingStatus } from '../domain';

type CancelFilter = 'all' | 'sameDayCancel' | 'previousDayCancel' | 'normalCancel';

function getRecordCancelTiming(record: FlatRecord): CancelTiming {
  return getCancelTimingFromStrings(record.sessionDateStr, record.applicationDateStr, record.status);
}

// ステータスアイコンの取得
const getStatusIcon = (status: CancelHandlingStatus | null) => {
  switch (status) {
    case 'unhandled':
      return <UnhandledIcon fontSize="small" />;
    case 'contacted':
      return <PhoneIcon fontSize="small" />;
    case 'rebooked':
      return <RebookIcon fontSize="small" />;
    case 'completed':
      return <DoneIcon fontSize="small" />;
    case 'not-required':
      return <BlockIcon fontSize="small" />;
    default:
      return <UnhandledIcon fontSize="small" />;
  }
};

export const CancelListView = () => {
  const { histories, updateCancelHandlingStatus } = useHistoryStore();
  const { dateBaseType, periodPreset, periodFrom, periodTo, getEffectivePeriod } = useUiStore();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchText, setSearchText] = useState('');
  const [cancelFilter, setCancelFilter] = useState<CancelFilter>('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  // ステータス変更メニュー用
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuReservationId, setMenuReservationId] = useState<string | null>(null);

  // キャンセルレコードのみ抽出
  const allCancelRecords = useMemo<FlatRecord[]>(() => {
    return Array.from(histories.values())
      .filter(h => h.status === 'キャンセル済み')
      .map(historyToFlatRecord);
  }, [histories]);

  // 有効な期間を取得
  const effectivePeriod = useMemo(
    () => getEffectivePeriod(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodPreset, periodFrom, periodTo]
  );

  // 期間フィルタを適用
  const periodFilteredRecords = useMemo(() => {
    const { from, to } = effectivePeriod;
    if (!from && !to) {
      return allCancelRecords;
    }

    return allCancelRecords.filter(record => {
      const targetDateStr = dateBaseType === 'application' ? record.applicationDateStr : record.sessionDateStr;

      // YYYY-MM-DD形式からローカルDateに変換（タイムゾーン対応）
      const datePart = targetDateStr.split(' ')[0];
      if (!datePart) return false;
      const targetDate = parseLocalDate(datePart);

      if (from && targetDate < from) return false;
      if (to) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        if (targetDate > toEnd) return false;
      }

      return true;
    });
  }, [allCancelRecords, effectivePeriod, dateBaseType]);

  // 統計情報
  const stats = useMemo(() => {
    const total = periodFilteredRecords.length;
    const sameDayCancel = periodFilteredRecords.filter(r => getRecordCancelTiming(r) === 'same-day').length;
    const previousDayCancel = periodFilteredRecords.filter(r => getRecordCancelTiming(r) === 'previous-day').length;
    const normalCancel = total - sameDayCancel - previousDayCancel;

    return { total, sameDayCancel, previousDayCancel, normalCancel };
  }, [periodFilteredRecords]);

  // キャンセルタイプフィルタを適用
  const cancelFilteredRecords = useMemo(() => {
    switch (cancelFilter) {
      case 'sameDayCancel':
        return periodFilteredRecords.filter(r => getRecordCancelTiming(r) === 'same-day');
      case 'previousDayCancel':
        return periodFilteredRecords.filter(r => getRecordCancelTiming(r) === 'previous-day');
      case 'normalCancel':
        return periodFilteredRecords.filter(r => {
          const timing = getRecordCancelTiming(r);
          return timing !== 'same-day' && timing !== 'previous-day';
        });
      case 'all':
      default:
        return periodFilteredRecords;
    }
  }, [periodFilteredRecords, cancelFilter]);

  // 検索フィルタ
  const filteredRecords = useMemo(() => {
    if (!searchText.trim()) return cancelFilteredRecords;

    const lowerSearch = searchText.toLowerCase();
    return cancelFilteredRecords.filter(
      record =>
        record.friendId.toLowerCase().includes(lowerSearch) ||
        record.name.toLowerCase().includes(lowerSearch) ||
        (record.staff && record.staff.toLowerCase().includes(lowerSearch))
    );
  }, [cancelFilteredRecords, searchText]);

  // ページング
  const paginatedRecords = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredRecords.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  const selectedRecord = useMemo(() => {
    if (!selectedReservationId) return null;
    return allCancelRecords.find(r => r.reservationId === selectedReservationId) || null;
  }, [selectedReservationId, allCancelRecords]);

  const handleRowClick = useCallback((record: FlatRecord) => {
    setSelectedReservationId(record.reservationId);
    setDrawerOpen(true);
  }, []);

  const handleCancelFilterChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newFilter: CancelFilter | null) => {
      if (newFilter !== null) {
        setCancelFilter(newFilter);
        setPage(0);
      }
    },
    []
  );

  // ステータス変更メニューを開く
  const handleStatusClick = useCallback((event: React.MouseEvent<HTMLElement>, reservationId: string) => {
    event.stopPropagation(); // 行クリックイベントを防止
    setMenuAnchorEl(event.currentTarget);
    setMenuReservationId(reservationId);
  }, []);

  // ステータス変更メニューを閉じる
  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
    setMenuReservationId(null);
  }, []);

  // ステータスを変更
  const handleStatusChange = useCallback(
    async (status: CancelHandlingStatus) => {
      if (menuReservationId) {
        await updateCancelHandlingStatus(menuReservationId, status);
      }
      handleMenuClose();
    },
    [menuReservationId, updateCancelHandlingStatus, handleMenuClose]
  );

  const handleDownloadCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      alert('データがありません');
      return;
    }

    const headers = ['予約ID', '友だちID', '名前', '実施日', '申込日時', 'キャンセル種別', '対応状況', '担当者', 'コース'];
    const rows = filteredRecords.map(record => {
      const timing = getRecordCancelTiming(record);
      const handlingStatus = record.cancelHandlingStatus
        ? CANCEL_HANDLING_STATUS_LABELS[record.cancelHandlingStatus]
        : '未対応';
      return [
        record.reservationId,
        record.friendId,
        record.name,
        record.sessionDateStr,
        record.applicationDateStr,
        CANCEL_TIMING_LABELS[timing] || 'キャンセル',
        handlingStatus,
        record.staff || '',
        record.course || '',
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `キャンセル一覧_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredRecords]);

  if (histories.size === 0) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CancelIcon color="error" />
          キャンセル一覧
        </Typography>
        <Alert severity="info">履歴データがありません。CSVをアップロードしてください。</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}
      >
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CancelIcon color="error" />
          キャンセル一覧
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCSV}
          disabled={filteredRecords.length === 0}
        >
          CSV出力
        </Button>
      </Box>

      {/* 統計サマリー */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" component="span">
            <strong>フィルタ条件:</strong>{' '}
            <Chip size="small" label={`基準: ${DATE_BASE_TYPE_LABELS[dateBaseType]}`} sx={{ mr: 0.5 }} />
            <Chip size="small" label={PERIOD_PRESET_LABELS[periodPreset]} color="primary" variant="outlined" />
          </Typography>
        </Box>
        <Typography variant="body2">
          <strong>キャンセル総数:</strong>{' '}
          <Chip
            size="small"
            label={`${stats.total}件`}
            color="error"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.75rem' }}
          />{' '}
          （前日: {stats.previousDayCancel}件 / 当日: {stats.sameDayCancel}件 / 通常: {stats.normalCancel}件）
        </Typography>
      </Alert>

      {/* フィルターバー */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup value={cancelFilter} exclusive onChange={handleCancelFilterChange} size="small">
          <ToggleButton value="all">
            <Tooltip title="全キャンセル">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ListIcon fontSize="small" />
                全件
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="previousDayCancel">
            <Tooltip title="前日キャンセル">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PreviousDayCancelIcon fontSize="small" />
                前日
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="sameDayCancel">
            <Tooltip title="当日キャンセル">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SameDayCancelIcon fontSize="small" />
                当日
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="normalCancel">
            <Tooltip title="通常キャンセル">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CancelIcon fontSize="small" />
                通常
              </Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <TextField
          size="small"
          placeholder="名前、担当者で検索..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: 280 }}
        />

        <Typography variant="body2" color="text.secondary">
          表示: {filteredRecords.length}件
        </Typography>
      </Box>

      <Paper elevation={2} sx={{ p: 3 }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>名前</TableCell>
                <TableCell>友だちID</TableCell>
                <TableCell>実施日</TableCell>
                <TableCell>申込日時</TableCell>
                <TableCell align="center">種別</TableCell>
                <TableCell align="center">対応状況</TableCell>
                <TableCell>担当者</TableCell>
                <TableCell>コース</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRecords.map((record, index) => {
                const timing = getRecordCancelTiming(record);
                return (
                  <TableRow
                    key={`${record.reservationId}-${index}`}
                    hover
                    onClick={() => handleRowClick(record)}
                    sx={{
                      cursor: 'pointer',
                      backgroundColor:
                        timing === 'same-day'
                          ? 'rgba(211, 47, 47, 0.08)'
                          : timing === 'previous-day'
                            ? 'rgba(237, 108, 2, 0.08)'
                            : 'inherit',
                    }}
                  >
                    <TableCell>{record.name}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {record.friendId}
                      </Typography>
                    </TableCell>
                    <TableCell>{record.sessionDateStr}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                        {record.applicationDateStr}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={CANCEL_TIMING_LABELS[timing] || 'キャンセル'}
                        size="small"
                        color={timing === 'same-day' ? 'error' : timing === 'previous-day' ? 'warning' : 'default'}
                        variant={timing === 'same-day' || timing === 'previous-day' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={getStatusIcon(record.cancelHandlingStatus)}
                        label={
                          record.cancelHandlingStatus
                            ? CANCEL_HANDLING_STATUS_LABELS[record.cancelHandlingStatus]
                            : '未対応'
                        }
                        size="small"
                        color={
                          record.cancelHandlingStatus
                            ? CANCEL_HANDLING_STATUS_COLORS[record.cancelHandlingStatus]
                            : 'error'
                        }
                        variant="outlined"
                        onClick={e => handleStatusClick(e, record.reservationId)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </TableCell>
                    <TableCell>{record.staff || '-'}</TableCell>
                    <TableCell>{record.course || '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredRecords.length}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={event => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="表示件数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
        />
      </Paper>

      <ReservationDetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} record={selectedRecord} />

      {/* ステータス変更メニュー */}
      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={() => handleStatusChange('unhandled')}>
          <ListItemIcon>
            <UnhandledIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>未対応</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange('contacted')}>
          <ListItemIcon>
            <PhoneIcon fontSize="small" color="warning" />
          </ListItemIcon>
          <ListItemText>連絡済み</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange('rebooked')}>
          <ListItemIcon>
            <RebookIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText>再予約済み</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange('completed')}>
          <ListItemIcon>
            <DoneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>対応完了</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange('not-required')}>
          <ListItemIcon>
            <BlockIcon fontSize="small" color="info" />
          </ListItemIcon>
          <ListItemText>対応不要</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};
