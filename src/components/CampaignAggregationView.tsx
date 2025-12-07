/**
 * 期間サマリービューコンポーネント
 *
 * - 分析期間を選択して集計を表示
 * - 期間マスターデータ（期間・日付タイプ）に基づいてフィルタリング
 * - 新規期間追加・編集・削除
 */
import { useState, useMemo, useCallback } from 'react';
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
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  DateRange as PeriodSummaryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  CalendarMonth as CalendarIcon,
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  FileDownload as FileDownloadIcon,
  ShowChart as ShowChartIcon,
  FilterAlt as FunnelIcon,
  PieChart as PieChartIcon,
  Schedule as ScheduleIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { useHistoryStore } from '../store/historyStore';
import { useUiStore } from '../store/uiStore';
import type { CampaignMaster, TargetDateType, ReservationHistory, ImplementationRule } from '../domain/types';
import { shouldCountAsImplemented, getCancelTiming, applySameDayMerge } from '../domain/logic';
import * as repository from '../infrastructure/repository';

// ============================================================================
// 型定義
// ============================================================================

interface CampaignSummary {
  totalCount: number;
  implementedCount: number;
  cancelCount: number;
  // キャンセル内訳
  sameDayCancelCount: number;
  previousDayCancelCount: number;
  earlyCancelCount: number;
  // 来店回数別
  firstVisitCount: number;
  secondVisitCount: number;
  thirdPlusVisitCount: number;
  uniqueUsers: number;
  // 各種レート
  implementationRate: number;
  firstVisitRate: number;
  // 3回目以降の比率（実施者に対する）
  thirdPlusRate: number;
  // 初回→2回目のCVR（期間内で初回を実施したユーザーのうち、2回目も実施した人の割合）
  firstToSecondCVR: number;
  // 初回→2回目のCVR計算用内訳
  firstTimeUserCount: number; // 期間内で初回を実施したユニークユーザー数
  firstTimeUserWithSecondCount: number; // そのうち2回目も実施したユーザー数
}

interface CampaignFormData {
  campaignId: string;
  campaignName: string;
  description: string;
  targetPeriodFrom: string;
  targetPeriodTo: string;
  targetDateType: TargetDateType;
}

/**
 * 日別集計データ
 */
interface DailyData {
  date: string; // YYYY-MM-DD
  dateLabel: string; // MM/DD表示用
  total: number;
  implemented: number;
  cancelled: number;
  firstVisit: number;
  repeat: number; // 2回目 + 3回目以降
}

/**
 * 担当者別パフォーマンスデータ
 */
interface StaffPerformance {
  staffName: string;
  totalCount: number;
  implementedCount: number;
  cancelCount: number;
  previousDayCancelCount: number;
  sameDayCancelCount: number;
  firstVisitCount: number;
  secondVisitCount: number;
  implementationRate: number;
  cancelRate: number;
  lateCancelRate: number; // 前日+当日キャンセル率
  firstToSecondCVR: number;
  firstTimeUserCount: number;
  firstTimeUserWithSecondCount: number;
}

/**
 * 時間帯別データ（ヒートマップ用）
 */
interface HourlyData {
  hour: number; // 0-23
  hourLabel: string; // "9:00" など
  total: number;
  implemented: number;
  cancelled: number;
  implementationRate: number;
}

/**
 * 曜日別データ
 */
interface DayOfWeekData {
  dayIndex: number; // 0=日曜, 1=月曜, ... 6=土曜
  dayName: string; // "日", "月", ... "土"
  total: number;
  implemented: number;
  cancelled: number;
  implementationRate: number;
}

/**
 * 曜日×時間帯のヒートマップデータ
 */
interface HeatmapCell {
  dayIndex: number;
  hour: number;
  dayName: string;
  hourLabel: string;
  count: number;
  implemented: number;
}

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付を表示用フォーマット（YYYY/MM/DD）
 */
function formatDateDisplay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * 日時をYYYY-MM-DD HH:mm形式にフォーマット
 */
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * キャンペーン対象レコードをフィルタ
 */
function filterRecordsForCampaign(
  histories: Map<string, ReservationHistory>,
  campaign: CampaignMaster
): ReservationHistory[] {
  const results: ReservationHistory[] = [];

  const periodToEnd = new Date(campaign.targetPeriodTo);
  periodToEnd.setHours(23, 59, 59, 999);

  for (const history of histories.values()) {
    // 除外フラグがtrueのレコードは集計から除外
    if (history.isExcluded) continue;

    const targetDate = campaign.targetDateType === 'application' ? history.applicationDate : history.sessionDate;

    if (targetDate >= campaign.targetPeriodFrom && targetDate <= periodToEnd) {
      results.push(history);
    }
  }

  return results;
}

/**
 * キャンペーンサマリーを計算
 */
