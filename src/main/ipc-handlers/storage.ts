/**
 * Storage IPC Handlers - Handles storage-related operations
 */

import { IpcMain, dialog } from 'electron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ConfigManager } from '../config-manager';
import { BackupManager } from '../services/backup-manager';

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

export function registerStorageHandlers(
  ipcMain: IpcMain,
  configManager: ConfigManager,
  backupManager: BackupManager,
  isWorkflowRunning: () => boolean
): void {
  /**
   * Get the current data folder
   */
  ipcMain.handle('storage:getDataFolder', () => {
    return configManager.get('dataFolder');
  });

  /**
   * Check if data folder is accessible
   * Uses retry logic to handle transient file system issues during startup
   */
  ipcMain.handle('storage:checkDataFolder', async (): Promise<DataFolderStatus> => {
    const dataFolder = configManager.get('dataFolder');

    // Check if folder exists
    if (!existsSync(dataFolder)) {
      // Try to create the folder if it doesn't exist
      try {
        await fs.mkdir(dataFolder, { recursive: true });
        console.log('Created data folder:', dataFolder);
      } catch (createError) {
        console.error('Failed to create data folder:', createError);
        return {
          accessible: false,
          exists: false,
          writable: false,
          errorType: 'not_found',
          dataFolder,
        };
      }
    }

    // Check if folder is writable with retry logic
    // This helps with transient issues during app startup when folder might be briefly locked
    const maxRetries = 3;
    const retryDelay = 500; // ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const testFile = path.join(dataFolder, '.write-test-' + Date.now() + '-' + attempt);
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        return {
          accessible: true,
          exists: true,
          writable: true,
          dataFolder,
        };
      } catch (error) {
        const errorCode = (error as NodeJS.ErrnoException).code;
        console.warn(`Data folder write test attempt ${attempt}/${maxRetries} failed:`, errorCode);

        // If this is not the last attempt and the error might be transient, retry
        if (attempt < maxRetries && (errorCode === 'EBUSY' || errorCode === 'EAGAIN' || errorCode === 'ENOENT')) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // Permanent error or last attempt failed
        let errorType: 'not_writable' | 'permission_denied' = 'not_writable';
        if (errorCode === 'EACCES' || errorCode === 'EPERM') {
          errorType = 'permission_denied';
        }

        return {
          accessible: false,
          exists: true,
          writable: false,
          errorType,
          dataFolder,
        };
      }
    }

    // Should not reach here, but return success if we do
    return {
      accessible: true,
      exists: true,
      writable: true,
      dataFolder,
    };
  });

  /**
   * Select a new data folder
   */
  ipcMain.handle('storage:selectDataFolder', async () => {
    // Check if workflows are running
    if (isWorkflowRunning()) {
      return {
        success: false,
        error: 'Cannot change data folder while workflows are running',
      };
    }

    const currentFolder = configManager.get('dataFolder');

    const result = await dialog.showOpenDialog({
      title: 'Select Data Folder',
      defaultPath: currentFolder,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const newFolder = result.filePaths[0];

    // Validate the folder is writable
    try {
      const testFile = path.join(newFolder, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
    } catch {
      return {
        success: false,
        error: 'The selected folder is not writable',
      };
    }

    // Update the config
    configManager.set('dataFolder', newFolder);

    return { success: true, path: newFolder };
  });

  /**
   * Get storage statistics
   */
  ipcMain.handle('storage:getStats', async () => {
    const dataFolder = configManager.get('dataFolder');

    try {
      const stats = await calculateStorageStats(dataFolder);
      return { success: true, stats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get storage stats',
      };
    }
  });

  /**
   * Clear cache (logs and temporary files)
   */
  ipcMain.handle('storage:clearCache', async () => {
    const dataFolder = configManager.get('dataFolder');
    const logsDir = path.join(dataFolder, 'logs');

    try {
      if (existsSync(logsDir)) {
        const files = await fs.readdir(logsDir);
        for (const file of files) {
          await fs.unlink(path.join(logsDir, file));
        }
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear cache',
      };
    }
  });

  /**
   * Check if data folder can be changed (no workflows running)
   */
  ipcMain.handle('storage:canChangeDataFolder', () => {
    return !isWorkflowRunning();
  });

  // ==================== BACKUP HANDLERS ====================

  /**
   * Create a backup
   */
  ipcMain.handle('storage:createBackup', async () => {
    return backupManager.createBackup();
  });

  /**
   * Restore from a backup
   */
  ipcMain.handle('storage:restoreBackup', async (_event, backupPath?: string) => {
    // Check if workflows are running
    if (isWorkflowRunning()) {
      return {
        success: false,
        error: 'Cannot restore while workflows are running',
      };
    }

    let selectedPath = backupPath;

    // If no path provided, show file picker
    if (!selectedPath) {
      const result = await dialog.showOpenDialog({
        title: 'Select Backup File',
        filters: [{ name: 'Backup Files', extensions: ['tar.gz'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      selectedPath = result.filePaths[0];
    }

    // Confirm restore
    const confirmResult = await dialog.showMessageBox({
      type: 'warning',
      title: 'Confirm Restore',
      message: 'Are you sure you want to restore from this backup?',
      detail: 'This will overwrite your current data. Make sure to backup your current data first if needed.',
      buttons: ['Cancel', 'Restore'],
      defaultId: 0,
      cancelId: 0,
    });

    if (confirmResult.response === 0) {
      return { success: false, canceled: true };
    }

    return backupManager.restoreBackup(selectedPath);
  });

  /**
   * List available backups
   */
  ipcMain.handle('storage:listBackups', async () => {
    return backupManager.listBackups();
  });

  /**
   * Delete a backup
   */
  ipcMain.handle('storage:deleteBackup', async (_event, backupId: string) => {
    return backupManager.deleteBackup(backupId);
  });
}

/**
 * Calculate storage statistics for a folder
 */
async function calculateStorageStats(dataFolder: string): Promise<StorageStats> {
  const stats: StorageStats = {
    dataFolder,
    totalSize: 0,
    workflowsSize: 0,
    logsSize: 0,
    backupsSize: 0,
  };

  async function calculateDirSize(dir: string): Promise<number> {
    let size = 0;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          size += await calculateDirSize(fullPath);
        } else if (entry.isFile()) {
          const fileStat = await fs.stat(fullPath);
          size += fileStat.size;
        }
      }
    } catch {
      // Skip directories that can't be read
    }
    return size;
  }

  // Calculate total size
  if (existsSync(dataFolder)) {
    stats.totalSize = await calculateDirSize(dataFolder);
  }

  // Calculate workflows size (typically in workflows.json or sqlite db)
  const workflowsDir = path.join(dataFolder, '.n8n');
  if (existsSync(workflowsDir)) {
    stats.workflowsSize = await calculateDirSize(workflowsDir);
  }

  // Calculate logs size
  const logsDir = path.join(dataFolder, 'logs');
  if (existsSync(logsDir)) {
    stats.logsSize = await calculateDirSize(logsDir);
  }

  // Calculate backups size
  const backupsDir = path.join(dataFolder, 'backups');
  if (existsSync(backupsDir)) {
    stats.backupsSize = await calculateDirSize(backupsDir);
  }

  return stats;
}
