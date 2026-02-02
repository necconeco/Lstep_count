/**
 * Infrastructure層 - 公開API
 *
 * このファイルはInfrastructure層の公開インターフェースを定義します。
 * 外部からはこのファイル経由でInfrastructure層の機能にアクセスしてください。
 *
 * 構成:
 * - repository.ts: メインのIndexedDBリポジトリ
 * - masterRepository.ts: マスターデータ専用リポジトリ
 */

// ============================================================================
// メインリポジトリ（repository.ts）
// ============================================================================
export {
  // 履歴操作
  getAllHistories,
  getHistoryById,
  saveHistory,
  saveHistoriesBatch,
  clearAllHistories,

  // ユーザーカウント操作
  getAllUserCounts,
  saveUserCountsBatch,
  clearAllUserCounts,

  // キャンペーン操作
  getAllCampaigns,
  saveCampaign,
  deleteCampaign,
  initializeDefaultCampaigns,

  // 監査ログ操作
  getAllAuditLogs,
  getAuditLogsByReservationId,
  saveAuditLog,

  // スナップショット操作
  getAllSnapshots,
  getSnapshotById,
  saveSnapshot,
  updateSnapshot,
  deleteSnapshot,

  // スナップショットフォルダ操作
  getAllFolders,
  saveFolder,
  deleteFolder,
  getFolderByName,

  // 担当者マスター操作
  getAllStaff,
  getActiveStaff,
  saveStaff,
  saveStaffBatch,
  deleteStaff,
  findStaffByNameOrAlias,

  // データクリア
  clearAllData,
  deleteDatabase,
} from './repository';

// ============================================================================
// マスターリポジトリ（masterRepository.ts - V2: 2系統マスター）
// ============================================================================
export {
  // フル履歴マスター
  getAllFullHistoryMasters,
  saveFullHistoryMastersBatch,
  clearAllFullHistoryMasters,

  // 実施マスター
  getAllImplementationMasters,
  saveImplementationMastersBatch,
  clearAllImplementationMasters,

  // バッチ操作
  saveAllMastersBatch,
  clearAllMasters,

  // データベース操作
  deleteDatabase as deleteMasterDatabase,
} from './masterRepository';
