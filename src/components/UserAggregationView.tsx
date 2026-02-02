/**
 * ユーザー別集計ビューコンポーネント
 *
 * 機能:
 * - ユーザー別の実績集計表示
 * - 期間フィルタ
 * - CSV/Excelエクスポート
 * - 行クリックで詳細履歴をドロワー表示
 */

import { useState, useMemo, useCallback } from 'react';
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
  Stack,
  Chip,
  Button,
  Tooltip,
  TextField,
  InputAdornment,
  TablePagination,
  TableSortLabel,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore, DATE_BASE_TYPE_LABELS } from '../store/uiStore';
import type { ReservationHistory, ImplementationRule } from '../domain';
import { shouldCountAsImplemented, applySameDayMerge } from '../domain';
import { UserDetailDrawer } from './UserDetailDrawer';

// ============================================================================
// 型定義
// ============================================================================

/**
 * ユーザー別集計結果
 */
interface UserAggregationResult {
  friendId: string;
  name: string;
  totalCount: number;
  implementedCount: number;
  cancelCount: number;
  previousDayCancelCount: number;
  sameDayCancelCount: number;
  firstVisitCount: number;
  secondVisitCount: number;
  thirdOrMoreCount: number;
  cumulativeVisitCount: number; // 累計来店回数
  firstVisitDate: Date | null; // 初回来店日
  lastVisitDate: Date | null; // 最終来店日
  implementationRate: number;
  // 詳細履歴（ドロワー用）
  histories: ReservationHistory[];
}

type SortField =
  | 'name'
  | 'totalCount'
  | 'implementedCount'
  | 'cancelCount'
  | 'cumulativeVisitCount'
  | 'firstVisitDate'
  | 'lastVisitDate';
type SortOrder = 'asc' | 'desc';

// ============================================================================
// 集計ロジック
// ============================================================================

/**
 * ユーザー別集計を計算
 */
function calculateUserAggregation(
  records: ReservationHistory[],
  implementationRule: ImplementationRule = 'includeLateCancel'
): UserAggregationResult[] {
  const userMap = new Map<
    string,
    {
      friendId: string;
      name: string;
      totalCount: number;
      implementedCount: number;
      cancelCount: number;
      previousDayCancelCount: number;
      sameDayCancelCount: number;
      firstVisitCount: number;
      secondVisitCount: number;
      thirdOrMoreCount: number;
      visitDates: Date[];
      histories: ReservationHistory[];
    }
  >();

  for (const record of records) {
    if (record.isExcluded) continue;

    const friendId = record.friendId;

    let entry = userMap.get(friendId);
    if (!entry) {
      entry = {
        friendId,
        name: record.name,
        totalCount: 0,
        implementedCount: 0,
        cancelCount: 0,
        previousDayCancelCount: 0,
        sameDayCancelCount: 0,
        firstVisitCount: 0,
        secondVisitCount: 0,
        thirdOrMoreCount: 0,
        visitDates: [],
        histories: [],
      };
      userMap.set(friendId, entry);
    }

    entry.totalCount++;
    entry.histories.push(record);

    // 前日/当日キャンセルのカウント
    if (record.detailStatus === '前日キャンセル') {
      entry.previousDayCancelCount++;
    } else if (record.detailStatus === '当日キャンセル') {
      entry.sameDayCancelCount++;
    }

    // 実施判定
    if (shouldCountAsImplemented(record, implementationRule)) {
      entry.implementedCount++;
      entry.visitDates.push(record.sessionDate);

      if (record.visitIndex === 1) {
        entry.firstVisitCount++;
      } else if (record.visitIndex === 2) {
        entry.secondVisitCount++;
      } else {
        entry.thirdOrMoreCount++;
      }
    } else if (record.status === 'キャンセル済み') {
      entry.cancelCount++;
    }
  }

  // 配列に変換
  return Array.from(userMap.values())
    .map(entry => {
      const sortedDates = [...entry.visitDates].sort((a, b) => a.getTime() - b.getTime());
      const firstVisitDate: Date | null = sortedDates.length > 0 ? sortedDates[0]! : null;
      const lastVisitDate: Date | null = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1]! : null;

      const implementationRate =
        entry.totalCount > 0 ? Math.round((entry.implementedCount / entry.totalCount) * 1000) / 10 : 0;

      // 履歴を日付順にソート（新しい順）
      const sortedHistories = entry.histories.sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());

      return {
        friendId: entry.friendId,
        name: entry.name,
        totalCount: entry.totalCount,
        implementedCount: entry.implementedCount,
        cancelCount: entry.cancelCount,
        previousDayCancelCount: entry.previousDayCancelCount,
        sameDayCancelCount: entry.sameDayCancelCount,
        firstVisitCount: entry.firstVisitCount,
        secondVisitCount: entry.secondVisitCount,
        thirdOrMoreCount: entry.thirdOrMoreCount,
        cumulativeVisitCount: entry.visitDates.length,
        firstVisitDate,
        lastVisitDate,
        implementationRate,
        histories: sortedHistories,
      };
    })
    .sort((a, b) => b.implementedCount - a.implementedCount);
}

