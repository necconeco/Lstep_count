/**
 * 予約詳細ドロワーコンポーネント
 *
 * - 予約の詳細情報を表示
 * - isExcludedの切り替え操作
 * - 実施/キャンセルの手動切り替え
 */
import { useCallback, useState, useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Divider,
  IconButton,
  Chip,
  Switch,
  FormControlLabel,
  Paper,
  List,
  ListItem,
  ListItemText,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Event as EventIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Block as BlockIcon,
  SwapHoriz as SwapHorizIcon,
  PersonAdd as PersonAddIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';
import type { FlatRecord } from '../domain/types';
import { historyToFlatRecord } from '../domain/logic';
import { OFFICIAL_STAFF_MEMBERS } from '../domain/staffMasterData';

interface ReservationDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  record: FlatRecord | null; // 初期表示用（reservationIdの取得に使用）
}

/**
 * フィールド名の日本語ラベル
 */
const FIELD_LABELS: Record<string, string> = {
  isExcluded: '集計除外',
  detailStatus: '詳細ステータス',
  staff: '担当者',
  isImplemented: '実施状態',
  isImplementedManual: '実施手動設定',
  groupId: '統合ID',
};

/**
 * 値の表示用変換
 */
function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    if (field === 'isImplementedManual') return '自動判定';
    return '-';
  }
  if (typeof value === 'boolean') {
    if (field === 'isExcluded') return value ? '除外' : '対象';
    if (field === 'isImplemented') return value ? '実施' : '未実施';
    if (field === 'isImplementedManual') return value ? '実施（手動）' : '未実施（手動）';
    return value ? 'はい' : 'いいえ';
  }
  return String(value);
}

