import Store from 'electron-store';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized?: boolean;
}

export interface AIServiceConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'custom';
  endpoint: string;
  apiKey?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface N8nOwnerCredentials {
  email: string;
  firstName: string;
  lastName: string;
  encryptedPassword?: string;
}

export interface AppConfig {
  // First run
  firstRunComplete: boolean;

  // n8n settings
  n8nPort: number;
  dataFolder: string;

  // n8n owner account
  n8nOwnerSetupComplete: boolean;
  n8nOwnerCredentials?: N8nOwnerCredentials;
  n8nApiKey?: string;

  // App behavior
  startWithSystem: boolean;
  minimizeToTray: boolean;
  runInBackground: boolean;

  // Workflow settings
  maxConcurrentWorkflows: number;

  // AI Services
  aiServices: AIServiceConfig[];

  // Window state
  windowBounds: WindowBounds;
}

const defaultConfig: AppConfig = {
  firstRunComplete: false,
  n8nPort: 5678,
  dataFolder: path.join(app.getPath('userData'), 'n8n-data'),
  n8nOwnerSetupComplete: false,
  n8nOwnerCredentials: undefined,
  n8nApiKey: undefined,
  startWithSystem: false,
  minimizeToTray: true,
  runInBackground: true,
  maxConcurrentWorkflows: 3,
  aiServices: [],
  windowBounds: {
    width: 1200,
    height: 800,
  },
};

export class ConfigManager {
  private store: Store<AppConfig>;

  constructor() {
    this.store = new Store<AppConfig>({
      name: 'config',
      defaults: defaultConfig,
      schema: {
        firstRunComplete: { type: 'boolean' },
        n8nPort: { type: 'number', minimum: 1024, maximum: 65535 },
        dataFolder: { type: 'string' },
        n8nOwnerSetupComplete: { type: 'boolean' },
        n8nOwnerCredentials: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            encryptedPassword: { type: 'string' },
          },
        },
        n8nApiKey: { type: 'string' },
        startWithSystem: { type: 'boolean' },
        minimizeToTray: { type: 'boolean' },
        runInBackground: { type: 'boolean' },
        maxConcurrentWorkflows: { type: 'number', minimum: 1, maximum: 10 },
        aiServices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string', enum: ['openai', 'anthropic', 'ollama', 'custom'] },
              endpoint: { type: 'string' },
              apiKey: { type: 'string' },
              isEnabled: { type: 'boolean' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
            required: ['id', 'name', 'type', 'endpoint', 'isEnabled', 'createdAt', 'updatedAt'],
          },
        },
        windowBounds: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            maximized: { type: 'boolean' },
          },
          required: ['width', 'height'],
        },
      },
    });
  }

  /**
   * Get a configuration value
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.store.get(key);
  }

  /**
   * Set a configuration value
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.store.set(key, value);
  }

  /**
   * Get all configuration
   */
  getAll(): AppConfig {
    return this.store.store;
  }

  /**
   * Set multiple configuration values
   */
  setMultiple(values: Partial<AppConfig>): void {
    Object.entries(values).forEach(([key, value]) => {
      this.store.set(key as keyof AppConfig, value);
    });
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.store.clear();
  }

  /**
   * Get window bounds
   */
  getWindowBounds(): WindowBounds {
    return this.store.get('windowBounds');
  }

  /**
   * Set window bounds
   */
  setWindowBounds(bounds: WindowBounds): void {
    this.store.set('windowBounds', bounds);
  }

  /**
   * Add an AI service
   */
  addAIService(service: Omit<AIServiceConfig, 'id' | 'createdAt' | 'updatedAt'>): AIServiceConfig {
    const services = this.store.get('aiServices');
    const now = new Date().toISOString();
    const newService: AIServiceConfig = {
      ...service,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    services.push(newService);
    this.store.set('aiServices', services);
    return newService;
  }

  /**
   * Update an AI service
   */
  updateAIService(id: string, updates: Partial<Omit<AIServiceConfig, 'id' | 'createdAt'>>): AIServiceConfig | null {
    const services = this.store.get('aiServices');
    const index = services.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const updatedService: AIServiceConfig = {
      ...services[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    services[index] = updatedService;
    this.store.set('aiServices', services);
    return updatedService;
  }

  /**
   * Delete an AI service
   */
  deleteAIService(id: string): boolean {
    const services = this.store.get('aiServices');
    const filtered = services.filter((s) => s.id !== id);
    if (filtered.length === services.length) return false;
    this.store.set('aiServices', filtered);
    return true;
  }

  /**
   * Get all AI services
   */
  getAIServices(): AIServiceConfig[] {
    return this.store.get('aiServices');
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.store.path;
  }

  /**
   * Check if data folder is valid and accessible
   */
  isDataFolderValid(): boolean {
    const dataFolder = this.store.get('dataFolder');
    try {
      if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder, { recursive: true });
      }
      // Test write access
      const testFile = path.join(dataFolder, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return true;
    } catch {
      return false;
    }
  }
}