// ============================================================================
// ユーティリティ
// ============================================================================

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// ============================================================================
// コンポーネント
// ============================================================================

export function UserAggregationView() {
  const { histories } = useHistoryStore();
  const {
    implementationRule,
    mergeSameDayReservations,
    dateBaseType,
    periodPreset,
    periodFrom,
    periodTo,
    getEffectivePeriod,
  } = useUiStore();

  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>('implementedCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // ドロワー状態
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAggregationResult | null>(null);

  // 共通フィルタから有効期間を取得
  const effectivePeriod = useMemo(
    () => getEffectivePeriod(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodPreset, periodFrom, periodTo]
  );

  // フィルタリングされたレコード
  const filteredRecords = useMemo(() => {
    const records = Array.from(histories.values());
    const { from: fromDate, to: toDate } = effectivePeriod;

    if (!fromDate && !toDate) {
      return records;
    }

    return records.filter(record => {
      const date = dateBaseType === 'session' ? record.sessionDate : record.applicationDate;

      if (fromDate) {
        const fromStart = new Date(fromDate);
        fromStart.setHours(0, 0, 0, 0);
        if (date < fromStart) return false;
      }

      if (toDate) {
        const toEnd = new Date(toDate);
        toEnd.setHours(23, 59, 59, 999);
        if (date > toEnd) return false;
      }

      return true;
    });
  }, [histories, effectivePeriod, dateBaseType]);

  // 同日統合を適用
  const recordsForAggregation = useMemo(() => {
    return applySameDayMerge(filteredRecords, mergeSameDayReservations);
  }, [filteredRecords, mergeSameDayReservations]);

  // ユーザー別集計
  const userAggregation = useMemo(() => {
    return calculateUserAggregation(recordsForAggregation, implementationRule);
  }, [recordsForAggregation, implementationRule]);

  // 検索フィルタ
  const searchFilteredUsers = useMemo(() => {
    if (!searchText.trim()) return userAggregation;

    const lowerSearch = searchText.toLowerCase();
    return userAggregation.filter(
      user => user.friendId.toLowerCase().includes(lowerSearch) || user.name.toLowerCase().includes(lowerSearch)
    );
  }, [userAggregation, searchText]);

  // ソート
  const sortedUsers = useMemo(() => {
    return [...searchFilteredUsers].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ja');
          break;
        case 'totalCount':
          comparison = a.totalCount - b.totalCount;
          break;
        case 'implementedCount':
          comparison = a.implementedCount - b.implementedCount;
          break;
        case 'cancelCount':
          comparison = a.cancelCount - b.cancelCount;
          break;
        case 'cumulativeVisitCount':
          comparison = a.cumulativeVisitCount - b.cumulativeVisitCount;
          break;
        case 'firstVisitDate':
          if (!a.firstVisitDate && !b.firstVisitDate) comparison = 0;
          else if (!a.firstVisitDate) comparison = 1;
          else if (!b.firstVisitDate) comparison = -1;
          else comparison = a.firstVisitDate.getTime() - b.firstVisitDate.getTime();
          break;
        case 'lastVisitDate':
          if (!a.lastVisitDate && !b.lastVisitDate) comparison = 0;
          else if (!a.lastVisitDate) comparison = 1;
          else if (!b.lastVisitDate) comparison = -1;
          else comparison = a.lastVisitDate.getTime() - b.lastVisitDate.getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [searchFilteredUsers, sortField, sortOrder]);

  // ページング
  const paginatedUsers = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return sortedUsers.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedUsers, page, rowsPerPage]);

  // 合計計算
  const totals = useMemo(() => {
    return userAggregation.reduce(
      (acc, u) => ({
        totalCount: acc.totalCount + u.totalCount,
        implementedCount: acc.implementedCount + u.implementedCount,
        cancelCount: acc.cancelCount + u.cancelCount,
        previousDayCancelCount: acc.previousDayCancelCount + u.previousDayCancelCount,
        sameDayCancelCount: acc.sameDayCancelCount + u.sameDayCancelCount,
        firstVisitCount: acc.firstVisitCount + u.firstVisitCount,
        secondVisitCount: acc.secondVisitCount + u.secondVisitCount,
        thirdOrMoreCount: acc.thirdOrMoreCount + u.thirdOrMoreCount,
        cumulativeVisitCount: acc.cumulativeVisitCount + u.cumulativeVisitCount,
      }),
      {
        totalCount: 0,
        implementedCount: 0,
        cancelCount: 0,
        previousDayCancelCount: 0,
        sameDayCancelCount: 0,
        firstVisitCount: 0,
        secondVisitCount: 0,
        thirdOrMoreCount: 0,
        cumulativeVisitCount: 0,
      }
    );
  }, [userAggregation]);

  // 全体の実施率と移行率
  const overallStats = useMemo(() => {
    const implementationRate =
      totals.totalCount > 0 ? Math.round((totals.implementedCount / totals.totalCount) * 1000) / 10 : 0;

    // 初回→2回目の移行率を計算
    // 初回が1回以上あるユーザーのうち、2回目以降も来店したユーザーの割合
    const usersWithFirstVisit = userAggregation.filter(u => u.firstVisitCount >= 1);
    const usersWithSecondVisit = userAggregation.filter(u => u.secondVisitCount >= 1 || u.thirdOrMoreCount >= 1);

    const firstToSecondRate =
      usersWithFirstVisit.length > 0
        ? Math.round((usersWithSecondVisit.length / usersWithFirstVisit.length) * 1000) / 10
        : 0;

    // 2回目→3回目以降の移行率
    const usersWithThirdOrMore = userAggregation.filter(u => u.thirdOrMoreCount >= 1);
    const secondToThirdRate =
      usersWithSecondVisit.length > 0
        ? Math.round((usersWithThirdOrMore.length / usersWithSecondVisit.length) * 1000) / 10
        : 0;

    // リピート率（2回以上来店したユーザー / 全ユーザー）
    const usersWithRepeat = userAggregation.filter(u => u.cumulativeVisitCount >= 2);
    const repeatRate =
      userAggregation.length > 0 ? Math.round((usersWithRepeat.length / userAggregation.length) * 1000) / 10 : 0;

    return {
      implementationRate,
      firstToSecondRate,
      secondToThirdRate,
      repeatRate,
      usersWithFirstVisit: usersWithFirstVisit.length,
      usersWithSecondVisit: usersWithSecondVisit.length,
      usersWithThirdOrMore: usersWithThirdOrMore.length,
      usersWithRepeat: usersWithRepeat.length,
    };
  }, [totals, userAggregation]);

  // ソートハンドラ
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortOrder('desc');
      }
    },
    [sortField, sortOrder]
  );

  // 行クリックハンドラ
  const handleRowClick = useCallback((user: UserAggregationResult) => {
    setSelectedUser(user);
    setDrawerOpen(true);
  }, []);

  // CSVエクスポート
  const handleExportCSV = useCallback(() => {
    const header = [
      '友だちID',
      '名前',
      '予約数',
      '実施数',
      'キャンセル数',
      '前日キャンセル',
      '当日キャンセル',
      '実施率(%)',
      '初回',
      '2回目',
      '3回目以降',
      '累計来店回数',
      '初回来店日',
      '最終来店日',
    ].join(',');

    const rows = sortedUsers.map(u =>
      [
        `"${u.friendId}"`,
        `"${u.name}"`,
        u.totalCount,
        u.implementedCount,
        u.cancelCount,
        u.previousDayCancelCount,
        u.sameDayCancelCount,
        u.implementationRate,
        u.firstVisitCount,
        u.secondVisitCount,
        u.thirdOrMoreCount,
        u.cumulativeVisitCount,
        formatDate(u.firstVisitDate),
        formatDate(u.lastVisitDate),
      ].join(',')
    );

    const totalRow = [
      '"合計"',
      `"${userAggregation.length}人"`,
      totals.totalCount,
      totals.implementedCount,
      totals.cancelCount,
      totals.previousDayCancelCount,
      totals.sameDayCancelCount,
      overallStats.implementationRate,
      totals.firstVisitCount,
      totals.secondVisitCount,
      totals.thirdOrMoreCount,
      totals.cumulativeVisitCount,
      '-',
      '-',
    ].join(',');

    const csvContent = [header, ...rows, totalRow].join('\n');

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `ユーザー別集計_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [sortedUsers, userAggregation.length, totals, overallStats]);

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" />
              <Typography variant="h5" component="h2">
                ユーザー別集計
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCSV}
              disabled={userAggregation.length === 0}
            >
              CSVダウンロード
            </Button>
          </Box>

          {/* サマリー */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: 'grey.50' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
              集計サマリー
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <Chip label={`基準日: ${DATE_BASE_TYPE_LABELS[dateBaseType]}`} variant="outlined" color="info" />
              <Chip label={`対象レコード: ${filteredRecords.length}件`} color="primary" variant="outlined" />
              <Chip label={`ユーザー数: ${userAggregation.length}人`} color="secondary" variant="outlined" />
              <Chip label={`全体実施率: ${overallStats.implementationRate}%`} color="success" variant="outlined" />
              <Chip label={`累計来店: ${totals.cumulativeVisitCount}回`} color="info" variant="outlined" />
            </Stack>

            {/* 移行率サマリー */}
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
              継続率・移行率
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Tooltip title={`初回来店ユーザー${overallStats.usersWithFirstVisit}人 → 2回目以降来店${overallStats.usersWithSecondVisit}人`}>
                <Chip
                  label={`初回→2回目: ${overallStats.firstToSecondRate}%`}
                  color={overallStats.firstToSecondRate >= 50 ? 'success' : overallStats.firstToSecondRate >= 30 ? 'warning' : 'error'}
                  variant="filled"
                  sx={{ fontWeight: 'bold' }}
                />
              </Tooltip>
              <Tooltip title={`2回目来店ユーザー${overallStats.usersWithSecondVisit}人 → 3回目以降来店${overallStats.usersWithThirdOrMore}人`}>
                <Chip
                  label={`2回目→3回目: ${overallStats.secondToThirdRate}%`}
                  color={overallStats.secondToThirdRate >= 50 ? 'success' : overallStats.secondToThirdRate >= 30 ? 'warning' : 'default'}
                  variant="outlined"
                />
              </Tooltip>
              <Tooltip title={`全ユーザー${userAggregation.length}人中、2回以上来店${overallStats.usersWithRepeat}人`}>
                <Chip
                  label={`リピート率: ${overallStats.repeatRate}%`}
                  color="info"
                  variant="outlined"
                />
              </Tooltip>
            </Stack>
          </Paper>

          {/* 検索バー */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="名前、友だちIDで検索..."
              value={searchText}
              onChange={e => {
                setSearchText(e.target.value);
                setPage(0);
              }}
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
              表示: {searchFilteredUsers.length}人
            </Typography>
          </Box>

          {/* テーブル */}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'name'}
                      direction={sortField === 'name' ? sortOrder : 'asc'}
                      onClick={() => handleSort('name')}
                    >
                      名前
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>友だちID</TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'totalCount'}
                      direction={sortField === 'totalCount' ? sortOrder : 'asc'}
                      onClick={() => handleSort('totalCount')}
                    >
                      予約数
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'implementedCount'}
                      direction={sortField === 'implementedCount' ? sortOrder : 'asc'}
                      onClick={() => handleSort('implementedCount')}
                    >
                      実施数
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'cancelCount'}
                      direction={sortField === 'cancelCount' ? sortOrder : 'asc'}
                      onClick={() => handleSort('cancelCount')}
                    >
                      キャンセル
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="前日キャンセル / 当日キャンセル">
                      <span>前日C/当日C</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">初回</TableCell>
                  <TableCell align="right">2回目</TableCell>
                  <TableCell align="right">3回目〜</TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'cumulativeVisitCount'}
                      direction={sortField === 'cumulativeVisitCount' ? sortOrder : 'asc'}
                      onClick={() => handleSort('cumulativeVisitCount')}
                    >
                      累計来店
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center">
                    <TableSortLabel
                      active={sortField === 'firstVisitDate'}
                      direction={sortField === 'firstVisitDate' ? sortOrder : 'asc'}
                      onClick={() => handleSort('firstVisitDate')}
                    >
                      初回来店日
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center">
                    <TableSortLabel
                      active={sortField === 'lastVisitDate'}
                      direction={sortField === 'lastVisitDate' ? sortOrder : 'asc'}
                      onClick={() => handleSort('lastVisitDate')}
                    >
                      最終来店日
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        データがありません
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map(user => (
                    <TableRow key={user.friendId} hover onClick={() => handleRowClick(user)} sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Typography fontWeight="medium">{user.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {user.friendId}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{user.totalCount}</TableCell>
                      <TableCell align="right">
                        <Typography color="success.main" fontWeight="medium">
                          {user.implementedCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="text.secondary">{user.cancelCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Typography color="warning.main" fontSize="0.875rem">
                            {user.previousDayCancelCount}
                          </Typography>
                          <Typography color="text.secondary" fontSize="0.875rem">
                            /
                          </Typography>
                          <Typography color="error.main" fontSize="0.875rem">
                            {user.sameDayCancelCount}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">{user.firstVisitCount}</TableCell>
                      <TableCell align="right">{user.secondVisitCount}</TableCell>
                      <TableCell align="right">{user.thirdOrMoreCount}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={user.cumulativeVisitCount}
                          size="small"
                          color={
                            user.cumulativeVisitCount >= 3
                              ? 'success'
                              : user.cumulativeVisitCount >= 2
                                ? 'primary'
                                : 'default'
                          }
                          variant={user.cumulativeVisitCount >= 2 ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontSize="0.75rem">
                          {formatDate(user.firstVisitDate)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontSize="0.75rem">
                          {formatDate(user.lastVisitDate)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ページネーション */}
          <TablePagination
            component="div"
            count={searchFilteredUsers.length}
            page={page}
            onPageChange={(_event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={event => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="表示件数:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}人`}
          />
        </CardContent>
      </Card>

      {/* ユーザー詳細ドロワー */}
      <UserDetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={selectedUser} />
    </Box>
  );
}
