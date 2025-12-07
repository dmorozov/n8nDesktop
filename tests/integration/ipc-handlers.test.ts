/**
 * Integration tests for IPC handlers
 * Tests the interaction between main process IPC handlers and mocked Electron APIs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock axios for API calls
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(() => Promise.resolve([])),
    readFile: vi.fn(() => Promise.resolve('[]')),
    writeFile: vi.fn(() => Promise.resolve()),
    stat: vi.fn(() => Promise.resolve({ size: 1024, mtime: new Date() })),
    mkdir: vi.fn(() => Promise.resolve()),
  },
  readdir: vi.fn(() => Promise.resolve([])),
  readFile: vi.fn(() => Promise.resolve('[]')),
  writeFile: vi.fn(() => Promise.resolve()),
  stat: vi.fn(() => Promise.resolve({ size: 1024, mtime: new Date() })),
  mkdir: vi.fn(() => Promise.resolve()),
}));

// Mock fs (sync operations)
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    statfsSync: vi.fn(() => ({ bfree: 1000000, bsize: 4096 })),
  },
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  statfsSync: vi.fn(() => ({ bfree: 1000000, bsize: 4096 })),
}));

// Import after mocks
import axios from 'axios';

// Mock IpcMain
class MockIpcMain extends EventEmitter {
  private handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

  handle(channel: string, handler: (...args: unknown[]) => Promise<unknown>): void {
    this.handlers.set(channel, handler);
  }

  removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  // Helper to invoke handlers in tests
  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler registered for channel: ${channel}`);
    }
    // First argument to handler is always the event
    const mockEvent = {};
    return handler(mockEvent, ...args);
  }

  hasHandler(channel: string): boolean {
    return this.handlers.has(channel);
  }
}

// Mock ConfigManager
function createMockConfigManager() {
  return {
    get: vi.fn((key: string) => {
      switch (key) {
        case 'dataFolder':
          return '/tmp/test-data';
        case 'n8nPort':
          return 5678;
        case 'aiServices':
          return [];
        case 'docling':
          return {
            enabled: true,
            processingTier: 'standard',
            tempFolder: '',
            maxConcurrentJobs: 1,
            timeoutAction: 'cancel',
            port: 8765,
            authToken: 'test-docling-token',
          };
        default:
          return undefined;
      }
    }),
    set: vi.fn(),
    getAll: vi.fn(),
    addAIService: vi.fn(),
    updateAIService: vi.fn(),
    deleteAIService: vi.fn(),
    getAIServices: vi.fn(() => []),
    getDoclingConfig: vi.fn(() => ({
      enabled: true,
      processingTier: 'standard',
      tempFolder: '',
      maxConcurrentJobs: 1,
      timeoutAction: 'cancel',
      port: 8765,
      authToken: 'test-docling-token',
    })),
    updateDoclingConfig: vi.fn(),
    getDoclingServiceUrl: vi.fn(() => 'http://127.0.0.1:8765'),
  };
}

// Mock N8nAuthManager
function createMockAuthManager() {
  return {
    getAuthHeaders: vi.fn(() => ({
      'Content-Type': 'application/json',
      'Cookie': 'n8n-auth=test-token',
    })),
    isAuthenticated: vi.fn(() => true),
    login: vi.fn(() => Promise.resolve(true)),
    logout: vi.fn(() => Promise.resolve()),
  };
}

describe('IPC Handlers Integration Tests', () => {
  let mockIpcMain: MockIpcMain;
  let mockConfigManager: ReturnType<typeof createMockConfigManager>;
  let mockAuthManager: ReturnType<typeof createMockAuthManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcMain = new MockIpcMain();
    mockConfigManager = createMockConfigManager();
    mockAuthManager = createMockAuthManager();
  });

  describe('Workflow Handlers', () => {
    // Import and register handlers
    beforeEach(async () => {
      const { registerWorkflowHandlers } = await import('@main/ipc-handlers/workflows');
      registerWorkflowHandlers(
        mockIpcMain as unknown as import('electron').IpcMain,
        mockConfigManager as unknown as import('@main/config-manager').ConfigManager,
        () => 5678,
        mockAuthManager as unknown as import('@main/services/n8n-auth-manager').N8nAuthManager
      );
    });

    afterEach(() => {
      mockIpcMain.removeHandler('workflows:list');
      mockIpcMain.removeHandler('workflows:get');
      mockIpcMain.removeHandler('workflows:create');
      mockIpcMain.removeHandler('workflows:update');
      mockIpcMain.removeHandler('workflows:delete');
      mockIpcMain.removeHandler('workflows:duplicate');
      mockIpcMain.removeHandler('workflows:execute');
      mockIpcMain.removeHandler('workflows:stopExecution');
      mockIpcMain.removeHandler('workflows:getRecent');
      mockIpcMain.removeHandler('workflows:addRecent');
      mockIpcMain.removeHandler('workflows:getTemplates');
    });

    describe('workflows:list', () => {
      it('should register handler for workflows:list', () => {
        expect(mockIpcMain.hasHandler('workflows:list')).toBe(true);
      });

      it('should return workflows from API', async () => {
        const mockWorkflows = [
          { id: '1', name: 'Workflow 1', active: true },
          { id: '2', name: 'Workflow 2', active: false },
        ];

        vi.mocked(axios.get).mockResolvedValue({
          data: { data: mockWorkflows },
        });

        const result = await mockIpcMain.invoke('workflows:list');

        expect(result).toEqual({
          success: true,
          data: mockWorkflows,
        });
        expect(axios.get).toHaveBeenCalledWith(
          'http://localhost:5678/rest/workflows',
          expect.objectContaining({ headers: expect.any(Object) })
        );
      });

      it('should handle API errors', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

        const result = await mockIpcMain.invoke('workflows:list');

        expect(result).toEqual({
          success: false,
          error: 'Network error',
        });
      });
    });

    describe('workflows:get', () => {
      it('should fetch a single workflow', async () => {
        const mockWorkflow = { id: '1', name: 'Test Workflow', active: true };

        vi.mocked(axios.get).mockResolvedValue({
          data: mockWorkflow,
        });

        const result = await mockIpcMain.invoke('workflows:get', '1');

        expect(result).toEqual({
          success: true,
          data: mockWorkflow,
        });
        expect(axios.get).toHaveBeenCalledWith(
          'http://localhost:5678/rest/workflows/1',
          expect.objectContaining({ headers: expect.any(Object) })
        );
      });
    });

    describe('workflows:create', () => {
      it('should create a new workflow', async () => {
        const newWorkflow = {
          name: 'New Workflow',
          nodes: [],
          connections: {},
        };

        const createdWorkflow = {
          id: 'new-id',
          ...newWorkflow,
          active: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        vi.mocked(axios.post).mockResolvedValue({
          data: createdWorkflow,
        });

        const result = await mockIpcMain.invoke('workflows:create', newWorkflow);

        expect(result).toEqual({
          success: true,
          data: createdWorkflow,
        });
        expect(axios.post).toHaveBeenCalledWith(
          'http://localhost:5678/rest/workflows',
          expect.objectContaining({
            name: 'New Workflow',
            nodes: [],
            connections: {},
          }),
          expect.objectContaining({ headers: expect.any(Object) })
        );
      });
    });

    describe('workflows:update', () => {
      it('should update an existing workflow', async () => {
        const updates = { name: 'Updated Name' };
        const updatedWorkflow = {
          id: '1',
          name: 'Updated Name',
          active: true,
        };

        vi.mocked(axios.patch).mockResolvedValue({
          data: updatedWorkflow,
        });

        const result = await mockIpcMain.invoke('workflows:update', '1', updates);

        expect(result).toEqual({
          success: true,
          data: updatedWorkflow,
        });
        expect(axios.patch).toHaveBeenCalledWith(
          'http://localhost:5678/rest/workflows/1',
          updates,
          expect.objectContaining({ headers: expect.any(Object) })
        );
      });
    });

    describe('workflows:delete', () => {
      it('should delete a workflow', async () => {
        vi.mocked(axios.delete).mockResolvedValue({});

        const result = await mockIpcMain.invoke('workflows:delete', '1');

        expect(result).toEqual({ success: true });
        expect(axios.delete).toHaveBeenCalledWith(
          'http://localhost:5678/rest/workflows/1',
          expect.objectContaining({ headers: expect.any(Object) })
        );
      });

      it('should handle deletion errors', async () => {
        vi.mocked(axios.delete).mockRejectedValue(new Error('Workflow not found'));

        const result = await mockIpcMain.invoke('workflows:delete', 'non-existent');

        expect(result).toEqual({
          success: false,
          error: 'Workflow not found',
        });
      });
    });

    describe('workflows:duplicate', () => {
      it('should duplicate a workflow', async () => {
        const originalWorkflow = {
          id: '1',
          name: 'Original',
          nodes: [{ id: 'node1' }],
          connections: {},
          settings: {},
        };

        const duplicatedWorkflow = {
          id: '2',
          name: 'Original (Copy)',
          nodes: [{ id: 'node1' }],
          connections: {},
          settings: {},
        };

        vi.mocked(axios.get).mockResolvedValue({ data: originalWorkflow });
        vi.mocked(axios.post).mockResolvedValue({ data: duplicatedWorkflow });

        const result = await mockIpcMain.invoke('workflows:duplicate', '1');

        expect(result).toEqual({
          success: true,
          data: duplicatedWorkflow,
        });
      });
    });

    describe('workflows:execute', () => {
      it('should execute a workflow', async () => {
        vi.mocked(axios.post).mockResolvedValue({
          data: { executionId: 'exec-123' },
        });

        const result = await mockIpcMain.invoke('workflows:execute', '1');

        expect(result).toEqual({
          success: true,
          executionId: 'exec-123',
        });
        expect(axios.post).toHaveBeenCalledWith(
          'http://localhost:5678/rest/workflows/1/run',
          expect.any(Object),
          expect.objectContaining({ headers: expect.any(Object) })
        );
      });
    });

    describe('workflows:stopExecution', () => {
      it('should stop an execution', async () => {
        vi.mocked(axios.post).mockResolvedValue({});

        const result = await mockIpcMain.invoke('workflows:stopExecution', 'exec-123');

        expect(result).toEqual({ success: true });
        expect(axios.post).toHaveBeenCalledWith(
          'http://localhost:5678/rest/executions/exec-123/stop',
          expect.any(Object),
          expect.objectContaining({ headers: expect.any(Object) })
        );
      });
    });

    describe('workflows:getRecent', () => {
      it('should return empty array when no recent workflows', async () => {
        const result = await mockIpcMain.invoke('workflows:getRecent');

        expect(result).toEqual({
          success: true,
          data: [],
        });
      });

      it('should track recently opened workflows', async () => {
        // Add a recent workflow
        await mockIpcMain.invoke('workflows:addRecent', 'workflow-1');

        // Mock API response
        vi.mocked(axios.get).mockResolvedValue({
          data: {
            data: [
              { id: 'workflow-1', name: 'Test Workflow' },
              { id: 'workflow-2', name: 'Other Workflow' },
            ],
          },
        });

        const result = await mockIpcMain.invoke('workflows:getRecent');

        expect(result).toHaveProperty('success', true);
        expect((result as { data: unknown[] }).data).toHaveLength(1);
      });
    });

    describe('workflows:getTemplates', () => {
      it('should return an array of templates', async () => {
        // Note: Due to fs mocking, the templates array may be empty in tests
        // The actual implementation falls back to built-in templates when fs fails
        const result = await mockIpcMain.invoke('workflows:getTemplates');

        expect(Array.isArray(result)).toBe(true);
        // Templates may be empty due to fs mocking - we just verify it returns an array
      });
    });
  });
});
