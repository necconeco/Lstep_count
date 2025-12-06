/**
 * CSVアップロードコンポーネント
 * マスターデータと今月のCSVを別々にアップロード
 *
 * V2: 2系統マスター対応（フル履歴マスター / 実施マスター）
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
  Grid,
} from '@mui/material';
import {
  Upload as UploadIcon,
  CheckCircle as CheckIcon,
  History as HistoryIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { useCsvStore } from '../store/csvStore';
import { useAggregationStore } from '../store/aggregationStore';
import { useMasterStoreV2 } from '../store/masterStoreV2';
import { useReviewStore } from '../store/reviewStore';
import { parseCSV, validateCSVFile } from '../utils/csvParser';
import { autoPopulateUsageCount } from '../utils/dataAggregator';

export const CsvUploader = () => {
  // 今月のCSV用のstate
  const { setCsvData, setError, setLoading, isLoading, error, fileName, csvData } = useCsvStore();
  const { processData } = useAggregationStore();
  const { detectReviewRecords } = useReviewStore();

  // マスターデータ用のstate（V2: 2系統マスター）
  const {
    fullHistoryMasters,
    implementationMasters,
    loadMasters,
    mergeCsvData,
    isLoading: isMasterStoreLoading,
  } = useMasterStoreV2();

  const [isMasterLoading, setIsMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [masterFileName, setMasterFileName] = useState<string | null>(null);
  const [masterDataCount, setMasterDataCount] = useState(0);

  // 初回読み込み
  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  // マスターデータの件数を更新
  useEffect(() => {
    setMasterDataCount(fullHistoryMasters.size);
  }, [fullHistoryMasters.size]);

  /**
   * マスターデータCSVのアップロード処理
   * V2: mergeCsvDataを使用してフル履歴マスター / 実施マスターにマージ
   */
  const handleMasterFile = useCallback(
    async (file: File) => {
      // ファイルバリデーション
      const validation = validateCSVFile(file);
      if (!validation.valid) {
        setMasterError(validation.error || 'ファイルが無効です');
        return;
      }

      setIsMasterLoading(true);
      setMasterError(null);

      try {
        // CSVパース
        const parseResult = await parseCSV(file);

        if (!parseResult.success || parseResult.data.length === 0) {
          setMasterError(parseResult.errors[0] || 'CSVファイルが空です');
          setIsMasterLoading(false);
          return;
        }

        // 警告がある場合は表示
        if (parseResult.warnings.length > 0) {
          console.warn('マスターCSV警告:', parseResult.warnings);
        }

        const csvRecords = parseResult.data;

        // V2: CSVデータを2系統マスターにマージ（後勝ち、重複排除）
        await mergeCsvData(csvRecords);

        setMasterFileName(file.name);
        // masterDataCountはuseEffectで自動更新される
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました';
        setMasterError(message);
        console.error('マスターCSV読み込みエラー:', err);
      } finally {
        setIsMasterLoading(false);
      }
    },
    [mergeCsvData]
  );

  /**
   * 今月のCSVのアップロード処理
   * V2: 実施マスターを参照して利用回数を自動補完、マージ処理
   */
  const handleMonthlyFile = useCallback(
    async (file: File) => {
      // マスターデータが未読み込みの場合は警告
      if (fullHistoryMasters.size === 0) {
        setError('先にマスターデータ（過去の履歴）をアップロードしてください');
        return;
      }

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

        // 警告がある場合は表示
        if (parseResult.warnings.length > 0) {
          console.warn('CSV警告:', parseResult.warnings);
        }

        // V2: 実施マスターから旧形式のUserHistoryMaster Mapを作成（互換性レイヤー）
        const legacyMasterData = new Map<
          string,
          {
            friendId: string;
            allHistory: [];
            implementationHistory: [];
            implementationCount: number;
            lastImplementationDate: Date | null;
            lastStaff: string | null;
            createdAt: Date;
            updatedAt: Date;
          }
        >();
        for (const [friendId, master] of implementationMasters) {
          legacyMasterData.set(friendId, {
            friendId,
            allHistory: [],
            implementationHistory: [],
            implementationCount: master.implementationCount,
            lastImplementationDate: master.lastImplementationDate,
            lastStaff: master.lastStaff,
            createdAt: master.createdAt,
            updatedAt: master.updatedAt,
          });
        }

        // 「キャリア相談のご利用回数を教えてください。」フィールドを自動補完
        const csvRecords = autoPopulateUsageCount(parseResult.data, legacyMasterData);
        setCsvData(csvRecords, file.name);

        // 集計処理とレビュー検出を実行
        await processData(csvRecords, legacyMasterData, csvRecords);
        detectReviewRecords(csvRecords, legacyMasterData);

        // V2: CSVデータを2系統マスターにマージ（後勝ち、重複排除）
        await mergeCsvData(csvRecords);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました';
        setError(message);
        console.error('CSV読み込みエラー:', err);
      } finally {
        setLoading(false);
      }
    },
    [
      setCsvData,
      setError,
      setLoading,
      processData,
      fullHistoryMasters,
      implementationMasters,
      detectReviewRecords,
      mergeCsvData,
    ]
  );

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        データアップロード
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          ① 最初に<strong>マスターデータ（過去の履歴）</strong>をアップロード
        </Typography>
        <Typography variant="body2">
          ② 次に<strong>今月のLステップCSV</strong>をアップロード
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* マスターデータアップロードセクション */}
        {/* @ts-expect-error MUI v7 Grid API compatibility */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              textAlign: 'center',
              border: '2px solid',
              borderColor: fullHistoryMasters.size > 0 ? 'success.main' : 'grey.300',
              minHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <HistoryIcon
              sx={{
                fontSize: 48,
                color: fullHistoryMasters.size > 0 ? 'success.main' : 'text.secondary',
                mb: 2,
              }}
            />
            <Typography variant="h6" gutterBottom>
              ① マスターデータ（過去の履歴）
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
              過去の予約CSVをアップロードしてください
            </Typography>

            {isMasterLoading || isMasterStoreLoading ? (
              <Box>
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="body2">解析中...</Typography>
              </Box>
            ) : fullHistoryMasters.size > 0 ? (
              <Box>
                <CheckIcon color="success" sx={{ fontSize: 40, mb: 2 }} />
                <Chip
                  label={`${masterDataCount}件のユーザー履歴を読み込み済み`}
                  color="success"
                  sx={{ mb: 2 }}
                />
                {masterFileName && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    {masterFileName}
                  </Typography>
                )}
                <Button variant="outlined" component="label" size="small" sx={{ mt: 2 }}>
                  再アップロード
                  <input
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleMasterFile(file);
                    }}
                  />
                </Button>
              </Box>
            ) : (
              <Button variant="contained" component="label" startIcon={<UploadIcon />}>
                ファイルを選択
                <input
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleMasterFile(file);
                  }}
                />
              </Button>
            )}

            {masterError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {masterError}
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* 今月のCSVアップロードセクション */}
        {/* @ts-expect-error MUI v7 Grid API compatibility */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              textAlign: 'center',
              border: '2px solid',
              borderColor: csvData.length > 0 ? 'primary.main' : 'grey.300',
              minHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              opacity: fullHistoryMasters.size === 0 ? 0.5 : 1,
            }}
          >
            <CalendarIcon
              sx={{
                fontSize: 48,
                color: csvData.length > 0 ? 'primary.main' : 'text.secondary',
                mb: 2,
              }}
            />
            <Typography variant="h6" gutterBottom>
              ② 今月のLステップCSV
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
              集計したい期間のCSVをアップロード
            </Typography>

            {isLoading ? (
              <Box>
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="body2">解析中...</Typography>
              </Box>
            ) : csvData.length > 0 ? (
              <Box>
                <CheckIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip label={`ファイル: ${fileName}`} color="primary" />
                  <Chip label={`${csvData.length}件`} color="primary" variant="outlined" />
                </Box>
                <Button variant="outlined" component="label" size="small">
                  再アップロード
                  <input
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleMonthlyFile(file);
                    }}
                  />
                </Button>
              </Box>
            ) : (
              <Button
                variant="contained"
                component="label"
                startIcon={<UploadIcon />}
                disabled={fullHistoryMasters.size === 0}
              >
                ファイルを選択
                <input
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleMonthlyFile(file);
                  }}
                />
              </Button>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
