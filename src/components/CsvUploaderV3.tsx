/**
 * CSVアップロードコンポーネント（新設計V3）
 *
 * シンプル化:
 * - 1つのCSVアップロード領域
 * - 蓄積型（何度もアップロード可能）
 */
import { useCallback, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Upload as UploadIcon,
  CheckCircle as CheckIcon,
  History as HistoryIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';
import { parseCSV, validateCSVFile } from '../utils/csvParser';

export const CsvUploaderV3 = () => {
  const {
    histories,
    userCounts,
    isLoading,
    error: storeError,
    initialize,
    mergeCsvData,
  } = useHistoryStore();

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<string | null>(null);
  const [lastUploadedCount, setLastUploadedCount] = useState(0);

  // 初回読み込み
  useEffect(() => {
    initialize();
  }, [initialize]);

  /**
   * CSVファイルのアップロード処理
   */
  const handleFileUpload = useCallback(
    async (file: File) => {
      // バリデーション
      const validation = validateCSVFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || 'ファイルが無効です');
        return;
      }

      setUploadError(null);

      try {
        // CSVパース
        const parseResult = await parseCSV(file);

        if (!parseResult.success || parseResult.data.length === 0) {
          setUploadError(parseResult.errors[0] || 'CSVファイルが空です');
          return;
        }

        // 警告があれば表示
        if (parseResult.warnings.length > 0) {
          console.warn('CSV警告:', parseResult.warnings);
        }

        const beforeCount = histories.size;

        // マージ処理
        await mergeCsvData(parseResult.data);

        const afterCount = useHistoryStore.getState().histories.size;

        setLastUploadedFile(file.name);
        setLastUploadedCount(parseResult.data.length);

        // 簡易フィードバック
        const newRecords = afterCount - beforeCount;
        void newRecords; // 将来的にUIフィードバックに使用
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました';
        setUploadError(message);
        console.error('CSV読み込みエラー:', err);
      }
    },
    [histories.size, mergeCsvData]
  );

  const error = uploadError || storeError;

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <UploadIcon color="primary" />
        CSVアップロード
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          LステップのCSVをアップロードしてください。
          複数回アップロードすると、データが<strong>蓄積</strong>されます（重複は自動排除）。
        </Typography>
      </Alert>

      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: histories.size > 0 ? 'success.main' : 'grey.400',
          backgroundColor: histories.size > 0 ? 'success.50' : 'grey.50',
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {isLoading ? (
          <Box sx={{ width: '100%', maxWidth: 300 }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              処理中...
            </Typography>
            <LinearProgress sx={{ mt: 2 }} />
          </Box>
        ) : (
          <>
            {histories.size > 0 ? (
              <CheckIcon color="success" sx={{ fontSize: 48 }} />
            ) : (
              <HistoryIcon color="action" sx={{ fontSize: 48 }} />
            )}

            {/* 現在のデータ状況 */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Chip
                label={`${histories.size}件の履歴`}
                color={histories.size > 0 ? 'success' : 'default'}
                variant={histories.size > 0 ? 'filled' : 'outlined'}
              />
              <Chip
                label={`${userCounts.size}人のユーザー`}
                color={userCounts.size > 0 ? 'primary' : 'default'}
                variant={userCounts.size > 0 ? 'filled' : 'outlined'}
              />
            </Box>

            {/* 最後のアップロード情報 */}
            {lastUploadedFile && (
              <Typography variant="caption" color="text.secondary">
                最終アップロード: {lastUploadedFile}（{lastUploadedCount}件）
              </Typography>
            )}

            {/* アップロードボタン */}
            <Button
              variant={histories.size > 0 ? 'outlined' : 'contained'}
              component="label"
              startIcon={histories.size > 0 ? <AddIcon /> : <UploadIcon />}
              size="large"
            >
              {histories.size > 0 ? 'CSVを追加' : 'CSVをアップロード'}
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  // 同じファイルを再選択できるようにリセット
                  e.target.value = '';
                }}
              />
            </Button>

            <Typography variant="caption" color="text.secondary">
              ※ 何度でもアップロード可能です（データは蓄積されます）
            </Typography>
          </>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};
