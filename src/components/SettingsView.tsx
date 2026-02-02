/**
 * 設定ページコンポーネント
 *
 * 機能:
 * - 全データクリア
 * - アプリ情報表示
 */
import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  DeleteForever as DeleteIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';

export const SettingsView = () => {
  const { clearAllData, histories, userCounts, campaigns } = useHistoryStore();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const handleClearClick = useCallback(() => {
    setConfirmDialogOpen(true);
  }, []);

  const handleConfirmClear = useCallback(async () => {
    setIsClearing(true);
    try {
      await clearAllData();
      setClearSuccess(true);
      setConfirmDialogOpen(false);
      // 3秒後に成功メッセージを消す
      setTimeout(() => setClearSuccess(false), 3000);
    } catch (error) {
      console.error('データクリアに失敗しました:', error);
    } finally {
      setIsClearing(false);
    }
  }, [clearAllData]);

  const handleCancelClear = useCallback(() => {
    setConfirmDialogOpen(false);
  }, []);

  // データ統計
  const dataStats = {
    histories: histories.size,
    userCounts: userCounts.size,
    campaigns: campaigns.length,
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <SettingsIcon color="primary" />
        設定
      </Typography>

      {clearSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          全てのデータをクリアしました。CSVを再アップロードしてください。
        </Alert>
      )}

      {/* データ管理セクション */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <StorageIcon />
          データ管理
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          現在のデータ状況
        </Alert>

        <List dense>
          <ListItem>
            <ListItemIcon>
              <InfoIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="履歴データ"
              secondary={`${dataStats.histories.toLocaleString()} 件`}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <InfoIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="ユーザーカウント"
              secondary={`${dataStats.userCounts.toLocaleString()} 件`}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <InfoIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="キャンペーン"
              secondary={`${dataStats.campaigns.toLocaleString()} 件`}
            />
          </ListItem>
        </List>

        <Divider sx={{ my: 2 }} />

        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>全データクリア</strong>について：
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            この操作は、IndexedDBに保存されている全てのデータ（履歴、ユーザーカウント、キャンペーン、監査ログなど）を削除します。
            削除後は復元できません。
          </Typography>
        </Alert>

        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleClearClick}
          disabled={isClearing || dataStats.histories === 0}
        >
          {isClearing ? 'クリア中...' : '全データをクリア'}
        </Button>

        {dataStats.histories === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
            クリアするデータがありません
          </Typography>
        )}
      </Paper>

      {/* アプリ情報セクション */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <InfoIcon />
          アプリ情報
        </Typography>

        <List dense>
          <ListItem>
            <ListItemText primary="バージョン" secondary="v3.0 新設計版" />
          </ListItem>
          <ListItem>
            <ListItemText primary="データベース" secondary="IndexedDB (lstep-aggregation-v3)" />
          </ListItem>
        </List>
      </Paper>

      {/* 確認ダイアログ */}
      <Dialog open={confirmDialogOpen} onClose={handleCancelClear}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          全データをクリアしますか？
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            この操作は取り消せません。以下のデータが全て削除されます：
          </DialogContentText>
          <List dense sx={{ mt: 1 }}>
            <ListItem>
              <ListItemText primary={`履歴データ: ${dataStats.histories.toLocaleString()} 件`} />
            </ListItem>
            <ListItem>
              <ListItemText primary={`ユーザーカウント: ${dataStats.userCounts.toLocaleString()} 件`} />
            </ListItem>
            <ListItem>
              <ListItemText primary={`キャンペーン: ${dataStats.campaigns.toLocaleString()} 件`} />
            </ListItem>
          </List>
          <DialogContentText sx={{ mt: 2, fontWeight: 'bold', color: 'error.main' }}>
            削除後はCSVを再度アップロードする必要があります。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelClear} disabled={isClearing}>
            キャンセル
          </Button>
          <Button
            onClick={handleConfirmClear}
            color="error"
            variant="contained"
            disabled={isClearing}
          >
            {isClearing ? 'クリア中...' : 'クリアする'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