function calculateCampaignSummary(
  records: ReservationHistory[],
  implementationRule: ImplementationRule = 'includeLateCancel'
): CampaignSummary {
  const userSet = new Set<string>();

  let implementedCount = 0;
  let cancelCount = 0;
  let sameDayCancelCount = 0;
  let previousDayCancelCount = 0;
  let earlyCancelCount = 0;
  let firstVisitCount = 0;
  let secondVisitCount = 0;
  let thirdPlusVisitCount = 0;

  // 初回→2回目CVR計算用
  // 期間内で初回を実施したユーザーを追跡
  const firstTimeUsers = new Set<string>();
  // 期間内で2回目以上を実施したユーザーを追跡
  const secondOrMoreUsers = new Set<string>();

  for (const record of records) {
    userSet.add(record.friendId);

    // 実施判定ルールに基づいてカウント
    if (shouldCountAsImplemented(record, implementationRule)) {
      implementedCount++;
      if (record.visitLabel === '初回') {
        firstVisitCount++;
        firstTimeUsers.add(record.friendId);
      } else if (record.visitLabel === '2回目') {
        secondVisitCount++;
        secondOrMoreUsers.add(record.friendId);
      } else {
        thirdPlusVisitCount++;
        secondOrMoreUsers.add(record.friendId);
      }
    } else if (record.status === 'キャンセル済み') {
      cancelCount++;
      // キャンセルタイミングを判定
      const timing = getCancelTiming(record.sessionDate, record.applicationDate, record.status);
      if (timing === 'same-day') {
        sameDayCancelCount++;
      } else if (timing === 'previous-day') {
        previousDayCancelCount++;
      } else {
        earlyCancelCount++;
      }
    }
  }

  const totalCount = records.length;
  const implementationRate = totalCount > 0 ? Math.round((implementedCount / totalCount) * 1000) / 10 : 0;
  const firstVisitRate = implementedCount > 0 ? Math.round((firstVisitCount / implementedCount) * 1000) / 10 : 0;
  const thirdPlusRate = implementedCount > 0 ? Math.round((thirdPlusVisitCount / implementedCount) * 1000) / 10 : 0;

  // 初回→2回目CVR
  // 期間内で初回を実施し、かつ2回目以上も実施したユーザー数
  let firstTimeUserWithSecondCount = 0;
  for (const userId of firstTimeUsers) {
    if (secondOrMoreUsers.has(userId)) {
      firstTimeUserWithSecondCount++;
    }
  }
  const firstToSecondCVR =
    firstTimeUsers.size > 0 ? Math.round((firstTimeUserWithSecondCount / firstTimeUsers.size) * 1000) / 10 : 0;

  return {
    totalCount,
    implementedCount,
    cancelCount,
    sameDayCancelCount,
    previousDayCancelCount,
    earlyCancelCount,
    firstVisitCount,
    secondVisitCount,
    thirdPlusVisitCount,
    uniqueUsers: userSet.size,
    implementationRate,
    firstVisitRate,
    thirdPlusRate,
    firstToSecondCVR,
    firstTimeUserCount: firstTimeUsers.size,
    firstTimeUserWithSecondCount,
  };
}

/**
 * 日別集計データを計算
 */
