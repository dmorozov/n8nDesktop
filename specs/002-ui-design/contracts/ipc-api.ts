/**
 * IPC API Contract: n8n Desktop Application
 *
 * This file defines the TypeScript interfaces for communication between
 * the Electron main process and renderer process via context bridge.
 *
 * Usage in renderer:
 *   const status = await window.electronAPI.n8n.getStatus();
 */

// =============================================================================
// n8n Server Management
// =============================================================================

export interface N8nAPI {
  /** Start the n8n server process */
  start(): Promise<N8nStartResult>;

  /** Stop the n8n server process */
  stop(): Promise<void>;

  /** Restart the n8n server */
  restart(): Promise<N8nStartResult>;

  /** Get current server status */
  getStatus(): Promise<N8nStatus>;

  /** Get server logs (last N lines) */
  getLogs(lines?: number): Promise<string[]>;

  /** Subscribe to server status changes */
  onStatusChange(callback: (status: N8nStatus) => void): () => void;
}

export interface N8nStartResult {
  success: boolean;
  port?: number;
  error?: string;
}

export interface N8nStatus {
  status: 'starting' | 'running' | 'stopped' | 'error';
  port: number;
  version: string;
  uptime: number; // seconds
  url: string;
  error?: string;
}

// =============================================================================
// Configuration Management
// =============================================================================

export interface ConfigAPI {
  /** Get a configuration value */
  get<T>(key: string): Promise<T | undefined>;

  /** Set a configuration value */
  set<T>(key: string, value: T): Promise<void>;

  /** Get all configuration */
  getAll(): Promise<AppConfig>;

  /** Reset configuration to defaults */
  reset(): Promise<void>;
}

export interface AppConfig {
  version: string;
  dataFolder: string;
  firstRunComplete: boolean;
  theme: 'dark' | 'light' | 'system';
  minimizeToTray: boolean;
  n8nPort: number;
  startOnBoot: boolean;
  runInBackground: boolean;
  checkForUpdates: boolean;
  autoSave: boolean;
  createBackups: boolean;
  recentWorkflows: RecentWorkflow[];
}

export interface RecentWorkflow {
  id: string;
  name: string;
  lastOpened: string;
}

// =============================================================================
// Workflow Management
// =============================================================================

export interface WorkflowAPI {
  /** List all workflows */
  list(): Promise<WorkflowSummary[]>;

  /** Get workflow by ID */
  get(id: string): Promise<Workflow>;

  /** Create a new workflow */
  create(workflow: WorkflowCreateInput): Promise<Workflow>;

  /** Update a workflow */
  update(id: string, updates: WorkflowUpdateInput): Promise<Workflow>;

  /** Delete a workflow */
  delete(id: string): Promise<void>;

  /** Duplicate a workflow */
  duplicate(id: string): Promise<Workflow>;

  /** Execute a workflow */
  execute(id: string): Promise<ExecutionResult>;

  /** Stop a running execution */
  stopExecution(executionId: string): Promise<void>;

  /** Import workflow from JSON file */
  import(): Promise<WorkflowImportResult>;

  /** Export workflow to JSON file */
  export(id: string): Promise<WorkflowExportResult>;

  /** Get recent workflows */
  getRecent(): Promise<RecentWorkflow[]>;

  /** Add to recent workflows */
  addRecent(id: string, name: string): Promise<void>;

  /** Subscribe to execution status changes */
  onExecutionChange(
    callback: (update: ExecutionUpdate) => void
  ): () => void;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface Workflow extends WorkflowSummary {
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, unknown>;
}

export interface WorkflowCreateInput {
  name: string;
  nodes?: WorkflowNode[];
  connections?: Record<string, unknown>;
}

export interface WorkflowUpdateInput {
  name?: string;
  nodes?: WorkflowNode[];
  connections?: Record<string, unknown>;
  active?: boolean;
}

export interface ExecutionResult {
  executionId: string;
  status: 'started' | 'error';
  error?: string;
}

export interface ExecutionUpdate {
  executionId: string;
  workflowId: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  startedAt: string;
  stoppedAt?: string;
  error?: string;
}

export interface WorkflowImportResult {
  success: boolean;
  workflow?: Workflow;
  error?: string;
  overwritten?: boolean;
}

export interface WorkflowExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// =============================================================================
// AI Service Configuration
// =============================================================================

export interface AIServiceAPI {
  /** List all AI services */
  list(): Promise<AIService[]>;

