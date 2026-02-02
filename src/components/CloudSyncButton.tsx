/**
 * クラウド同期ボタンコンポーネント
 */
import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  Chip,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
  Cloud as CloudIcon,
  CloudOff as CloudOffIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import {
  uploadToCloud,
  downloadFromCloud,
  testConnection,
  getSyncStatus,
  type SyncStatus,
} from '../lib/supabaseSync';
import { useHistoryStore } from '../store/historyStore';
import { getAllImplementationMasters } from '../infrastructure';

export function CloudSyncButton() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { userCounts } = useHistoryStore();

  // 接続テスト
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await testConnection();
      setIsConnected(connected);
    };
    checkConnection();
  }, []);

  // 同期ステータス更新
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatus(getSyncStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // クラウドにアップロード
  const handleUpload = async () => {
    setIsUploading(true);
    setMessage(null);

    try {
      const implementationMasters = await getAllImplementationMasters();
      await uploadToCloud(implementationMasters);
      setMessage({ type: 'success', text: `${implementationMasters.size}件のデータをクラウドに保存しました` });
      setSyncStatus(getSyncStatus());
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'アップロードに失敗しました',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // クラウドからダウンロード
  const handleDownload = async () => {
    setIsDownloading(true);
    setMessage(null);

    try {
      const cloudData = await downloadFromCloud();
      setMessage({
        type: 'success',
        text: `${cloudData.size}件のデータをクラウドから取得しました（表示のみ）`,
      });
      setSyncStatus(getSyncStatus());
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'ダウンロードに失敗しました',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Tooltip title={isConnected ? 'クラウド同期' : 'クラウド未接続'}>
        <IconButton
          onClick={() => setDialogOpen(true)}
          color={isConnected ? 'primary' : 'default'}
          size="small"
        >
          {isConnected === null ? (
            <CircularProgress size={20} />
          ) : isConnected ? (
            <CloudIcon />
          ) : (
            <CloudOffIcon />
          )}
        </IconButton>
      </Tooltip>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SyncIcon />
            クラウド同期
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* 接続状態 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              接続状態
            </Typography>
            <Chip
              icon={isConnected ? <CloudIcon /> : <CloudOffIcon />}
              label={isConnected ? 'Supabase に接続中' : '未接続'}
              color={isConnected ? 'success' : 'default'}
              variant="outlined"
            />
          </Box>

          {/* データ件数 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              データ件数
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  ローカル
                </Typography>
                <Typography variant="h6">{userCounts.size} 件</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  クラウド
                </Typography>
                <Typography variant="h6">{syncStatus.cloudCount} 件</Typography>
              </Box>
            </Box>
          </Box>

          {/* 最終同期 */}
          {syncStatus.lastSyncedAt && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                最終同期
              </Typography>
              <Typography variant="body2">
                {syncStatus.lastSyncedAt.toLocaleString('ja-JP')}
              </Typography>
            </Box>
          )}

          {/* メッセージ */}
          {message && (
            <Alert severity={message.type} sx={{ mb: 2 }}>
              {message.text}
            </Alert>
          )}

          {/* 同期ボタン */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={isUploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
              onClick={handleUpload}
              disabled={!isConnected || isUploading || isDownloading}
            >
              クラウドに保存
            </Button>

            <Button
              variant="outlined"
              startIcon={isDownloading ? <CircularProgress size={20} /> : <CloudDownloadIcon />}
              onClick={handleDownload}
              disabled={!isConnected || isUploading || isDownloading}
            >
              クラウドから取得
            </Button>
          </Box>

          {!isConnected && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              クラウドに接続できません。インターネット接続を確認してください。
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
