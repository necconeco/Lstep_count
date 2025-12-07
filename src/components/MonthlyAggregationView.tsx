/**
 * 月次集計ビューコンポーネント
 *
 * - 月ごとの集計テーブルを表示
 * - 共通フィルタバーの条件に基づいてフィルタリング
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
  CalendarMonth as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore, DATE_BASE_TYPE_LABELS, PERIOD_PRESET_LABELS } from '../store/uiStore';
import { shouldCountAsImplemented, applySameDayMerge, formatDate, formatDateTime, parseLocalDate } from '../domain/logic';
import { IMPLEMENTATION_RULE_LABELS } from '../domain/types';

/**
 * 月次集計の1行分のデータ
 */
interface MonthlyData {
  month: string; // yyyy-MM形式
  totalCount: number;
  implementedCount: number;
  cancelCount: number;
  firstVisitCount: number;
  secondVisitCount: number;
  thirdPlusVisitCount: number;
  uniqueUsers: number;
}

/**
 * 日付からyyyy-MM形式の文字列を取得
 */
function getYearMonth(dateStr: string): string {
  // dateStr: "YYYY-MM-DD" or "YYYY-MM-DD HH:mm"
  const datePart = dateStr.split(' ')[0];
  if (!datePart) return '';
  const parts = datePart.split('-');
  if (parts.length < 2) return '';
  return `${parts[0]}-${parts[1]}`;
}

