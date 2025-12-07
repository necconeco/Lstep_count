/**
 * ユーザー詳細履歴ドロワーコンポーネント
 *
 * ユーザー別集計の行クリック時に表示
 * - ユーザー基本情報
 * - 来店履歴一覧
 */

import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import type { ReservationHistory } from '../domain/types';

interface UserAggregationResult {
  friendId: string;
  name: string;
  totalCount: number;
  implementedCount: number;
  cancelCount: number;
  previousDayCancelCount: number;
  sameDayCancelCount: number;
  firstVisitCount: number;
  secondVisitCount: number;
  thirdOrMoreCount: number;
  cumulativeVisitCount: number;
  firstVisitDate: Date | null;
  lastVisitDate: Date | null;
  implementationRate: number;
  histories: ReservationHistory[];
}

interface UserDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  user: UserAggregationResult | null;
}

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function UserDetailDrawer({ open, onClose, user }: UserDetailDrawerProps) {
  if (!user) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 600 },
          maxWidth: '100%',
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="h5" component="h2">
                {user.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                {user.friendId}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* サマリー情報 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            サマリー
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Chip label={`予約: ${user.totalCount}件`} size="small" variant="outlined" />
            <Chip label={`実施: ${user.implementedCount}件`} size="small" color="success" variant="outlined" />
            <Chip label={`キャンセル: ${user.cancelCount}件`} size="small" color="error" variant="outlined" />
            <Chip label={`実施率: ${user.implementationRate}%`} size="small" color="primary" variant="outlined" />
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Chip
              label={`累計来店: ${user.cumulativeVisitCount}回`}
              size="small"
              color={
                user.cumulativeVisitCount >= 3 ? 'success' : user.cumulativeVisitCount >= 2 ? 'primary' : 'default'
              }
            />
            <Chip label={`初回: ${user.firstVisitCount}件`} size="small" variant="outlined" />
            <Chip label={`2回目: ${user.secondVisitCount}件`} size="small" variant="outlined" />
            <Chip label={`3回目〜: ${user.thirdOrMoreCount}件`} size="small" variant="outlined" />
          </Stack>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                初回来店日
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {formatDate(user.firstVisitDate)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                最終来店日
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {formatDate(user.lastVisitDate)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* 来店履歴一覧 */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          来店履歴 ({user.histories.length}件)
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>実施日</TableCell>
                <TableCell>申込日時</TableCell>
                <TableCell>コース</TableCell>
                <TableCell>担当者</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell align="center">回数</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {user.histories.map((history, index) => (
                <TableRow
                  key={`${history.reservationId}-${index}`}
                  sx={{
                    backgroundColor:
                      history.status === 'キャンセル済み'
                        ? 'rgba(211, 47, 47, 0.04)'
                        : history.isImplemented
                          ? 'rgba(46, 125, 50, 0.04)'
                          : 'inherit',
                  }}
                >
                  <TableCell>
                    <Typography variant="body2">{formatDate(history.sessionDate)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontSize="0.75rem" color="text.secondary">
                      {formatDateTime(history.applicationDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontSize="0.75rem">
                      {history.course || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontSize="0.75rem">
                      {history.staff || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {history.status === 'キャンセル済み' ? (
                      <Chip
                        label={
                          history.detailStatus === '当日キャンセル'
                            ? '当日C'
                            : history.detailStatus === '前日キャンセル'
                              ? '前日C'
                              : 'キャンセル'
                        }
                        size="small"
                        color={
                          history.detailStatus === '当日キャンセル'
                            ? 'error'
                            : history.detailStatus === '前日キャンセル'
                              ? 'warning'
                              : 'default'
                        }
                        variant="outlined"
                      />
                    ) : history.isImplemented ? (
                      <Chip label="実施済" size="small" color="success" />
                    ) : (
                      <Chip label="予約" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {history.isImplemented && (
                      <Chip
                        label={
                          history.visitIndex === 1
                            ? '初回'
                            : history.visitIndex === 2
                              ? '2回目'
                              : `${history.visitIndex}回目`
                        }
                        size="small"
                        color={
                          history.visitIndex === 1 ? 'primary' : history.visitIndex === 2 ? 'secondary' : 'default'
                        }
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {user.histories.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">履歴がありません</Typography>
          </Paper>
        )}
      </Box>
    </Drawer>
  );
}
