/**
 * 担当者別集計ビューコンポーネント
 *
 * 機能:
 * - 担当者別の実績集計表示
 * - 期間フィルタ
 * - CSV/Excelエクスポート
 * - 実施率・CVRグラフ表示
 */

import { useState, useMemo } from 'react';
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
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore, DATE_BASE_TYPE_LABELS } from '../store/uiStore';
import type { ReservationHistory, ImplementationRule } from '../domain/types';
import { shouldCountAsImplemented, applySameDayMerge } from '../domain/logic';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ============================================================================
// 型定義
// ============================================================================

// propsは不要になりました（共通フィルタを使用）
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface StaffAggregationViewProps {}

// ============================================================================
// 集計ロジック
// ============================================================================

/**
 * 拡張された担当者別集計結果
 */
interface StaffAggregationResult {
  staffName: string;
  totalCount: number;
  implementedCount: number;
  cancelCount: number;
  previousDayCancelCount: number;  // 前日キャンセル件数
  sameDayCancelCount: number;      // 当日キャンセル件数
  firstVisitCount: number;
  secondVisitCount: number;
  thirdOrMoreCount: number;
  omakaseAssignedCount: number;
  uniqueUsers: number;
  groupedCount: number;
  implementationRate: number;      // 実施率(%)
  firstToSecondCVR: number;        // 初回→2回目CVR(%)
}

/**
 * 担当者別集計を計算
 */
function calculateStaffAggregation(
  records: ReservationHistory[],
  implementationRule: ImplementationRule = 'includeLateCancel'
): StaffAggregationResult[] {
  const staffMap = new Map<string, {
    staffName: string;
    totalCount: number;
    implementedCount: number;
    cancelCount: number;
    previousDayCancelCount: number;
    sameDayCancelCount: number;
    firstVisitCount: number;
    secondVisitCount: number;
    thirdOrMoreCount: number;
    omakaseAssignedCount: number;
    uniqueUsers: Set<string>;
    firstVisitUsers: Set<string>;  // 初回来店したユーザー
    secondVisitUsers: Set<string>; // 2回目来店したユーザー
    groupedCount: number;
  }>();

  const processedGroups = new Set<string>();

  for (const record of records) {
    // 除外されたレコードはスキップ
    if (record.isExcluded) continue;

    const staffName = record.staff || '(未割当)';

    let entry = staffMap.get(staffName);
    if (!entry) {
      entry = {
        staffName,
        totalCount: 0,
        implementedCount: 0,
        cancelCount: 0,
        previousDayCancelCount: 0,
        sameDayCancelCount: 0,
        firstVisitCount: 0,
        secondVisitCount: 0,
        thirdOrMoreCount: 0,
        omakaseAssignedCount: 0,
        uniqueUsers: new Set(),
        firstVisitUsers: new Set(),
        secondVisitUsers: new Set(),
        groupedCount: 0,
      };
      staffMap.set(staffName, entry);
    }

    entry.totalCount++;
    entry.uniqueUsers.add(record.friendId);

    // groupIdでまとめられたレコードをカウント
    if (record.groupId && !processedGroups.has(record.groupId)) {
      entry.groupedCount++;
      processedGroups.add(record.groupId);
    }

    // 前日/当日キャンセルのカウント
    if (record.detailStatus === '前日キャンセル') {
      entry.previousDayCancelCount++;
    } else if (record.detailStatus === '当日キャンセル') {
      entry.sameDayCancelCount++;
    }

    // 実施判定ルールに基づいてカウント
    if (shouldCountAsImplemented(record, implementationRule)) {
      entry.implementedCount++;
      if (record.visitIndex === 1) {
        entry.firstVisitCount++;
        entry.firstVisitUsers.add(record.friendId);
      } else if (record.visitIndex === 2) {
        entry.secondVisitCount++;
        entry.secondVisitUsers.add(record.friendId);
      } else {
        entry.thirdOrMoreCount++;
      }
    } else if (record.status === 'キャンセル済み') {
      entry.cancelCount++;
    }

    if (record.wasOmakase && record.staff) {
      entry.omakaseAssignedCount++;
    }
  }

  // 配列に変換して実施数降順でソート
  return Array.from(staffMap.values())
    .map((entry) => {
      // 実施率
      const implementationRate = entry.totalCount > 0
        ? Math.round((entry.implementedCount / entry.totalCount) * 1000) / 10
        : 0;

      // 初回→2回目CVR（初回ユーザーのうち2回目も来た人の割合）
      // 注: この担当者経由で初回来店した人が、その後2回目も来た割合
      const firstToSecondCVR = entry.firstVisitUsers.size > 0
        ? Math.round((entry.secondVisitUsers.size / entry.firstVisitUsers.size) * 1000) / 10
        : 0;

      return {
        staffName: entry.staffName,
        totalCount: entry.totalCount,
        implementedCount: entry.implementedCount,
        cancelCount: entry.cancelCount,
        previousDayCancelCount: entry.previousDayCancelCount,
        sameDayCancelCount: entry.sameDayCancelCount,
        firstVisitCount: entry.firstVisitCount,
        secondVisitCount: entry.secondVisitCount,
        thirdOrMoreCount: entry.thirdOrMoreCount,
        omakaseAssignedCount: entry.omakaseAssignedCount,
        uniqueUsers: entry.uniqueUsers.size,
        groupedCount: entry.groupedCount,
        implementationRate,
        firstToSecondCVR,
      };
    })
    .sort((a, b) => b.implementedCount - a.implementedCount);
}

