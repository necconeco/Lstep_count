/**
 * 日次集計ビューコンポーネント
 *
 * - 日ごとの集計テーブルを表示
 * - 初回/2回目以降でシンプルに集計
 * - CSV DL機能付き
 */
import { useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Button,
} from '@mui/material';
import {
  Today as TodayIcon,
  TrendingUp as TrendingUpIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore, DATE_BASE_TYPE_LABELS, PERIOD_PRESET_LABELS } from '../store/uiStore';
import {
  shouldCountAsImplemented,
  applySameDayMerge,
  formatDate,
  formatDateTime,
  parseLocalDate,
  IMPLEMENTATION_RULE_LABELS,
} from '../domain';

/**
 * 日次集計の1行分のデータ
 */
interface DailyData {
  date: string; // yyyy-MM-dd形式
  totalCount: number;
  implementedCount: number;
  cancelCount: number;
  firstVisitCount: number;
  repeatVisitCount: number; // 2回目以降
}

export const DailyAggregationView = () => {
  const { histories } = useHistoryStore();
  const {
    dateBaseType,
    periodPreset,
    periodFrom,
    periodTo,
    implementationRule,
    mergeSameDayReservations,
    getEffectivePeriod,
  } = useUiStore();

  // 有効な期間を取得
  const effectivePeriod = useMemo(
    () => getEffectivePeriod(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodPreset, periodFrom, periodTo]
  );

  // 全履歴レコードを取得
  const allRecords = useMemo(() => {
    return Array.from(histories.values()).map(history => ({
      ...history,
      sessionDateStr: formatDate(history.sessionDate),
      applicationDateStr: formatDateTime(history.applicationDate),
    }));
  }, [histories]);

  // 期間フィルタを適用
  const filteredRecords = useMemo(() => {
    const { from, to } = effectivePeriod;

    return allRecords.filter(record => {
      if (record.isExcluded) return false;
      if (!from && !to) return true;

      const targetDateStr = dateBaseType === 'application' ? record.applicationDateStr : record.sessionDateStr;
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
  }, [allRecords, effectivePeriod, dateBaseType]);

  // 同日統合を適用
  const mergedRecords = useMemo(() => {
    const historiesForMerge = filteredRecords.map(r => ({
      ...r,
      sessionDate: new Date(r.sessionDateStr),
      applicationDate: new Date(r.applicationDateStr),
    }));
    const merged = applySameDayMerge(historiesForMerge, mergeSameDayReservations);
    return merged.map(h => ({
      ...h,
      sessionDateStr: formatDate(h.sessionDate),
      applicationDateStr: formatDateTime(h.applicationDate),
    }));
  }, [filteredRecords, mergeSameDayReservations]);

  // 日別にグループ化して集計
  const dailyData = useMemo<DailyData[]>(() => {
    const dayMap = new Map<string, typeof mergedRecords>();

    for (const record of mergedRecords) {
      const targetDateStr = dateBaseType === 'application' ? record.applicationDateStr : record.sessionDateStr;
      const datePart = targetDateStr.split(' ')[0] || '';

      if (!datePart) continue;

      if (!dayMap.has(datePart)) {
        dayMap.set(datePart, []);
      }
      dayMap.get(datePart)!.push(record);
    }

    const result: DailyData[] = [];

    for (const [date, records] of dayMap) {
      const implementedRecords = records.filter(r => shouldCountAsImplemented(r, implementationRule));

      result.push({
        date,
        totalCount: records.length,
        implementedCount: implementedRecords.length,
        cancelCount: records.filter(r => r.status === 'キャンセル済み' && !shouldCountAsImplemented(r, implementationRule))
          .length,
        firstVisitCount: implementedRecords.filter(r => r.visitLabel === '初回').length,
        repeatVisitCount: implementedRecords.filter(r => r.visitLabel !== '初回').length,
      });
    }

    // 日付順にソート（降順: 新しい日が上）
    result.sort((a, b) => b.date.localeCompare(a.date));

    return result;
  }, [mergedRecords, dateBaseType, implementationRule]);

  // 全体サマリー
  const summary = useMemo(() => {
    return {
      dayCount: dailyData.length,
      totalCount: dailyData.reduce((sum, d) => sum + d.totalCount, 0),
      implementedCount: dailyData.reduce((sum, d) => sum + d.implementedCount, 0),
      cancelCount: dailyData.reduce((sum, d) => sum + d.cancelCount, 0),
      firstVisitCount: dailyData.reduce((sum, d) => sum + d.firstVisitCount, 0),
      repeatVisitCount: dailyData.reduce((sum, d) => sum + d.repeatVisitCount, 0),
    };
  }, [dailyData]);

  // 期間表示用フォーマット
  const periodLabel = useMemo(() => {
    const { from, to } = effectivePeriod;
    if (!from && !to) return '全期間';

    const formatPeriodDate = (date: Date | null) => {
      if (!date) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return `${formatPeriodDate(from)} 〜 ${formatPeriodDate(to)}`;
  }, [effectivePeriod]);

  /**
   * CSVダウンロード
   */
  const handleDownloadCSV = useCallback(() => {
    if (dailyData.length === 0) {
      alert('ダウンロードするデータがありません');
      return;
    }

    // 日本語ヘッダー
    const header = '日付,総件数,実施,キャンセル,初回,2回目以降,実施率';

    // データ行
    const rows = dailyData.map(row => {
      const rate = row.totalCount > 0 ? Math.round((row.implementedCount / row.totalCount) * 100) : 0;
      return [row.date, row.totalCount, row.implementedCount, row.cancelCount, row.firstVisitCount, row.repeatVisitCount, `${rate}%`].join(
        ','
      );
    });

    // 合計行
    const totalRate = summary.totalCount > 0 ? Math.round((summary.implementedCount / summary.totalCount) * 100) : 0;
    const totalRow = [
      '合計',
      summary.totalCount,
      summary.implementedCount,
      summary.cancelCount,
      summary.firstVisitCount,
      summary.repeatVisitCount,
      `${totalRate}%`,
    ].join(',');

    const csv = [header, ...rows, totalRow].join('\n');

    // BOM付きUTF-8でダウンロード
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');
    const filename = `日次集計_${timestamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [dailyData, summary]);

  // データがない場合
  if (histories.size === 0) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TodayIcon color="primary" />
          日次集計
        </Typography>
        <Alert severity="info">履歴データがありません。CSVをアップロードしてください。</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TodayIcon color="primary" />
          日次集計
        </Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCSV}
          disabled={dailyData.length === 0}
        >
          CSVダウンロード
        </Button>
      </Box>

      {/* サマリー */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" component="span">
            <strong>集計条件:</strong>{' '}
            <Chip size="small" label={`基準: ${DATE_BASE_TYPE_LABELS[dateBaseType]}`} sx={{ mr: 0.5 }} />
            <Chip size="small" label={PERIOD_PRESET_LABELS[periodPreset]} color="primary" variant="outlined" sx={{ mr: 0.5 }} />
            <Chip
              size="small"
              label={`実施: ${IMPLEMENTATION_RULE_LABELS[implementationRule]}`}
              color={implementationRule === 'strict' ? 'default' : 'success'}
              variant="outlined"
              sx={{ mr: 0.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              （{periodLabel}）
            </Typography>
          </Typography>
        </Box>
        <Typography variant="body2">
          <strong>表示日数:</strong> {summary.dayCount}日 |<strong> 総件数:</strong> {summary.totalCount}件 |
          <strong> 実施:</strong> {summary.implementedCount}件（初回: {summary.firstVisitCount} / 2回目以降:{' '}
          {summary.repeatVisitCount}）|<strong> キャンセル:</strong> {summary.cancelCount}件
        </Typography>
      </Alert>

      {dailyData.length === 0 ? (
        <Alert severity="warning">指定された期間内にデータがありません。</Alert>
      ) : (
        <Paper elevation={2} sx={{ p: 3 }}>
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>日付</TableCell>
                  <TableCell align="right">総件数</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      <TrendingUpIcon fontSize="small" color="success" />
                      実施
                    </Box>
                  </TableCell>
                  <TableCell align="right">キャンセル</TableCell>
                  <TableCell align="right">初回</TableCell>
                  <TableCell align="right">2回目以降</TableCell>
                  <TableCell align="right">実施率</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyData.map(row => {
                  const rate = row.totalCount > 0 ? Math.round((row.implementedCount / row.totalCount) * 100) : 0;

                  return (
                    <TableRow key={row.date} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {row.date}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{row.totalCount}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="success.main">
                          {row.implementedCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main">
                          {row.cancelCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{row.firstVisitCount}</TableCell>
                      <TableCell align="right">{row.repeatVisitCount}</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={`${rate}%`}
                          color={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'error'}
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* 合計行 */}
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      合計
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {summary.totalCount}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      {summary.implementedCount}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold" color="error.main">
                      {summary.cancelCount}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {summary.firstVisitCount}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {summary.repeatVisitCount}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      label={`${summary.totalCount > 0 ? Math.round((summary.implementedCount / summary.totalCount) * 100) : 0}%`}
                      color="primary"
                      sx={{ height: 18, fontSize: '0.65rem' }}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};
