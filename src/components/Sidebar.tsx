/**
 * サイドバーコンポーネント
 *
 * 左カラム:
 * - データソース（CSVアップロード、履歴統計）
 * - キャンペーン & ルール
 * - 集計ビュー選択
 */
import { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Chip,
  Collapse,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Upload as UploadIcon,
  History as HistoryIcon,
  Campaign as CampaignIcon,
  Assessment as AssessmentIcon,
  ExpandLess,
  ExpandMore,
  CalendarMonth as CalendarIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  CameraAlt as CameraAltIcon,
  ManageHistory as ManageHistoryIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';
import { useHistoryStore } from '../store/historyStore';

export type ViewType = 'history' | 'monthly' | 'campaign' | 'user' | 'staff' | 'snapshot' | 'auditLog' | 'staffMaster';

export const SIDEBAR_WIDTH = 280;

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onUploadClick: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar = ({
  currentView,
  onViewChange,
  onUploadClick,
  mobileOpen,
  onMobileClose,
}: SidebarProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { histories, userCounts } = useHistoryStore();

  const [dataSourceOpen, setDataSourceOpen] = useState(true);
  const [viewsOpen, setViewsOpen] = useState(true);

  // 統計情報
  const stats = {
    historyCount: histories.size,
    userCount: userCounts.size,
    implementedCount: Array.from(histories.values()).filter((h) => h.isImplemented).length,
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <AssessmentIcon color="primary" />
        <Typography variant="h6" noWrap>
          Lステップ集計
        </Typography>
      </Box>

      {/* メインコンテンツ */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List component="nav" dense>
          {/* データソースセクション */}
          <ListItem disablePadding>
            <ListItemButton onClick={() => setDataSourceOpen(!dataSourceOpen)}>
              <ListItemIcon>
                <UploadIcon />
              </ListItemIcon>
              <ListItemText primary="データソース" />
              {dataSourceOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          <Collapse in={dataSourceOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding dense>
              {/* CSVアップロード */}
              <ListItemButton sx={{ pl: 4 }} onClick={onUploadClick}>
                <ListItemIcon>
                  <UploadIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="CSVアップロード" />
              </ListItemButton>

              {/* 統計サマリー */}
              <Box sx={{ px: 4, py: 1 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  <Chip
                    size="small"
                    icon={<HistoryIcon />}
                    label={`${stats.historyCount}件`}
                    color={stats.historyCount > 0 ? 'success' : 'default'}
                    variant={stats.historyCount > 0 ? 'filled' : 'outlined'}
                  />
                  <Chip
                    size="small"
                    icon={<PersonIcon />}
                    label={`${stats.userCount}人`}
                    color={stats.userCount > 0 ? 'primary' : 'default'}
                    variant={stats.userCount > 0 ? 'filled' : 'outlined'}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  実施: {stats.implementedCount}件
                </Typography>
              </Box>
            </List>
          </Collapse>

          <Divider sx={{ my: 1 }} />

          {/* 集計ビューセクション */}
          <ListItem disablePadding>
            <ListItemButton onClick={() => setViewsOpen(!viewsOpen)}>
              <ListItemIcon>
                <TrendingUpIcon />
              </ListItemIcon>
              <ListItemText primary="集計ビュー" />
              {viewsOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          <Collapse in={viewsOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding dense>
              {/* 履歴一覧 */}
              <ListItemButton
                sx={{ pl: 4 }}
                selected={currentView === 'history'}
                onClick={() => {
                  onViewChange('history');
                  if (isMobile) onMobileClose();
                }}
              >
                <ListItemIcon>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="履歴一覧" />
              </ListItemButton>

              {/* 月次集計 */}
              <ListItemButton
                sx={{ pl: 4 }}
                selected={currentView === 'monthly'}
                onClick={() => {
                  onViewChange('monthly');
                  if (isMobile) onMobileClose();
                }}
              >
                <ListItemIcon>
                  <CalendarIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="月次集計" />
              </ListItemButton>

              {/* キャンペーン別 */}
              <ListItemButton
                sx={{ pl: 4 }}
                selected={currentView === 'campaign'}
                onClick={() => {
                  onViewChange('campaign');
                  if (isMobile) onMobileClose();
                }}
              >
                <ListItemIcon>
                  <CampaignIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="キャンペーン別" />
              </ListItemButton>

              {/* ユーザー別 */}
              <ListItemButton
                sx={{ pl: 4 }}
                selected={currentView === 'user'}
                onClick={() => {
                  onViewChange('user');
                  if (isMobile) onMobileClose();
                }}
              >
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="ユーザー別" />
              </ListItemButton>

              {/* 担当者別 */}
              <ListItemButton
                sx={{ pl: 4 }}
                selected={currentView === 'staff'}
                onClick={() => {
                  onViewChange('staff');
                  if (isMobile) onMobileClose();
                }}
              >
                <ListItemIcon>
                  <PeopleIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="担当者別" />
              </ListItemButton>
            </List>
          </Collapse>

          <Divider sx={{ my: 1 }} />

          {/* 管理機能セクション */}
          <ListItemButton
            selected={currentView === 'snapshot'}
            onClick={() => {
              onViewChange('snapshot');
              if (isMobile) onMobileClose();
            }}
          >
            <ListItemIcon>
              <CameraAltIcon />
            </ListItemIcon>
            <ListItemText primary="スナップショット" />
          </ListItemButton>

          <ListItemButton
            selected={currentView === 'auditLog'}
            onClick={() => {
              onViewChange('auditLog');
              if (isMobile) onMobileClose();
            }}
          >
            <ListItemIcon>
              <ManageHistoryIcon />
            </ListItemIcon>
            <ListItemText primary="監査ログ" />
          </ListItemButton>

          <ListItemButton
            selected={currentView === 'staffMaster'}
            onClick={() => {
              onViewChange('staffMaster');
              if (isMobile) onMobileClose();
            }}
          >
            <ListItemIcon>
              <BadgeIcon />
            </ListItemIcon>
            <ListItemText primary="担当者マスター" />
          </ListItemButton>

          <Divider sx={{ my: 1 }} />

          {/* 設定 */}
          <ListItemButton>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="設定" />
          </ListItemButton>
        </List>
      </Box>

      {/* フッター */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          backgroundColor: 'grey.50',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          v3.0 新設計版
        </Typography>
      </Box>
    </Box>
  );

  // モバイル向け（一時的なドロワー）
  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  // デスクトップ向け（固定ドロワー）
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

/**
 * モバイル用のメニューボタン
 */
export const MobileMenuButton = ({ onClick }: { onClick: () => void }) => (
  <IconButton
    color="inherit"
    aria-label="open drawer"
    edge="start"
    onClick={onClick}
    sx={{ mr: 2, display: { md: 'none' } }}
  >
    <MenuIcon />
  </IconButton>
);
