import { contextBridge, ipcRenderer } from 'electron';
import type {
  ElectronAPI,
  N8nStatus,
  AppConfig,
  AIServiceConfig,
  WorkflowData,
  UpdateInfo,
  DoclingStatus,
  DoclingConfig,
  DoclingProcessOptions,
} from './types';

// Create the API object
const electronAPI: ElectronAPI = {
  // n8n management
  n8n: {
    start: () => ipcRenderer.invoke('n8n:start'),
    stop: () => ipcRenderer.invoke('n8n:stop'),
    restart: () => ipcRenderer.invoke('n8n:restart'),
    getStatus: () => ipcRenderer.invoke('n8n:getStatus'),
    getLogs: (lines?: number) => ipcRenderer.invoke('n8n:getLogs', lines),
    clearLogs: () => ipcRenderer.invoke('n8n:clearLogs'),
    isRunning: () => ipcRenderer.invoke('n8n:isRunning'),
    onStatusChange: (callback: (status: N8nStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: N8nStatus) => callback(status);
      ipcRenderer.on('n8n:statusChange', listener);
      return () => ipcRenderer.removeListener('n8n:statusChange', listener);
    },
    onReady: (callback: (ready: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, ready: boolean) => callback(ready);
      ipcRenderer.on('n8n:ready', listener);
      return () => ipcRenderer.removeListener('n8n:ready', listener);
    },
  },

  // Editor management (WebContentsView)
  editor: {
    open: (workflowId?: string) => ipcRenderer.invoke('editor:open', workflowId),
    close: () => ipcRenderer.invoke('editor:close'),
    isVisible: () => ipcRenderer.invoke('editor:isVisible'),
    onVisibilityChange: (callback: (visible: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, visible: boolean) => callback(visible);
      ipcRenderer.on('editor:visibilityChanged', listener);
      return () => ipcRenderer.removeListener('editor:visibilityChanged', listener);
    },
  },

  // Workflow operations
  workflows: {
    list: () => ipcRenderer.invoke('workflows:list'),
    get: (id: string) => ipcRenderer.invoke('workflows:get', id),
    create: (workflow: Partial<WorkflowData>) => ipcRenderer.invoke('workflows:create', workflow),
    update: (id: string, updates: Partial<WorkflowData>) => ipcRenderer.invoke('workflows:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('workflows:delete', id),
    duplicate: (id: string) => ipcRenderer.invoke('workflows:duplicate', id),
    execute: (id: string) => ipcRenderer.invoke('workflows:execute', id),
    stopExecution: (executionId: string) => ipcRenderer.invoke('workflows:stopExecution', executionId),
    import: (filePath?: string) => ipcRenderer.invoke('workflows:import', filePath),
    export: (workflow: unknown, suggestedName?: string) => ipcRenderer.invoke('workflows:export', workflow, suggestedName),
    getRecent: () => ipcRenderer.invoke('workflows:getRecent'),
    addRecent: (id: string) => ipcRenderer.invoke('workflows:addRecent', id),
    getTemplates: () => ipcRenderer.invoke('workflows:getTemplates'),
  },

  // Configuration
  config: {
    get: <K extends keyof AppConfig>(key: K) => ipcRenderer.invoke('config:get', key),
    set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => ipcRenderer.invoke('config:set', key, value),
    getAll: () => ipcRenderer.invoke('config:getAll'),
    setMultiple: (values: Partial<AppConfig>) => ipcRenderer.invoke('config:setMultiple', values),
    reset: () => ipcRenderer.invoke('config:reset'),
    getAIServices: () => ipcRenderer.invoke('config:getAIServices'),
    addAIService: (service: Omit<AIServiceConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
      ipcRenderer.invoke('config:addAIService', service),
    updateAIService: (id: string, updates: Partial<Omit<AIServiceConfig, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('config:updateAIService', id, updates),
    deleteAIService: (id: string) => ipcRenderer.invoke('config:deleteAIService', id),
  },

  // AI Service operations
  ai: {
    testConnection: (serviceId: string) => ipcRenderer.invoke('ai:testConnection', serviceId),
    getModels: (serviceId: string) => ipcRenderer.invoke('ai:getModels', serviceId),
  },

  // Dialogs
  dialog: {
    selectFolder: (options) => ipcRenderer.invoke('dialog:selectFolder', options),
    selectFile: (options) => ipcRenderer.invoke('dialog:selectFile', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    showMessage: (options) => ipcRenderer.invoke('dialog:showMessage', options),
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },

  // Storage operations
  storage: {
    getDataFolder: () => ipcRenderer.invoke('storage:getDataFolder'),
    checkDataFolder: () => ipcRenderer.invoke('storage:checkDataFolder'),
    selectDataFolder: () => ipcRenderer.invoke('storage:selectDataFolder'),
    getStats: () => ipcRenderer.invoke('storage:getStats'),
    clearCache: () => ipcRenderer.invoke('storage:clearCache'),
    canChangeDataFolder: () => ipcRenderer.invoke('storage:canChangeDataFolder'),
    createBackup: () => ipcRenderer.invoke('storage:createBackup'),
    restoreBackup: (backupPath?: string) => ipcRenderer.invoke('storage:restoreBackup', backupPath),
    listBackups: () => ipcRenderer.invoke('storage:listBackups'),
    deleteBackup: (backupId: string) => ipcRenderer.invoke('storage:deleteBackup', backupId),
  },

  // Updates
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    getInfo: () => ipcRenderer.invoke('updates:getInfo'),
    getCurrentVersion: () => ipcRenderer.invoke('updates:getCurrentVersion'),
    download: () => ipcRenderer.invoke('updates:download'),
    dismiss: () => ipcRenderer.invoke('updates:dismiss'),
    getLastCheckTime: () => ipcRenderer.invoke('updates:getLastCheckTime'),
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => callback(info);
      ipcRenderer.on('updates:available', listener);
      return () => ipcRenderer.removeListener('updates:available', listener);
    },
    onUpdateDismissed: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('updates:dismissed', listener);
      return () => ipcRenderer.removeListener('updates:dismissed', listener);
    },
  },

  // Docling OCR service
  docling: {
    // Service management
    start: () => ipcRenderer.invoke('docling:start'),
    stop: () => ipcRenderer.invoke('docling:stop'),
    restart: () => ipcRenderer.invoke('docling:restart'),
    getStatus: () => ipcRenderer.invoke('docling:getStatus'),
    healthCheck: () => ipcRenderer.invoke('docling:healthCheck'),
    checkPython: () => ipcRenderer.invoke('docling:checkPython'),
    isRunning: () => ipcRenderer.invoke('docling:isRunning'),

    // Configuration
    getConfig: () => ipcRenderer.invoke('docling:getConfig'),
    updateConfig: (updates: Partial<DoclingConfig>) => ipcRenderer.invoke('docling:updateConfig', updates),
    selectTempFolder: () => ipcRenderer.invoke('docling:selectTempFolder'),
    getTempFolderDiskSpace: () => ipcRenderer.invoke('docling:getTempFolderDiskSpace'),
    validateTempFolder: (folderPath: string) => ipcRenderer.invoke('docling:validateTempFolder', folderPath),

    // Document processing
    processDocument: (filePath: string, options?: DoclingProcessOptions) =>
      ipcRenderer.invoke('docling:processDocument', filePath, options),
    processBatch: (filePaths: string[], options?: DoclingProcessOptions) =>
      ipcRenderer.invoke('docling:processBatch', filePaths, options),
    getJobStatus: (jobId: string) => ipcRenderer.invoke('docling:getJobStatus', jobId),
    listJobs: () => ipcRenderer.invoke('docling:listJobs'),
    cancelJob: (jobId: string) => ipcRenderer.invoke('docling:cancelJob', jobId),

    // Logs
    getLogs: (lines?: number, traceId?: string) => ipcRenderer.invoke('docling:getLogs', lines, traceId),
    clearLogs: () => ipcRenderer.invoke('docling:clearLogs'),

    // Events
    onStatusChange: (callback: (status: DoclingStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: DoclingStatus) => callback(status);
      ipcRenderer.on('docling:statusChange', listener);
      return () => ipcRenderer.removeListener('docling:statusChange', listener);
    },
    onRestartAttempt: (callback: (attempt: number, maxAttempts: number) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, attempt: number, maxAttempts: number) =>
        callback(attempt, maxAttempts);
      ipcRenderer.on('docling:restartAttempt', listener);
      return () => ipcRenderer.removeListener('docling:restartAttempt', listener);
    },
    onMaxRestartsExceeded: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('docling:maxRestartsExceeded', listener);
      return () => ipcRenderer.removeListener('docling:maxRestartsExceeded', listener);
    },
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);