export const ReservationDetailDrawer = ({ open, onClose, record: initialRecord }: ReservationDetailDrawerProps) => {
  const { histories, setExcluded, updateDetailStatus, assignStaff, setIsImplementedManual, getAuditLogsByReservation } =
    useHistoryStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string>('');

  // ストアから最新のレコードを取得（即時反映のため）
  const record = useMemo<FlatRecord | null>(() => {
    if (!initialRecord) return null;
    const history = histories.get(initialRecord.reservationId);
    if (!history) return initialRecord; // フォールバック
    return historyToFlatRecord(history);
  }, [initialRecord, histories]);

  // 監査ログを取得
  const auditLogs = record ? getAuditLogsByReservation(record.reservationId) : [];

  /**
   * 除外フラグの切り替え
   */
  const handleExcludedChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!record) return;
      await setExcluded(record.reservationId, event.target.checked);
    },
    [record, setExcluded]
  );

  /**
   * 詳細ステータス（前日/当日キャンセル）の変更
   */
  const handleDetailStatusChange = useCallback(
    async (newStatus: '前日キャンセル' | '当日キャンセル' | null) => {
      if (!record) return;
      setIsUpdating(true);
      try {
        await updateDetailStatus(record.reservationId, newStatus);
      } finally {
        setIsUpdating(false);
      }
    },
    [record, updateDetailStatus]
  );

  /**
   * 担当者割当（おまかせ以外も可能）
   */
  const handleAssignStaff = useCallback(async () => {
    if (!record || !selectedStaff) return;
    setIsUpdating(true);
    try {
      await assignStaff(record.reservationId, selectedStaff);
      setSelectedStaff('');
    } finally {
      setIsUpdating(false);
    }
  }, [record, selectedStaff, assignStaff]);

  /**
   * 担当者クリア
   */
  const handleClearStaff = useCallback(async () => {
    if (!record) return;
    setIsUpdating(true);
    try {
      await assignStaff(record.reservationId, null);
      setSelectedStaff('');
    } finally {
      setIsUpdating(false);
    }
  }, [record, assignStaff]);

  /**
   * 実施状態の手動設定
   */
  const handleSetImplementedManual = useCallback(
    async (value: boolean | null) => {
      if (!record) return;
      setIsUpdating(true);
      try {
        await setIsImplementedManual(record.reservationId, value);
      } finally {
        setIsUpdating(false);
      }
    },
    [record, setIsImplementedManual]
  );

  // ストアからisImplementedManualを取得（即時反映のため）
  const isImplementedManual = useMemo(() => {
    if (!initialRecord) return null;
    const history = histories.get(initialRecord.reservationId);
    return history?.isImplementedManual ?? null;
  }, [initialRecord, histories]);

  if (!record) {
    return null;
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      keepMounted={false}
      disableEnforceFocus
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 } },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* ヘッダー */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'primary.main',
            color: 'white',
          }}
        >
          <Typography variant="h6">予約詳細</Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* コンテンツ */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          {/* 基本情報セクション */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon fontSize="small" />
                基本情報
              </Typography>
            </Box>
            <Divider />
            <List dense disablePadding>
              <ListItem divider>
                <ListItemText
                  primary="名前"
                  secondary={record.name}
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                  secondaryTypographyProps={{ variant: 'body1' }}
                />
              </ListItem>
              <ListItem divider>
                <ListItemText
                  primary="友だちID"
                  secondary={
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {record.friendId}
                    </Typography>
                  }
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
              <ListItem divider>
                <ListItemText
                  primary="予約ID"
                  secondary={
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {record.reservationId || '-'}
                    </Typography>
                  }
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
              <ListItem divider>
                <ListItemText
                  primary="担当者"
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">{record.staff || '-'}</Typography>
                      {record.wasOmakase && <Chip label="おまかせ" size="small" color="warning" variant="outlined" />}
                    </Box>
                  }
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
              {record.course && (
                <ListItem divider>
                  <ListItemText
                    primary="コース"
                    secondary={record.course}
                    primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>
              )}
              {record.reservationSlot && (
                <ListItem>
                  <ListItemText
                    primary="予約枠"
                    secondary={
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                        {record.reservationSlot}
                      </Typography>
                    }
                    primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>

          {/* 担当者割当セクション */}
          <Paper
            variant="outlined"
            sx={{
              mb: 2,
              borderColor: !record.staff ? 'warning.main' : record.wasOmakase ? 'info.main' : 'divider',
            }}
          >
            <Box sx={{ p: 2, bgcolor: !record.staff ? 'warning.50' : record.wasOmakase ? 'info.50' : 'grey.50' }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAddIcon fontSize="small" />
                担当者設定
                {!record.staff && <Chip label="未割当" size="small" color="warning" />}
                {record.wasOmakase && <Chip label="おまかせ" size="small" color="info" variant="outlined" />}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ p: 2 }}>
              {!record.staff && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">担当者が未割当です。担当者を設定してください。</Typography>
                </Alert>
              )}

              {record.staff ? (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    現在の担当者
                  </Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={record.staff} color="success" icon={<PersonIcon />} />
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={handleClearStaff}
                      disabled={isUpdating}
                    >
                      クリア
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  担当者が未割当です
                </Typography>
              )}

              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel>担当者を選択</InputLabel>
                <Select value={selectedStaff} label="担当者を選択" onChange={e => setSelectedStaff(e.target.value)}>
                  {OFFICIAL_STAFF_MEMBERS.map(staff => (
                    <MenuItem key={staff} value={staff}>
                      {staff}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                color={!record.staff ? 'warning' : 'primary'}
                onClick={handleAssignStaff}
                disabled={isUpdating || !selectedStaff}
                startIcon={isUpdating ? <CircularProgress size={16} /> : <PersonAddIcon />}
                fullWidth
                size="small"
              >
                {record.staff ? '担当者を変更' : '担当者を割当'}
              </Button>
            </Box>
          </Paper>

          {/* 日付情報セクション */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventIcon fontSize="small" />
                日付情報
              </Typography>
            </Box>
            <Divider />
            <List dense disablePadding>
              <ListItem divider>
                <ListItemText
                  primary="実施日（予約日）"
                  secondary={record.sessionDateStr}
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                  secondaryTypographyProps={{ variant: 'body1', fontWeight: 'bold' }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="申込日時"
                  secondary={record.applicationDateStr}
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                  secondaryTypographyProps={{ variant: 'body1' }}
                />
              </ListItem>
            </List>
          </Paper>

          {/* ステータス情報セクション */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentIcon fontSize="small" />
                ステータス情報
              </Typography>
            </Box>
            <Divider />
            <List dense disablePadding>
              <ListItem divider>
                <ListItemText
                  primary="予約ステータス"
                  secondary={
                    <Chip
                      icon={record.status === '予約済み' ? <CheckCircleIcon /> : <CancelIcon />}
                      label={record.status}
                      size="small"
                      color={record.status === '予約済み' ? 'primary' : 'error'}
                      variant="outlined"
                    />
                  }
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
              <ListItem divider>
                <ListItemText
                  primary="来店/来場"
                  secondary={
                    <Chip
                      label={record.visitStatus}
                      size="small"
                      color={record.visitStatus === '済み' ? 'success' : 'default'}
                      variant={record.visitStatus === '済み' ? 'filled' : 'outlined'}
                    />
                  }
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
              <ListItem divider>
                <ListItemText
                  primary="実施判定"
                  secondary={
                    <Chip
                      label={record.isImplemented ? '実施済み' : '未実施'}
                      size="small"
                      color={record.isImplemented ? 'success' : 'default'}
                      variant={record.isImplemented ? 'filled' : 'outlined'}
                    />
                  }
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
              {record.detailStatus && (
                <ListItem divider>
                  <ListItemText
                    primary="詳細ステータス"
                    secondary={record.detailStatus}
                    primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>

          {/* 来店回数情報セクション */}
          {record.isImplemented && (
            <Paper variant="outlined" sx={{ mb: 2 }}>
              <Box sx={{ p: 2, bgcolor: 'success.50' }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon fontSize="small" color="success" />
                  来店回数情報
                </Typography>
              </Box>
              <Divider />
              <List dense disablePadding>
                <ListItem divider>
                  <ListItemText
                    primary="来店回数"
                    secondary={
                      <Typography variant="h5" color="primary">
                        {record.visitIndex}回目
                      </Typography>
                    }
                    primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="区分"
                    secondary={
                      <Chip
                        label={record.visitLabel}
                        size="medium"
                        color={
                          record.visitLabel === '初回' ? 'success' : record.visitLabel === '2回目' ? 'info' : 'default'
                        }
                      />
                    }
                    primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                  />
                </ListItem>
              </List>
            </Paper>
          )}

          {/* 詳細ステータス変更セクション */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box sx={{ p: 2, bgcolor: 'info.50' }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SwapHorizIcon fontSize="small" />
                実施判定の手動変更
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  前日/当日キャンセルを設定すると「実施」扱いになります。 変更は監査ログに記録されます。
                </Typography>
              </Alert>

              {/* 現在の状態 */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  現在の詳細ステータス
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={record.detailStatus || '未設定'}
                    size="small"
                    color={
                      record.detailStatus === '前日キャンセル'
                        ? 'warning'
                        : record.detailStatus === '当日キャンセル'
                          ? 'error'
                          : 'default'
                    }
                    variant={record.detailStatus ? 'filled' : 'outlined'}
                  />
                </Box>
              </Box>

              {/* 前日/当日キャンセル設定 */}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                前日/当日キャンセル設定
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                <Button
                  variant={record.detailStatus === '前日キャンセル' ? 'contained' : 'outlined'}
                  color="warning"
                  onClick={() => handleDetailStatusChange('前日キャンセル')}
                  disabled={isUpdating}
                  startIcon={isUpdating ? <CircularProgress size={16} /> : <CancelIcon />}
                  size="small"
                >
                  前日キャンセル（実施扱い）
                </Button>
                <Button
                  variant={record.detailStatus === '当日キャンセル' ? 'contained' : 'outlined'}
                  color="error"
                  onClick={() => handleDetailStatusChange('当日キャンセル')}
                  disabled={isUpdating}
                  startIcon={isUpdating ? <CircularProgress size={16} /> : <CancelIcon />}
                  size="small"
                >
                  当日キャンセル（実施扱い）
                </Button>
                {record.detailStatus && (
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => handleDetailStatusChange(null)}
                    disabled={isUpdating}
                    size="small"
                  >
                    解除（通常に戻す）
                  </Button>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* 手動実施設定 */}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                手動実施設定
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  現在の設定
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={
                      isImplementedManual === null
                        ? '自動判定'
                        : isImplementedManual
                          ? '実施（手動設定）'
                          : '未実施（手動設定）'
                    }
                    size="small"
                    color={isImplementedManual === null ? 'default' : isImplementedManual ? 'success' : 'error'}
                    variant={isImplementedManual === null ? 'outlined' : 'filled'}
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant={isImplementedManual === true ? 'contained' : 'outlined'}
                  color="success"
                  onClick={() => handleSetImplementedManual(true)}
                  disabled={isUpdating}
                  startIcon={isUpdating ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                  size="small"
                >
                  実施として扱う
                </Button>
                <Button
                  variant={isImplementedManual === false ? 'contained' : 'outlined'}
                  color="error"
                  onClick={() => handleSetImplementedManual(false)}
                  disabled={isUpdating}
                  startIcon={isUpdating ? <CircularProgress size={16} /> : <CancelIcon />}
                  size="small"
                >
                  未実施として扱う
                </Button>
                {isImplementedManual !== null && (
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => handleSetImplementedManual(null)}
                    disabled={isUpdating}
                    size="small"
                  >
                    自動判定に戻す
                  </Button>
                )}
              </Box>
            </Box>
          </Paper>

          {/* 集計設定セクション */}
          <Paper
            variant="outlined"
            sx={{
              mb: 2,
              border: record.isExcluded ? '2px solid' : '1px solid',
              borderColor: record.isExcluded ? 'warning.main' : 'divider',
            }}
          >
            <Box
              sx={{
                p: 2,
                bgcolor: record.isExcluded ? 'warning.50' : 'grey.50',
              }}
            >
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BlockIcon fontSize="small" />
                集計設定
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ p: 2 }}>
              <FormControlLabel
                control={<Switch checked={record.isExcluded} onChange={handleExcludedChange} color="warning" />}
                label={
                  <Box>
                    <Typography variant="body2">この予約を集計から除外する</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ONにすると、集計結果に含まれなくなります
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />
              {record.isExcluded && (
                <Chip icon={<BlockIcon />} label="現在除外中" color="warning" size="small" sx={{ mt: 1 }} />
              )}
            </Box>
          </Paper>

          {/* 変更履歴セクション */}
          {auditLogs.length > 0 && (
            <Paper variant="outlined" sx={{ mb: 2 }}>
              <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HistoryIcon fontSize="small" />
                  変更履歴
                  <Chip label={auditLogs.length} size="small" color="primary" />
                </Typography>
              </Box>
              <Divider />
              <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
                {auditLogs.map((log, index) => (
                  <ListItem key={log.id} divider={index < auditLogs.length - 1}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            {FIELD_LABELS[log.field] || log.field}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatValue(log.field, log.oldValue)}
                          </Typography>
                          <Typography variant="caption">→</Typography>
                          <Typography variant="caption" color="primary">
                            {formatValue(log.field, log.newValue)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {log.changedAt.toLocaleString('ja-JP')}
                          {log.changedBy && ` (${log.changedBy})`}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>

        {/* フッター */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            変更は自動的に保存されます
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};
