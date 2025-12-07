/**
 * Unit tests for N8nManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/mock/app/path',
  },
}));

// Mock child_process - but don't import EventEmitter directly in mock
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock port-finder
vi.mock('@main/utils/port-finder', () => ({
  isPortAvailable: vi.fn(),
}));

// Import after mocks are set up
import { spawn } from 'child_process';
import fs from 'fs';
import { isPortAvailable } from '@main/utils/port-finder';
import { N8nManager } from '@main/n8n-manager';
import { ConfigManager } from '@main/config-manager';
import { EventEmitter } from 'events';

// Create mock config manager
function createMockConfigManager(): ConfigManager {
  const mockConfigManager = {
    get: vi.fn((key: string) => {
      switch (key) {
        case 'n8nPort':
          return 5678;
        case 'dataFolder':
          return '/tmp/test-data';
        case 'firstRunComplete':
          return false;
        default:
          return undefined;
      }
    }),
    set: vi.fn(),
    getAll: vi.fn(),
    setMultiple: vi.fn(),
    reset: vi.fn(),
    getWindowBounds: vi.fn(),
    setWindowBounds: vi.fn(),
    addAIService: vi.fn(),
    updateAIService: vi.fn(),
    deleteAIService: vi.fn(),
    getAIServices: vi.fn(),
    getConfigPath: vi.fn(),
    isDataFolderValid: vi.fn(),
    // Docling config methods
    getDoclingConfig: vi.fn(() => ({
      enabled: true,
      processingTier: 'standard',
      tempFolder: '',
      maxConcurrentJobs: 1,
      timeoutAction: 'cancel',
      port: 8765,
      authToken: 'test-auth-token',
    })),
    updateDoclingConfig: vi.fn(),
    isDoclingTempFolderValid: vi.fn(() => true),
    getDoclingServiceUrl: vi.fn(() => 'http://127.0.0.1:8765'),
  } as unknown as ConfigManager;

  return mockConfigManager;
}

describe('N8nManager', () => {
  let n8nManager: N8nManager;
  let mockConfigManager: ConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigManager = createMockConfigManager();

    // Setup default mock implementations
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(isPortAvailable).mockResolvedValue(true);

    n8nManager = new N8nManager(mockConfigManager);
  });

  describe('constructor', () => {
    it('should initialize with stopped status', () => {
      const status = n8nManager.getStatus();
      expect(status.status).toBe('stopped');
    });

    it('should use port from config', () => {
      const status = n8nManager.getStatus();
      expect(status.port).toBe(5678);
    });
  });

  describe('getStatus', () => {
    it('should return current status object', () => {
      const status = n8nManager.getStatus();

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('port');
      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('url');
    });

    it('should return uptime of 0 when stopped', () => {
      const status = n8nManager.getStatus();
      expect(status.uptime).toBe(0);
    });
  });

  describe('start', () => {
    it('should return error if port is not available', async () => {
      vi.mocked(isPortAvailable).mockResolvedValue(false);

      const result = await n8nManager.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Port');
      expect(result.error).toContain('already in use');
    });

    it('should return error if data folder is not configured', async () => {
      vi.mocked(mockConfigManager.get).mockImplementation((key: string) => {
        if (key === 'dataFolder') return undefined;
        if (key === 'n8nPort') return 5678;
        return undefined;
      });

      const newManager = new N8nManager(mockConfigManager);
      const result = await newManager.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Data folder not configured');
    });

    it('should call spawn when starting', async () => {
      // Make fs.existsSync return false for n8n binary paths but true for data folder
      vi.mocked(fs.existsSync).mockImplementation((pathArg) => {
        const pathStr = String(pathArg);
        // Return false for n8n binary checks to force npx fallback
        if (pathStr.includes('n8n') && (pathStr.includes('.bin') || pathStr.includes('bin'))) {
          return false;
        }
        // Return true for data folder check
        return true;
      });

      // Create a mock process
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        killed: boolean;
        kill: ReturnType<typeof vi.fn>;
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.killed = false;
      mockProcess.kill = vi.fn();

      // Add error handler to prevent unhandled error
      mockProcess.on('error', () => {});

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);

      // Start the manager - it returns a promise but we don't wait for it to complete
      // The promise will resolve when the process emits the startup message
      const startPromise = n8nManager.start();

      // Give async operations time to start (port check is async)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(spawn).toHaveBeenCalledWith('npx', ['n8n', 'start'], expect.anything());

      // Clean up - emit exit to resolve the promise
      mockProcess.emit('exit', 1, null);
      await startPromise.catch(() => {});
    });

    it('should create data folder if not exists before spawning', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        killed: boolean;
        kill: ReturnType<typeof vi.fn>;
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.killed = false;
      mockProcess.kill = vi.fn();

      // Add error handler to prevent unhandled error
      mockProcess.on('error', () => {});

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);

      // Start the manager
      const startPromise = n8nManager.start();

      // Give async operations time to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.n8n'), {
        recursive: true,
      });

      // Clean up
      mockProcess.emit('exit', 1, null);
      await startPromise.catch(() => {});
    });
  });

  describe('stop', () => {
    it('should handle stop when not running', async () => {
      // Should not throw
      await expect(n8nManager.stop()).resolves.toBeUndefined();
    });

    it('should update status to stopped', async () => {
      await n8nManager.stop();

      const status = n8nManager.getStatus();
      expect(status.status).toBe('stopped');
    });
  });

  describe('isRunning', () => {
    it('should return false when stopped', () => {
      expect(n8nManager.isRunning()).toBe(false);
    });
  });

  describe('getPort', () => {
    it('should return configured port', () => {
      expect(n8nManager.getPort()).toBe(5678);
    });
  });

  describe('getUrl', () => {
    it('should return null when not running', () => {
      expect(n8nManager.getUrl()).toBeNull();
    });
  });

  describe('getLogs', () => {
    it('should return empty array initially', () => {
      expect(n8nManager.getLogs()).toEqual([]);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      n8nManager.clearLogs();
      expect(n8nManager.getLogs()).toEqual([]);
    });
  });

  describe('hasRunningWorkflows', () => {
    it('should return false (placeholder implementation)', () => {
      expect(n8nManager.hasRunningWorkflows()).toBe(false);
    });
  });
});
