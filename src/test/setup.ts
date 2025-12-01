/**
 * Vitest テストセットアップ
 */
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// 各テスト後にクリーンアップ
afterEach(() => {
  cleanup();
});

// IndexedDBのモック
const indexedDBMock = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

global.indexedDB = indexedDBMock as unknown as IDBFactory;

// Blob URLのモック
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();
