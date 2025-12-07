/**
 * マスターデータ管理画面
 * 実施候補の抽出、確認、マスターデータへの登録
 */
import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  IconButton,
  Chip,
  Divider,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { parseCSV, validateCSVFile } from '../utils/csvParser';
import {
  extractImplementationCandidates,
  type ImplementationCandidate,
} from '../utils/implementationCandidateDetector';
import { updateMasterData } from '../utils/dataAggregator';
import { saveMasterDataBatch } from '../utils/masterDataManager';
import { useMasterStore } from '../store/masterStore';
import { getVisitType } from '../utils/dataAggregator';

export const MasterDataManager = () => {
  const { masterData, loadMasterData } = useMasterStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ImplementationCandidate[]>([]);

  /**
   * CSVファイルのアップロード処理
   */
  const handleFileUpload = useCallback(async (file: File) => {
    const validation = validateCSVFile(file);
    if (!validation.valid) {
      setError(validation.error || 'ファイルが無効です');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const parseResult = await parseCSV(file);

      if (!parseResult.success || parseResult.data.length === 0) {
        setError(parseResult.errors[0] || 'CSVファイルが空です');
        setIsLoading(false);
        return;
      }

      if (parseResult.warnings.length > 0) {
        console.warn('CSV警告:', parseResult.warnings);
      }

      const csvData = parseResult.data;

      // 実施候補を抽出
      const candidateList = extractImplementationCandidates(csvData);

      setCandidates(candidateList);
      setFileName(file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました';
      setError(message);
      console.error('CSV読み込みエラー:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * マスターに登録するかのチェックボックストグル
   */
  const handleToggleInclude = (index: number) => {
    setCandidates(prev =>
      prev.map((candidate, i) =>
        i === index ? { ...candidate, shouldIncludeInMaster: !candidate.shouldIncludeInMaster } : candidate
      )
    );
  };

  /**
   * 削除ボタン（行を除外）
   */
  const handleDelete = (index: number) => {
    setCandidates(prev =>
      prev.map((candidate, i) =>
        i === index ? { ...candidate, isDeleted: true, shouldIncludeInMaster: false } : candidate
      )
    );
  };

  /**
   * マスターデータに反映
   */
  const handleSaveToMaster = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // チェックが入っていて、削除されていない行のみを抽出
      const recordsToSave = candidates.filter(c => c.shouldIncludeInMaster && !c.isDeleted).map(c => c.record);

      if (recordsToSave.length === 0) {
        setError('マスターに登録する行が選択されていません');
        setIsLoading(false);
        return;
      }

      // マスターデータを生成
      const newMasterData = updateMasterData(recordsToSave, masterData);

      // IndexedDBに保存
      await saveMasterDataBatch(newMasterData);

      // マスターストアを再読み込み
      await loadMasterData();

      alert(
        `マスターデータに ${recordsToSave.length} 件の実施記録を登録しました。\n` +
          `登録後のマスター件数: ${newMasterData.size} 人`
      );

      // 候補リストをクリア
      setCandidates([]);
      setFileName(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'マスターデータの保存に失敗しました';
      setError(message);
      console.error('マスターデータ保存エラー:', err);
    } finally {
      setIsLoading(false);
    }
  }, [candidates, masterData, loadMasterData]);

  // 統計情報
  const totalCandidates = candidates.length;
  const includedCount = candidates.filter(c => c.shouldIncludeInMaster && !c.isDeleted).length;
  const deletedCount = candidates.filter(c => c.isDeleted).length;

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckIcon color="primary" />
        マスターデータ管理
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">① LステップCSVをアップロードして、実施候補を確認</Typography>
        <Typography variant="body2">② 不要な行はチェックを外すか、削除ボタンで除外</Typography>
        <Typography variant="body2">③ 「マスターデータに反映」で登録</Typography>
      </Alert>

      {/* CSVアップロード */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          ① LステップCSVのアップロード
        </Typography>
        <Button variant="contained" component="label" startIcon={<UploadIcon />}>
          CSVファイルを選択
          <input
            type="file"
            accept=".csv"
            hidden
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
        </Button>
        {fileName && <Chip label={`ファイル: ${fileName}`} color="primary" sx={{ ml: 2 }} />}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 実施候補一覧 */}
      {candidates.length > 0 && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="h6">② 実施候補一覧</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip label={`候補: ${totalCandidates}件`} color="primary" />
              <Chip label={`登録予定: ${includedCount}件`} color="success" />
              <Chip label={`除外: ${deletedCount}件`} color="error" />
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSaveToMaster}
                disabled={includedCount === 0 || isLoading}
              >
                マスターデータに反映
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <TableContainer sx={{ maxHeight: 600 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>登録</TableCell>
                  <TableCell>操作</TableCell>
                  <TableCell>予約ID</TableCell>
                  <TableCell>友だちID</TableCell>
                  <TableCell>名前</TableCell>
                  <TableCell>予約日</TableCell>
                  <TableCell>申込日時</TableCell>
                  <TableCell>ステータス</TableCell>
                  <TableCell>来店/来場</TableCell>
                  <TableCell>詳細ステータス</TableCell>
                  <TableCell>利用回数</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidates.map((candidate, index) => {
                  const visitType = getVisitType(candidate.record.友だちID, masterData);
                  return (
                    <TableRow
                      key={index}
                      sx={{
                        opacity: candidate.isDeleted ? 0.4 : 1,
                        bgcolor: candidate.isDeleted ? 'error.light' : 'inherit',
                      }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={candidate.shouldIncludeInMaster && !candidate.isDeleted}
                          onChange={() => handleToggleInclude(index)}
                          disabled={candidate.isDeleted}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(index)}
                          disabled={candidate.isDeleted}
                        >
                          {candidate.isDeleted ? <CancelIcon /> : <DeleteIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>{candidate.record.予約ID}</TableCell>
                      <TableCell>{candidate.record.友だちID}</TableCell>
                      <TableCell>{candidate.record.名前}</TableCell>
                      <TableCell>{candidate.record.予約日}</TableCell>
                      <TableCell>{candidate.record.申込日時}</TableCell>
                      <TableCell>
                        <Chip
                          label={candidate.record.ステータス}
                          size="small"
                          color={candidate.record.ステータス === '予約済み' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={candidate.record['来店/来場']}
                          size="small"
                          color={candidate.record['来店/来場'] === '済み' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{candidate.record.詳細ステータス || '-'}</TableCell>
                      <TableCell>
                        <Chip label={visitType} size="small" color="primary" variant="outlined" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};
