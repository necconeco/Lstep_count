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
  // シンプルに: Dateからローカル日付文字列を直接生成（タイムゾーン変換なし）
  const allRecords = useMemo(() => {
    return Array.from(histories.values()).map(history => {
      // sessionDateからローカル日付文字列を生成（getFullYear/Month/Dateはローカルタイムゾーン）
      const sd = history.sessionDate;
      const sessionDateStr = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;

      const ad = history.applicationDate;
      const applicationDateStr = `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, '0')}-${String(ad.getDate()).padStart(2, '0')} ${String(ad.getHours()).padStart(2, '0')}:${String(ad.getMinutes()).padStart(2, '0')}`;

      return {
        ...history,
        sessionDateStr,
        applicationDateStr,
      };
    });
  }, [histories]);

  // 期間フィルタを適用（実施日または申込日が期間内ならOK）
  const filteredRecords = useMemo(() => {
    const { from, to } = effectivePeriod;

    return allRecords.filter(record => {
      if (record.isExcluded) return false;
      if (!from && !to) return true;

      // 実施日をチェック
      const sessionDatePart = record.sessionDateStr.split(' ')[0];
      const sessionDate = sessionDatePart ? parseLocalDate(sessionDatePart) : null;

      // 申込日をチェック
      const applicationDatePart = record.applicationDateStr.split(' ')[0];
      const applicationDate = applicationDatePart ? parseLocalDate(applicationDatePart) : null;

      // 実施日または申込日が期間内ならOK
      const toEnd = to ? new Date(to) : null;
      if (toEnd) toEnd.setHours(23, 59, 59, 999);

      const sessionInRange = sessionDate && (!from || sessionDate >= from) && (!toEnd || sessionDate <= toEnd);
      const applicationInRange = applicationDate && (!from || applicationDate >= from) && (!toEnd || applicationDate <= toEnd);

      return sessionInRange || applicationInRange;
    });
  }, [allRecords, effectivePeriod]);

  // 同日統合を適用
  const mergedRecords = useMemo(() => {
    const historiesForMerge = filteredRecords.map(r => ({
      ...r,
      sessionDate: parseLocalDate(r.sessionDateStr.split(' ')[0] || r.sessionDateStr),
      applicationDate: parseLocalDate(r.applicationDateStr.split(' ')[0] || r.applicationDateStr),
    }));
    const merged = applySameDayMerge(historiesForMerge, mergeSameDayReservations);
    // シンプルに: Dateからローカル日付文字列を直接生成
    return merged.map(h => {
      const sd = h.sessionDate;
      const sessionDateStr = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
      const ad = h.applicationDate;
      const applicationDateStr = `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, '0')}-${String(ad.getDate()).padStart(2, '0')} ${String(ad.getHours()).padStart(2, '0')}:${String(ad.getMinutes()).padStart(2, '0')}`;
      return {
        ...h,
        sessionDateStr,
        applicationDateStr,
      };
    });
  }, [filteredRecords, mergeSameDayReservations]);

  // 日別にグループ化して集計（スプレッドシート形式）
  // カレンダー形式: 期間内の全日を表示（予約がない日も0で表示）
  //
  // 重要: 予約と実施で基準日が異なる
  // - 予約（初回予約、2回目以降予約）= 申込日ベース
  // - 実施（初回実施、2回目以降実施）= 実施日ベース
  const dailyData = useMemo<DailyData[]>(() => {
    // 申込日ベースでグループ化（予約カウント用）
    const applicationDayMap = new Map<string, typeof mergedRecords>();
    // 実施日ベースでグループ化（実施カウント用）
    const sessionDayMap = new Map<string, typeof mergedRecords>();

    for (const record of mergedRecords) {
      // 申込日
      const applicationDatePart = record.applicationDateStr.split(' ')[0] || '';
      if (applicationDatePart) {
        if (!applicationDayMap.has(applicationDatePart)) {
          applicationDayMap.set(applicationDatePart, []);
        }
        applicationDayMap.get(applicationDatePart)!.push(record);
      }

      // 実施日
      const sessionDatePart = record.sessionDateStr.split(' ')[0] || '';
      if (sessionDatePart) {
        if (!sessionDayMap.has(sessionDatePart)) {
          sessionDayMap.set(sessionDatePart, []);
        }
        sessionDayMap.get(sessionDatePart)!.push(record);
      }
    }

    // 期間内の全日を生成
    const { from, to } = effectivePeriod;
    const allDates: string[] = [];

    if (from && to) {
      // 期間指定がある場合: fromからtoまでの全日を生成
      const current = new Date(from);
      const endDate = new Date(to);
      while (current <= endDate) {
        const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        allDates.push(dateStr);
        current.setDate(current.getDate() + 1);
      }
    } else {
      // 期間指定がない場合: 両方のマップからユニークな日付を取得
      const allDateSet = new Set([...applicationDayMap.keys(), ...sessionDayMap.keys()]);
      allDates.push(...Array.from(allDateSet));
    }

    const result: DailyData[] = [];

    for (const dateSort of allDates) {
      // 予約は申込日ベース
      const applicationRecords = applicationDayMap.get(dateSort) || [];
      const firstApplicationRecords = applicationRecords.filter(r => r.visitLabel === '初回');
      const repeatApplicationRecords = applicationRecords.filter(r => r.visitLabel !== '初回');

      // 実施は実施日ベース
      const sessionRecords = sessionDayMap.get(dateSort) || [];
      const firstSessionRecords = sessionRecords.filter(r => r.visitLabel === '初回');
      const repeatSessionRecords = sessionRecords.filter(r => r.visitLabel !== '初回');

      // 予約 = 申込日ベースで、同一人物・同日は1件としてカウント（ユニークなfriendId数）
      const firstReservation = new Set(firstApplicationRecords.map(r => r.friendId)).size;
      const repeatReservation = new Set(repeatApplicationRecords.map(r => r.friendId)).size;

      // 実施 = 実施日ベースで、shouldCountAsImplemented
      const firstImplementation = firstSessionRecords.filter(r => shouldCountAsImplemented(r, implementationRule)).length;
      const repeatImplementation = repeatSessionRecords.filter(r => shouldCountAsImplemented(r, implementationRule)).length;

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
  }, [mergedRecords, implementationRule, effectivePeriod]);

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