  /** Get AI service by ID */
  get(id: string): Promise<AIService | null>;

  /** Add or update an AI service */
  save(service: AIServiceInput): Promise<AIService>;

  /** Delete an AI service */
  delete(id: string): Promise<void>;

  /** Test connection to AI service */
  testConnection(id: string): Promise<ConnectionTestResult>;

  /** Get available models for a service */
  getModels(id: string): Promise<string[]>;
}

export interface AIService {
  id: string;
  name: string;
  type: 'openai' | 'gemini' | 'ollama' | 'lm-studio';
  provider: 'cloud' | 'local';
  enabled: boolean;
  serverUrl?: string;
  defaultModel?: string;
  availableModels: string[];
  status: 'connected' | 'disconnected' | 'error' | 'not-configured';
  hasApiKey: boolean;
  lastTested?: string;
  lastError?: string;
}

export interface AIServiceInput {
  id?: string; // Optional for new services
  name: string;
  type: 'openai' | 'gemini' | 'ollama' | 'lm-studio';
  serverUrl?: string;
  apiKey?: string; // Will be stored securely
  defaultModel?: string;
  enabled?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  models?: string[];
  error?: string;
  latency?: number; // ms
}

// =============================================================================
// Storage & Backup
// =============================================================================

export interface StorageAPI {
  /** Get current data folder path */
  getDataFolder(): Promise<string>;

  /** Select new data folder (opens native dialog) */
  selectDataFolder(): Promise<SelectFolderResult>;

  /** Get storage statistics */
  getStats(): Promise<StorageStats>;

  /** Clear cache */
  clearCache(): Promise<ClearCacheResult>;

  /** Create backup */
  createBackup(): Promise<BackupResult>;

  /** Restore from backup */
  restoreBackup(): Promise<RestoreResult>;

  /** List available backups */
  listBackups(): Promise<BackupInfo[]>;
}

export interface SelectFolderResult {
  success: boolean;
  path?: string;
  cancelled?: boolean;
}

export interface StorageStats {
  dataFolder: string;
  databaseSize: number; // bytes
  cacheSize: number; // bytes
  backupsSize: number; // bytes
  totalSize: number; // bytes
}

export interface ClearCacheResult {
  success: boolean;
  freedBytes: number;
  error?: string;
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  size?: number;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredFrom?: string;
  error?: string;
}

export interface BackupInfo {
  filePath: string;
  createdAt: string;
  size: number;
  version: string;
}

// =============================================================================
// Dialog & System
// =============================================================================

export interface DialogAPI {
  /** Show open file dialog */
  showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult>;

  /** Show save file dialog */
  showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogResult>;

  /** Show message box */
  showMessageBox(options: MessageBoxOptions): Promise<MessageBoxResult>;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenDialogResult {
  cancelled: boolean;
  filePaths: string[];
}

export interface SaveDialogResult {
  cancelled: boolean;
  filePath?: string;
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
}

export interface MessageBoxResult {
  response: number;
}

// =============================================================================
// Updates
// =============================================================================

export interface UpdateAPI {
  /** Check for updates */
  checkForUpdates(): Promise<UpdateCheckResult>;

  /** Download update */
  downloadUpdate(): Promise<DownloadResult>;

  /** Install update and restart */
  installUpdate(): Promise<void>;

  /** Subscribe to download progress */
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
}

export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

// =============================================================================
// Combined API Interface
// =============================================================================

export interface ElectronAPI {
  n8n: N8nAPI;
  config: ConfigAPI;
  workflows: WorkflowAPI;
  aiServices: AIServiceAPI;
  storage: StorageAPI;
  dialog: DialogAPI;
  updates: UpdateAPI;
}

// Global declaration for renderer process
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
