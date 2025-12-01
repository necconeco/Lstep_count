/**
 * CSVアップロードコンポーネント
 * ドラッグ&ドロップ対応
 */
import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import { Upload as UploadIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { useCsvStore } from '../store/csvStore';
import { useAggregationStore } from '../store/aggregationStore';
import { useMasterStore } from '../store/masterStore';
import { useReviewStore } from '../store/reviewStore';
import { parseCSV, validateCSVFile } from '../utils/csvParser';
import { updateMasterData } from '../utils/dataAggregator';
import { saveMasterDataBatch } from '../utils/masterDataManager';

export const CsvUploader = () => {
  const [isDragging, setIsDragging] = useState(false);
  const { setCsvData, setError, setLoading, isLoading, error, fileName, csvData } = useCsvStore();
  const { processData } = useAggregationStore();
  const { masterData, loadMasterData } = useMasterStore();
  const { detectReviewRecords } = useReviewStore();

  const handleFile = useCallback(
    async (file: File) => {
      // ファイルバリデーション
      const validation = validateCSVFile(file);
      if (!validation.valid) {
        setError(validation.error || 'ファイルが無効です');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // CSVパース
        const parseResult = await parseCSV(file);

        if (!parseResult.success || parseResult.data.length === 0) {
          setError(parseResult.errors[0] || 'CSVファイルが空です');
          setLoading(false);
          return;
        }

        // 警告がある場合は表示（エラーではない）
        if (parseResult.warnings.length > 0) {
          console.warn('CSV警告:', parseResult.warnings);
        }

        const csvData = parseResult.data;
        setCsvData(csvData, file.name);

        // 履歴マスタ読み込み（未読み込みの場合）
        if (masterData.size === 0) {
          await loadMasterData();
        }

        // 履歴マスタを更新（実施済みレコードがあれば）
        const updatedMasterData = updateMasterData(csvData, masterData);
        if (updatedMasterData.size > masterData.size) {
          // 新しいマスタデータがあればIndexedDBに保存
          await saveMasterDataBatch(updatedMasterData);
          // マスタストアを再読み込み
          await loadMasterData();
        }

        // 集計処理とレビュー検出を実行（更新後のマスタデータを使用）
        const finalMasterData = updatedMasterData.size > masterData.size ? updatedMasterData : masterData;
        await processData(csvData, finalMasterData);
        detectReviewRecords(csvData, finalMasterData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました';
        setError(message);
        console.error('CSV読み込みエラー:', err);
      } finally {
        setLoading(false);
      }
    },
    [setCsvData, setError, setLoading, processData, masterData, loadMasterData, detectReviewRecords]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  return (
    <Box sx={{ mb: 3 }}>
      <Paper
        elevation={3}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          p: 4,
          textAlign: 'center',
          border: isDragging ? '2px dashed #1976d2' : '2px dashed #ccc',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s',
          cursor: 'pointer',
          '&:hover': {
            borderColor: '#1976d2',
            bgcolor: 'action.hover',
          },
        }}
      >
        {isLoading ? (
          <Box>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body1">CSV解析中...</Typography>
          </Box>
        ) : csvData.length > 0 ? (
          <Box>
            <CheckIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              アップロード完了
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`ファイル: ${fileName}`} color="primary" />
              <Chip label={`レコード数: ${csvData.length}件`} color="success" />
            </Box>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              component="label"
              sx={{ mt: 3 }}
            >
              別のファイルをアップロード
              <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
            </Button>
          </Box>
        ) : (
          <Box>
            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              CSVファイルをドラッグ&ドロップ
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              または
            </Typography>
            <Button variant="contained" component="label" startIcon={<UploadIcon />} sx={{ mt: 2 }}>
              ファイルを選択
              <input type="file" accept=".csv" hidden onChange={handleFileSelect} />
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 2 }} color="text.secondary">
              対応形式: CSV（UTF-8） / 最大ファイルサイズ: 10MB
            </Typography>
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
};
