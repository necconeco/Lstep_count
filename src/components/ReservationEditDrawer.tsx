/**
 * 予約詳細・手動編集ドロワー
 *
 * 機能:
 * - 予約詳細の表示
 * - おまかせ予約への担当者割り当て
 * - 詳細ステータス変更（前日/当日キャンセル）
 * - 実施/キャンセルのトグル
 * - 同日予約の統合
 * - 変更履歴（監査ログ）の表示
 */

import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Stack,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import MergeIcon from '@mui/icons-material/MergeType';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import { useHistoryStore } from '../store/historyStore';
import { useStaffStore } from '../store/staffStore';
import type { ReservationHistory, AuditLog } from '../domain';
import { formatDate, formatDateTime } from '../domain';

// ============================================================================
// 型定義
// ============================================================================

interface ReservationEditDrawerProps {
  open: boolean;
  onClose: () => void;
  reservationId: string | null;
}

// ============================================================================
// コンポーネント
// ============================================================================

export function ReservationEditDrawer({ open, onClose, reservationId }: ReservationEditDrawerProps) {
  const {
    getHistory,
    histories,
    assignStaffToOmakase,
    updateDetailStatus,
    toggleImplementation,
    mergeReservations,
    unmergeReservation,
    getAuditLogsByReservation,
  } = useHistoryStore();

  const { getActiveStaffList } = useStaffStore();

  // 予約データ
  const [reservation, setReservation] = useState<ReservationHistory | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // 編集状態
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [selectedDetailStatus, setSelectedDetailStatus] = useState<string>('');

  // 同日予約リスト
  const [sameDayReservations, setSameDayReservations] = useState<ReservationHistory[]>([]);

  // データ読み込み
  useEffect(() => {
    if (reservationId) {
      const history = getHistory(reservationId);
      setReservation(history || null);

      if (history) {
        setSelectedStaff(history.staff || '');
        setSelectedDetailStatus(history.detailStatus || '');

        // 監査ログを取得
        const logs = getAuditLogsByReservation(reservationId);
        setAuditLogs(logs);

        // 同日の予約を検索
        const sameDayDate = formatDate(history.sessionDate);
        const sameDayList = Array.from(histories.values()).filter(
          h =>
            h.friendId === history.friendId &&
            formatDate(h.sessionDate) === sameDayDate &&
            h.reservationId !== reservationId
        );
        setSameDayReservations(sameDayList);
      }
    } else {
      setReservation(null);
      setAuditLogs([]);
      setSameDayReservations([]);
    }
  }, [reservationId, getHistory, histories, getAuditLogsByReservation]);

  // 担当者割り当て
  const handleAssignStaff = async () => {
    if (!reservationId || !selectedStaff) return;
    await assignStaffToOmakase(reservationId, selectedStaff);
    // データを再読み込み
    const history = getHistory(reservationId);
    setReservation(history || null);
    const logs = getAuditLogsByReservation(reservationId);
    setAuditLogs(logs);
  };

  // 詳細ステータス変更
  const handleUpdateDetailStatus = async () => {
    if (!reservationId) return;
    const status = selectedDetailStatus as '前日キャンセル' | '当日キャンセル' | '' | null;
    await updateDetailStatus(reservationId, status || null);
    // データを再読み込み
    const history = getHistory(reservationId);
    setReservation(history || null);
    const logs = getAuditLogsByReservation(reservationId);
    setAuditLogs(logs);
  };

  // 実施/キャンセルトグル
  const handleToggleImplementation = async () => {
    if (!reservationId) return;
    await toggleImplementation(reservationId);
    // データを再読み込み
    const history = getHistory(reservationId);
    setReservation(history || null);
    const logs = getAuditLogsByReservation(reservationId);
    setAuditLogs(logs);
  };

  // 同日予約と統合
  const handleMergeReservations = async (otherReservationId: string) => {
    if (!reservationId) return;
    await mergeReservations([reservationId, otherReservationId], reservationId);
    // データを再読み込み
    const history = getHistory(reservationId);
    setReservation(history || null);
  };

  // 統合解除
  const handleUnmerge = async () => {
    if (!reservationId) return;
    await unmergeReservation(reservationId);
    // データを再読み込み
    const history = getHistory(reservationId);
    setReservation(history || null);
  };

  // フィールド名を日本語に変換
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      staff: '担当者',
      detailStatus: '詳細ステータス',
      isImplemented: '実施状態',
      groupId: '統合ID',
      isExcluded: '除外フラグ',
    };
    return labels[field] || field;
  };

  // 値を表示用に変換
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(なし)';
    if (typeof value === 'boolean') return value ? 'はい' : 'いいえ';
    return String(value);
  };

  if (!reservation) {
    return (
      <Drawer anchor="right" open={open} onClose={onClose}>
        <Box sx={{ width: 400, p: 3 }}>
          <Typography>予約が見つかりません</Typography>
        </Box>
      </Drawer>
    );
  }

  const activeStaffList = getActiveStaffList();

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 450, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* ヘッダー */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">予約詳細</Typography>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* コンテンツ */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={3}>
            {/* 基本情報 */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  基本情報
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      予約ID
                    </Typography>
                    <Typography variant="body2">{reservation.reservationId}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      名前
                    </Typography>
                    <Typography variant="body2">{reservation.name}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      友だちID
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {reservation.friendId}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      実施日
                    </Typography>
                    <Typography variant="body2">{formatDate(reservation.sessionDate)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      申込日時
                    </Typography>
                    <Typography variant="body2">{formatDateTime(reservation.applicationDate)}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* ステータス */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  ステータス
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={reservation.status}
                    color={reservation.status === '予約済み' ? 'primary' : 'default'}
                    size="small"
                  />
                  <Chip
                    label={`来店: ${reservation.visitStatus}`}
                    color={reservation.visitStatus === '済み' ? 'success' : 'default'}
                    size="small"
                  />
                  <Chip
                    label={reservation.isImplemented ? '実施済み' : '未実施'}
                    color={reservation.isImplemented ? 'success' : 'warning'}
                    size="small"
                    icon={reservation.isImplemented ? <CheckCircleIcon /> : <CancelIcon />}
                  />
                  {reservation.wasOmakase && <Chip label="おまかせ" color="info" size="small" />}
                  {reservation.detailStatus && <Chip label={reservation.detailStatus} color="error" size="small" />}
                  {reservation.groupId && <Chip label="統合済み" color="secondary" size="small" icon={<MergeIcon />} />}
                  {reservation.isExcluded && <Chip label="除外" color="default" size="small" variant="outlined" />}
                </Stack>

                {/* 来店回数 */}
                {reservation.isImplemented && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      来店回数: {reservation.visitIndex}回目 ({reservation.visitLabel})
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Divider />

            {/* 手動編集セクション */}
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon fontSize="small" />
              手動編集
            </Typography>

            {/* 担当者割り当て（おまかせ予約の場合） */}
            {reservation.wasOmakase && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    <PersonIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                    担当者割り当て
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    おまかせ予約に担当者を手動で割り当てます
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="flex-end">
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>担当者</InputLabel>
                      <Select value={selectedStaff} label="担当者" onChange={e => setSelectedStaff(e.target.value)}>
                        <MenuItem value="">
                          <em>未選択</em>
                        </MenuItem>
                        {activeStaffList.map(staff => (
                          <MenuItem key={staff.staffId} value={staff.staffName}>
                            {staff.staffName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleAssignStaff}
                      disabled={!selectedStaff || selectedStaff === reservation.staff}
                    >
                      割り当て
                    </Button>
                  </Stack>
                  {reservation.staff && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      現在の担当者: {reservation.staff}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 詳細ステータス変更 */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  詳細ステータス変更
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  前日/当日キャンセルは実施扱いになります
                </Typography>
                <Stack direction="row" spacing={1} alignItems="flex-end">
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>詳細ステータス</InputLabel>
                    <Select
                      value={selectedDetailStatus}
                      label="詳細ステータス"
                      onChange={e => setSelectedDetailStatus(e.target.value)}
                    >
                      <MenuItem value="">通常</MenuItem>
                      <MenuItem value="前日キャンセル">前日キャンセル</MenuItem>
                      <MenuItem value="当日キャンセル">当日キャンセル</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleUpdateDetailStatus}
                    disabled={selectedDetailStatus === (reservation.detailStatus || '')}
                  >
                    変更
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* 実施/キャンセルトグル */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  実施状態の切り替え
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  実施済み/キャンセルを手動で切り替えます
                </Typography>
                <Button
                  variant="outlined"
                  color={reservation.isImplemented ? 'error' : 'success'}
                  onClick={handleToggleImplementation}
                  startIcon={reservation.isImplemented ? <CancelIcon /> : <CheckCircleIcon />}
                >
                  {reservation.isImplemented ? 'キャンセルに変更' : '実施済みに変更'}
                </Button>
              </CardContent>
            </Card>

            {/* 同日予約の統合 */}
            {sameDayReservations.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    <MergeIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                    同日予約の統合
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    同日の別予約と統合して1件としてカウントします
                  </Typography>
                  <List dense>
                    {sameDayReservations.map(r => (
                      <ListItem
                        key={r.reservationId}
                        secondaryAction={
                          <Tooltip title="この予約と統合">
                            <Button
                              size="small"
                              onClick={() => handleMergeReservations(r.reservationId)}
                              disabled={!!reservation.groupId}
                            >
                              統合
                            </Button>
                          </Tooltip>
                        }
                      >
                        <ListItemText primary={r.reservationId} secondary={`${r.status} / ${r.visitStatus}`} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* 統合解除 */}
            {reservation.groupId && (
              <Alert severity="info" sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  この予約は統合されています (ID: {reservation.groupId})
                </Typography>
                <Button size="small" variant="outlined" onClick={handleUnmerge}>
                  統合を解除
                </Button>
              </Alert>
            )}

            <Divider />

            {/* 変更履歴 */}
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon fontSize="small" />
              変更履歴
            </Typography>

            {auditLogs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                変更履歴がありません
              </Typography>
            ) : (
              <List dense>
                {auditLogs.map(log => (
                  <ListItem key={log.id} sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          {getFieldLabel(log.field)}: {formatValue(log.oldValue)} → {formatValue(log.newValue)}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(log.changedAt)} by {log.changedBy}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
}
