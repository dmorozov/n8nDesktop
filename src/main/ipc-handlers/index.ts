import { IpcMain, dialog, shell, app } from 'electron';
import { N8nManager } from '../n8n-manager';
import { ConfigManager, AppConfig, AIServiceConfig } from '../config-manager';
import { showEditor, hideEditor, isEditorShowing } from '../index';
import { registerWorkflowHandlers } from './workflows';
import { registerStorageHandlers } from './storage';
import { testConnection, getModels } from '../services/ai-service-tester';
import { BackupManager } from '../services/backup-manager';
import { N8nAuthManager } from '../services/n8n-auth-manager';
import { N8nCredentialSync } from '../services/n8n-credential-sync';
import fs from 'fs/promises';
import path from 'path';

export function registerIpcHandlers(
  ipcMain: IpcMain,
  n8nManager: N8nManager,
  configManager: ConfigManager,
  authManager: N8nAuthManager,
  credentialSync: N8nCredentialSync | null
): void {
  // ==================== N8N HANDLERS ====================

  /**
   * Start n8n server
   */
  ipcMain.handle('n8n:start', async () => {
    const result = await n8nManager.start();
    if (result.success) {
      // Set up owner account after server starts
      try {
        const ready = await authManager.waitForN8nReady();
        if (ready) {
          await authManager.ensureAuthenticated();

          // Sync AI services to n8n credentials after authentication
          if (credentialSync) {
            console.log('Syncing AI services to n8n credentials...');
            await credentialSync.syncAllServices();
          }
        }
      } catch (error) {
        console.error('Error setting up n8n auth after start:', error);
      }
    }
    return result;
  });

  /**
   * Stop n8n server
   */
  ipcMain.handle('n8n:stop', async () => {
    await n8nManager.stop();
    return { success: true };
  });

  /**
   * Restart n8n server
   */
  ipcMain.handle('n8n:restart', async () => {
    // Clear session before restart
    authManager.clearSession();
    const result = await n8nManager.restart();
    if (result.success) {
      // Re-authenticate after restart
      try {
        const ready = await authManager.waitForN8nReady();
        if (ready) {
          await authManager.ensureAuthenticated();

          // Re-sync AI services after restart
          if (credentialSync) {
            console.log('Re-syncing AI services to n8n credentials after restart...');
            await credentialSync.syncAllServices();
          }
        }
      } catch (error) {
        console.error('Error setting up n8n auth after restart:', error);
      }
    }
    return result;
  });

  /**
   * Get n8n status
   */
  ipcMain.handle('n8n:getStatus', () => {
    return n8nManager.getStatus();
  });

  /**
   * Get n8n logs
   */
  ipcMain.handle('n8n:getLogs', (_event, lines?: number) => {
    return n8nManager.getLogs(lines);
  });

  /**
   * Clear n8n logs
   */
  ipcMain.handle('n8n:clearLogs', () => {
    n8nManager.clearLogs();
    return { success: true };
  });

  /**
   * Check if n8n is running
   */
  ipcMain.handle('n8n:isRunning', () => {
    return n8nManager.isRunning();
  });

  // ==================== CONFIG HANDLERS ====================

  /**
   * Get a config value
   */
  ipcMain.handle('config:get', <K extends keyof AppConfig>(_event: Electron.IpcMainInvokeEvent, key: K) => {
    return configManager.get(key);
  });

  /**
   * Set a config value
   */
  ipcMain.handle('config:set', <K extends keyof AppConfig>(_event: Electron.IpcMainInvokeEvent, key: K, value: AppConfig[K]) => {
    configManager.set(key, value);

    // Handle auto-launch setting
    if (key === 'startWithSystem') {
      const boolValue = Boolean(value);
      try {
        app.setLoginItemSettings({
          openAtLogin: boolValue,
          // On macOS, run hidden when starting at login
          openAsHidden: process.platform === 'darwin' && boolValue,
        });
        console.log(`Set login item settings: openAtLogin=${boolValue}`);
      } catch (error) {
        console.error('Failed to set login item settings:', error);
      }
    }

    return { success: true };
  });

  /**
   * Get all config - syncs login item state with stored config
   */
  ipcMain.handle('config:getAll', () => {
    const config = configManager.getAll();

    // Sync login item state with config (in case it was changed externally)
    try {
      const loginItemSettings = app.getLoginItemSettings();
      if (config.startWithSystem !== loginItemSettings.openAtLogin) {
        // Update config to match actual system state
        configManager.set('startWithSystem', loginItemSettings.openAtLogin);
        config.startWithSystem = loginItemSettings.openAtLogin;
        console.log(`Synced startWithSystem config with system: ${loginItemSettings.openAtLogin}`);
      }
    } catch (error) {
      console.warn('Failed to get login item settings:', error);
    }

    return config;
  });

  /**
   * Set multiple config values
   */
  ipcMain.handle('config:setMultiple', (_event, values: Partial<AppConfig>) => {
    configManager.setMultiple(values);

    // Handle auto-launch setting if included
    if ('startWithSystem' in values && values.startWithSystem !== undefined) {
      const boolValue = Boolean(values.startWithSystem);
      try {
        app.setLoginItemSettings({
          openAtLogin: boolValue,
          openAsHidden: process.platform === 'darwin' && boolValue,
        });
        console.log(`Set login item settings (multiple): openAtLogin=${boolValue}`);
      } catch (error) {
        console.error('Failed to set login item settings:', error);
      }
    }

    return { success: true };
  });

  /**
   * Reset config to defaults
   */
  ipcMain.handle('config:reset', () => {
    configManager.reset();
    return { success: true };
  });

  // ==================== AI SERVICE HANDLERS ====================

  /**
   * Get all AI services
   */
  ipcMain.handle('config:getAIServices', () => {
    return configManager.getAIServices();
  });

  /**
   * Add an AI service
   */
  ipcMain.handle('config:addAIService', async (_event, service: Omit<AIServiceConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newService = configManager.addAIService(service);

    // Sync to n8n if running
    if (credentialSync && n8nManager.isRunning()) {
      try {
        await credentialSync.onServiceAdded(newService);
      } catch (error) {
        console.error('Failed to sync new AI service to n8n:', error);
      }
    }

    return newService;
  });

  /**
   * Update an AI service
   */
  ipcMain.handle('config:updateAIService', async (_event, id: string, updates: Partial<Omit<AIServiceConfig, 'id' | 'createdAt'>>) => {
    const updatedService = configManager.updateAIService(id, updates);

    // Sync to n8n if running
    if (updatedService && credentialSync && n8nManager.isRunning()) {
      try {
        await credentialSync.onServiceUpdated(updatedService);
      } catch (error) {
        console.error('Failed to sync updated AI service to n8n:', error);
      }
    }

    return updatedService;
  });

  /**
   * Delete an AI service
   */
  ipcMain.handle('config:deleteAIService', async (_event, id: string) => {
    // Get service name before deleting for the sync
    const services = configManager.getAIServices();
    const serviceToDelete = services.find(s => s.id === id);
    const serviceName = serviceToDelete?.name || '';

    const success = configManager.deleteAIService(id);

    // Sync deletion to n8n if running
    if (success && credentialSync && n8nManager.isRunning()) {
      try {
        await credentialSync.onServiceDeleted(id, serviceName);
      } catch (error) {
        console.error('Failed to sync AI service deletion to n8n:', error);
      }
    }

    return success;
  });

  /**
   * Test AI service connection
   */
  ipcMain.handle('ai:testConnection', async (_event, serviceId: string) => {
    const services = configManager.getAIServices();
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      return { success: false, error: 'Service not found' };
    }
    return testConnection(service);
  });

  /**
   * Get available models from AI service
   */
  ipcMain.handle('ai:getModels', async (_event, serviceId: string) => {
    const services = configManager.getAIServices();
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      return { success: false, error: 'Service not found' };
    }
    return getModels(service);
  });

  // ==================== DIALOG HANDLERS ====================

  /**
   * Show folder picker dialog
   */
  ipcMain.handle('dialog:selectFolder', async (_event, options?: { title?: string; defaultPath?: string }) => {
    const result = await dialog.showOpenDialog({
      title: options?.title ?? 'Select Folder',
      defaultPath: options?.defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
  });

  /**
   * Show file picker dialog
   */
  ipcMain.handle('dialog:selectFile', async (_event, options?: {
    title?: string;
    defaultPath?: string;
    filters?: Electron.FileFilter[];
  }) => {
    const result = await dialog.showOpenDialog({
      title: options?.title ?? 'Select File',
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
  });

  /**
   * Show save dialog
   */
  ipcMain.handle('dialog:saveFile', async (_event, options?: {
    title?: string;
    defaultPath?: string;
    filters?: Electron.FileFilter[];
  }) => {
    const result = await dialog.showSaveDialog({
      title: options?.title ?? 'Save File',
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePath };
  });

  /**
   * Show message box
   */
  ipcMain.handle('dialog:showMessage', async (_event, options: {
    type?: 'none' | 'info' | 'error' | 'question' | 'warning';
    title?: string;
    message: string;
    detail?: string;
    buttons?: string[];
  }) => {
    const result = await dialog.showMessageBox({
      type: options.type ?? 'info',
      title: options.title,
      message: options.message,
      detail: options.detail,
      buttons: options.buttons ?? ['OK'],
    });

    return { response: result.response };
  });

  // ==================== SHELL HANDLERS ====================

  /**
   * Open external URL
   */
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  /**
   * Open path in file explorer
   */
  ipcMain.handle('shell:showItemInFolder', (_event, path: string) => {
    shell.showItemInFolder(path);
    return { success: true };
  });

  /**
   * Open path with default application
   */
  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    const result = await shell.openPath(filePath);
    return { success: !result, error: result || undefined };
  });

  // ==================== EDITOR HANDLERS ====================

  /**
   * Open n8n editor in WebContentsView
   */
  ipcMain.handle('editor:open', async (_event, workflowId?: string) => {
    await showEditor(workflowId);
    return { success: true };
  });

  /**
   * Close n8n editor and return to launcher
   */
  ipcMain.handle('editor:close', () => {
    console.log('[IPC] editor:close handler called');
    hideEditor();
    return { success: true };
  });

  /**
   * Check if editor is visible
   */
  ipcMain.handle('editor:isVisible', () => {
    return isEditorShowing();
  });

  // ==================== WORKFLOW IMPORT/EXPORT HANDLERS ====================

  /**
   * Import workflow from JSON file
   */
  ipcMain.handle('workflows:import', async (_event, filePath?: string) => {
    try {
      let selectedPath = filePath;

      // Show file picker if no path provided
      if (!selectedPath) {
        const result = await dialog.showOpenDialog({
          title: 'Import Workflow',
          filters: [{ name: 'JSON Files', extensions: ['json'] }],
          properties: ['openFile'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, canceled: true };
        }

        selectedPath = result.filePaths[0];
      }

      // Read the file
      let fileContent: string;
      try {
        fileContent = await fs.readFile(selectedPath, 'utf-8');
      } catch (readError) {
        const errorCode = (readError as NodeJS.ErrnoException).code;
        if (errorCode === 'ENOENT') {
          return { success: false, error: 'File not found. The file may have been moved or deleted.' };
        }
        if (errorCode === 'EACCES') {
          return { success: false, error: 'Permission denied. Unable to read the file.' };
        }
        throw readError;
      }

      // Check for empty file
      if (!fileContent.trim()) {
        return { success: false, error: 'The workflow file is empty.' };
      }

      // Parse JSON with better error handling
      let workflowData;
      try {
        workflowData = JSON.parse(fileContent);
      } catch (parseError) {
        const fileName = path.basename(selectedPath);
        if (parseError instanceof SyntaxError) {
          // Try to extract position info from the error message
          const posMatch = parseError.message.match(/position (\d+)/);
          const position = posMatch ? posMatch[1] : 'unknown';
          return {
            success: false,
            error: `Corrupted workflow file: "${fileName}" contains invalid JSON. Error at position ${position}. The file may be damaged or not a valid n8n workflow.`,
          };
        }
        return {
          success: false,
          error: `Failed to parse workflow file: "${fileName}". The file may be corrupted.`,
        };
      }

      // Validate it has required workflow structure
      if (typeof workflowData !== 'object' || workflowData === null) {
        return { success: false, error: 'Invalid workflow file: expected a JSON object.' };
      }

      if (!workflowData.name && !workflowData.nodes) {
        return {
          success: false,
          error: 'Invalid workflow file: missing required fields (name or nodes). This may not be an n8n workflow file.',
        };
      }

      // Additional validation for nodes array
      if (workflowData.nodes && !Array.isArray(workflowData.nodes)) {
        return { success: false, error: 'Invalid workflow file: "nodes" must be an array.' };
      }

      return {
        success: true,
        data: {
          ...workflowData,
          filePath: selectedPath,
          fileName: path.basename(selectedPath),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import workflow';
      console.error('Error importing workflow:', message);
      return { success: false, error: message };
    }
  });

  /**
   * Export workflow to JSON file
   */
  ipcMain.handle('workflows:export', async (_event, workflow: unknown, suggestedName?: string) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export Workflow',
        defaultPath: suggestedName || 'workflow.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      // Write workflow to file
      await fs.writeFile(result.filePath, JSON.stringify(workflow, null, 2), 'utf-8');

      return { success: true, path: result.filePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export workflow';
      console.error('Error exporting workflow:', message);
      return { success: false, error: message };
    }
  });

  // ==================== REGISTER WORKFLOW HANDLERS ====================

  registerWorkflowHandlers(ipcMain, configManager, () => n8nManager.getPort(), authManager);

  // ==================== REGISTER STORAGE HANDLERS ====================

  const backupManager = new BackupManager(configManager);
  registerStorageHandlers(
    ipcMain,
    configManager,
    backupManager,
    () => n8nManager.hasRunningWorkflows()
  );
}
