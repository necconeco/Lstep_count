/**
 * スナップショット管理コンポーネント
 *
 * 機能:
 * - スナップショット一覧表示
 * - フォルダ管理
 * - ピン留め
 * - 削除・名前変更
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Collapse,
  Alert,
  Snackbar,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DescriptionIcon from '@mui/icons-material/Description';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSnapshotStore } from '../store/snapshotStore';
import type { AggregationSnapshot, SnapshotFolder } from '../domain/types';
import { formatDate } from '../domain/logic';

// ============================================================================
// 型定義
// ============================================================================

interface SnapshotManagerProps {
  onSelectSnapshot?: (snapshot: AggregationSnapshot) => void;
}

// ============================================================================
// コンポーネント
// ============================================================================

export function SnapshotManager({ onSelectSnapshot }: SnapshotManagerProps) {
  const {
    snapshots,
    folders,
    isLoading,
    error,
    initialize,
    deleteSnapshot,
    updateSnapshotLabel,
    togglePin,
    moveToFolder,
    createFolder,
    deleteFolder,
    renameFolder,
    clearError,
  } = useSnapshotStore();

  // 状態
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['pinned']));
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; snapshot: AggregationSnapshot } | null>(null);
  const [folderMenuAnchor, setFolderMenuAnchor] = useState<{ el: HTMLElement; folder: SnapshotFolder } | null>(null);

  // ダイアログ
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; snapshot: AggregationSnapshot | null; newLabel: string }>({
    open: false,
    snapshot: null,
    newLabel: '',
  });
  const [newFolderDialog, setNewFolderDialog] = useState<{ open: boolean; name: string }>({
    open: false,
    name: '',
  });
  const [moveFolderDialog, setMoveFolderDialog] = useState<{ open: boolean; snapshot: AggregationSnapshot | null }>({
    open: false,
    snapshot: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; snapshot: AggregationSnapshot | null }>({
    open: false,
    snapshot: null,
  });
  const [renameFolderDialog, setRenameFolderDialog] = useState<{ open: boolean; folder: SnapshotFolder | null; newName: string }>({
    open: false,
    folder: null,
    newName: '',
  });

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

  // ピン留めされたスナップショット
  const pinnedSnapshots = useMemo(() => {
    return snapshots.filter((s) => s.isPinned);
  }, [snapshots]);

  // 未分類のスナップショット
  const uncategorizedSnapshots = useMemo(() => {
    return snapshots.filter((s) => !s.isPinned && !s.folderName);
  }, [snapshots]);

  // フォルダの展開トグル
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // スナップショットのタイプラベル
  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      monthly: '月次',
      campaign: 'キャンペーン',
      custom: 'カスタム',
    };
    return labels[type] || type;
  };

  // スナップショット項目をレンダリング
  const renderSnapshotItem = (snapshot: AggregationSnapshot) => (
    <ListItem
      key={snapshot.id}
      disablePadding
      secondaryAction={
        <Stack direction="row" spacing={0}>
          <Tooltip title={snapshot.isPinned ? 'ピン解除' : 'ピン留め'}>
            <IconButton size="small" onClick={() => togglePin(snapshot.id)}>
              {snapshot.isPinned ? <PushPinIcon fontSize="small" color="primary" /> : <PushPinOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor({ el: e.currentTarget, snapshot })}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
    >
      <ListItemButton
        onClick={() => onSelectSnapshot?.(snapshot)}
        sx={{ pr: 10 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <DescriptionIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                {snapshot.label}
              </Typography>
              <Chip label={getTypeLabel(snapshot.type)} size="small" variant="outlined" />
            </Stack>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {formatDate(snapshot.periodFrom)} 〜 {formatDate(snapshot.periodTo)}
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  );

  // 名前変更処理
  const handleRename = async () => {
    if (renameDialog.snapshot && renameDialog.newLabel.trim()) {
      await updateSnapshotLabel(renameDialog.snapshot.id, renameDialog.newLabel.trim());
      setSnackbar({ open: true, message: '名前を変更しました', severity: 'success' });
    }
    setRenameDialog({ open: false, snapshot: null, newLabel: '' });
  };

  // 削除処理
  const handleDelete = async () => {
    if (deleteConfirm.snapshot) {
      await deleteSnapshot(deleteConfirm.snapshot.id);
      setSnackbar({ open: true, message: 'スナップショットを削除しました', severity: 'success' });
    }
    setDeleteConfirm({ open: false, snapshot: null });
  };

  // フォルダ移動処理
  const handleMoveToFolder = async (folderName: string | null) => {
    if (moveFolderDialog.snapshot) {
      await moveToFolder(moveFolderDialog.snapshot.id, folderName);
      setSnackbar({ open: true, message: 'フォルダに移動しました', severity: 'success' });
    }
    setMoveFolderDialog({ open: false, snapshot: null });
  };

  // 新規フォルダ作成
  const handleCreateFolder = async () => {
    if (newFolderDialog.name.trim()) {
      await createFolder(newFolderDialog.name.trim());
      setSnackbar({ open: true, message: 'フォルダを作成しました', severity: 'success' });
    }
    setNewFolderDialog({ open: false, name: '' });
  };

  // フォルダ名変更
  const handleRenameFolder = async () => {
    if (renameFolderDialog.folder && renameFolderDialog.newName.trim()) {
      await renameFolder(renameFolderDialog.folder.folderName, renameFolderDialog.newName.trim());
      setSnackbar({ open: true, message: 'フォルダ名を変更しました', severity: 'success' });
    }
    setRenameFolderDialog({ open: false, folder: null, newName: '' });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CameraAltIcon color="primary" />
              <Typography variant="h5" component="h2">
                スナップショット管理
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<CreateNewFolderIcon />}
              onClick={() => setNewFolderDialog({ open: true, name: '' })}
            >
              フォルダ作成
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            確定した集計結果をスナップショットとして保存・管理できます。
          </Typography>

          {isLoading ? (
            <Typography>読み込み中...</Typography>
          ) : snapshots.length === 0 ? (
            <Alert severity="info">
              スナップショットがありません。集計画面から「スナップショット保存」を実行してください。
            </Alert>
          ) : (
            <List dense>
              {/* ピン留め */}
              {pinnedSnapshots.length > 0 && (
                <>
                  <ListItemButton onClick={() => toggleFolder('pinned')}>
                    <ListItemIcon>
                      <PushPinIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={`ピン留め (${pinnedSnapshots.length})`} />
                    {expandedFolders.has('pinned') ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </ListItemButton>
                  <Collapse in={expandedFolders.has('pinned')}>
                    <List dense sx={{ pl: 2 }}>
                      {pinnedSnapshots.map(renderSnapshotItem)}
                    </List>
                  </Collapse>
                  <Divider />
                </>
              )}

              {/* フォルダ */}
              {folders.map((folder) => {
                const folderSnapshots = snapshots.filter(
                  (s) => s.folderName === folder.folderName && !s.isPinned
                );
                return (
                  <Box key={folder.folderName}>
                    <ListItemButton
                      onClick={() => toggleFolder(folder.folderName)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setFolderMenuAnchor({ el: e.currentTarget as HTMLElement, folder });
                      }}
                    >
                      <ListItemIcon>
                        {expandedFolders.has(folder.folderName) ? (
                          <FolderOpenIcon color="primary" />
                        ) : (
                          <FolderIcon color="primary" />
                        )}
                      </ListItemIcon>
                      <ListItemText primary={`${folder.folderName} (${folderSnapshots.length})`} />
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderMenuAnchor({ el: e.currentTarget, folder });
                        }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                      {expandedFolders.has(folder.folderName) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItemButton>
                    <Collapse in={expandedFolders.has(folder.folderName)}>
                      <List dense sx={{ pl: 2 }}>
                        {folderSnapshots.length === 0 ? (
                          <ListItem>
                            <ListItemText
                              secondary={
                                <Typography variant="body2" color="text.secondary">
                                  空のフォルダ
                                </Typography>
                              }
                            />
                          </ListItem>
                        ) : (
                          folderSnapshots.map(renderSnapshotItem)
                        )}
                      </List>
                    </Collapse>
                    <Divider />
                  </Box>
                );
              })}

              {/* 未分類 */}
              {uncategorizedSnapshots.length > 0 && (
                <>
                  <ListItemButton onClick={() => toggleFolder('uncategorized')}>
                    <ListItemIcon>
                      <FolderIcon color="action" />
                    </ListItemIcon>
                    <ListItemText primary={`未分類 (${uncategorizedSnapshots.length})`} />
                    {expandedFolders.has('uncategorized') ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </ListItemButton>
                  <Collapse in={expandedFolders.has('uncategorized')}>
                    <List dense sx={{ pl: 2 }}>
                      {uncategorizedSnapshots.map(renderSnapshotItem)}
                    </List>
                  </Collapse>
                </>
              )}
            </List>
          )}
        </CardContent>
      </Card>

      {/* スナップショットメニュー */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              setRenameDialog({
                open: true,
                snapshot: menuAnchor.snapshot,
                newLabel: menuAnchor.snapshot.label,
              });
            }
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          名前を変更
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              setMoveFolderDialog({ open: true, snapshot: menuAnchor.snapshot });
            }
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <DriveFileMoveIcon fontSize="small" />
          </ListItemIcon>
          フォルダに移動
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              setDeleteConfirm({ open: true, snapshot: menuAnchor.snapshot });
            }
            setMenuAnchor(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          削除
        </MenuItem>
      </Menu>

      {/* フォルダメニュー */}
      <Menu
        anchorEl={folderMenuAnchor?.el}
        open={Boolean(folderMenuAnchor)}
        onClose={() => setFolderMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (folderMenuAnchor) {
              setRenameFolderDialog({
                open: true,
                folder: folderMenuAnchor.folder,
                newName: folderMenuAnchor.folder.folderName,
              });
            }
            setFolderMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          名前を変更
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (folderMenuAnchor) {
              deleteFolder(folderMenuAnchor.folder.folderName);
              setSnackbar({ open: true, message: 'フォルダを削除しました', severity: 'success' });
            }
            setFolderMenuAnchor(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          削除
        </MenuItem>
      </Menu>

      {/* 名前変更ダイアログ */}
      <Dialog open={renameDialog.open} onClose={() => setRenameDialog({ open: false, snapshot: null, newLabel: '' })}>
        <DialogTitle>スナップショット名を変更</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="新しい名前"
            value={renameDialog.newLabel}
            onChange={(e) => setRenameDialog({ ...renameDialog, newLabel: e.target.value })}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialog({ open: false, snapshot: null, newLabel: '' })}>
            キャンセル
          </Button>
          <Button variant="contained" onClick={handleRename}>
            変更
          </Button>
        </DialogActions>
      </Dialog>

      {/* 新規フォルダダイアログ */}
      <Dialog open={newFolderDialog.open} onClose={() => setNewFolderDialog({ open: false, name: '' })}>
        <DialogTitle>新規フォルダ</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="フォルダ名"
            value={newFolderDialog.name}
            onChange={(e) => setNewFolderDialog({ ...newFolderDialog, name: e.target.value })}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialog({ open: false, name: '' })}>
            キャンセル
          </Button>
          <Button variant="contained" onClick={handleCreateFolder}>
            作成
          </Button>
        </DialogActions>
      </Dialog>

      {/* フォルダ移動ダイアログ */}
      <Dialog open={moveFolderDialog.open} onClose={() => setMoveFolderDialog({ open: false, snapshot: null })}>
        <DialogTitle>フォルダに移動</DialogTitle>
        <DialogContent>
          <List>
            <ListItemButton onClick={() => handleMoveToFolder(null)}>
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText primary="未分類" />
            </ListItemButton>
            {folders.map((folder) => (
              <ListItemButton
                key={folder.folderName}
                onClick={() => handleMoveToFolder(folder.folderName)}
              >
                <ListItemIcon>
                  <FolderIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary={folder.folderName} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveFolderDialog({ open: false, snapshot: null })}>
            キャンセル
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, snapshot: null })}>
        <DialogTitle>スナップショットの削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{deleteConfirm.snapshot?.label}」を削除しますか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, snapshot: null })}>
            キャンセル
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* フォルダ名変更ダイアログ */}
      <Dialog open={renameFolderDialog.open} onClose={() => setRenameFolderDialog({ open: false, folder: null, newName: '' })}>
        <DialogTitle>フォルダ名を変更</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="新しい名前"
            value={renameFolderDialog.newName}
            onChange={(e) => setRenameFolderDialog({ ...renameFolderDialog, newName: e.target.value })}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameFolderDialog({ open: false, folder: null, newName: '' })}>
            キャンセル
          </Button>
          <Button variant="contained" onClick={handleRenameFolder}>
            変更
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
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
