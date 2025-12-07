/**
 * 未割当一覧ビューコンポーネント
 *
 * - 担当者未割当の予約を抽出表示
 * - その場で担当者割当可能
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
  Select,
  MenuItem,
  FormControl,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  PersonOff as PersonOffIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore, DATE_BASE_TYPE_LABELS, PERIOD_PRESET_LABELS } from '../store/uiStore';
import { ReservationDetailDrawer } from './ReservationDetailDrawer';
import { historyToFlatRecord } from '../domain/logic';
import type { FlatRecord } from '../domain/types';
import { OFFICIAL_STAFF_MEMBERS } from '../domain/staffMasterData';

export const UnassignedListView = () => {
  const { histories, assignStaff } = useHistoryStore();
  const { dateBaseType, periodPreset, periodFrom, periodTo, getEffectivePeriod } = useUiStore();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchText, setSearchText] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  // 未割当レコードのみ抽出
  const allUnassignedRecords = useMemo<FlatRecord[]>(() => {
    return Array.from(histories.values())
      .filter(h => !h.staff || h.staff.trim() === '')
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
      return allUnassignedRecords;
    }

    return allUnassignedRecords.filter(record => {
      const targetDateStr = dateBaseType === 'application' ? record.applicationDateStr : record.sessionDateStr;

      const datePart = targetDateStr.split(' ')[0];
      if (!datePart) return false;
      const targetDate = new Date(datePart);

      if (from && targetDate < from) return false;
      if (to) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        if (targetDate > toEnd) return false;
      }

      return true;
    });
  }, [allUnassignedRecords, effectivePeriod, dateBaseType]);

  // 統計情報
  const stats = useMemo(() => {
    const total = periodFilteredRecords.length;
    const implemented = periodFilteredRecords.filter(r => r.isImplemented).length;
    const omakase = periodFilteredRecords.filter(r => r.wasOmakase).length;
    const excluded = periodFilteredRecords.filter(r => r.isExcluded).length;
    const lateCancel = periodFilteredRecords.filter(
      r => r.detailStatus === '前日キャンセル' || r.detailStatus === '当日キャンセル'
    ).length;

    return { total, implemented, omakase, excluded, lateCancel };
  }, [periodFilteredRecords]);

  /**
   * 除外ステータスに基づいてバッジを返す
   */
  const getExclusionBadge = useCallback((record: FlatRecord) => {
    // 手動除外が最優先
    if (record.isExcluded) {
      return (
        <Chip
          label="除外"
          size="small"
          sx={{
            backgroundColor: '#f44336',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.7rem',
          }}
        />
      );
    }

    // 前日/当日キャンセル
    if (record.detailStatus === '前日キャンセル' || record.detailStatus === '当日キャンセル') {
      return (
        <Chip
          label={record.detailStatus === '前日キャンセル' ? '前日' : '当日'}
          size="small"
          sx={{
            backgroundColor: '#ff9800',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.7rem',
          }}
        />
      );
    }

    // ステータス未設定
    if (!record.detailStatus) {
      // 集計対象として扱われる
      return (
        <Chip
          label="対象"
          size="small"
          sx={{
            backgroundColor: '#4caf50',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.7rem',
          }}
        />
      );
    }

    // その他のステータス（存在する場合）
    return (
      <Chip
        label="-"
        size="small"
        sx={{
          backgroundColor: '#9e9e9e',
          color: 'white',
          fontSize: '0.7rem',
        }}
      />
    );
  }, []);

  // 検索フィルタ
  const filteredRecords = useMemo(() => {
    if (!searchText.trim()) return periodFilteredRecords;

    const lowerSearch = searchText.toLowerCase();
    return periodFilteredRecords.filter(
      record =>
        record.friendId.toLowerCase().includes(lowerSearch) ||
        record.name.toLowerCase().includes(lowerSearch) ||
        (record.course && record.course.toLowerCase().includes(lowerSearch)) ||
        (record.reservationSlot && record.reservationSlot.toLowerCase().includes(lowerSearch))
    );
  }, [periodFilteredRecords, searchText]);

  // ページング
  const paginatedRecords = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredRecords.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  const selectedRecord = useMemo(() => {
    if (!selectedReservationId) return null;
    return allUnassignedRecords.find(r => r.reservationId === selectedReservationId) || null;
  }, [selectedReservationId, allUnassignedRecords]);

  const handleRowClick = useCallback((record: FlatRecord) => {
    setSelectedReservationId(record.reservationId);
    setDrawerOpen(true);
  }, []);

  /**
   * 担当者をその場で割り当て
   */
  const handleAssignStaff = useCallback(
    async (reservationId: string, staffName: string) => {
      if (!staffName) return;
      setUpdatingId(reservationId);
      try {
        await assignStaff(reservationId, staffName);
      } finally {
        setUpdatingId(null);
      }
    },
    [assignStaff]
  );

  const handleDownloadCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      alert('データがありません');
      return;
    }

    const headers = [
      '予約ID',
      '友だちID',
      '名前',
      '実施日',
      '申込日時',
      'ステータス',
      '来店',
      '除外ステータス',
      'コース',
      '予約枠',
      'おまかせ',
    ];
    const rows = filteredRecords.map(record => {
      // 除外ステータスの判定
      let exclusionStatus = '対象';
      if (record.isExcluded) {
        exclusionStatus = '除外';
      } else if (record.detailStatus === '前日キャンセル') {
        exclusionStatus = '前日キャンセル';
      } else if (record.detailStatus === '当日キャンセル') {
        exclusionStatus = '当日キャンセル';
      }

      return [
        record.reservationId,
        record.friendId,
        record.name,
        record.sessionDateStr,
        record.applicationDateStr,
        record.status,
        record.visitStatus,
        exclusionStatus,
        record.course || '',
        record.reservationSlot || '',
        record.wasOmakase ? 'はい' : 'いいえ',
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `未割当一覧_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredRecords]);

  if (histories.size === 0) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PersonOffIcon color="warning" />
          未割当一覧
        </Typography>
        <Alert severity="info">履歴データがありません。CSVをアップロードしてください。</Alert>
      </Box>
    );
  }

  if (allUnassignedRecords.length === 0) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PersonOffIcon color="success" />
          未割当一覧
        </Typography>
        <Alert severity="success">すべての予約に担当者が割り当てられています。</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}
      >
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonOffIcon color="warning" />
          未割当一覧
          <Chip label={`${stats.total}件`} color="warning" size="small" />
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
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" component="span">
            <strong>フィルタ条件:</strong>{' '}
            <Chip size="small" label={`基準: ${DATE_BASE_TYPE_LABELS[dateBaseType]}`} sx={{ mr: 0.5 }} />
            <Chip size="small" label={PERIOD_PRESET_LABELS[periodPreset]} color="primary" variant="outlined" />
          </Typography>
        </Box>
        <Typography variant="body2">
          <strong>未割当総数:</strong>{' '}
          <Chip
            size="small"
            label={`${stats.total}件`}
            color="warning"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.75rem' }}
          />{' '}
          （実施済み: {stats.implemented}件 / おまかせ: {stats.omakase}件）
          {(stats.excluded > 0 || stats.lateCancel > 0) && (
            <span style={{ marginLeft: 8 }}>
              {stats.excluded > 0 && (
                <Chip
                  size="small"
                  label={`除外: ${stats.excluded}件`}
                  sx={{ height: 20, fontSize: '0.75rem', backgroundColor: '#f44336', color: 'white', ml: 0.5 }}
                />
              )}
              {stats.lateCancel > 0 && (
                <Chip
                  size="small"
                  label={`前日/当日: ${stats.lateCancel}件`}
                  sx={{ height: 20, fontSize: '0.75rem', backgroundColor: '#ff9800', color: 'white', ml: 0.5 }}
                />
              )}
            </span>
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          担当者が未設定、または「おまかせ」予約で担当者判定ができなかった予約が表示されます。
          プルダウンから担当者を選択すると即座に割り当てできます。
        </Typography>
      </Alert>

      {/* フィルターバー */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="名前、コース、予約枠で検索..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: 300 }}
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
                <TableCell>実施日</TableCell>
                <TableCell>申込日時</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell align="center">
                  <Tooltip title="集計対象/除外/前日キャンセル/当日キャンセル">
                    <span>除外</span>
                  </Tooltip>
                </TableCell>
                <TableCell>コース</TableCell>
                <TableCell>予約枠（G列）</TableCell>
                <TableCell sx={{ minWidth: 200 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PersonAddIcon fontSize="small" />
                    担当者割当
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRecords.map((record, index) => (
                <TableRow
                  key={`${record.reservationId}-${index}`}
                  hover
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: record.wasOmakase ? 'rgba(237, 108, 2, 0.04)' : 'inherit',
                  }}
                >
                  <TableCell onClick={() => handleRowClick(record)}>{record.name}</TableCell>
                  <TableCell onClick={() => handleRowClick(record)}>{record.sessionDateStr}</TableCell>
                  <TableCell onClick={() => handleRowClick(record)}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {record.applicationDateStr}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" onClick={() => handleRowClick(record)}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={record.status === '予約済み' ? '予約' : 'キャンセル'}
                        size="small"
                        color={record.status === '予約済み' ? 'primary' : 'error'}
                        variant="outlined"
                      />
                      {record.wasOmakase && <Chip label="おまかせ" size="small" color="warning" variant="outlined" />}
                    </Box>
                  </TableCell>
                  <TableCell align="center" onClick={() => handleRowClick(record)}>
                    {getExclusionBadge(record)}
                  </TableCell>
                  <TableCell onClick={() => handleRowClick(record)}>{record.course || '-'}</TableCell>
                  <TableCell onClick={() => handleRowClick(record)}>
                    <Tooltip title={record.reservationSlot || ''}>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 150,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {record.reservationSlot || '-'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" fullWidth>
                      <Select
                        value=""
                        displayEmpty
                        onChange={e => handleAssignStaff(record.reservationId, e.target.value)}
                        disabled={updatingId === record.reservationId}
                        startAdornment={
                          updatingId === record.reservationId ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null
                        }
                      >
                        <MenuItem value="" disabled>
                          <em>担当者を選択...</em>
                        </MenuItem>
                        {OFFICIAL_STAFF_MEMBERS.map(staff => (
                          <MenuItem key={staff} value={staff}>
                            {staff}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
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
    </Box>
  );
};
