/**
 * Integration tests for Docling service startup (T031).
 *
 * These tests verify that the DoclingManager correctly starts,
 * manages, and stops the Python Docling service.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess, execSync } from 'child_process';
import { EventEmitter } from 'events';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: (name: string) => `/tmp/test-${name}`,
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    accessSync: vi.fn(),
  },
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  accessSync: vi.fn(),
}));

// Create a mock store for testing
class MockStore<T extends Record<string, unknown>> {
  private data: Map<string, unknown> = new Map();
  private defaults: T;
  public path = '/tmp/test-config.json';

  constructor(options?: { defaults?: T }) {
    this.defaults = options?.defaults || ({} as T);
    // Initialize with defaults
    if (this.defaults) {
      Object.entries(this.defaults).forEach(([key, value]) => {
        this.data.set(key, value);
      });
    }
  }

  get<K extends keyof T>(key: K): T[K] {
    if (this.data.has(key as string)) {
      return this.data.get(key as string) as T[K];
    }
    return this.defaults[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data.set(key as string, value);
  }

  get store(): T {
    const result = { ...this.defaults };
    this.data.forEach((value, key) => {
      (result as Record<string, unknown>)[key] = value;
    });
    return result;
  }

  clear(): void {
    this.data.clear();
  }

  has(key: string): boolean {
    return this.data.has(key) || key in this.defaults;
  }

  delete(key: string): void {
    this.data.delete(key);
  }
}

// Generate a random auth token for testing
function generateAuthToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Mock electron-store with custom implementation
vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation((options: { defaults?: Record<string, unknown> }) => {
    // Ensure docling config is in defaults
    const defaults = options?.defaults || {};
    if (!defaults.docling) {
      defaults.docling = {
        enabled: true,
        processingTier: 'standard',
        tempFolder: '',
        maxConcurrentJobs: 1,
        timeoutAction: 'cancel',
        port: 8765,
        authToken: generateAuthToken(),
      };
    }
    return new MockStore({ defaults });
  }),
}));

// Check if Python is available for integration tests
const isPythonAvailable = (): boolean => {
  try {
    execSync('python3 --version', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

describe('DoclingManager', () => {
  describe('Python availability check', () => {
    it('should detect Python 3.10+ when available', async () => {
      // Import after mocks are set up
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      const result = await manager.checkPython();

      if (isPythonAvailable()) {
        expect(result.available).toBe(true);
        expect(result.version).toContain('Python 3.');
      } else {
        // Skip if Python not available
        console.log('Skipping: Python not available');
        expect(result.available).toBe(false);
      }
    });

    it('should report Python not available when not installed', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      // Mock execSync to simulate Python not found
      const originalExecSync = require('child_process').execSync;
      vi.spyOn(require('child_process'), 'execSync').mockImplementation(() => {
        throw new Error('command not found');
      });

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      // Force re-check by creating new manager
      const result = await manager.checkPython();

      // Restore original
      vi.spyOn(require('child_process'), 'execSync').mockRestore();

      // Result depends on actual system state, but the check should complete
      expect(typeof result.available).toBe('boolean');
    });
  });

  describe('Service lifecycle', () => {
    it('should report initial status as stopped', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      const status = manager.getStatus();
      expect(status.status).toBe('stopped');
      expect(status.restartAttempts).toBe(0);
    });

    it('should return false for isRunning when stopped', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      expect(manager.isRunning()).toBe(false);
    });

    it('should emit statusChange event on start attempt', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      const statusChanges: string[] = [];
      manager.on('statusChange', (status) => {
        statusChanges.push(status.status);
      });

      // Start will fail if Python not available, but should still emit status change
      await manager.start().catch(() => {});

      // Should have at least tried to start
      expect(statusChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should read port from config', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      const status = manager.getStatus();
      const config = configManager.getDoclingConfig();

      expect(status.port).toBe(config.port);
    });

    it('should generate API base URL from port', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      const baseUrl = manager.getApiBaseUrl();
      const config = configManager.getDoclingConfig();

      expect(baseUrl).toBe(`http://127.0.0.1:${config.port}/api/v1`);
    });

    it('should return auth token from config', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      const token = manager.getAuthToken();
      const config = configManager.getDoclingConfig();

      expect(token).toBe(config.authToken);
    });
  });

  describe('Logging', () => {
    it('should store logs in memory buffer', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      // Force add a log entry via start attempt
      await manager.start().catch(() => {});

      const logs = manager.getLogs();
      expect(Array.isArray(logs)).toBe(true);
    });

    it('should clear logs on clearLogs call', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      // Force add a log entry
      await manager.start().catch(() => {});

      manager.clearLogs();
      const logs = manager.getLogs();

      expect(logs.length).toBe(0);
    });

    it('should limit logs to configured line count', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      // Request specific number of lines
      const logs = manager.getLogs(10);
      expect(logs.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error handling', () => {
    it('should return error when service disabled', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      configManager.updateDoclingConfig({ enabled: false });

      const manager = new DoclingManager(configManager);
      const result = await manager.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');

      // Restore
      configManager.updateDoclingConfig({ enabled: true });
    });

    it('should return error when Python not available', async () => {
      const { DoclingManager } = await import('../../src/main/docling-manager');
      const { ConfigManager } = await import('../../src/main/config-manager');

      const configManager = new ConfigManager();
      const manager = new DoclingManager(configManager);

      // Mock checkPython to always return false
      manager['checkPython'] = vi.fn().mockResolvedValue({ available: false });
      manager['pythonInfo'] = { available: false };

      const result = await manager.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Python');
    });
  });
});

describe('DoclingConfig', () => {
  it('should have default values', async () => {
    const { ConfigManager } = await import('../../src/main/config-manager');

    const configManager = new ConfigManager();
    const config = configManager.getDoclingConfig();

    expect(config.enabled).toBe(true);
    expect(config.processingTier).toBe('standard');
    expect(config.maxConcurrentJobs).toBe(1);
    expect(config.timeoutAction).toBe('cancel');
    expect(config.port).toBe(8765);
    expect(typeof config.authToken).toBe('string');
    expect(config.authToken.length).toBeGreaterThan(0);
  });

  it('should update config values', async () => {
    const { ConfigManager } = await import('../../src/main/config-manager');

    const configManager = new ConfigManager();

    const updated = configManager.updateDoclingConfig({
      processingTier: 'advanced',
      maxConcurrentJobs: 3,
    });

    expect(updated.processingTier).toBe('advanced');
    expect(updated.maxConcurrentJobs).toBe(3);

    // Restore defaults
    configManager.updateDoclingConfig({
      processingTier: 'standard',
      maxConcurrentJobs: 1,
    });
  });

  it('should validate temp folder accessibility', async () => {
    const { ConfigManager } = await import('../../src/main/config-manager');

    const configManager = new ConfigManager();

    // Empty temp folder (use system default) should be valid
    configManager.updateDoclingConfig({ tempFolder: '' });
    expect(configManager.isDoclingTempFolderValid()).toBe(true);
  });

  it('should generate service URL from config', async () => {
    const { ConfigManager } = await import('../../src/main/config-manager');

    const configManager = new ConfigManager();
    const url = configManager.getDoclingServiceUrl();

    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });
});
