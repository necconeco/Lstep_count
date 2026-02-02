/**
 * 監査ログ閲覧コンポーネント
 *
 * 機能:
 * - 変更履歴の一覧表示
 * - フィルタリング（期間、フィールド）
 * - ページネーション
 */

import { useState, useEffect, useMemo } from 'react';
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
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useHistoryStore } from '../store/historyStore';
// Domain層からは公開API（index.ts）経由でインポート
import { formatDateTime } from '../domain';

// ============================================================================
// 型定義
// ============================================================================

interface AuditLogViewerProps {
  onOpenReservation?: (reservationId: string) => void;
}

// ============================================================================
// コンポーネント
// ============================================================================

export function AuditLogViewer({ onOpenReservation }: AuditLogViewerProps) {
  const { auditLogs, loadAuditLogs } = useHistoryStore();

  // フィルタ状態
  const [fieldFilter, setFieldFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  // ページネーション
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // 初期化
  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // フィールドの一覧を取得
  const uniqueFields = useMemo(() => {
    const fields = new Set(auditLogs.map(log => log.field));
    return Array.from(fields).sort();
  }, [auditLogs]);

  // フィルタリング
  const filteredLogs = useMemo(() => {
    return auditLogs
      .filter(log => {
        // フィールドフィルタ
        if (fieldFilter && log.field !== fieldFilter) return false;

        // テキスト検索
        if (searchText) {
          const searchLower = searchText.toLowerCase();
          const matchesReservationId = log.reservationId.toLowerCase().includes(searchLower);
          const matchesChangedBy = log.changedBy.toLowerCase().includes(searchLower);
          const matchesOldValue = String(log.oldValue).toLowerCase().includes(searchLower);
          const matchesNewValue = String(log.newValue).toLowerCase().includes(searchLower);
          if (!matchesReservationId && !matchesChangedBy && !matchesOldValue && !matchesNewValue) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
  }, [auditLogs, fieldFilter, searchText]);

  // ページネーション対象のログ
  const paginatedLogs = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredLogs.slice(start, start + rowsPerPage);
  }, [filteredLogs, page, rowsPerPage]);

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
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'はい' : 'いいえ';
    return String(value);
  };

  // フィールドに応じた色
  const getFieldColor = (
    field: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
      staff: 'primary',
      detailStatus: 'warning',
      isImplemented: 'success',
      groupId: 'secondary',
      isExcluded: 'error',
    };
    return colors[field] || 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h5" component="h2">
              変更履歴（監査ログ）
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            予約データへの手動変更の履歴を確認できます。
          </Typography>

          {/* フィルタ */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <TextField
              size="small"
              label="検索"
              placeholder="予約ID、変更者など"
              value={searchText}
              onChange={e => {
                setSearchText(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>フィールド</InputLabel>
              <Select
                value={fieldFilter}
                label="フィールド"
                onChange={e => {
                  setFieldFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">すべて</MenuItem>
                {uniqueFields.map(field => (
                  <MenuItem key={field} value={field}>
                    {getFieldLabel(field)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* 件数表示 */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {filteredLogs.length}件の変更履歴
          </Typography>

          {/* テーブル */}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>日時</TableCell>
                  <TableCell>予約ID</TableCell>
                  <TableCell>フィールド</TableCell>
                  <TableCell>変更前</TableCell>
                  <TableCell>変更後</TableCell>
                  <TableCell>変更者</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        変更履歴がありません
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map(log => (
                    <TableRow key={log.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(log.changedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {log.reservationId.length > 15
                            ? `${log.reservationId.substring(0, 15)}...`
                            : log.reservationId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={getFieldLabel(log.field)} size="small" color={getFieldColor(log.field)} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatValue(log.oldValue)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatValue(log.newValue)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{log.changedBy}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        {onOpenReservation && (
                          <Tooltip title="予約詳細を開く">
                            <IconButton size="small" onClick={() => onOpenReservation(log.reservationId)}>
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ページネーション */}
          <TablePagination
            component="div"
            count={filteredLogs.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="表示件数:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
