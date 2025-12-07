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

// Docling OCR service types
export type DoclingProcessingTier = 'lightweight' | 'standard' | 'advanced';
export type DoclingTimeoutAction = 'cancel' | 'extend' | 'notify';
export type DoclingServiceStatus = 'starting' | 'running' | 'stopped' | 'error';

export interface DoclingConfig {
  enabled: boolean;
  processingTier: DoclingProcessingTier;
  tempFolder: string;
  maxConcurrentJobs: number;
  timeoutAction: DoclingTimeoutAction;
  port: number;
  authToken: string;
}

export interface DoclingStatus {
  status: DoclingServiceStatus;
  port: number;
  version: string;
  uptime: number;
  url: string;
  error?: string;
  restartAttempts: number;
  pythonAvailable: boolean;
  queueSize: number;
  activeJobs: number;
}

export interface DoclingStartResult {
  success: boolean;
  port?: number;
  error?: string;
}

export interface DoclingHealthResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  processing_tier: string;
  queue_size: number;
  active_jobs: number;
  trace_id?: string;
}

export interface DoclingProcessOptions {
  processingTier?: DoclingProcessingTier;
  languages?: string[];
  forceFullPageOcr?: boolean;
  timeoutSeconds?: number;
}

export interface DoclingJobStatus {
  jobId: string;
  filePath: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result?: DoclingProcessResult;
  error?: string;
  errorType?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  traceId?: string;
}

export interface DoclingProcessResult {
  status: 'success' | 'error';
  markdown?: string;
  metadata?: {
    pageCount?: number;
    filePath?: string;
    processingTier?: string;
    format?: string;
    processingTimeMs?: number;
    ocrEngine?: string;
  };
  error?: string;
}

export interface DoclingProcessResponse {
  jobId: string;
  status: string;
  message: string;
  traceId?: string;
}

export interface DoclingBatchResponse {
  jobIds: string[];
  status: string;
  totalDocuments: number;
  correlationId?: string;
  traceId?: string;
}

export interface DoclingPythonInfo {
  available: boolean;
  version?: string;
  path?: string;
}

export interface DiskSpaceInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercentage: number;
}

export interface DiskSpaceResult {
  success: boolean;
  diskSpace?: DiskSpaceInfo;
  path: string;
  error?: string;
}

export interface FolderValidationResult {
  valid: boolean;
  message: string;
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

  // Editor management (WebContentsView)
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

  // Docling OCR service
  docling: {
    // Service management
    start: () => Promise<DoclingStartResult>;
    stop: () => Promise<SimpleResult>;
    restart: () => Promise<DoclingStartResult>;
    getStatus: () => Promise<DoclingStatus>;
    healthCheck: () => Promise<DoclingHealthResponse | null>;
    checkPython: () => Promise<DoclingPythonInfo>;
    isRunning: () => Promise<boolean>;

    // Configuration
    getConfig: () => Promise<DoclingConfig>;
    updateConfig: (updates: Partial<DoclingConfig>) => Promise<DoclingConfig>;
    selectTempFolder: () => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>;
    getTempFolderDiskSpace: () => Promise<DiskSpaceResult>;
    validateTempFolder: (folderPath: string) => Promise<FolderValidationResult>;

    // Document processing
    processDocument: (filePath: string, options?: DoclingProcessOptions) => Promise<DoclingProcessResponse>;
    processBatch: (filePaths: string[], options?: DoclingProcessOptions) => Promise<DoclingBatchResponse>;
    getJobStatus: (jobId: string) => Promise<DoclingJobStatus | null>;
    listJobs: () => Promise<DoclingJobStatus[]>;
    cancelJob: (jobId: string) => Promise<SimpleResult>;

    // Logs
    getLogs: (lines?: number, traceId?: string) => Promise<string[]>;
    clearLogs: () => Promise<SimpleResult>;

    // Events
    onStatusChange: (callback: (status: DoclingStatus) => void) => () => void;
    onRestartAttempt: (callback: (attempt: number, maxAttempts: number) => void) => () => void;
    onMaxRestartsExceeded: (callback: () => void) => () => void;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
