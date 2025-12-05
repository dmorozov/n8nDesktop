// Types shared between preload and renderer

export interface N8nStatus {
  status: 'starting' | 'running' | 'stopped' | 'error';
  port: number;
  version: string;
  uptime: number;
  url: string;
  error?: string;
}

export interface N8nStartResult {
  success: boolean;
  port?: number;
  error?: string;
}

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

export interface AppConfig {
  firstRunComplete: boolean;
  n8nPort: number;
  dataFolder: string;
  startWithSystem: boolean;
  minimizeToTray: boolean;
  runInBackground: boolean;
  maxConcurrentWorkflows: number;
  aiServices: AIServiceConfig[];
  windowBounds: WindowBounds;
}

export interface DialogResult {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

export interface MessageResult {
  response: number;
}

export interface SimpleResult {
  success: boolean;
  error?: string;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
  latencyMs?: number;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
}

export interface GetModelsResult {
  success: boolean;
  models?: AIModel[];
  error?: string;
}

export interface StorageStats {
  dataFolder: string;
  totalSize: number;
  workflowsSize: number;
  logsSize: number;
  backupsSize: number;
}

export interface DataFolderStatus {
  accessible: boolean;
  exists: boolean;
  writable: boolean;
  errorType?: 'not_found' | 'not_writable' | 'permission_denied';
  dataFolder: string;
}

export interface BackupInfo {
  id: string;
  filename: string;
  path: string;
  createdAt: string;
  size: number;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupInfo;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  canceled?: boolean;
  error?: string;
}

export interface ListBackupsResult {
  success: boolean;
  backups?: BackupInfo[];
  error?: string;
}

// Update types
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  mandatory: boolean;
}

export interface UpdateCheckResult {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateInfo?: UpdateInfo;
  error?: string;
}

// Workflow types
export interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  nodes: unknown[];
  connections: unknown;
  settings?: Record<string, unknown>;
  staticData?: unknown;
  tags?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowResult {
  success: boolean;
  data?: WorkflowData;
  error?: string;
}

export interface WorkflowListResult {
  success: boolean;
  data?: WorkflowData[];
  error?: string;
}

export interface ExecuteResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  canceled?: boolean;
  data?: WorkflowData & {
    filePath: string;
    fileName: string;
  };
  error?: string;
}

export interface ExportResult {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

// Template types
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: 'bot' | 'cog' | 'file';
  workflow: Partial<WorkflowData>;
}

// API exposed to renderer
export interface ElectronAPI {
  // n8n management
  n8n: {
    start: () => Promise<N8nStartResult>;
    stop: () => Promise<SimpleResult>;
    restart: () => Promise<N8nStartResult>;
    getStatus: () => Promise<N8nStatus>;
    getLogs: (lines?: number) => Promise<string[]>;
    clearLogs: () => Promise<SimpleResult>;
    isRunning: () => Promise<boolean>;
    onStatusChange: (callback: (status: N8nStatus) => void) => () => void;
    onReady: (callback: (ready: boolean) => void) => () => void;
  };

  // Editor management (BrowserView)
  editor: {
    open: (workflowId?: string) => Promise<SimpleResult>;
    close: () => Promise<SimpleResult>;
    isVisible: () => Promise<boolean>;
    onVisibilityChange: (callback: (visible: boolean) => void) => () => void;
  };

  // Workflow operations
  workflows: {
    list: () => Promise<WorkflowListResult>;
    get: (id: string) => Promise<WorkflowResult>;
    create: (workflow: Partial<WorkflowData>) => Promise<WorkflowResult>;
    update: (id: string, updates: Partial<WorkflowData>) => Promise<WorkflowResult>;
    delete: (id: string) => Promise<SimpleResult>;
    duplicate: (id: string) => Promise<WorkflowResult>;
    execute: (id: string) => Promise<ExecuteResult>;
    stopExecution: (executionId: string) => Promise<SimpleResult>;
    import: (filePath?: string) => Promise<ImportResult>;
    export: (workflow: unknown, suggestedName?: string) => Promise<ExportResult>;
    getRecent: () => Promise<WorkflowListResult>;
    addRecent: (id: string) => Promise<SimpleResult>;
    getTemplates: () => Promise<WorkflowTemplate[]>;
  };

  // Configuration
  config: {
    get: <K extends keyof AppConfig>(key: K) => Promise<AppConfig[K]>;
    set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<SimpleResult>;
    getAll: () => Promise<AppConfig>;
    setMultiple: (values: Partial<AppConfig>) => Promise<SimpleResult>;
    reset: () => Promise<SimpleResult>;
    getAIServices: () => Promise<AIServiceConfig[]>;
    addAIService: (service: Omit<AIServiceConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AIServiceConfig>;
    updateAIService: (id: string, updates: Partial<Omit<AIServiceConfig, 'id' | 'createdAt'>>) => Promise<AIServiceConfig | null>;
    deleteAIService: (id: string) => Promise<boolean>;
  };

  // AI Service operations
  ai: {
    testConnection: (serviceId: string) => Promise<TestConnectionResult>;
    getModels: (serviceId: string) => Promise<GetModelsResult>;
  };

  // Dialogs
  dialog: {
    selectFolder: (options?: { title?: string; defaultPath?: string }) => Promise<DialogResult>;
    selectFile: (options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<DialogResult>;
    saveFile: (options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<DialogResult>;
    showMessage: (options: {
      type?: 'none' | 'info' | 'error' | 'question' | 'warning';
      title?: string;
      message: string;
      detail?: string;
      buttons?: string[];
    }) => Promise<MessageResult>;
  };

  // Shell
  shell: {
    openExternal: (url: string) => Promise<SimpleResult>;
    showItemInFolder: (path: string) => Promise<SimpleResult>;
    openPath: (path: string) => Promise<SimpleResult>;
  };

  // Storage operations
  storage: {
    getDataFolder: () => Promise<string>;
    checkDataFolder: () => Promise<DataFolderStatus>;
    selectDataFolder: () => Promise<DialogResult>;
    getStats: () => Promise<{ success: boolean; stats?: StorageStats; error?: string }>;
    clearCache: () => Promise<SimpleResult>;
    canChangeDataFolder: () => Promise<boolean>;
    createBackup: () => Promise<BackupResult>;
    restoreBackup: (backupPath?: string) => Promise<RestoreResult>;
    listBackups: () => Promise<ListBackupsResult>;
    deleteBackup: (backupId: string) => Promise<SimpleResult>;
  };

  // Updates
  updates: {
    check: () => Promise<UpdateCheckResult>;
    getInfo: () => Promise<UpdateInfo | null>;
    getCurrentVersion: () => Promise<string>;
    download: () => Promise<SimpleResult>;
    dismiss: () => Promise<SimpleResult>;
    getLastCheckTime: () => Promise<string | null>;
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
    onUpdateDismissed: (callback: () => void) => () => void;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
