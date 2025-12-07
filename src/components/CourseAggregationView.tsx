/**
 * コース別集計ビューコンポーネント
 *
 * 機能:
 * - コース別の実績集計表示
 * - 期間フィルタ
 * - CSV/Excelエクスポート
 * - 実施率・CVRグラフ表示
 * - コース別担当者パフォーマンス
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
  Collapse,
  IconButton,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore, DATE_BASE_TYPE_LABELS } from '../store/uiStore';
import type { ReservationHistory, ImplementationRule } from '../domain/types';
import { shouldCountAsImplemented, applySameDayMerge } from '../domain/logic';
import { OFFICIAL_COURSES } from '../domain/courseMasterData';
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
  PieChart,
  Pie,
} from 'recharts';

// ============================================================================
// 型定義
// ============================================================================

/**
 * コース別集計結果
 */
interface CourseAggregationResult {
  courseName: string;
  totalCount: number;
  implementedCount: number;
  cancelCount: number;
  previousDayCancelCount: number;
  sameDayCancelCount: number;
  firstVisitCount: number;
  secondVisitCount: number;
  thirdOrMoreCount: number;
  uniqueUsers: number;
  implementationRate: number;
  cancelRate: number;
  firstToSecondCVR: number;
  // 担当者別内訳
  staffBreakdown: Map<
    string,
    {
      staffName: string;
      implementedCount: number;
      totalCount: number;
      implementationRate: number;
    }
  >;
}

// ============================================================================
// 集計ロジック
// ============================================================================

/**
 * 空のコースエントリを作成
 */
function createEmptyCourseEntry(courseName: string) {
  return {
    courseName,
    totalCount: 0,
    implementedCount: 0,
    cancelCount: 0,
    previousDayCancelCount: 0,
    sameDayCancelCount: 0,
    firstVisitCount: 0,
    secondVisitCount: 0,
    thirdOrMoreCount: 0,
    uniqueUsers: new Set<string>(),
    firstVisitUsers: new Set<string>(),
    secondVisitUsers: new Set<string>(),
    staffBreakdown: new Map<
      string,
      {
        staffName: string;
        implementedCount: number;
        totalCount: number;
      }
    >(),
  };
}

/**
 * コース別集計を計算
 */
