/**
 * メインコンテンツエリア
 *
 * 右カラム:
 * - フィルタバー（共通）
 * - ビューに応じたコンテンツ（動的インポートで最適化）
 */
import { lazy, Suspense } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { ViewType } from './Sidebar';
import { CommonFilterBar } from './CommonFilterBar';

// 軽量コンポーネント（即時読み込み）
import { HistoryViewer } from './HistoryViewer';

// 重いコンポーネント（動的インポートで遅延読み込み）
const DailyAggregationView = lazy(() => import('./DailyAggregationView').then(m => ({ default: m.DailyAggregationView })));
const MonthlyAggregationView = lazy(() => import('./MonthlyAggregationView').then(m => ({ default: m.MonthlyAggregationView })));
const CampaignAggregationView = lazy(() => import('./CampaignAggregationView').then(m => ({ default: m.CampaignAggregationView })));
const StaffAggregationView = lazy(() => import('./StaffAggregationView').then(m => ({ default: m.StaffAggregationView })));
const SnapshotManager = lazy(() => import('./SnapshotManager').then(m => ({ default: m.SnapshotManager })));
const AuditLogViewer = lazy(() => import('./AuditLogViewer').then(m => ({ default: m.AuditLogViewer })));
const StaffMasterManager = lazy(() => import('./StaffMasterManager').then(m => ({ default: m.StaffMasterManager })));
const CancelListView = lazy(() => import('./CancelListView').then(m => ({ default: m.CancelListView })));
const UnassignedListView = lazy(() => import('./UnassignedListView').then(m => ({ default: m.UnassignedListView })));
const CourseAggregationView = lazy(() => import('./CourseAggregationView').then(m => ({ default: m.CourseAggregationView })));
const UserAggregationView = lazy(() => import('./UserAggregationView').then(m => ({ default: m.UserAggregationView })));
const SettingsView = lazy(() => import('./SettingsView').then(m => ({ default: m.SettingsView })));

// ローディングコンポーネント
const LoadingFallback = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      gap: 2,
    }}
  >
    <CircularProgress size={40} />
    <Typography variant="body2" color="text.secondary">
      読み込み中...
    </Typography>
  </Box>
);

interface MainContentProps {
  currentView: ViewType;
}

export const MainContent = ({ currentView }: MainContentProps) => {
  return (
    <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
      {/* 共通フィルタバー（集計ビューのみ表示） */}
      {['history', 'daily', 'monthly', 'campaign', 'user', 'staff', 'course', 'cancelList', 'unassignedList'].includes(
        currentView
      ) && <CommonFilterBar />}

      {/* ビューに応じたコンテンツ */}
      {currentView === 'history' && <HistoryViewer />}

      <Suspense fallback={<LoadingFallback />}>
        {currentView === 'daily' && <DailyAggregationView />}

        {currentView === 'monthly' && <MonthlyAggregationView />}

        {currentView === 'campaign' && <CampaignAggregationView />}

        {currentView === 'user' && <UserAggregationView />}

        {currentView === 'staff' && <StaffAggregationView />}

        {currentView === 'course' && <CourseAggregationView />}

        {currentView === 'snapshot' && <SnapshotManager />}

        {currentView === 'auditLog' && <AuditLogViewer />}

        {currentView === 'staffMaster' && <StaffMasterManager />}

        {currentView === 'cancelList' && <CancelListView />}

        {currentView === 'unassignedList' && <UnassignedListView />}

        {currentView === 'settings' && <SettingsView />}
      </Suspense>
    </Box>
  );
};
