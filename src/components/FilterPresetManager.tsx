/**
 * フィルタプリセット管理コンポーネント
 *
 * - 現在のフィルタ設定をプリセットとして保存
 * - 保存したプリセットの読み込み・削除
 * - プリセット一覧の表示
 */

import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Tooltip,
  Chip,
  Stack,
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import {
  useUiStore,
  PERIOD_PRESET_LABELS,
  DATE_BASE_TYPE_LABELS,
  type FilterPreset,
} from '../store/uiStore';

// ============================================================================
// 型定義
// ============================================================================

interface FilterPresetManagerProps {
  /** コンパクト表示（アイコンのみ） */
  compact?: boolean;
}

// ============================================================================
// ユーティリティ
// ============================================================================

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatPresetDescription(preset: FilterPreset): string {
  const parts: string[] = [];
  parts.push(DATE_BASE_TYPE_LABELS[preset.dateBaseType]);
  parts.push(PERIOD_PRESET_LABELS[preset.periodPreset]);

  if (preset.periodPreset === 'custom' && (preset.periodFrom || preset.periodTo)) {
    parts.push(`(${formatDate(preset.periodFrom)}〜${formatDate(preset.periodTo)})`);
  }

  return parts.join(' / ');
}

// ============================================================================
// コンポーネント
// ============================================================================

export function FilterPresetManager({ compact = false }: FilterPresetManagerProps) {
  const {
    filterPresets,
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    renameFilterPreset,
  } = useUiStore();

  // メニュー状態
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  // 保存ダイアログ
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // 編集状態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // メニューハンドラ
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setEditingId(null);
  }, []);

  // 保存ダイアログ
  const handleOpenSaveDialog = useCallback(() => {
    setNewPresetName(`プリセット ${filterPresets.length + 1}`);
    setSaveDialogOpen(true);
  }, [filterPresets.length]);

  const handleCloseSaveDialog = useCallback(() => {
    setSaveDialogOpen(false);
    setNewPresetName('');
  }, []);

  const handleSave = useCallback(() => {
    if (newPresetName.trim()) {
      saveFilterPreset(newPresetName.trim());
      handleCloseSaveDialog();
    }
  }, [newPresetName, saveFilterPreset, handleCloseSaveDialog]);

  // プリセット読み込み
  const handleLoad = useCallback(
    (presetId: string) => {
      loadFilterPreset(presetId);
      handleMenuClose();
    },
    [loadFilterPreset, handleMenuClose]
  );

  // プリセット削除
  const handleDelete = useCallback(
    (presetId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      deleteFilterPreset(presetId);
    },
    [deleteFilterPreset]
  );

  // 編集開始
  const handleStartEdit = useCallback(
    (preset: FilterPreset, event: React.MouseEvent) => {
      event.stopPropagation();
      setEditingId(preset.id);
      setEditingName(preset.name);
    },
    []
  );

  // 編集確定
  const handleConfirmEdit = useCallback(
    (presetId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      if (editingName.trim()) {
        renameFilterPreset(presetId, editingName.trim());
      }
      setEditingId(null);
    },
    [editingName, renameFilterPreset]
  );

  return (
    <>
      {/* トリガーボタン */}
      {compact ? (
        <Tooltip title="フィルタプリセット">
          <IconButton onClick={handleMenuOpen} size="small">
            <BookmarkIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          variant="outlined"
          startIcon={<BookmarkIcon />}
          onClick={handleMenuOpen}
          size="small"
        >
          プリセット
          {filterPresets.length > 0 && (
            <Chip
              label={filterPresets.length}
              size="small"
              sx={{ ml: 1, height: 20, minWidth: 20 }}
            />
          )}
        </Button>
      )}

      {/* プリセットメニュー */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 280, maxWidth: 400 } }}
      >
        {/* 新規保存 */}
        <MenuItem onClick={handleOpenSaveDialog}>
          <ListItemIcon>
            <BookmarkAddIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary="現在のフィルタを保存" />
        </MenuItem>

        {filterPresets.length > 0 && <Divider />}

        {/* プリセット一覧 */}
        {filterPresets.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              保存済みプリセットはありません
            </Typography>
          </MenuItem>
        ) : (
          filterPresets.map(preset => (
            <MenuItem
              key={preset.id}
              onClick={() => handleLoad(preset.id)}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <BookmarkIcon fontSize="small" />
              </ListItemIcon>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {editingId === preset.id ? (
                  <TextField
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleConfirmEdit(preset.id, e as unknown as React.MouseEvent);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    size="small"
                    autoFocus
                    fullWidth
                    sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
                  />
                ) : (
                  <>
                    <Typography variant="body1" noWrap>
                      {preset.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {formatPresetDescription(preset)}
                    </Typography>
                  </>
                )}
              </Box>
              <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
                {editingId === preset.id ? (
                  <IconButton
                    size="small"
                    onClick={e => handleConfirmEdit(preset.id, e)}
                    color="primary"
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                ) : (
                  <IconButton
                    size="small"
                    onClick={e => handleStartEdit(preset, e)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  onClick={e => handleDelete(preset.id, e)}
                  color="error"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </MenuItem>
          ))
        )}
      </Menu>

      {/* 保存ダイアログ */}
      <Dialog open={saveDialogOpen} onClose={handleCloseSaveDialog} maxWidth="xs" fullWidth>
        <DialogTitle>フィルタプリセットを保存</DialogTitle>
        <DialogContent>
          <TextField
            label="プリセット名"
            value={newPresetName}
            onChange={e => setNewPresetName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave();
            }}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            現在のフィルタ設定（基準日、期間、実施判定ルールなど）を保存します。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSaveDialog}>キャンセル</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!newPresetName.trim()}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