function calculateCourseAggregation(
  records: ReservationHistory[],
  implementationRule: ImplementationRule = 'includeLateCancel'
): CourseAggregationResult[] {
  const courseMap = new Map<string, ReturnType<typeof createEmptyCourseEntry>>();

  // マスターのコースを先に初期化（件数0でも表示されるようにする）
  for (const officialCourse of OFFICIAL_COURSES) {
    courseMap.set(officialCourse, createEmptyCourseEntry(officialCourse));
  }

  for (const record of records) {
    if (record.isExcluded) continue;

    const courseName = record.course || '(コース未設定)';

    let entry = courseMap.get(courseName);
    if (!entry) {
      // マスターにないコースも追加
      entry = createEmptyCourseEntry(courseName);
      courseMap.set(courseName, entry);
    }

    entry.totalCount++;
    entry.uniqueUsers.add(record.friendId);

    // 担当者別カウント
    const staffName = record.staff || '(未割当)';
    let staffEntry = entry.staffBreakdown.get(staffName);
    if (!staffEntry) {
      staffEntry = { staffName, implementedCount: 0, totalCount: 0 };
      entry.staffBreakdown.set(staffName, staffEntry);
    }
    staffEntry.totalCount++;

    // 前日/当日キャンセルのカウント
    if (record.detailStatus === '前日キャンセル') {
      entry.previousDayCancelCount++;
    } else if (record.detailStatus === '当日キャンセル') {
      entry.sameDayCancelCount++;
    }

    // 実施判定
    if (shouldCountAsImplemented(record, implementationRule)) {
      entry.implementedCount++;
      staffEntry.implementedCount++;

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
  }

  // 配列に変換してソート
  return Array.from(courseMap.values())
    .map(entry => {
      const implementationRate =
        entry.totalCount > 0 ? Math.round((entry.implementedCount / entry.totalCount) * 1000) / 10 : 0;

      const cancelRate = entry.totalCount > 0 ? Math.round((entry.cancelCount / entry.totalCount) * 1000) / 10 : 0;

      const firstToSecondCVR =
        entry.firstVisitUsers.size > 0
          ? Math.round((entry.secondVisitUsers.size / entry.firstVisitUsers.size) * 1000) / 10
          : 0;

      // 担当者別の実施率を計算
      const staffBreakdown = new Map<
        string,
        {
          staffName: string;
          implementedCount: number;
          totalCount: number;
          implementationRate: number;
        }
      >();

      for (const [name, staff] of entry.staffBreakdown) {
        staffBreakdown.set(name, {
          ...staff,
          implementationRate:
            staff.totalCount > 0 ? Math.round((staff.implementedCount / staff.totalCount) * 1000) / 10 : 0,
        });
      }

      return {
        courseName: entry.courseName,
        totalCount: entry.totalCount,
        implementedCount: entry.implementedCount,
        cancelCount: entry.cancelCount,
        previousDayCancelCount: entry.previousDayCancelCount,
        sameDayCancelCount: entry.sameDayCancelCount,
        firstVisitCount: entry.firstVisitCount,
        secondVisitCount: entry.secondVisitCount,
        thirdOrMoreCount: entry.thirdOrMoreCount,
        uniqueUsers: entry.uniqueUsers.size,
        implementationRate,
        cancelRate,
        firstToSecondCVR,
        staffBreakdown,
      };
    })
    .sort((a, b) => {
      // マスターのコースはマスター定義順を維持
      const aIndex = OFFICIAL_COURSES.indexOf(a.courseName as (typeof OFFICIAL_COURSES)[number]);
      const bIndex = OFFICIAL_COURSES.indexOf(b.courseName as (typeof OFFICIAL_COURSES)[number]);

      // 両方ともマスターにある場合は定義順
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // aがマスター、bがマスター外 → aを先に
      if (aIndex !== -1 && bIndex === -1) {
        return -1;
      }

      // bがマスター、aがマスター外 → bを先に
      if (aIndex === -1 && bIndex !== -1) {
        return 1;
      }

      // 両方ともマスター外の場合は実施数順
      return b.implementedCount - a.implementedCount;
    });
}

// ============================================================================
// コンポーネント
// ============================================================================

const CHART_COLORS = [
  '#4CAF50',
  '#2196F3',
  '#FF9800',
  '#9C27B0',
  '#E91E63',
  '#00BCD4',
  '#FFC107',
  '#795548',
  '#607D8B',
  '#3F51B5',
];

const PIE_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4', '#FFC107', '#795548'];

/**
 * 展開可能な行コンポーネント
 */
function CourseRow({ course }: { course: CourseAggregationResult }) {
  const [open, setOpen] = useState(false);
  const staffArray = Array.from(course.staffBreakdown.values()).sort((a, b) => b.implementedCount - a.implementedCount);

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography fontWeight="medium">{course.courseName}</Typography>
        </TableCell>
        <TableCell align="right">{course.totalCount}</TableCell>
        <TableCell align="right">
          <Typography color="success.main" fontWeight="medium">
            {course.implementedCount}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography color="text.secondary">{course.cancelCount}</Typography>
        </TableCell>
        <TableCell align="right">
          <Typography color="warning.main" fontSize="0.875rem">
            {course.previousDayCancelCount}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography color="error.main" fontSize="0.875rem">
            {course.sameDayCancelCount}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={course.implementationRate}
              sx={{ width: 40, height: 6, borderRadius: 1 }}
              color="success"
            />
            <Typography fontSize="0.875rem">{course.implementationRate}%</Typography>
          </Box>
        </TableCell>
        <TableCell align="right">{course.firstVisitCount}</TableCell>
        <TableCell align="right">{course.secondVisitCount}</TableCell>
        <TableCell align="right">{course.thirdOrMoreCount}</TableCell>
        <TableCell align="right">
          <Typography color="info.main" fontSize="0.875rem">
            {course.firstToSecondCVR}%
          </Typography>
        </TableCell>
        <TableCell align="right">{course.uniqueUsers}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={13}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom component="div">
                担当者別内訳
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>担当者</TableCell>
                    <TableCell align="right">予約数</TableCell>
                    <TableCell align="right">実施数</TableCell>
                    <TableCell align="right">実施率</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {staffArray.map(staff => (
                    <TableRow key={staff.staffName}>
                      <TableCell>{staff.staffName}</TableCell>
                      <TableCell align="right">{staff.totalCount}</TableCell>
                      <TableCell align="right">{staff.implementedCount}</TableCell>
                      <TableCell align="right">{staff.implementationRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export function CourseAggregationView() {
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

  const [activeTab, setActiveTab] = useState(0);

  const effectivePeriod = useMemo(
    () => getEffectivePeriod(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodPreset, periodFrom, periodTo]
  );

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

  const recordsForAggregation = useMemo(() => {
    return applySameDayMerge(filteredRecords, mergeSameDayReservations);
  }, [filteredRecords, mergeSameDayReservations]);

  const courseAggregation = useMemo(() => {
    return calculateCourseAggregation(recordsForAggregation, implementationRule);
  }, [recordsForAggregation, implementationRule]);

  const totals = useMemo(() => {
    return courseAggregation.reduce(
      (acc, c) => ({
        totalCount: acc.totalCount + c.totalCount,
        implementedCount: acc.implementedCount + c.implementedCount,
        cancelCount: acc.cancelCount + c.cancelCount,
        previousDayCancelCount: acc.previousDayCancelCount + c.previousDayCancelCount,
        sameDayCancelCount: acc.sameDayCancelCount + c.sameDayCancelCount,
        firstVisitCount: acc.firstVisitCount + c.firstVisitCount,
        secondVisitCount: acc.secondVisitCount + c.secondVisitCount,
        thirdOrMoreCount: acc.thirdOrMoreCount + c.thirdOrMoreCount,
        uniqueUsers: acc.uniqueUsers + c.uniqueUsers,
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
        uniqueUsers: 0,
      }
    );
  }, [courseAggregation]);

  const overallStats = useMemo(() => {
    const implementationRate =
      totals.totalCount > 0 ? Math.round((totals.implementedCount / totals.totalCount) * 1000) / 10 : 0;
    const cancelRate = totals.totalCount > 0 ? Math.round((totals.cancelCount / totals.totalCount) * 1000) / 10 : 0;
    const firstToSecondCVR =
      totals.firstVisitCount > 0 ? Math.round((totals.secondVisitCount / totals.firstVisitCount) * 1000) / 10 : 0;
    return { implementationRate, cancelRate, firstToSecondCVR };
  }, [totals]);

  const handleExportCSV = () => {
    const header = [
      'コース名',
      '予約数',
      '実施数',
      'キャンセル数',
      '前日キャンセル',
      '当日キャンセル',
      '実施率(%)',
      'キャンセル率(%)',
      '初回',
      '2回目',
      '3回目以降',
      '初回→2回目CVR(%)',
      'ユニークユーザー',
    ].join(',');

    const rows = courseAggregation.map(c =>
      [
        `"${c.courseName}"`,
        c.totalCount,
        c.implementedCount,
        c.cancelCount,
        c.previousDayCancelCount,
        c.sameDayCancelCount,
        c.implementationRate,
        c.cancelRate,
        c.firstVisitCount,
        c.secondVisitCount,
        c.thirdOrMoreCount,
        c.firstToSecondCVR,
        c.uniqueUsers,
      ].join(',')
    );

    const totalRow = [
      '"合計"',
      totals.totalCount,
      totals.implementedCount,
      totals.cancelCount,
      totals.previousDayCancelCount,
      totals.sameDayCancelCount,
      overallStats.implementationRate,
      overallStats.cancelRate,
      totals.firstVisitCount,
      totals.secondVisitCount,
      totals.thirdOrMoreCount,
      overallStats.firstToSecondCVR,
      '-',
    ].join(',');

    const csvContent = [header, ...rows, totalRow].join('\n');

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `コース別集計_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 円グラフ用データ
  const pieData = useMemo(() => {
    return courseAggregation
      .filter(c => c.implementedCount > 0)
      .slice(0, 8)
      .map(c => ({
        name: c.courseName,
        value: c.implementedCount,
      }));
  }, [courseAggregation]);

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SchoolIcon color="primary" />
              <Typography variant="h5" component="h2">
                コース別集計
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCSV}
              disabled={courseAggregation.length === 0}
            >
              CSVダウンロード
            </Button>
          </Box>

          {/* サマリー */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
            <Chip label={`基準日: ${DATE_BASE_TYPE_LABELS[dateBaseType]}`} variant="outlined" color="info" />
            <Chip label={`対象レコード: ${filteredRecords.length}件`} color="primary" variant="outlined" />
            <Chip label={`コース数: ${courseAggregation.length}種類`} color="secondary" variant="outlined" />
            <Chip label={`全体実施率: ${overallStats.implementationRate}%`} color="success" variant="outlined" />
            <Chip label={`全体キャンセル率: ${overallStats.cancelRate}%`} color="error" variant="outlined" />
            <Chip label={`初回→2回目CVR: ${overallStats.firstToSecondCVR}%`} color="info" variant="outlined" />
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
                    <TableCell sx={{ width: 50 }} />
                    <TableCell>コース名</TableCell>
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
                    <TableCell align="right">UU</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {courseAggregation.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>
                          データがありません
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {courseAggregation.map(course => (
                        <CourseRow key={course.courseName} course={course} />
                      ))}

                      {/* 合計行 */}
                      <TableRow sx={{ backgroundColor: 'grey.50' }}>
                        <TableCell />
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
                          <Typography fontWeight="bold">{overallStats.implementationRate}%</Typography>
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
                          <Typography fontWeight="bold">-</Typography>
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* グラフビュー */}
          {activeTab === 1 && courseAggregation.length > 0 && (
            <Box>
              {/* 実施率グラフ */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  コース別 実施率
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={courseAggregation.filter(c => c.courseName !== '(コース未設定)')}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="courseName"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={100}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'implementationRate') return [`${value}%`, '実施率'];
                        if (name === 'cancelRate') return [`${value}%`, 'キャンセル率'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="implementationRate" name="実施率" fill="#4CAF50" />
                    <Bar dataKey="cancelRate" name="キャンセル率" fill="#f44336" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>

              {/* 実施件数構成（円グラフ） */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  コース別 実施件数構成
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => [`${value}件`, '実施数']} />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>

              {/* CVRグラフ */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  コース別 初回→2回目CVR
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={courseAggregation.filter(c => c.courseName !== '(コース未設定)' && c.firstVisitCount > 0)}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="courseName"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={100}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <RechartsTooltip formatter={(value: number) => [`${value}%`, '初回→2回目CVR']} />
                    <Legend />
                    <Bar dataKey="firstToSecondCVR" name="初回→2回目CVR" fill="#2196F3">
                      {courseAggregation
                        .filter(c => c.courseName !== '(コース未設定)' && c.firstVisitCount > 0)
                        .map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>

              {/* 実施件数グラフ */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  コース別 実施件数（初回/2回目/3回目以降）
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={courseAggregation.filter(c => c.courseName !== '(コース未設定)')}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="courseName"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={100}
                      tick={{ fontSize: 11 }}
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

          {activeTab === 1 && courseAggregation.length === 0 && (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">データがありません</Typography>
            </Paper>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