// ============================================================================
// コンポーネント
// ============================================================================

// グラフ用カラーパレット
const CHART_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63',
  '#00BCD4', '#FFC107', '#795548', '#607D8B', '#3F51B5',
];

export function StaffAggregationView(_props: StaffAggregationViewProps) {
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

  // タブ切り替え (0: テーブル, 1: グラフ)
  const [activeTab, setActiveTab] = useState(0);

  // 共通フィルタから有効期間を取得（フィルタ条件の変更を検知）
  const effectivePeriod = useMemo(
    () => getEffectivePeriod(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodPreset, periodFrom, periodTo]
  );

  // フィルタリングされたレコード（共通フィルタに連動）
  const filteredRecords = useMemo(() => {
    const records = Array.from(histories.values());
    const { from: fromDate, to: toDate } = effectivePeriod;

    if (!fromDate && !toDate) {
      return records;
    }

    return records.filter((record) => {
      // 基準日タイプに応じて使用する日付を切り替え
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

  // 担当者別集計
  const staffAggregation = useMemo(() => {
    return calculateStaffAggregation(recordsForAggregation, implementationRule);
  }, [recordsForAggregation, implementationRule]);

  // 合計計算
  const totals = useMemo(() => {
    return staffAggregation.reduce(
      (acc, s) => ({
        totalCount: acc.totalCount + s.totalCount,
        implementedCount: acc.implementedCount + s.implementedCount,
        cancelCount: acc.cancelCount + s.cancelCount,
        previousDayCancelCount: acc.previousDayCancelCount + s.previousDayCancelCount,
        sameDayCancelCount: acc.sameDayCancelCount + s.sameDayCancelCount,
        firstVisitCount: acc.firstVisitCount + s.firstVisitCount,
        secondVisitCount: acc.secondVisitCount + s.secondVisitCount,
        thirdOrMoreCount: acc.thirdOrMoreCount + s.thirdOrMoreCount,
        omakaseAssignedCount: acc.omakaseAssignedCount + s.omakaseAssignedCount,
        uniqueUsers: acc.uniqueUsers + s.uniqueUsers,
        groupedCount: acc.groupedCount + s.groupedCount,
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
        omakaseAssignedCount: 0,
        uniqueUsers: 0,
        groupedCount: 0,
      }
    );
  }, [staffAggregation]);

  // 全体の実施率・CVR
  const overallStats = useMemo(() => {
    const implementationRate = totals.totalCount > 0
      ? Math.round((totals.implementedCount / totals.totalCount) * 1000) / 10
      : 0;
    const firstToSecondCVR = totals.firstVisitCount > 0
      ? Math.round((totals.secondVisitCount / totals.firstVisitCount) * 1000) / 10
      : 0;
    return { implementationRate, firstToSecondCVR };
  }, [totals]);

  // CSVエクスポート
  const handleExportCSV = () => {
    const header = [
      '担当者',
      '予約数',
      '実施数',
      'キャンセル数',
      '前日キャンセル',
      '当日キャンセル',
      '実施率(%)',
      '初回',
      '2回目',
      '3回目以降',
      '初回→2回目CVR(%)',
      'おまかせ配分',
      'ユニークユーザー',
    ].join(',');

    const rows = staffAggregation.map((s) =>
      [
        s.staffName,
        s.totalCount,
        s.implementedCount,
        s.cancelCount,
        s.previousDayCancelCount,
        s.sameDayCancelCount,
        s.implementationRate,
        s.firstVisitCount,
        s.secondVisitCount,
        s.thirdOrMoreCount,
        s.firstToSecondCVR,
        s.omakaseAssignedCount,
        s.uniqueUsers,
      ].join(',')
    );

    // 合計行
    const totalRow = [
      '合計',
      totals.totalCount,
      totals.implementedCount,
      totals.cancelCount,
      totals.previousDayCancelCount,
      totals.sameDayCancelCount,
      overallStats.implementationRate,
      totals.firstVisitCount,
      totals.secondVisitCount,
      totals.thirdOrMoreCount,
      overallStats.firstToSecondCVR,
      totals.omakaseAssignedCount,
      '-',
    ].join(',');

    const csvContent = [header, ...rows, totalRow].join('\n');

    // BOM付きUTF-8
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `担当者別集計_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" />
              <Typography variant="h5" component="h2">
                担当者別集計
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCSV}
              disabled={staffAggregation.length === 0}
            >
              CSVダウンロード
            </Button>
          </Box>

          {/* サマリー（期間は共通フィルタバーで設定） */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
            <Chip
              label={`基準日: ${DATE_BASE_TYPE_LABELS[dateBaseType]}`}
              variant="outlined"
              color="info"
            />
            <Chip
              label={`対象レコード: ${filteredRecords.length}件`}
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`担当者数: ${staffAggregation.length}人`}
              color="secondary"
              variant="outlined"
            />
            <Chip
              label={`全体実施率: ${overallStats.implementationRate}%`}
              color="success"
              variant="outlined"
            />
            <Chip
              label={`初回→2回目CVR: ${overallStats.firstToSecondCVR}%`}
              color="info"
              variant="outlined"
            />
          </Stack>

          {/* タブ切り替え */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
              <Tab icon={<TableChartIcon />} iconPosition="start" label="テーブル" />
              <Tab icon={<BarChartIcon />} iconPosition="start" label="グラフ" />
            </Tabs>
          </Box>

          {/* テーブルビュー */}
          {activeTab === 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell>担当者</TableCell>
                  <TableCell align="right">予約数</TableCell>
                  <TableCell align="right">実施数</TableCell>
                  <TableCell align="right">キャンセル</TableCell>
                  <TableCell align="right">
                    <Tooltip title="前日キャンセル">
                      <span>前日C</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="当日キャンセル">
                      <span>当日C</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">実施率</TableCell>
                  <TableCell align="right">初回</TableCell>
                  <TableCell align="right">2回目</TableCell>
                  <TableCell align="right">3回目〜</TableCell>
                  <TableCell align="right">
                    <Tooltip title="初回来店者が2回目も来店した率">
                      <span>CVR</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">おまかせ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staffAggregation.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        データがありません
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {staffAggregation.map((staff) => (
                      <TableRow key={staff.staffName} hover>
                        <TableCell>
                          <Typography fontWeight="medium">
                            {staff.staffName}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{staff.totalCount}</TableCell>
                        <TableCell align="right">
                          <Typography color="success.main" fontWeight="medium">
                            {staff.implementedCount}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="text.secondary">
                            {staff.cancelCount}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="warning.main" fontSize="0.875rem">
                            {staff.previousDayCancelCount}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="error.main" fontSize="0.875rem">
                            {staff.sameDayCancelCount}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={staff.implementationRate}
                              sx={{ width: 40, height: 6, borderRadius: 1 }}
                            />
                            <Typography fontSize="0.875rem">{staff.implementationRate}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">{staff.firstVisitCount}</TableCell>
                        <TableCell align="right">{staff.secondVisitCount}</TableCell>
                        <TableCell align="right">{staff.thirdOrMoreCount}</TableCell>
                        <TableCell align="right">
                          <Typography color="info.main" fontSize="0.875rem">
                            {staff.firstToSecondCVR}%
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {staff.omakaseAssignedCount > 0 && (
                            <Chip
                              label={staff.omakaseAssignedCount}
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* 合計行 */}
                    <TableRow sx={{ backgroundColor: 'grey.50' }}>
                      <TableCell>
                        <Typography fontWeight="bold">合計</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{totals.totalCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="success.main">
                          {totals.implementedCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="text.secondary">
                          {totals.cancelCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="warning.main">
                          {totals.previousDayCancelCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="error.main">
                          {totals.sameDayCancelCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          {overallStats.implementationRate}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{totals.firstVisitCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{totals.secondVisitCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{totals.thirdOrMoreCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="info.main">
                          {overallStats.firstToSecondCVR}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{totals.omakaseAssignedCount}</Typography>
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          )}

          {/* グラフビュー */}
          {activeTab === 1 && staffAggregation.length > 0 && (
            <Box>
              {/* 実施率グラフ */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  担当者別 実施率
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={staffAggregation.filter((s) => s.staffName !== '(未割当)')}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="staffName"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'implementationRate') return [`${value}%`, '実施率'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="implementationRate"
                      name="実施率"
                      fill="#4CAF50"
                    >
                      {staffAggregation.filter((s) => s.staffName !== '(未割当)').map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>

              {/* CVRグラフ */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  担当者別 初回→2回目CVR
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={staffAggregation.filter((s) => s.staffName !== '(未割当)' && s.firstVisitCount > 0)}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="staffName"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'firstToSecondCVR') return [`${value}%`, '初回→2回目CVR'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="firstToSecondCVR"
                      name="初回→2回目CVR"
                      fill="#2196F3"
                    >
                      {staffAggregation.filter((s) => s.staffName !== '(未割当)' && s.firstVisitCount > 0).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>

              {/* 実施件数グラフ */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  担当者別 実施件数（初回/2回目/3回目以降）
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={staffAggregation.filter((s) => s.staffName !== '(未割当)')}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="staffName"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="firstVisitCount" name="初回" stackId="a" fill="#4CAF50" />
                    <Bar dataKey="secondVisitCount" name="2回目" stackId="a" fill="#2196F3" />
                    <Bar dataKey="thirdOrMoreCount" name="3回目以降" stackId="a" fill="#FF9800" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Box>
          )}

          {activeTab === 1 && staffAggregation.length === 0 && (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                データがありません
              </Typography>
            </Paper>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
