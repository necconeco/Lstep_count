/**
 * tabSync.ts ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// BroadcastChannelをモック
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  private static channels: Map<string, Set<MockBroadcastChannel>> = new Map();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(message: unknown): void {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      channels.forEach(channel => {
        if (channel !== this && channel.onmessage) {
          channel.onmessage(new MessageEvent('message', { data: message }));
        }
      });
    }
  }

  close(): void {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      channels.delete(this);
    }
  }

  static clearAll(): void {
    MockBroadcastChannel.channels.clear();
  }
}

// グローバルにモックを設定
vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

// モジュールをインポート（BroadcastChannelモック後）
import {
  initTabSync,
  broadcastSync,
  onSyncMessage,
  cleanupTabSync,
  getTabId,
  isBroadcastChannelSupported,
} from './tabSync';

describe('tabSync', () => {
  beforeEach(() => {
    cleanupTabSync();
    MockBroadcastChannel.clearAll();
  });

  afterEach(() => {
    cleanupTabSync();
    MockBroadcastChannel.clearAll();
  });

  describe('initTabSync', () => {
    it('should initialize without error', () => {
      expect(() => initTabSync()).not.toThrow();
    });

    it('should be idempotent (can be called multiple times)', () => {
      initTabSync();
      expect(() => initTabSync()).not.toThrow();
    });
  });

  describe('isBroadcastChannelSupported', () => {
    it('should return true when BroadcastChannel is available', () => {
      expect(isBroadcastChannelSupported()).toBe(true);
    });
  });

  describe('getTabId', () => {
    it('should return a string', () => {
      const tabId = getTabId();
      expect(typeof tabId).toBe('string');
    });

    it('should return consistent tab ID', () => {
      const tabId1 = getTabId();
      const tabId2 = getTabId();
      expect(tabId1).toBe(tabId2);
    });

    it('should start with "tab_"', () => {
      const tabId = getTabId();
      expect(tabId.startsWith('tab_')).toBe(true);
    });
  });

  describe('onSyncMessage', () => {
    it('should register a listener and return unsubscribe function', () => {
      initTabSync();
      const listener = vi.fn();
      const unsubscribe = onSyncMessage('DATA_CHANGED', listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call listener when message is received', async () => {
      // 2つ目のチャンネルを作成して送信者として使用
      const senderChannel = new MockBroadcastChannel('lstep-aggregation-sync');

      initTabSync();
      const listener = vi.fn();
      onSyncMessage('DATA_CHANGED', listener);

      // 別タブから送信をシミュレート
      senderChannel.postMessage({
        type: 'DATA_CHANGED',
        timestamp: Date.now(),
        tabId: 'other_tab_123',
        payload: { count: 10 },
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DATA_CHANGED',
          tabId: 'other_tab_123',
        })
      );
    });

    it('should call wildcard listener for any message type', async () => {
      const senderChannel = new MockBroadcastChannel('lstep-aggregation-sync');

      initTabSync();
      const listener = vi.fn();
      onSyncMessage('*', listener);

      senderChannel.postMessage({
        type: 'HISTORY_UPDATED',
        timestamp: Date.now(),
        tabId: 'other_tab_456',
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not call listener for different message type', async () => {
      const senderChannel = new MockBroadcastChannel('lstep-aggregation-sync');

      initTabSync();
      const listener = vi.fn();
      onSyncMessage('DATA_CHANGED', listener);

      senderChannel.postMessage({
        type: 'HISTORY_UPDATED',
        timestamp: Date.now(),
        tabId: 'other_tab_789',
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should unsubscribe when unsubscribe function is called', async () => {
      const senderChannel = new MockBroadcastChannel('lstep-aggregation-sync');

      initTabSync();
      const listener = vi.fn();
      const unsubscribe = onSyncMessage('DATA_CHANGED', listener);

      unsubscribe();

      senderChannel.postMessage({
        type: 'DATA_CHANGED',
        timestamp: Date.now(),
        tabId: 'other_tab_abc',
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('broadcastSync', () => {
    it('should send message to other tabs', () => {
      const receiverChannel = new MockBroadcastChannel('lstep-aggregation-sync');
      const receivedMessages: unknown[] = [];
      receiverChannel.onmessage = (event) => {
        receivedMessages.push(event.data);
      };

      initTabSync();
      broadcastSync('DATA_CHANGED', { count: 5 });

      expect(receivedMessages.length).toBe(1);
      expect(receivedMessages[0]).toMatchObject({
        type: 'DATA_CHANGED',
        payload: { count: 5 },
      });
    });

    it('should auto-initialize if not initialized', () => {
      const receiverChannel = new MockBroadcastChannel('lstep-aggregation-sync');
      const receivedMessages: unknown[] = [];
      receiverChannel.onmessage = (event) => {
        receivedMessages.push(event.data);
      };

      // initTabSyncを呼ばずにbroadcast
      broadcastSync('DATA_CLEARED');

      expect(receivedMessages.length).toBe(1);
    });

    it('should include timestamp and tabId', () => {
      const receiverChannel = new MockBroadcastChannel('lstep-aggregation-sync');
      let receivedMessage: { timestamp?: number; tabId?: string } | null = null;
      receiverChannel.onmessage = (event) => {
        receivedMessage = event.data;
      };

      initTabSync();
      broadcastSync('BACKUP_RESTORED');

      expect(receivedMessage).not.toBeNull();
      expect(typeof receivedMessage!.timestamp).toBe('number');
      expect(typeof receivedMessage!.tabId).toBe('string');
    });
  });

  describe('cleanupTabSync', () => {
    it('should clean up channel and listeners', () => {
      initTabSync();
      const listener = vi.fn();
      onSyncMessage('DATA_CHANGED', listener);

      cleanupTabSync();

      // 新しいチャンネルを作成して送信
      const senderChannel = new MockBroadcastChannel('lstep-aggregation-sync');
      senderChannel.postMessage({
        type: 'DATA_CHANGED',
        timestamp: Date.now(),
        tabId: 'other_tab_xyz',
      });

      // クリーンアップ後はリスナーが呼ばれない
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('message types', () => {
    it('should support DATA_CHANGED', () => {
      initTabSync();
      const listener = vi.fn();
      onSyncMessage('DATA_CHANGED', listener);

      const senderChannel = new MockBroadcastChannel('lstep-aggregation-sync');
      senderChannel.postMessage({
        type: 'DATA_CHANGED',
        timestamp: Date.now(),
        tabId: 'tab_1',
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should support DATA_CLEARED', () => {
      initTabSync();
      const listener = vi.fn();
      onSyncMessage('DATA_CLEARED', listener);

      const senderChannel = new MockBroadcastChannel('lstep-aggregation-sync');
      senderChannel.postMessage({
        type: 'DATA_CLEARED',
        timestamp: Date.now(),
        tabId: 'tab_2',
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should support HISTORY_UPDATED', () => {
      initTabSync();
      const listener = vi.fn();
      onSyncMessage('HISTORY_UPDATED', listener);

      const senderChannel = new MockBroadcastChannel('lstep-aggregation-sync');
      senderChannel.postMessage({
        type: 'HISTORY_UPDATED',
        timestamp: Date.now(),
        tabId: 'tab_3',
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should support BACKUP_RESTORED', () => {
      initTabSync();
      const listener = vi.fn();
      onSyncMessage('BACKUP_RESTORED', listener);

      const senderChannel = new MockBroadcastChannel('lstep-aggregation-sync');
      senderChannel.postMessage({
        type: 'BACKUP_RESTORED',
        timestamp: Date.now(),
        tabId: 'tab_4',
      });

      expect(listener).toHaveBeenCalled();
    });
  });
});
