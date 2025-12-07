/**
 * 担当者マスター管理コンポーネント
 *
 * 機能:
 * - 担当者一覧表示
 * - 担当者の追加・編集・削除
 * - CSVからの自動抽出
 * - エイリアス管理
 */

import { useState, useEffect } from 'react';
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
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import { useStaffStore } from '../store/staffStore';
import type { StaffMaster } from '../domain/types';

// ============================================================================
// 型定義
// ============================================================================

interface StaffFormData {
  staffName: string;
  aliases: string[];
  isActive: boolean;
  sortOrder: number;
}

// ============================================================================
// コンポーネント
// ============================================================================

export function StaffMasterManager() {
  const { staffList, isLoading, error, initialize, addStaff, updateStaff, deleteStaff, clearError } = useStaffStore();

  // ダイアログ状態
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMaster | null>(null);
  const [formData, setFormData] = useState<StaffFormData>({
    staffName: '',
    aliases: [],
    isActive: true,
    sortOrder: 0,
  });
  const [aliasInput, setAliasInput] = useState('');

  // 削除確認ダイアログ
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMaster | null>(null);

  // スナックバー
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // 初期化
  useEffect(() => {
    initialize();
  }, [initialize]);

  // エラー処理
  useEffect(() => {
    if (error) {
      setSnackbar({ open: true, message: error, severity: 'error' });
      clearError();
    }
  }, [error, clearError]);

  // ダイアログを開く（新規）
  const handleOpenAddDialog = () => {
    setEditingStaff(null);
    setFormData({
      staffName: '',
      aliases: [],
      isActive: true,
      sortOrder: staffList.length,
    });
    setAliasInput('');
    setIsDialogOpen(true);
  };

  // ダイアログを開く（編集）
  const handleOpenEditDialog = (staff: StaffMaster) => {
    setEditingStaff(staff);
    setFormData({
      staffName: staff.staffName,
      aliases: [...staff.aliases],
      isActive: staff.isActive,
      sortOrder: staff.sortOrder,
    });
    setAliasInput('');
    setIsDialogOpen(true);
  };

  // ダイアログを閉じる
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStaff(null);
  };

  // エイリアス追加
  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !formData.aliases.includes(trimmed)) {
      setFormData({
        ...formData,
        aliases: [...formData.aliases, trimmed],
      });
      setAliasInput('');
    }
  };

  // エイリアス削除
  const handleRemoveAlias = (alias: string) => {
    setFormData({
      ...formData,
      aliases: formData.aliases.filter(a => a !== alias),
    });
  };

  // 保存処理
  const handleSave = async () => {
    if (!formData.staffName.trim()) {
      setSnackbar({ open: true, message: '担当者名を入力してください', severity: 'error' });
      return;
    }

    if (editingStaff) {
      // 更新
      await updateStaff(editingStaff.staffId, {
        staffName: formData.staffName.trim(),
        aliases: formData.aliases,
        isActive: formData.isActive,
        sortOrder: formData.sortOrder,
      });
      setSnackbar({ open: true, message: '担当者を更新しました', severity: 'success' });
    } else {
      // 新規追加
      await addStaff({
        staffName: formData.staffName.trim(),
        aliases: formData.aliases,
        isActive: formData.isActive,
        sortOrder: formData.sortOrder,
      });
      setSnackbar({ open: true, message: '担当者を追加しました', severity: 'success' });
    }

    handleCloseDialog();
  };

  // 削除確認ダイアログを開く
  const handleOpenDeleteConfirm = (staff: StaffMaster) => {
    setStaffToDelete(staff);
    setDeleteConfirmOpen(true);
  };

  // 削除実行
  const handleDelete = async () => {
    if (staffToDelete) {
      await deleteStaff(staffToDelete.staffId);
      setSnackbar({ open: true, message: '担当者を削除しました', severity: 'success' });
    }
    setDeleteConfirmOpen(false);
    setStaffToDelete(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" />
              <Typography variant="h5" component="h2">
                担当者マスター管理
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddDialog}>
              担当者を追加
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            担当者マスターを管理します。CSVから自動抽出された担当者と、手動で追加した担当者の両方を管理できます。
            エイリアス（別名）を設定すると、異なる表記を同一人物として扱えます。
          </Typography>

          {isLoading ? (
            <Typography>読み込み中...</Typography>
          ) : staffList.length === 0 ? (
            <Alert severity="info">
              担当者が登録されていません。「担当者を追加」ボタンから追加するか、CSVをインポートして自動抽出してください。
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>No.</TableCell>
                    <TableCell>担当者名</TableCell>
                    <TableCell>エイリアス（別名）</TableCell>
                    <TableCell align="center">ステータス</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {staffList.map((staff, index) => (
                    <TableRow key={staff.staffId} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">{staff.staffName}</Typography>
                      </TableCell>
                      <TableCell>
                        {staff.aliases.length > 0 ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {staff.aliases.map(alias => (
                              <Chip key={alias} label={alias} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        ) : (
                          <Typography color="text.secondary" variant="body2">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={staff.isActive ? '有効' : '無効'}
                          color={staff.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="編集">
                          <IconButton size="small" onClick={() => handleOpenEditDialog(staff)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="削除">
                          <IconButton size="small" color="error" onClick={() => handleOpenDeleteConfirm(staff)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* 追加/編集ダイアログ */}
      <Dialog open={isDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingStaff ? '担当者を編集' : '担当者を追加'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="担当者名"
              value={formData.staffName}
              onChange={e => setFormData({ ...formData, staffName: e.target.value })}
              fullWidth
              required
              autoFocus
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                エイリアス（別名）
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                CSVで異なる表記（例：「田中」と「田中さん」）を同一人物として扱いたい場合に設定します。
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  placeholder="エイリアスを入力"
                  value={aliasInput}
                  onChange={e => setAliasInput(e.target.value)}
                  onKeyPress={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAlias();
                    }
                  }}
                  sx={{ flex: 1 }}
                />
                <Button variant="outlined" onClick={handleAddAlias}>
                  追加
                </Button>
              </Box>
              {formData.aliases.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {formData.aliases.map(alias => (
                    <Chip key={alias} label={alias} onDelete={() => handleRemoveAlias(alias)} size="small" />
                  ))}
                </Stack>
              )}
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                />
              }
              label="有効（無効にすると集計・選択肢から除外されます）"
            />

            <TextField
              label="表示順"
              type="number"
              value={formData.sortOrder}
              onChange={e => setFormData({ ...formData, sortOrder: parseInt(e.target.value, 10) || 0 })}
              fullWidth
              helperText="数値が小さいほど上に表示されます"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingStaff ? '更新' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>担当者の削除</DialogTitle>
        <DialogContent>
          <Typography>担当者「{staffToDelete?.staffName}」を削除しますか？</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            この操作は取り消せません。既存の予約データには影響しません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>キャンセル</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
