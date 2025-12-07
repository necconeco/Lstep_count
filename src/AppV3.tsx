/**
 * メインアプリケーション（新設計V3）
 *
 * 2カラムレイアウト:
 * - 左: サイドバー（ナビゲーション・データソース）
 * - 右: メインコンテンツ（履歴一覧・集計ビュー）
 */
import { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, AppBar, Toolbar, Typography, Box } from '@mui/material';
import { Assessment as AssessmentIcon } from '@mui/icons-material';
import { Sidebar, MobileMenuButton, SIDEBAR_WIDTH, type ViewType } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { CsvUploadDialog } from './components/CsvUploadDialog';
import { useHistoryStore } from './store/historyStore';
import { startAutoBackup, stopAutoBackup } from './utils/autoBackup';

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

function AppV3() {
  const [currentView, setCurrentView] = useState<ViewType>('history');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const { initialize, exportToJSON } = useHistoryStore();

  // 初回読み込み
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 自動バックアップを開始
  useEffect(() => {
    // exportToJSONを使ってデータを取得するバックアップ関数
    startAutoBackup(() => exportToJSON());

    // クリーンアップ
    return () => {
      stopAutoBackup();
    };
  }, [exportToJSON]);

  const handleMobileDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* サイドバー */}
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onUploadClick={() => setUploadDialogOpen(true)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* メインエリア */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
            minHeight: '100vh',
          }}
        >
          {/* モバイル用ヘッダー */}
          <AppBar
            position="static"
            elevation={1}
            sx={{
              display: { md: 'none' },
            }}
          >
            <Toolbar>
              <MobileMenuButton onClick={handleMobileDrawerToggle} />
              <AssessmentIcon sx={{ mr: 1 }} />
              <Typography variant="h6" noWrap component="div">
                Lステップ集計
              </Typography>
            </Toolbar>
          </AppBar>

          {/* メインコンテンツ */}
          <MainContent currentView={currentView} />
        </Box>

        {/* CSVアップロードダイアログ */}
        <CsvUploadDialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} />
      </Box>
    </ThemeProvider>
  );
}

export default AppV3;
