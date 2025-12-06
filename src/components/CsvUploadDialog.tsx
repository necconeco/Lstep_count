/**
 * CSVアップロードダイアログ
 *
 * サイドバーから呼び出されるモーダル形式のアップロード
 */
import { useCallback, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Upload as UploadIcon,
  CheckCircle as CheckIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';
import { parseCSV, validateCSVFile } from '../utils/csvParser';

interface CsvUploadDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CsvUploadDialog = ({ open, onClose }: CsvUploadDialogProps) => {
  const { histories, mergeCsvData } = useHistoryStore();

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{
    fileName: string;
    count: number;
    newCount: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // アップロード専用のローディング状態

  /**
   * ファイル処理
   */
  const processFile = useCallback(
    async (file: File) => {
      // バリデーション
      const validation = validateCSVFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || 'ファイルが無効です');
        return;
      }

      setUploadError(null);
      setUploadSuccess(null);
      setIsProcessing(true); // ローディング開始

      try {
        // CSVパース
        const parseResult = await parseCSV(file);

        if (!parseResult.success || parseResult.data.length === 0) {
          setUploadError(parseResult.errors[0] || 'CSVファイルが空です');
          setIsProcessing(false);
          return;
        }

        const beforeCount = histories.size;

        // マージ処理
        await mergeCsvData(parseResult.data);

        const afterCount = useHistoryStore.getState().histories.size;
        const newRecords = afterCount - beforeCount;

        setUploadSuccess({
          fileName: file.name,
          count: parseResult.data.length,
          newCount: newRecords,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました';
        setUploadError(message);
        console.error('[CsvUpload] CSV読み込みエラー:', err);
      } finally {
        setIsProcessing(false); // ローディング終了
      }
    },
    [histories.size, mergeCsvData]
  );

  /**
   * ドラッグ&ドロップ
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) {
        processFile(file);
      } else {
        setUploadError('CSVファイルを選択してください');
      }
    },
    [processFile]
  );

  /**
   * ファイル選択
   */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // 同じファイルを再選択できるようにリセット
      e.target.value = '';
    },
    [processFile]
  );

  /**
   * クローズ時にリセット
   */
  const handleClose = useCallback(() => {
    setUploadError(null);
    setUploadSuccess(null);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <UploadIcon color="primary" />
        CSVアップロード
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            LステップのCSVをアップロードしてください。
            複数回アップロードすると、データが<strong>蓄積</strong>されます（重複は自動排除）。
          </Typography>
        </Alert>

        {/* ドラッグ&ドロップエリア */}
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            p: 4,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: isDragging ? 'primary.main' : uploadSuccess ? 'success.main' : 'grey.400',
            borderRadius: 2,
            backgroundColor: isDragging
              ? 'action.hover'
              : uploadSuccess
              ? 'success.50'
              : 'grey.50',
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: 180,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'action.hover',
            },
          }}
        >
          {isProcessing ? (
            <>
              <Typography variant="body1" color="text.secondary">
                処理中...
              </Typography>
              <LinearProgress sx={{ width: '80%' }} />
            </>
          ) : uploadSuccess ? (
            <>
              <CheckIcon color="success" sx={{ fontSize: 48 }} />
              <Typography variant="body1" color="success.main">
                アップロード完了
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip label={`${uploadSuccess.count}件処理`} size="small" />
                <Chip label={`新規${uploadSuccess.newCount}件`} size="small" color="success" />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {uploadSuccess.fileName}
              </Typography>
            </>
          ) : (
            <>
              <CloudUploadIcon color="action" sx={{ fontSize: 48 }} />
              <Typography variant="body1" color="text.secondary">
                CSVファイルをドラッグ&ドロップ
              </Typography>
              <Typography variant="body2" color="text.secondary">
                または
              </Typography>
              <Button variant="contained" component="label" startIcon={<UploadIcon />}>
                ファイルを選択
                <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
              </Button>
            </>
          )}
        </Box>

        {/* エラー表示 */}
        {uploadError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {uploadError}
          </Alert>
        )}

        {/* 現在のデータ状況 */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            現在のデータ: <strong>{histories.size}件</strong>の履歴
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};
