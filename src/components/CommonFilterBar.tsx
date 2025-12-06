/**
 * 共通フィルタバーコンポーネント
 *
 * - 基準日切り替え（申込日/実施日）
 * - 期間プリセット選択
 * - カスタム期間入力
 */
import { useCallback } from 'react';
import {
  Box,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  DateRange as DateRangeIcon,
  CheckCircle as CheckCircleIcon,
  MergeType as MergeTypeIcon,
} from '@mui/icons-material';
import {
  useUiStore,
  type DateBaseType,
  type PeriodPreset,
  PERIOD_PRESET_LABELS,
  DATE_BASE_TYPE_LABELS,
} from '../store/uiStore';
import { type ImplementationRule, IMPLEMENTATION_RULE_LABELS } from '../domain/types';

/**
 * 日付をYYYY-MM-DD形式にフォーマット（input[type="date"]用）
 */
function formatDateForInput(date: Date | null): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付をMM/DD形式にフォーマット（表示用）
 */
function formatDateShort(date: Date | null): string {
  if (!date) return '-';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}


export const CommonFilterBar = () => {
  const {
    dateBaseType,
    periodPreset,
    periodFrom,
    periodTo,
    implementationRule,
    mergeSameDayReservations,
    setDateBaseType,
    setPeriodPreset,
    setPeriodRange,
    setImplementationRule,
    setMergeSameDayReservations,
    getEffectivePeriod,
  } = useUiStore();

  // 有効な期間を取得
  const effectivePeriod = getEffectivePeriod();

  /**
   * 基準日タイプ変更
   */
  const handleDateBaseTypeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newType: DateBaseType | null) => {
      if (newType !== null) {
        setDateBaseType(newType);
      }
    },
    [setDateBaseType]
  );

  /**
   * 期間プリセット変更
   */
  const handlePeriodPresetChange = useCallback(
    (event: { target: { value: string } }) => {
      setPeriodPreset(event.target.value as PeriodPreset);
    },
    [setPeriodPreset]
  );

  /**
   * カスタム期間From変更
   */
  const handleFromChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      const newFrom = value ? new Date(value) : null;
      setPeriodRange(newFrom, periodTo);
    },
    [periodTo, setPeriodRange]
  );

  /**
   * カスタム期間To変更
   */
  const handleToChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      const newTo = value ? new Date(value) : null;
      setPeriodRange(periodFrom, newTo);
    },
    [periodFrom, setPeriodRange]
  );

  /**
   * 実施判定ルール変更
   */
  const handleImplementationRuleChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newRule: ImplementationRule | null) => {
      if (newRule !== null) {
        setImplementationRule(newRule);
      }
    },
    [setImplementationRule]
  );

  /**
   * 同日統合の切り替え
   */
  const handleMergeSameDayChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newValue: string | null) => {
      if (newValue !== null) {
        setMergeSameDayReservations(newValue === 'merge');
      }
    },
    [setMergeSameDayReservations]
  );

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        mb: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        flexWrap: 'wrap',
      }}
    >
      {/* 基準日切り替え */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalendarIcon color="action" fontSize="small" />
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          基準日:
        </Typography>
        <ToggleButtonGroup
          value={dateBaseType}
          exclusive
          onChange={handleDateBaseTypeChange}
          size="small"
        >
          <ToggleButton value="session">
            {DATE_BASE_TYPE_LABELS.session}
          </ToggleButton>
          <ToggleButton value="application">
            {DATE_BASE_TYPE_LABELS.application}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 期間プリセット */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DateRangeIcon color="action" fontSize="small" />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="period-preset-label">期間</InputLabel>
          <Select
            labelId="period-preset-label"
            value={periodPreset}
            label="期間"
            onChange={handlePeriodPresetChange}
          >
            {Object.entries(PERIOD_PRESET_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* カスタム期間入力 */}
      {periodPreset === 'custom' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="date"
            size="small"
            label="From"
            value={formatDateForInput(periodFrom)}
            onChange={handleFromChange}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <Typography variant="body2" color="text.secondary">
            〜
          </Typography>
          <TextField
            type="date"
            size="small"
            label="To"
            value={formatDateForInput(periodTo)}
            onChange={handleToChange}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
        </Box>
      )}

      {/* 有効期間の表示 */}
      {periodPreset !== 'all' && effectivePeriod.from && effectivePeriod.to && (
        <Chip
          size="small"
          variant="outlined"
          color="primary"
          label={`${formatDateShort(effectivePeriod.from)} 〜 ${formatDateShort(effectivePeriod.to)}`}
        />
      )}

      {periodPreset === 'all' && (
        <Chip
          size="small"
          variant="outlined"
          color="default"
          label="全期間"
        />
      )}

      {/* 区切り線 */}
      <Box sx={{ borderLeft: 1, borderColor: 'divider', height: 32 }} />

      {/* 実施判定ルール */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleIcon color="action" fontSize="small" />
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          実施カウント:
        </Typography>
        <ToggleButtonGroup
          value={implementationRule}
          exclusive
          onChange={handleImplementationRuleChange}
          size="small"
        >
          <ToggleButton value="strict">
            {IMPLEMENTATION_RULE_LABELS.strict}
          </ToggleButton>
          <ToggleButton value="includeLateCancel">
            {IMPLEMENTATION_RULE_LABELS.includeLateCancel}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 区切り線 */}
      <Box sx={{ borderLeft: 1, borderColor: 'divider', height: 32 }} />

      {/* 同日統合オプション */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MergeTypeIcon color="action" fontSize="small" />
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          同日予約:
        </Typography>
        <ToggleButtonGroup
          value={mergeSameDayReservations ? 'merge' : 'separate'}
          exclusive
          onChange={handleMergeSameDayChange}
          size="small"
        >
          <ToggleButton value="separate">
            個別カウント
          </ToggleButton>
          <ToggleButton value="merge">
            1件に統合
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Paper>
  );
};