export const MonthlyAggregationView = () => {
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

  // 有効な期間を取得（フィルタ条件の変更を検知）
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
      // 除外フラグがtrueのレコードは除外
      if (record.isExcluded) return false;

      // 全期間の場合はフィルタなし
      if (!from && !to) return true;

      // 基準日を決定
      const targetDateStr = dateBaseType === 'application' ? record.applicationDateStr : record.sessionDateStr;

      // YYYY-MM-DD形式からローカルDateに変換（タイムゾーン対応）
      const datePart = targetDateStr.split(' ')[0];
      if (!datePart) return false;
      const targetDate = parseLocalDate(datePart);

      // 期間内かチェック
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
    // ReservationHistory型に変換して統合を適用
    const historiesForMerge = filteredRecords.map(r => ({
      ...r,
      sessionDate: new Date(r.sessionDateStr),
      applicationDate: new Date(r.applicationDateStr),
    }));
    const merged = applySameDayMerge(historiesForMerge, mergeSameDayReservations);
    // 元の形式に戻す
    return merged.map(h => ({
      ...h,
      sessionDateStr: formatDate(h.sessionDate),
      applicationDateStr: formatDateTime(h.applicationDate),
    }));
  }, [filteredRecords, mergeSameDayReservations]);

  // 月別にグループ化して集計
  const monthlyData = useMemo<MonthlyData[]>(() => {
    const monthMap = new Map<
      string,
      {
        records: typeof mergedRecords;
        userSet: Set<string>;
      }
    >();

    // レコードを月ごとにグループ化
    for (const record of mergedRecords) {
      const targetDateStr = dateBaseType === 'application' ? record.applicationDateStr : record.sessionDateStr;
      const yearMonth = getYearMonth(targetDateStr);

      if (!yearMonth) continue;

      if (!monthMap.has(yearMonth)) {
        monthMap.set(yearMonth, { records: [], userSet: new Set() });
      }

      const monthData = monthMap.get(yearMonth)!;
      monthData.records.push(record);
      monthData.userSet.add(record.friendId);
    }

    // 各月の集計を計算
    const result: MonthlyData[] = [];

    for (const [month, data] of monthMap) {
      const { records, userSet } = data;

      // 実施判定ルールに基づいてカウント
      const implementedRecords = records.filter(r => shouldCountAsImplemented(r, implementationRule));

      result.push({
        month,
        totalCount: records.length,
        implementedCount: implementedRecords.length,
        cancelCount: records.filter(
          r => r.status === 'キャンセル済み' && !shouldCountAsImplemented(r, implementationRule)
        ).length,
        firstVisitCount: implementedRecords.filter(r => r.visitLabel === '初回').length,
        secondVisitCount: implementedRecords.filter(r => r.visitLabel === '2回目').length,
        thirdPlusVisitCount: implementedRecords.filter(r => r.visitLabel === '3回目以降').length,
        uniqueUsers: userSet.size,
      });
    }

    // 月順にソート（降順: 新しい月が上）
    result.sort((a, b) => b.month.localeCompare(a.month));

    return result;
  }, [mergedRecords, dateBaseType, implementationRule]);

  // 全体サマリー
  const summary = useMemo(() => {
    return {
      monthCount: monthlyData.length,
      totalCount: monthlyData.reduce((sum, m) => sum + m.totalCount, 0),
      implementedCount: monthlyData.reduce((sum, m) => sum + m.implementedCount, 0),
      cancelCount: monthlyData.reduce((sum, m) => sum + m.cancelCount, 0),
      firstVisitCount: monthlyData.reduce((sum, m) => sum + m.firstVisitCount, 0),
      secondVisitCount: monthlyData.reduce((sum, m) => sum + m.secondVisitCount, 0),
    };
  }, [monthlyData]);

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
    if (monthlyData.length === 0) {
      alert('ダウンロードするデータがありません');
      return;
    }

    // ヘッダー行
    const header =
      'month,totalCount,implementedCount,cancelCount,firstVisitCount,secondVisitCount,thirdOrMoreCount,uniqueUsers';

    // データ行
    const rows = monthlyData.map(row => {
      return [
        row.month,
        row.totalCount,
        row.implementedCount,
        row.cancelCount,
        row.firstVisitCount,
        row.secondVisitCount,
        row.thirdPlusVisitCount,
        row.uniqueUsers,
      ].join(',');
    });

    // CSV文字列を生成
    const csv = [header, ...rows].join('\n');

    // BOM付きUTF-8でダウンロード
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // ファイル名: monthly-aggregation-YYYYMMDD-HHmm.csv
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');
    const filename = `monthly-aggregation-${timestamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [monthlyData]);

  // データがない場合
  if (histories.size === 0) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CalendarIcon color="primary" />
          月次集計
        </Typography>
        <Alert severity="info">履歴データがありません。CSVをアップロードしてください。</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarIcon color="primary" />
          月次集計
        </Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCSV}
          disabled={monthlyData.length === 0}
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
            <Chip
              size="small"
              label={PERIOD_PRESET_LABELS[periodPreset]}
              color="primary"
              variant="outlined"
              sx={{ mr: 0.5 }}
            />
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
          <strong>表示月数:</strong> {summary.monthCount}ヶ月 |<strong> 総件数:</strong> {summary.totalCount}件 |
          <strong> 実施:</strong>{' '}
          <Chip
            size="small"
            label={`${summary.implementedCount}件`}
            color="success"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.75rem' }}
          />
          （初回: {summary.firstVisitCount} / 2回目: {summary.secondVisitCount}）|
          <strong> キャンセル:</strong>{' '}
          <Chip
            size="small"
            label={`${summary.cancelCount}件`}
            color="error"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.75rem' }}
          />
        </Typography>
      </Alert>

      {monthlyData.length === 0 ? (
        <Alert severity="warning">指定された期間内にデータがありません。フィルタ条件を確認してください。</Alert>
      ) : (
        <Paper elevation={2} sx={{ p: 3 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarIcon fontSize="small" />月
                    </Box>
                  </TableCell>
                  <TableCell align="right">総件数</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      <TrendingUpIcon fontSize="small" color="success" />
                      実施件数
                    </Box>
                  </TableCell>
                  <TableCell align="right">キャンセル</TableCell>
                  <TableCell align="right">初回</TableCell>
                  <TableCell align="right">2回目</TableCell>
                  <TableCell align="right">3回目以降</TableCell>
                  <TableCell align="right">ユニークユーザー</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlyData.map(row => {
                  const implementationRate =
                    row.totalCount > 0 ? Math.round((row.implementedCount / row.totalCount) * 100) : 0;
                  const firstRate =
                    row.implementedCount > 0 ? Math.round((row.firstVisitCount / row.implementedCount) * 100) : 0;

                  return (
                    <TableRow key={row.month} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {row.month}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{row.totalCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {row.implementedCount}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${implementationRate}%`}
                            color={
                              implementationRate >= 80 ? 'success' : implementationRate >= 50 ? 'warning' : 'error'
                            }
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main">
                          {row.cancelCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <Typography variant="body2">{row.firstVisitCount}</Typography>
                          {row.implementedCount > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              ({firstRate}%)
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{row.secondVisitCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{row.thirdPlusVisitCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={row.uniqueUsers}
                          color="primary"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.75rem' }}
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
                      {summary.secondVisitCount}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {monthlyData.reduce((sum, m) => sum + m.thirdPlusVisitCount, 0)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="text.secondary">
                      -
                    </Typography>
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

// ============================================================================
// ヘルパー関数
// ============================================================================
// ヘルパー関数はdomain/logic.tsからインポート（formatDate, formatDateTime）
