/**
 * メインコンテンツエリア
 *
 * 右カラム:
 * - フィルタバー（共通）
 * - ビューに応じたコンテンツ
 */
import { Box, Typography, Paper, Alert } from '@mui/material';
import type { ViewType } from './Sidebar';
import { CommonFilterBar } from './CommonFilterBar';
import { HistoryViewer } from './HistoryViewer';
import { MonthlyAggregationView } from './MonthlyAggregationView';
import { CampaignAggregationView } from './CampaignAggregationView';
import { StaffAggregationView } from './StaffAggregationView';
import { SnapshotManager } from './SnapshotManager';
import { AuditLogViewer } from './AuditLogViewer';
import { StaffMasterManager } from './StaffMasterManager';

interface MainContentProps {
  currentView: ViewType;
}

export const MainContent = ({ currentView }: MainContentProps) => {
  return (
    <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
      {/* 共通フィルタバー（集計ビューのみ表示） */}
      {['history', 'monthly', 'campaign', 'user', 'staff'].includes(currentView) && (
        <CommonFilterBar />
      )}

      {/* ビューに応じたコンテンツ */}
      {currentView === 'history' && <HistoryViewer />}

      {currentView === 'monthly' && <MonthlyAggregationView />}

      {currentView === 'campaign' && <CampaignAggregationView />}

      {currentView === 'user' && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            ユーザー別集計
          </Typography>
          <Alert severity="info">
            ユーザー別集計ビューは近日実装予定です。
            各ユーザーの来店履歴・累計実施回数を確認できます。
          </Alert>
        </Paper>
      )}

      {currentView === 'staff' && <StaffAggregationView />}

      {currentView === 'snapshot' && <SnapshotManager />}

      {currentView === 'auditLog' && <AuditLogViewer />}

      {currentView === 'staffMaster' && <StaffMasterManager />}
    </Box>
  );
};
