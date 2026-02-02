/**
 * 日次集計ビューコンポーネント
 *
 * スプレッドシート形式で表示:
 * - 初回予約/初回実施/2回目以降予約/2回目以降実施
 * - TTL（合計）行 + 日別行
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
  Alert,
  Button,
} from '@mui/material';
import {
  Today as TodayIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore } from '../store/uiStore';
import {
  shouldCountAsImplemented,
  applySameDayMerge,
  formatDate,
  formatDateTime,
  parseLocalDate,
} from '../domain';

/**
 * 日次集計の1行分のデータ（スプレッドシート形式）
 */
interface DailyData {
  date: string; // MM/dd形式（表示用）
  dateSort: string; // yyyy-MM-dd形式（ソート用）
  firstReservation: number; // 初回予約
  firstImplementation: number; // 初回実施
  repeatReservation: number; // 2回目以降予約
  repeatImplementation: number; // 2回目以降実施
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
      sessionDate: parseLocalDate(r.sessionDateStr.split(' ')[0] || r.sessionDateStr),
      applicationDate: parseLocalDate(r.applicationDateStr.split(' ')[0] || r.applicationDateStr),
    }));
    const merged = applySameDayMerge(historiesForMerge, mergeSameDayReservations);
    return merged.map(h => ({
      ...h,
      sessionDateStr: formatDate(h.sessionDate),
      applicationDateStr: formatDateTime(h.applicationDate),
    }));
  }, [filteredRecords, mergeSameDayReservations]);

  // 日別にグループ化して集計（スプレッドシート形式）
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

    for (const [dateSort, records] of dayMap) {
      // 初回 vs 2回目以降を分類
      const firstRecords = records.filter(r => r.visitLabel === '初回');
      const repeatRecords = records.filter(r => r.visitLabel !== '初回');

      // 予約 = キャンセルではないもの（ステータスが予約済み）
      // 実施 = shouldCountAsImplemented
      const firstReservation = firstRecords.filter(r => r.status === '予約済み').length;
      const firstImplementation = firstRecords.filter(r => shouldCountAsImplemented(r, implementationRule)).length;
      const repeatReservation = repeatRecords.filter(r => r.status === '予約済み').length;
      const repeatImplementation = repeatRecords.filter(r => shouldCountAsImplemented(r, implementationRule)).length;

      // MM/dd形式に変換
      const parts = dateSort.split('-');
      const displayDate = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : dateSort;

      result.push({
        date: displayDate,
        dateSort,
        firstReservation,
        firstImplementation,
        repeatReservation,
        repeatImplementation,
      });
    }

    // 日付順にソート（昇順: 古い日が上）
    result.sort((a, b) => a.dateSort.localeCompare(b.dateSort));

    return result;
  }, [mergedRecords, dateBaseType, implementationRule]);

  // 全体サマリー（TTL行用）
  const summary = useMemo(() => {
    return {
      firstReservation: dailyData.reduce((sum, d) => sum + d.firstReservation, 0),
      firstImplementation: dailyData.reduce((sum, d) => sum + d.firstImplementation, 0),
      repeatReservation: dailyData.reduce((sum, d) => sum + d.repeatReservation, 0),
      repeatImplementation: dailyData.reduce((sum, d) => sum + d.repeatImplementation, 0),
    };
  }, [dailyData]);

  /**
   * CSVダウンロード（スプレッドシート形式）
   */
  const handleDownloadCSV = useCallback(() => {
    if (dailyData.length === 0) {
      alert('ダウンロードするデータがありません');
      return;
    }

    // ヘッダー（スプレッドシートと同じ列名）
    const header = '日付,初回予約,初回実施,2回目以降予約,2回目以降実施';

    // データ行
    const rows = dailyData.map(row => {
      return [row.date, row.firstReservation, row.firstImplementation, row.repeatReservation, row.repeatImplementation].join(',');
    });

    const csv = [header, ...rows].join('\n');

    // BOM付きUTF-8でダウンロード
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const filename = `日次集計_${timestamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [dailyData]);

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
          variant="contained"
          color="primary"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCSV}
          disabled={dailyData.length === 0}
        >
          CSVダウンロード
        </Button>
      </Box>

      {/* サマリー */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>初回:</strong> 予約 {summary.firstReservation}件 → 実施 {summary.firstImplementation}件 |
          <strong> 2回目以降:</strong> 予約 {summary.repeatReservation}件 → 実施 {summary.repeatImplementation}件
        </Typography>
      </Alert>

      {dailyData.length === 0 ? (
        <Alert severity="warning">指定された期間内にデータがありません。</Alert>
      ) : (
        <Paper elevation={2} sx={{ p: 3 }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>日付</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'success.light', color: 'white' }}>
                    初回予約
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'success.main', color: 'white' }}>
                    初回実施
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'info.light', color: 'white' }}>
                    2回目以降予約
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'info.main', color: 'white' }}>
                    2回目以降実施
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyData.map(row => (
                  <TableRow key={row.dateSort} hover>
                    <TableCell>
                      <Typography variant="body2">{row.date}</Typography>
                    </TableCell>
                    <TableCell align="right">{row.firstReservation}</TableCell>
                    <TableCell align="right">{row.firstImplementation}</TableCell>
                    <TableCell align="right">{row.repeatReservation}</TableCell>
                    <TableCell align="right">{row.repeatImplementation}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};
