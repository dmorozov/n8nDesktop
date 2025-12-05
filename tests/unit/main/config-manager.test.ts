/**
 * Unit tests for ConfigManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron app module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      switch (name) {
        case 'userData':
          return '/tmp/test-user-data';
        case 'home':
          return '/tmp/test-home';
        default:
          return '/tmp';
      }
    }),
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
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

// Mock electron-store with custom implementation
vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation((options: { defaults?: Record<string, unknown> }) => {
    return new MockStore(options);
  }),
}));

// Import after mocks
import { ConfigManager, type AIServiceConfig } from '@main/config-manager';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    configManager = new ConfigManager();
  });

  describe('constructor', () => {
    it('should create a new ConfigManager instance', () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
    });
  });

  describe('get', () => {
    it('should return default n8nPort', () => {
      const port = configManager.get('n8nPort');
      expect(port).toBe(5678);
    });

    it('should return default firstRunComplete as false', () => {
      const firstRun = configManager.get('firstRunComplete');
      expect(firstRun).toBe(false);
    });

    it('should return default minimizeToTray as true', () => {
      const minimizeToTray = configManager.get('minimizeToTray');
      expect(minimizeToTray).toBe(true);
    });

    it('should return default runInBackground as true', () => {
      const runInBackground = configManager.get('runInBackground');
      expect(runInBackground).toBe(true);
    });

    it('should return empty aiServices array by default', () => {
      const services = configManager.get('aiServices');
      expect(services).toEqual([]);
    });
  });

  describe('set', () => {
    it('should set a configuration value', () => {
      configManager.set('n8nPort', 8080);
      expect(configManager.get('n8nPort')).toBe(8080);
    });

    it('should set firstRunComplete', () => {
      configManager.set('firstRunComplete', true);
      expect(configManager.get('firstRunComplete')).toBe(true);
    });

    it('should set boolean values correctly', () => {
      configManager.set('startWithSystem', true);
      expect(configManager.get('startWithSystem')).toBe(true);

      configManager.set('startWithSystem', false);
      expect(configManager.get('startWithSystem')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all configuration values', () => {
      const config = configManager.getAll();

      expect(config).toHaveProperty('n8nPort');
      expect(config).toHaveProperty('dataFolder');
      expect(config).toHaveProperty('firstRunComplete');
      expect(config).toHaveProperty('startWithSystem');
      expect(config).toHaveProperty('minimizeToTray');
      expect(config).toHaveProperty('runInBackground');
      expect(config).toHaveProperty('maxConcurrentWorkflows');
      expect(config).toHaveProperty('aiServices');
      expect(config).toHaveProperty('windowBounds');
    });
  });

  describe('setMultiple', () => {
    it('should set multiple values at once', () => {
      configManager.setMultiple({
        n8nPort: 9000,
        startWithSystem: true,
        maxConcurrentWorkflows: 5,
      });

      expect(configManager.get('n8nPort')).toBe(9000);
      expect(configManager.get('startWithSystem')).toBe(true);
      expect(configManager.get('maxConcurrentWorkflows')).toBe(5);
    });
  });

  describe('reset', () => {
    it('should reset all configuration to defaults', () => {
      // Change some values
      configManager.set('n8nPort', 9999);
      configManager.set('firstRunComplete', true);

      // Reset
      configManager.reset();

      // Create fresh instance to get defaults
      const freshManager = new ConfigManager();

      // Check that values are reset
      expect(configManager.get('n8nPort')).toBe(freshManager.get('n8nPort'));
    });
  });

  describe('getWindowBounds / setWindowBounds', () => {
    it('should return default window bounds', () => {
      const bounds = configManager.getWindowBounds();

      expect(bounds).toHaveProperty('width');
      expect(bounds).toHaveProperty('height');
      expect(bounds.width).toBe(1200);
      expect(bounds.height).toBe(800);
    });

    it('should set and get window bounds', () => {
      const newBounds = {
        x: 100,
        y: 100,
        width: 1920,
        height: 1080,
        maximized: true,
      };

      configManager.setWindowBounds(newBounds);
      const bounds = configManager.getWindowBounds();

      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(100);
      expect(bounds.width).toBe(1920);
      expect(bounds.height).toBe(1080);
      expect(bounds.maximized).toBe(true);
    });
  });

  describe('AI Services CRUD', () => {
    describe('addAIService', () => {
      it('should add a new AI service', () => {
        const service = configManager.addAIService({
          name: 'Test OpenAI',
          type: 'openai',
          endpoint: 'https://api.openai.com/v1',
          apiKey: 'test-key',
          isEnabled: true,
        });

        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('createdAt');
        expect(service).toHaveProperty('updatedAt');
        expect(service.name).toBe('Test OpenAI');
        expect(service.type).toBe('openai');
      });

      it('should generate unique IDs for services', () => {
        const service1 = configManager.addAIService({
          name: 'Service 1',
          type: 'openai',
          endpoint: 'https://api.openai.com/v1',
          isEnabled: true,
        });

        const service2 = configManager.addAIService({
          name: 'Service 2',
          type: 'anthropic',
          endpoint: 'https://api.anthropic.com',
          isEnabled: true,
        });

        expect(service1.id).not.toBe(service2.id);
      });
    });

    describe('getAIServices', () => {
      it('should return AI services that were added', () => {
        const initialCount = configManager.getAIServices().length;

        configManager.addAIService({
          name: 'Service 1',
          type: 'openai',
          endpoint: 'https://api.openai.com/v1',
          isEnabled: true,
        });

        configManager.addAIService({
          name: 'Service 2',
          type: 'ollama',
          endpoint: 'http://localhost:11434',
          isEnabled: false,
        });

        const services = configManager.getAIServices();
        // Should have 2 more than before
        expect(services.length).toBe(initialCount + 2);
      });
    });

    describe('updateAIService', () => {
      it('should update an existing AI service', async () => {
        const service = configManager.addAIService({
          name: 'Original Name',
          type: 'openai',
          endpoint: 'https://api.openai.com/v1',
          isEnabled: true,
        });

        // Wait a small amount to ensure different timestamp
        await new Promise((resolve) => setTimeout(resolve, 5));

        const updated = configManager.updateAIService(service.id, {
          name: 'Updated Name',
          isEnabled: false,
        });

        expect(updated).not.toBeNull();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.isEnabled).toBe(false);
        // updatedAt should be a valid timestamp (at least exists)
        expect(updated?.updatedAt).toBeDefined();
      });

      it('should return null for non-existent service', () => {
        const result = configManager.updateAIService('non-existent-id', {
          name: 'New Name',
        });

        expect(result).toBeNull();
      });
    });

    describe('deleteAIService', () => {
      it('should delete an existing AI service', () => {
        const service = configManager.addAIService({
          name: 'To Delete',
          type: 'openai',
          endpoint: 'https://api.openai.com/v1',
          isEnabled: true,
        });

        const result = configManager.deleteAIService(service.id);
        expect(result).toBe(true);

        const services = configManager.getAIServices();
        expect(services.find((s) => s.id === service.id)).toBeUndefined();
      });

      it('should return false for non-existent service', () => {
        const result = configManager.deleteAIService('non-existent-id');
        expect(result).toBe(false);
      });
    });
  });

  describe('getConfigPath', () => {
    it('should return the config file path', () => {
      const path = configManager.getConfigPath();
      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe('isDataFolderValid', () => {
    it('should return true for valid data folder', () => {
      const isValid = configManager.isDataFolderValid();
      expect(isValid).toBe(true);
    });
  });
});
