/**
 * メインアプリケーション
 * Phase 4: ページ実装完了版
 */
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  Divider,
} from '@mui/material';
import { Download as DownloadIcon, Assessment as AssessmentIcon } from '@mui/icons-material';
import { CsvUploader } from './components/CsvUploader';
import { SummaryCard } from './components/SummaryCard';
import { StaffTable } from './components/StaffTable';
import { DailyChart } from './components/DailyChart';
import { MonthlyChart } from './components/MonthlyChart';
import { ReviewList } from './components/ReviewList';
import { CancellationList } from './components/CancellationList';
import { HistoryView } from './components/HistoryView';
import { useCsvStore } from './store/csvStore';
import { useAggregationStore } from './store/aggregationStore';

// MUIテーマ設定
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
    success: {
      main: '#2e7d32',
    },
    error: {
      main: '#d32f2f',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

function App() {
  const { csvData } = useCsvStore();
  const { spreadsheetData } = useAggregationStore();

  const handleDownloadSpreadsheet = () => {
    // TODO: Phase 6でSheetJSを使った実際のスプレッドシート生成を実装
    console.log('スプレッドシートダウンロード:', spreadsheetData);
    alert('スプレッドシート生成機能は Phase 6 で実装予定です');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* ヘッダー */}
        <AppBar position="static" elevation={2}>
          <Toolbar>
            <AssessmentIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Lステップ集計ツール
            </Typography>
            <Typography variant="body2" sx={{ mr: 2, opacity: 0.8 }}>
              v2.1（実CSV構造対応版）
            </Typography>
            {csvData.length > 0 && spreadsheetData && (
              <Button
                color="inherit"
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadSpreadsheet}
              >
                スプレッドシート出力
              </Button>
            )}
          </Toolbar>
        </AppBar>

        {/* メインコンテンツ */}
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
          {/* CSVアップロード */}
          <CsvUploader />

          {csvData.length > 0 && (
            <>
              {/* サマリー */}
              <SummaryCard />

              <Divider sx={{ my: 4 }} />

              {/* 相談員別実績 */}
              <StaffTable />

              <Divider sx={{ my: 4 }} />

              {/* グラフ */}
              <DailyChart />
              <MonthlyChart />

              <Divider sx={{ my: 4 }} />

              {/* 要確認リスト */}
              <ReviewList />

              {/* キャンセル一覧 */}
              <CancellationList />

              <Divider sx={{ my: 4 }} />

              {/* 履歴表示 */}
              <HistoryView />
            </>
          )}

          {csvData.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h5" color="text.secondary" gutterBottom>
                CSVファイルをアップロードして開始
              </Typography>
              <Typography variant="body1" color="text.secondary">
                LステップからエクスポートしたCSVファイルをアップロードすると、
                <br />
                自動的に集計・分析が実行されます
              </Typography>
            </Box>
          )}
        </Container>

        {/* フッター */}
        <Box
          component="footer"
          sx={{
            py: 3,
            px: 2,
            mt: 'auto',
            backgroundColor: (theme) =>
              theme.palette.mode === 'light' ? theme.palette.grey[200] : theme.palette.grey[800],
          }}
        >
          <Container maxWidth="xl">
            <Typography variant="body2" color="text.secondary" align="center">
              © 2025 Lステップ集計ツール | Phase 4: ページ実装完了
            </Typography>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