function calculateDailyData(
  records: ReservationHistory[],
  dateType: TargetDateType,
  implementationRule: ImplementationRule = 'includeLateCancel'
): DailyData[] {
  const dailyMap = new Map<string, DailyData>();

  for (const record of records) {
    const targetDate = dateType === 'application' ? record.applicationDate : record.sessionDate;

    const dateStr = formatDateForInput(targetDate);
    const dateLabel = `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;

    let daily = dailyMap.get(dateStr);
    if (!daily) {
      daily = {
        date: dateStr,
        dateLabel,
        total: 0,
        implemented: 0,
        cancelled: 0,
        firstVisit: 0,
        repeat: 0,
      };
      dailyMap.set(dateStr, daily);
    }

    daily.total++;

    if (shouldCountAsImplemented(record, implementationRule)) {
      daily.implemented++;
      if (record.visitLabel === '初回') {
        daily.firstVisit++;
      } else {
        daily.repeat++;
      }
    } else if (record.status === 'キャンセル済み') {
      daily.cancelled++;
    }
  }

  // 日付順にソート
  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 担当者別パフォーマンスを計算
 */
function calculateStaffPerformance(
  records: ReservationHistory[],
  implementationRule: ImplementationRule = 'includeLateCancel'
): StaffPerformance[] {
  const staffMap = new Map<
    string,
    {
      totalCount: number;
      implementedCount: number;
      cancelCount: number;
      previousDayCancelCount: number;
      sameDayCancelCount: number;
      firstVisitCount: number;
      secondVisitCount: number;
      firstTimeUsers: Set<string>;
      secondOrMoreUsers: Set<string>;
    }
  >();

  for (const record of records) {
    const staffName = record.staff || '(未割当)';

    let staff = staffMap.get(staffName);
    if (!staff) {
      staff = {
        totalCount: 0,
        implementedCount: 0,
        cancelCount: 0,
        previousDayCancelCount: 0,
        sameDayCancelCount: 0,
        firstVisitCount: 0,
        secondVisitCount: 0,
        firstTimeUsers: new Set(),
        secondOrMoreUsers: new Set(),
      };
      staffMap.set(staffName, staff);
    }

    staff.totalCount++;

    if (shouldCountAsImplemented(record, implementationRule)) {
      staff.implementedCount++;
      if (record.visitLabel === '初回') {
        staff.firstVisitCount++;
        staff.firstTimeUsers.add(record.friendId);
      } else {
        staff.secondVisitCount++;
        staff.secondOrMoreUsers.add(record.friendId);
      }
    } else if (record.status === 'キャンセル済み') {
      staff.cancelCount++;
      const timing = getCancelTiming(record.sessionDate, record.applicationDate, record.status);
      if (timing === 'same-day') {
        staff.sameDayCancelCount++;
      } else if (timing === 'previous-day') {
        staff.previousDayCancelCount++;
      }
    }
  }

  // 配列に変換して計算
  const results: StaffPerformance[] = [];

  for (const [staffName, data] of staffMap) {
    const implementationRate =
      data.totalCount > 0 ? Math.round((data.implementedCount / data.totalCount) * 1000) / 10 : 0;
    const cancelRate = data.totalCount > 0 ? Math.round((data.cancelCount / data.totalCount) * 1000) / 10 : 0;
    const lateCancelRate =
      data.totalCount > 0
        ? Math.round(((data.previousDayCancelCount + data.sameDayCancelCount) / data.totalCount) * 1000) / 10
        : 0;

    // 初回→2回目CVR
    let firstTimeUserWithSecondCount = 0;
    for (const userId of data.firstTimeUsers) {
      if (data.secondOrMoreUsers.has(userId)) {
        firstTimeUserWithSecondCount++;
      }
    }
    const firstToSecondCVR =
      data.firstTimeUsers.size > 0
        ? Math.round((firstTimeUserWithSecondCount / data.firstTimeUsers.size) * 1000) / 10
        : 0;

    results.push({
      staffName,
      totalCount: data.totalCount,
      implementedCount: data.implementedCount,
      cancelCount: data.cancelCount,
      previousDayCancelCount: data.previousDayCancelCount,
      sameDayCancelCount: data.sameDayCancelCount,
      firstVisitCount: data.firstVisitCount,
      secondVisitCount: data.secondVisitCount,
      implementationRate,
      cancelRate,
      lateCancelRate,
      firstToSecondCVR,
      firstTimeUserCount: data.firstTimeUsers.size,
      firstTimeUserWithSecondCount,
    });
  }

  // 実施数でソート
  return results.sort((a, b) => b.implementedCount - a.implementedCount);
}

/**
 * 曜日名を取得
 */
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * 時間帯別データを計算（申込時間帯基準）
 */
function calculateHourlyData(
  records: ReservationHistory[],
  implementationRule: ImplementationRule = 'includeLateCancel'
): HourlyData[] {
  // 0-23時の配列を初期化
  const hourlyMap: Map<number, { total: number; implemented: number; cancelled: number }> = new Map();

  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { total: 0, implemented: 0, cancelled: 0 });
  }

  for (const record of records) {
    const hour = record.applicationDate.getHours();
    const data = hourlyMap.get(hour)!;
    data.total++;

    if (shouldCountAsImplemented(record, implementationRule)) {
      data.implemented++;
    } else if (record.status === 'キャンセル済み') {
      data.cancelled++;
    }
  }

  const results: HourlyData[] = [];
  for (let h = 0; h < 24; h++) {
    const data = hourlyMap.get(h)!;
    results.push({
      hour: h,
      hourLabel: `${h}:00`,
      total: data.total,
      implemented: data.implemented,
      cancelled: data.cancelled,
      implementationRate: data.total > 0 ? Math.round((data.implemented / data.total) * 1000) / 10 : 0,
    });
  }

  return results;
}

/**
 * 曜日別データを計算（申込曜日基準）
 */
function calculateDayOfWeekData(
  records: ReservationHistory[],
  implementationRule: ImplementationRule = 'includeLateCancel'
): DayOfWeekData[] {
  // 0-6の配列を初期化
  const dayMap: Map<number, { total: number; implemented: number; cancelled: number }> = new Map();

  for (let d = 0; d < 7; d++) {
    dayMap.set(d, { total: 0, implemented: 0, cancelled: 0 });
  }

  for (const record of records) {
    const day = record.applicationDate.getDay();
    const data = dayMap.get(day)!;
    data.total++;

    if (shouldCountAsImplemented(record, implementationRule)) {
      data.implemented++;
    } else if (record.status === 'キャンセル済み') {
      data.cancelled++;
    }
  }

  const results: DayOfWeekData[] = [];
  for (let d = 0; d < 7; d++) {
    const data = dayMap.get(d)!;
    const dayName = DAY_NAMES[d] ?? '';
    results.push({
      dayIndex: d,
      dayName,
      total: data.total,
      implemented: data.implemented,
      cancelled: data.cancelled,
      implementationRate: data.total > 0 ? Math.round((data.implemented / data.total) * 1000) / 10 : 0,
    });
  }

  return results;
}

/**
 * 曜日×時間帯のヒートマップデータを計算
 */
function calculateHeatmapData(records: ReservationHistory[]): HeatmapCell[] {
  // 曜日(0-6) × 時間帯(0-23) のマップ
  const heatmap: Map<string, { count: number; implemented: number }> = new Map();

  // 全組み合わせを初期化
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      heatmap.set(`${d}-${h}`, { count: 0, implemented: 0 });
    }
  }

  for (const record of records) {
    const day = record.applicationDate.getDay();
    const hour = record.applicationDate.getHours();
    const key = `${day}-${hour}`;
    const data = heatmap.get(key)!;
    data.count++;
    if (record.isImplemented) {
      data.implemented++;
    }
  }

  const results: HeatmapCell[] = [];
  for (let d = 0; d < 7; d++) {
    const dayName = DAY_NAMES[d] ?? '';
    for (let h = 0; h < 24; h++) {
      const key = `${d}-${h}`;
      const data = heatmap.get(key)!;
      results.push({
        dayIndex: d,
        hour: h,
        dayName,
        hourLabel: `${h}:00`,
        count: data.count,
        implemented: data.implemented,
      });
    }
  }

  return results;
}

// ============================================================================
// 期間追加・編集ダイアログ
// ============================================================================

interface CampaignDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CampaignFormData) => Promise<void>;
  initialData?: CampaignMaster | null;
  mode: 'add' | 'edit';
}

const CampaignDialog = ({ open, onClose, onSave, initialData, mode }: CampaignDialogProps) => {
  const [formData, setFormData] = useState<CampaignFormData>(() => {
    if (initialData) {
      return {
        campaignId: initialData.campaignId,
        campaignName: initialData.campaignName,
        description: initialData.description || '',
        targetPeriodFrom: formatDateForInput(initialData.targetPeriodFrom),
        targetPeriodTo: formatDateForInput(initialData.targetPeriodTo),
        targetDateType: initialData.targetDateType,
      };
    }
    // 新規作成時のデフォルト値
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      campaignId: '',
      campaignName: '',
      description: '',
      targetPeriodFrom: formatDateForInput(firstDay),
      targetPeriodTo: formatDateForInput(lastDay),
      targetDateType: 'application',
    };
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.campaignName.trim()) {
      alert('期間名を入力してください');
      return;
    }
    if (!formData.targetPeriodFrom || !formData.targetPeriodTo) {
      alert('期間を設定してください');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('期間設定保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'add' ? '期間追加' : '期間編集'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="期間名"
            value={formData.campaignName}
            onChange={e => setFormData({ ...formData, campaignName: e.target.value })}
            fullWidth
            required
            placeholder="例: 2024年12月"
          />

          <TextField
            label="説明（オプション）"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            fullWidth
            multiline
            rows={2}
            placeholder="期間の説明を入力"
          />

          <Divider />

          <Typography variant="subtitle2" color="text.secondary">
            対象期間
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="開始日"
              type="date"
              value={formData.targetPeriodFrom}
              onChange={e => setFormData({ ...formData, targetPeriodFrom: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
            <TextField
              label="終了日"
              type="date"
              value={formData.targetPeriodTo}
              onChange={e => setFormData({ ...formData, targetPeriodTo: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel>基準日</InputLabel>
            <Select
              value={formData.targetDateType}
              label="基準日"
              onChange={e => setFormData({ ...formData, targetDateType: e.target.value as TargetDateType })}
            >
              <MenuItem value="application">申込日</MenuItem>
              <MenuItem value="session">実施日</MenuItem>
            </Select>
          </FormControl>

          <Alert severity="info" sx={{ mt: 1 }}>
            <Typography variant="body2">
              <strong>基準日</strong>: 期間フィルタに使用する日付の種類
              <br />• <strong>申込日</strong>: ユーザーが申込んだ日で集計（マーケティング効果測定向け）
              <br />• <strong>実施日</strong>: 実際に来店した日で集計（運用実績向け）
            </Typography>
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          キャンセル
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// メインコンポーネント
// ============================================================================

export const CampaignAggregationView = () => {
  const { histories, campaigns, loadData } = useHistoryStore();
  const { implementationRule, mergeSameDayReservations } = useUiStore();

  // 選択中のキャンペーン
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // ダイアログ状態
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingCampaign, setEditingCampaign] = useState<CampaignMaster | null>(null);

  // 削除確認
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);

  // 選択中のキャンペーン
  const selectedCampaign = useMemo(() => {
    return campaigns.find(c => c.campaignId === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // 選択中キャンペーンの対象レコード
  const filteredRecords = useMemo(() => {
    if (!selectedCampaign) return [];
    return filterRecordsForCampaign(histories, selectedCampaign);
  }, [histories, selectedCampaign]);

  // 同日統合を適用したレコード
  const recordsForAggregation = useMemo(() => {
    return applySameDayMerge(filteredRecords, mergeSameDayReservations);
  }, [filteredRecords, mergeSameDayReservations]);

  // サマリー計算
  const summary = useMemo(() => {
    return calculateCampaignSummary(recordsForAggregation, implementationRule);
  }, [recordsForAggregation, implementationRule]);

  // 日別集計データ（グラフ用）
  const dailyData = useMemo(() => {
    if (!selectedCampaign) return [];
    return calculateDailyData(recordsForAggregation, selectedCampaign.targetDateType, implementationRule);
  }, [recordsForAggregation, selectedCampaign, implementationRule]);

  // 担当者別パフォーマンス
  const staffPerformance = useMemo(() => {
    return calculateStaffPerformance(recordsForAggregation, implementationRule);
  }, [recordsForAggregation, implementationRule]);

  // ユーザータイプ分布（円グラフ用）
  const userTypeDistribution = useMemo(() => {
    const colors = {
      first: '#4caf50',
      second: '#2196f3',
      thirdPlus: '#9c27b0',
    };

    const data = [
      { name: '初回', value: summary.firstVisitCount, fill: colors.first },
      { name: '2回目', value: summary.secondVisitCount, fill: colors.second },
      { name: '3回目以降', value: summary.thirdPlusVisitCount, fill: colors.thirdPlus },
    ].filter(d => d.value > 0);

    return data;
  }, [summary]);

  // 時間帯別データ
  const hourlyData = useMemo(() => {
    return calculateHourlyData(recordsForAggregation, implementationRule);
  }, [recordsForAggregation, implementationRule]);

  // 曜日別データ
  const dayOfWeekData = useMemo(() => {
    return calculateDayOfWeekData(recordsForAggregation, implementationRule);
  }, [recordsForAggregation, implementationRule]);

  // ヒートマップデータ
  const heatmapData = useMemo(() => {
    return calculateHeatmapData(recordsForAggregation);
  }, [recordsForAggregation]);

  // 全キャンペーンのサマリー（一覧表示用）
  const allCampaignSummaries = useMemo(() => {
    return campaigns.map(campaign => {
      const records = filterRecordsForCampaign(histories, campaign);
      const mergedRecords = applySameDayMerge(records, mergeSameDayReservations);
      return {
        campaign,
        summary: calculateCampaignSummary(mergedRecords, implementationRule),
      };
    });
  }, [campaigns, histories, implementationRule, mergeSameDayReservations]);

  // キャンペーン追加
  const handleAddCampaign = useCallback(() => {
    setDialogMode('add');
    setEditingCampaign(null);
    setDialogOpen(true);
  }, []);

  // キャンペーン編集
  const handleEditCampaign = useCallback((campaign: CampaignMaster) => {
    setDialogMode('edit');
    setEditingCampaign(campaign);
    setDialogOpen(true);
  }, []);

  // キャンペーン保存
  const handleSaveCampaign = useCallback(
    async (data: CampaignFormData) => {
      const now = new Date();
      const campaignId = data.campaignId || `campaign-${Date.now()}`;

      const campaign: CampaignMaster = {
        campaignId,
        campaignName: data.campaignName,
        description: data.description || undefined,
        targetPeriodFrom: new Date(data.targetPeriodFrom),
        targetPeriodTo: new Date(data.targetPeriodTo),
        targetDateType: data.targetDateType,
        isActive: true,
        createdAt: editingCampaign?.createdAt || now,
        updatedAt: now,
      };

      await repository.saveCampaign(campaign);
      await loadData();
    },
    [editingCampaign, loadData]
  );

  // キャンペーン削除確認
  const handleDeleteClick = useCallback((campaignId: string) => {
    setDeletingCampaignId(campaignId);
    setDeleteConfirmOpen(true);
  }, []);

  // キャンペーン削除実行
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingCampaignId) return;

    try {
      await repository.deleteCampaign(deletingCampaignId);
      await loadData();
      if (selectedCampaignId === deletingCampaignId) {
        setSelectedCampaignId(null);
      }
    } catch (error) {
      console.error('期間設定削除エラー:', error);
      alert('削除に失敗しました');
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingCampaignId(null);
    }
  }, [deletingCampaignId, loadData, selectedCampaignId]);

  /**
   * キャンペーン一覧CSVダウンロード
   */
  const handleDownloadCSV = useCallback(() => {
    if (allCampaignSummaries.length === 0) {
      alert('ダウンロードするデータがありません');
      return;
    }

    // ヘッダー行
    const header =
      'campaignName,description,targetPeriodFrom,targetPeriodTo,targetDateType,totalCount,implementedCount,cancelCount,firstVisitCount,secondVisitCount,thirdOrMoreCount,uniqueUsers';

    // データ行
    const rows = allCampaignSummaries.map(({ campaign, summary: s }) => {
      // CSVエスケープ（カンマ、改行、ダブルクォートを含む場合）
      const escapeCsv = (value: string) => {
        if (!value) return '';
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      return [
        escapeCsv(campaign.campaignName),
        escapeCsv(campaign.description || ''),
        formatDateForInput(campaign.targetPeriodFrom),
        formatDateForInput(campaign.targetPeriodTo),
        campaign.targetDateType === 'application' ? '申込日' : '実施日',
        s.totalCount,
        s.implementedCount,
        s.cancelCount,
        s.firstVisitCount,
        s.secondVisitCount,
        s.thirdPlusVisitCount,
        s.uniqueUsers,
      ].join(',');
    });

    // CSV文字列を生成
    const csv = [header, ...rows].join('\n');

    // BOM付きUTF-8でダウンロード
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // ファイル名: campaign-aggregation-YYYYMMDD-HHmm.csv
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');
    const filename = `campaign-aggregation-${timestamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [allCampaignSummaries]);

  /**
   * キャンペーン詳細CSV（該当レコード一覧）ダウンロード
   */
  const handleDownloadDetailCSV = useCallback(
    (campaign: CampaignMaster) => {
      // 対象レコードを取得（isExcluded=trueは除外済み）
      const records = filterRecordsForCampaign(histories, campaign);

      if (records.length === 0) {
        alert('該当するレコードがありません');
        return;
      }

      // CSVエスケープ
      const escapeCsv = (value: string) => {
        if (!value) return '';
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      // ヘッダー行
      const header =
        'friendId,name,applicationDate,sessionDate,status,visitStatus,isImplemented,visitIndex,visitLabel,isExcluded';

      // データ行（sessionDate降順でソート）
      const sortedRecords = [...records].sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());

      const rows = sortedRecords.map(record => {
        return [
          escapeCsv(record.friendId),
          escapeCsv(record.name),
          formatDateTime(record.applicationDate),
          formatDateTime(record.sessionDate),
          record.status,
          record.visitStatus,
          record.isImplemented ? 'true' : 'false',
          record.visitIndex,
          record.visitLabel,
          record.isExcluded ? 'true' : 'false',
        ].join(',');
      });

      // CSV文字列を生成
      const csv = [header, ...rows].join('\n');

      // BOM付きUTF-8でダウンロード
      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // ファイル名: campaign-detail-[campaignName]-YYYYMMDD-HHmm.csv
      // スペースを_に変換
      const safeCampaignName = campaign.campaignName.replace(/\s+/g, '_');
      const now = new Date();
      const timestamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        '-',
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
      ].join('');
      const filename = `campaign-detail-${safeCampaignName}-${timestamp}.csv`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    [histories]
  );

  /**
   * 日別集計CSVダウンロード
   */
  const handleDownloadDailyCSV = useCallback(() => {
    if (dailyData.length === 0 || !selectedCampaign) {
      alert('ダウンロードするデータがありません');
      return;
    }

    // ヘッダー行
    const header = '日付,総件数,実施,キャンセル,初回,リピート,実施率(%)';

    // データ行
    const rows = dailyData.map(d => {
      const rate = d.total > 0 ? Math.round((d.implemented / d.total) * 1000) / 10 : 0;
      return [d.date, d.total, d.implemented, d.cancelled, d.firstVisit, d.repeat, rate].join(',');
    });

    // 合計行を追加
    const totalRow = dailyData.reduce(
      (acc, d) => {
        acc.total += d.total;
        acc.implemented += d.implemented;
        acc.cancelled += d.cancelled;
        acc.firstVisit += d.firstVisit;
        acc.repeat += d.repeat;
        return acc;
      },
      { total: 0, implemented: 0, cancelled: 0, firstVisit: 0, repeat: 0 }
    );
    const totalRate = totalRow.total > 0 ? Math.round((totalRow.implemented / totalRow.total) * 1000) / 10 : 0;
    rows.push(
      `合計,${totalRow.total},${totalRow.implemented},${totalRow.cancelled},${totalRow.firstVisit},${totalRow.repeat},${totalRate}`
    );

    // CSV文字列を生成
    const csv = [header, ...rows].join('\n');

    // BOM付きUTF-8でダウンロード
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // ファイル名: campaign-daily-[campaignName]-YYYYMMDD-HHmm.csv
    const safeCampaignName = selectedCampaign.campaignName.replace(/\s+/g, '_');
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');
    const filename = `campaign-daily-${safeCampaignName}-${timestamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [dailyData, selectedCampaign]);

  // データがない場合
  if (histories.size === 0) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PeriodSummaryIcon color="primary" />
          期間サマリー
        </Typography>
        <Alert severity="info">履歴データがありません。CSVをアップロードしてください。</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeriodSummaryIcon color="primary" />
          期間サマリー
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddCampaign}>
          期間追加
        </Button>
      </Box>

      {/* 期間一覧 */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            期間一覧
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadCSV}
            disabled={campaigns.length === 0}
          >
            CSVダウンロード
          </Button>
        </Box>

        {campaigns.length === 0 ? (
          <Alert severity="info">期間設定がありません。「期間追加」ボタンから作成してください。</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>期間名</TableCell>
                  <TableCell>期間</TableCell>
                  <TableCell align="center">基準日</TableCell>
                  <TableCell align="right">総件数</TableCell>
                  <TableCell align="right">実施</TableCell>
                  <TableCell align="right">初回</TableCell>
                  <TableCell align="right">ユニーク</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allCampaignSummaries.map(({ campaign, summary: s }) => (
                  <TableRow
                    key={campaign.campaignId}
                    hover
                    selected={selectedCampaignId === campaign.campaignId}
                    onClick={() => setSelectedCampaignId(campaign.campaignId)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {campaign.campaignName}
                      </Typography>
                      {campaign.description && (
                        <Typography variant="caption" color="text.secondary">
                          {campaign.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateDisplay(campaign.targetPeriodFrom)} 〜 {formatDateDisplay(campaign.targetPeriodTo)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={campaign.targetDateType === 'application' ? '申込日' : '実施日'}
                        color={campaign.targetDateType === 'application' ? 'info' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">{s.totalCount}</TableCell>
                    <TableCell align="right">
                      <Typography color="success.main" fontWeight="bold">
                        {s.implementedCount}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{s.firstVisitCount}</TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={s.uniqueUsers} color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title="詳細CSV">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={e => {
                              e.stopPropagation();
                              handleDownloadDetailCSV(campaign);
                            }}
                          >
                            <FileDownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="編集">
                          <IconButton
                            size="small"
                            onClick={e => {
                              e.stopPropagation();
                              handleEditCampaign(campaign);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="削除">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteClick(campaign.campaignId);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 選択中のキャンペーン詳細 */}
      {selectedCampaign && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon color="primary" />
            {selectedCampaign.campaignName} の集計結果
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Chip
                icon={<CalendarIcon />}
                label={`${formatDateDisplay(selectedCampaign.targetPeriodFrom)} 〜 ${formatDateDisplay(selectedCampaign.targetPeriodTo)}`}
                size="small"
              />
              <Chip
                label={`基準: ${selectedCampaign.targetDateType === 'application' ? '申込日' : '実施日'}`}
                size="small"
                color={selectedCampaign.targetDateType === 'application' ? 'info' : 'success'}
                variant="outlined"
              />
              <Typography variant="body2" component="span">
                | 対象レコード: <strong>{summary.totalCount}件</strong>（除外済みは含まず）
              </Typography>
            </Box>
          </Alert>

          {/* メインサマリーカード */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              mb: 3,
            }}
          >
            <Card variant="outlined" sx={{ flex: '1 1 120px', minWidth: 120, maxWidth: 160 }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  総件数
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {summary.totalCount}
                </Typography>
              </CardContent>
            </Card>

            <Card
              variant="outlined"
              sx={{ flex: '1 1 120px', minWidth: 120, maxWidth: 160, borderColor: 'success.main' }}
            >
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  実施
                </Typography>
                <Typography variant="h5" fontWeight="bold" color="success.main">
                  {summary.implementedCount}
                </Typography>
                <Chip
                  size="small"
                  label={`${summary.implementationRate}%`}
                  color="success"
                  variant="outlined"
                  sx={{ mt: 0.5 }}
                />
              </CardContent>
            </Card>

            <Card
              variant="outlined"
              sx={{ flex: '1 1 120px', minWidth: 120, maxWidth: 160, borderColor: 'error.main' }}
            >
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  キャンセル
                </Typography>
                <Typography variant="h5" fontWeight="bold" color="error.main">
                  {summary.cancelCount}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  前日: {summary.previousDayCancelCount} / 当日: {summary.sameDayCancelCount}
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flex: '1 1 120px', minWidth: 120, maxWidth: 160 }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  初回
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {summary.firstVisitCount}
                </Typography>
                <Chip size="small" label={`${summary.firstVisitRate}%`} variant="outlined" sx={{ mt: 0.5 }} />
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flex: '1 1 120px', minWidth: 120, maxWidth: 160 }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  2回目
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {summary.secondVisitCount}
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flex: '1 1 120px', minWidth: 120, maxWidth: 160 }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  3回目以降
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {summary.thirdPlusVisitCount}
                </Typography>
                <Chip size="small" label={`${summary.thirdPlusRate}%`} variant="outlined" sx={{ mt: 0.5 }} />
              </CardContent>
            </Card>
          </Box>

          {/* 追加指標カード */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              mb: 3,
            }}
          >
            {/* 初回→2回目CVR */}
            <Card variant="outlined" sx={{ flex: '1 1 200px', minWidth: 200, maxWidth: 280, borderColor: 'info.main' }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  初回→2回目 CVR
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography variant="h4" fontWeight="bold" color="info.main">
                    {summary.firstToSecondCVR}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({summary.firstTimeUserWithSecondCount}/{summary.firstTimeUserCount}人)
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  期間内で初回実施→2回目実施した割合
                </Typography>
              </CardContent>
            </Card>

            {/* ユニークユーザー */}
            <Card variant="outlined" sx={{ flex: '1 1 200px', minWidth: 200, maxWidth: 280 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  ユニークユーザー
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon color="primary" fontSize="small" />
                  <Typography variant="h4" fontWeight="bold">
                    {summary.uniqueUsers}人
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* キャンセル詳細 */}
            <Card
              variant="outlined"
              sx={{ flex: '1 1 200px', minWidth: 200, maxWidth: 280, borderColor: 'warning.main' }}
            >
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  キャンセル内訳
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      早期
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {summary.earlyCancelCount}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="warning.main">
                      前日
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="warning.main">
                      {summary.previousDayCancelCount}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="error.main">
                      当日
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="error.main">
                      {summary.sameDayCancelCount}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* 日別推移グラフ */}
          {dailyData.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShowChartIcon color="primary" />
                日別推移
                <Chip
                  size="small"
                  label={`基準: ${selectedCampaign?.targetDateType === 'application' ? '申込日' : '実施日'}`}
                  variant="outlined"
                  sx={{ ml: 1 }}
                />
              </Typography>
              <Box sx={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 12 }}
                      interval={dailyData.length > 20 ? Math.floor(dailyData.length / 15) : 0}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: 4,
                      }}
                      labelFormatter={label => `日付: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="implemented" name="実施" stackId="a" fill="#4caf50" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="cancelled" name="キャンセル" stackId="a" fill="#f44336" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="firstVisit"
                      name="初回"
                      stroke="#2196f3"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="repeat"
                      name="リピート"
                      stroke="#9c27b0"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          )}

          {/* ファネル（初回→2回目）*/}
          {summary.firstTimeUserCount > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FunnelIcon color="primary" />
                初回→2回目 コンバージョンファネル
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* ファネル棒グラフ */}
                <Box sx={{ flex: '1 1 300px', minWidth: 300, height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: '初回実施',
                          value: summary.firstTimeUserCount,
                          fill: '#4caf50',
                        },
                        {
                          name: '2回目実施',
                          value: summary.firstTimeUserWithSecondCount,
                          fill: '#2196f3',
                        },
                      ]}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} />
                      <RechartsTooltip />
                      <Bar dataKey="value" name="ユーザー数" radius={[0, 4, 4, 0]}>
                        {[{ fill: '#4caf50' }, { fill: '#2196f3' }].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>

                {/* ファネル指標 */}
                <Box sx={{ flex: '1 1 250px', minWidth: 250 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      初回実施ユーザー
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {summary.firstTimeUserCount}人
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      うち2回目も実施
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="info.main">
                      {summary.firstTimeUserWithSecondCount}人
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      コンバージョン率
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="primary.main">
                      {summary.firstToSecondCVR}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      期間内で初回実施した人が2回目も実施した割合
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}

          {/* 担当者別パフォーマンス */}
          {staffPerformance.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon color="primary" />
                担当者別パフォーマンス
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'grey.100' }}>
                      <TableCell>担当者</TableCell>
                      <TableCell align="right">件数</TableCell>
                      <TableCell align="right">実施</TableCell>
                      <TableCell align="right">実施率</TableCell>
                      <TableCell align="right">キャンセル</TableCell>
                      <TableCell align="right">前日/当日</TableCell>
                      <TableCell align="right">初回→2回目CVR</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {staffPerformance.map(staff => (
                      <TableRow key={staff.staffName} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{staff.staffName}</Typography>
                        </TableCell>
                        <TableCell align="right">{staff.totalCount}</TableCell>
                        <TableCell align="right">
                          <Typography color="success.main" fontWeight="medium">
                            {staff.implementedCount}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={`${staff.implementationRate}%`}
                            color={
                              staff.implementationRate >= 80
                                ? 'success'
                                : staff.implementationRate >= 60
                                  ? 'warning'
                                  : 'error'
                            }
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="text.secondary">{staff.cancelCount}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          {staff.previousDayCancelCount + staff.sameDayCancelCount > 0 ? (
                            <Chip
                              size="small"
                              label={`${staff.previousDayCancelCount}/${staff.sameDayCancelCount}`}
                              color="warning"
                              variant="outlined"
                            />
                          ) : (
                            <Typography color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {staff.firstTimeUserCount > 0 ? (
                            <Tooltip title={`${staff.firstTimeUserWithSecondCount}/${staff.firstTimeUserCount}人`}>
                              <Chip size="small" label={`${staff.firstToSecondCVR}%`} color="info" variant="outlined" />
                            </Tooltip>
                          ) : (
                            <Typography color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* ユーザータイプ分布（円グラフ）*/}
          {userTypeDistribution.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PieChartIcon color="primary" />
                ユーザータイプ分布
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* 円グラフ */}
                <Box sx={{ flex: '1 1 250px', minWidth: 250, height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={userTypeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={{ stroke: '#666', strokeWidth: 1 }}
                      >
                        {userTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number, name: string) => [`${value}件`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                {/* 内訳リスト */}
                <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  {userTypeDistribution.map(item => (
                    <Box
                      key={item.name}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb: 1.5,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: 'grey.50',
                      }}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          bgcolor: item.fill,
                          mr: 1.5,
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {item.name}
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {item.value}件
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            (
                            {summary.implementedCount > 0
                              ? Math.round((item.value / summary.implementedCount) * 100)
                              : 0}
                            %)
                          </Typography>
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Paper>
          )}

          {/* 時間帯/曜日分析（ヒートマップ）*/}
          {summary.totalCount > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon color="primary" />
                申込時間帯 / 曜日分析
              </Typography>

              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {/* 時間帯別グラフ（棒グラフ） */}
                <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    申込時間帯別の分布
                  </Typography>
                  <Box sx={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={hourlyData.filter(h => h.total > 0 || (h.hour >= 8 && h.hour <= 22))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="hourLabel" tick={{ fontSize: 10 }} interval={1} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [
                            `${value}件`,
                            name === 'implemented' ? '実施' : 'キャンセル',
                          ]}
                          labelFormatter={label => `${label}`}
                        />
                        <Bar dataKey="implemented" name="実施" stackId="a" fill="#4caf50" />
                        <Bar dataKey="cancelled" name="キャンセル" stackId="a" fill="#f44336" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>

                {/* 曜日別グラフ（棒グラフ） */}
                <Box sx={{ flex: '1 1 300px', minWidth: 250 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    申込曜日別の分布
                  </Typography>
                  <Box sx={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="dayName" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [
                            `${value}件`,
                            name === 'implemented' ? '実施' : 'キャンセル',
                          ]}
                          labelFormatter={label => `${label}曜`}
                        />
                        <Bar dataKey="implemented" name="実施" stackId="a" fill="#4caf50" />
                        <Bar dataKey="cancelled" name="キャンセル" stackId="a" fill="#f44336" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              </Box>

              {/* ヒートマップ（曜日×時間帯） */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  曜日 × 時間帯ヒートマップ（申込件数）
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Box sx={{ minWidth: 600 }}>
                    {/* ヘッダー行（時間帯） */}
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Box sx={{ width: 40, flexShrink: 0 }} />
                      {Array.from({ length: 24 }, (_, h) => (
                        <Box
                          key={h}
                          sx={{
                            flex: '1 0 24px',
                            textAlign: 'center',
                            fontSize: 10,
                            color: 'text.secondary',
                          }}
                        >
                          {h}
                        </Box>
                      ))}
                    </Box>

                    {/* 曜日行 */}
                    {DAY_NAMES.map((dayName, dayIndex) => {
                      const dayData = heatmapData.filter(d => d.dayIndex === dayIndex);
                      const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

                      return (
                        <Box key={dayIndex} sx={{ display: 'flex', mb: 0.5 }}>
                          <Box
                            sx={{
                              width: 40,
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              fontSize: 12,
                              fontWeight: 'medium',
                              color: dayIndex === 0 ? 'error.main' : dayIndex === 6 ? 'info.main' : 'text.primary',
                            }}
                          >
                            {dayName}
                          </Box>
                          {dayData.map(cell => {
                            const intensity = cell.count / maxCount;
                            const bgcolor =
                              cell.count > 0 ? `rgba(33, 150, 243, ${0.1 + intensity * 0.8})` : 'grey.100';

                            return (
                              <Tooltip
                                key={cell.hour}
                                title={`${dayName}曜 ${cell.hour}:00 - ${cell.count}件（実施: ${cell.implemented}件）`}
                                arrow
                              >
                                <Box
                                  sx={{
                                    flex: '1 0 24px',
                                    height: 24,
                                    bgcolor,
                                    borderRadius: 0.5,
                                    mx: 0.25,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 9,
                                    color: intensity > 0.5 ? 'white' : 'text.secondary',
                                    cursor: 'default',
                                    transition: 'transform 0.1s',
                                    '&:hover': {
                                      transform: 'scale(1.1)',
                                      zIndex: 1,
                                    },
                                  }}
                                >
                                  {cell.count > 0 ? cell.count : ''}
                                </Box>
                              </Tooltip>
                            );
                          })}
                        </Box>
                      );
                    })}

                    {/* 凡例 */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 1, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        少
                      </Typography>
                      {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity, i) => (
                        <Box
                          key={i}
                          sx={{
                            width: 16,
                            height: 16,
                            bgcolor: `rgba(33, 150, 243, ${0.1 + intensity * 0.8})`,
                            borderRadius: 0.5,
                          }}
                        />
                      ))}
                      <Typography variant="caption" color="text.secondary">
                        多
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}

          {/* 日別詳細テーブル */}
          {dailyData.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TableChartIcon color="primary" />
                  日別詳細テーブル
                </Typography>
                <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={handleDownloadDailyCSV}>
                  CSVダウンロード
                </Button>
              </Box>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>日付</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                        総件数
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                        実施
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                        キャンセル
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                        初回
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                        リピート
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                        実施率
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyData.map(d => {
                      const rate = d.total > 0 ? Math.round((d.implemented / d.total) * 1000) / 10 : 0;
                      return (
                        <TableRow key={d.date} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {d.date}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{d.total}</TableCell>
                          <TableCell align="right">
                            <Typography color="success.main" fontWeight="medium">
                              {d.implemented}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography color={d.cancelled > 0 ? 'error.main' : 'text.secondary'}>
                              {d.cancelled}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{d.firstVisit}</TableCell>
                          <TableCell align="right">{d.repeat}</TableCell>
                          <TableCell align="right">
                            <Chip
                              size="small"
                              label={`${rate}%`}
                              color={rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'error'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* 合計行 */}
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>合計</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {summary.totalCount}
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="success.main" fontWeight="bold">
                          {summary.implementedCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="error.main" fontWeight="bold">
                          {summary.cancelCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {summary.firstVisitCount}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {summary.secondVisitCount + summary.thirdPlusVisitCount}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={`${summary.implementationRate}%`}
                          color={
                            summary.implementationRate >= 80
                              ? 'success'
                              : summary.implementationRate >= 60
                                ? 'warning'
                                : 'error'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* 対象レコードなしの場合 */}
          {summary.totalCount === 0 && (
            <Alert severity="warning">
              この期間内に対象レコードがありません。 期間設定や基準日を確認してください。
            </Alert>
          )}
        </Paper>
      )}

      {/* 期間追加・編集ダイアログ */}
      <CampaignDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveCampaign}
        initialData={editingCampaign}
        mode={dialogMode}
      />

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>期間の削除</DialogTitle>
        <DialogContent>
          <Typography>
            この期間設定を削除しますか？
            <br />
            <strong>この操作は取り消せません。</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>キャンセル</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
