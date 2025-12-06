/**
 * CSVデータ一覧表示コンポーネント
 * 詳細ステータス編集機能付き
 */
import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Button,
  Chip,
  Alert,
  FormControl,
} from '@mui/material';
import {
  TableChart as TableChartIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useCsvStore } from '../store/csvStore';
import { useMasterStore } from '../store/masterStore';
import { exportToCSV } from '../utils/csvExporter';
import { autoPopulateUsageCount } from '../utils/dataAggregator';

export const CsvDataTable = () => {
  const { csvData, getFilteredData, updateRecord } = useCsvStore();
  const { masterData } = useMasterStore();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 選択中の月でフィルタされたデータを取得
  const filteredData = getFilteredData();

  /**
   * 詳細ステータスの変更ハンドラ
   */
  const handleDetailStatusChange = useCallback(
    (予約ID: string, newValue: '' | '前日キャンセル' | '当日キャンセル') => {
      updateRecord(予約ID, { 詳細ステータス: newValue });
      setSaveMessage('詳細ステータスを更新しました');
      setTimeout(() => setSaveMessage(null), 3000);
    },
    [updateRecord]
  );

  /**
   * キャリア相談のご利用回数の変更ハンドラ
   */
  const handleUsageCountChange = useCallback(
    (予約ID: string, newValue: '' | '初めて' | '2回目以上') => {
      updateRecord(予約ID, { 'キャリア相談のご利用回数を教えてください。': newValue });
      setSaveMessage('利用回数を更新しました');
      setTimeout(() => setSaveMessage(null), 3000);
    },
    [updateRecord]
  );

  /**
   * CSVダウンロード（全カラム出力、詳細ステータス・回数フィールド含む）
   */
  const handleDownloadCSV = useCallback(() => {
    if (filteredData.length === 0) {
      alert('データがありません');
      return;
    }

    // Domain層: 回数フィールドを自動補完（ビジネスロジック）
    const processedData = autoPopulateUsageCount(filteredData, masterData);

    // Infrastructure層: CSV出力（純粋なファイル出力）
    const fileName = `Lステップ予約データ_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(processedData, fileName);

    // 成功メッセージを表示
    setSaveMessage('CSVファイルをダウンロードしました（全カラム出力）');
    setTimeout(() => setSaveMessage(null), 3000);
  }, [filteredData, masterData]);

  if (csvData.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TableChartIcon color="primary" />
          CSVデータ一覧（詳細ステータス編集）
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCSV}
        >
          全カラムCSV出力
        </Button>
      </Box>

      {saveMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {saveMessage}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>編集可能な項目：</strong>
        <br />
        • <strong>詳細ステータス</strong>：キャンセル済みレコードのみ編集可能。「前日キャンセル」「当日キャンセル」を選択すると実施扱いとしてカウントされます。
        <br />
        • <strong>利用回数</strong>：全レコード編集可能。通常は自動補完されますが、例外的な修正が必要な場合に手動で変更できます。
      </Alert>

      <Paper elevation={2} sx={{ p: 3 }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>友だちID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>予約日</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>来店/来場</TableCell>
                <TableCell>詳細ステータス</TableCell>
                <TableCell>利用回数</TableCell>
                <TableCell>担当者</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData.map((record) => {
                const isキャンセル済み = record.ステータス === 'キャンセル済み';

                return (
                  <TableRow key={record.予約ID} hover>
                    <TableCell>{record.友だちID}</TableCell>
                    <TableCell>{record.名前}</TableCell>
                    <TableCell>{record.予約日}</TableCell>
                    <TableCell>
                      <Chip
                        label={record.ステータス}
                        size="small"
                        color={record.ステータス === '予約済み' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record['来店/来場']}
                        size="small"
                        color={record['来店/来場'] === '済み' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {isキャンセル済み ? (
                        <FormControl size="small" fullWidth>
                          <Select
                            value={record.詳細ステータス || ''}
                            onChange={(e) =>
                              handleDetailStatusChange(
                                record.予約ID,
                                e.target.value as '' | '前日キャンセル' | '当日キャンセル'
                              )
                            }
                            displayEmpty
                          >
                            <MenuItem value="">通常キャンセル</MenuItem>
                            <MenuItem value="前日キャンセル">前日キャンセル</MenuItem>
                            <MenuItem value="当日キャンセル">当日キャンセル</MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={record['キャリア相談のご利用回数を教えてください。'] || ''}
                          onChange={(e) =>
                            handleUsageCountChange(
                              record.予約ID,
                              e.target.value as '' | '初めて' | '2回目以上'
                            )
                          }
                          displayEmpty
                        >
                          <MenuItem value="">（空欄）</MenuItem>
                          <MenuItem value="初めて">初めて</MenuItem>
                          <MenuItem value="2回目以上">2回目以上</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>{record.担当者 || '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};
