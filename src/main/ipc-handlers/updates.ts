import { IpcMain, shell, BrowserWindow } from 'electron';
import { UpdateChecker, UpdateInfo, UpdateCheckResult } from '../services/update-checker';

export function registerUpdateHandlers(
  ipcMain: IpcMain,
  updateChecker: UpdateChecker,
  getMainWindow: () => BrowserWindow | null
): void {
  /**
   * Check for updates
   */
  ipcMain.handle('updates:check', async (): Promise<UpdateCheckResult> => {
    return updateChecker.checkForUpdates();
  });

  /**
   * Get cached update info
   */
  ipcMain.handle('updates:getInfo', (): UpdateInfo | null => {
    return updateChecker.getCachedUpdateInfo();
  });

  /**
   * Get current app version
   */
  ipcMain.handle('updates:getCurrentVersion', (): string => {
    return updateChecker.getCurrentVersion();
  });

  /**
   * Download update (opens browser to download page)
   */
  ipcMain.handle('updates:download', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const downloadUrl = updateChecker.getDownloadUrl();
      if (!downloadUrl) {
        return { success: false, error: 'No download URL available' };
      }

      await shell.openExternal(downloadUrl);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open download page',
      };
    }
  });

  /**
   * Dismiss update notification
   */
  ipcMain.handle('updates:dismiss', (): { success: boolean } => {
    updateChecker.dismissUpdate();
    return { success: true };
  });

  /**
   * Get last check time
   */
  ipcMain.handle('updates:getLastCheckTime', (): string | null => {
    const lastCheck = updateChecker.getLastCheckTime();
    return lastCheck ? lastCheck.toISOString() : null;
  });

  // Forward update events to renderer
  updateChecker.on('updateAvailable', (info: UpdateInfo) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('updates:available', info);
    }
  });

  updateChecker.on('updateDismissed', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('updates:dismissed');
    }
  });
}
