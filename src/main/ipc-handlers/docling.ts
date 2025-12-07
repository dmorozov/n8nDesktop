import { IpcMain, dialog, BrowserWindow } from 'electron';
import { DoclingManager, DoclingStatus } from '../docling-manager';
import { ConfigManager, DoclingConfig } from '../config-manager';
import { v4 as uuidv4 } from 'uuid';

interface DoclingProcessOptions {
  processingTier?: 'lightweight' | 'standard' | 'advanced';
  languages?: string[];
  forceFullPageOcr?: boolean;
  timeoutSeconds?: number;
}

/**
 * Register Docling-related IPC handlers
 */
export function registerDoclingHandlers(
  ipcMain: IpcMain,
  doclingManager: DoclingManager,
  configManager: ConfigManager,
  mainWindow: BrowserWindow | null
): void {
  // ==================== SERVICE MANAGEMENT ====================

  /**
   * Start Docling service
   */
  ipcMain.handle('docling:start', async () => {
    return doclingManager.start();
  });

  /**
   * Stop Docling service
   */
  ipcMain.handle('docling:stop', async () => {
    await doclingManager.stop();
    return { success: true };
  });

  /**
   * Restart Docling service
   */
  ipcMain.handle('docling:restart', async () => {
    return doclingManager.restart();
  });

  /**
   * Get Docling service status
   */
  ipcMain.handle('docling:getStatus', () => {
    return doclingManager.getStatus();
  });

  /**
   * Perform health check
   */
  ipcMain.handle('docling:healthCheck', async () => {
    return doclingManager.healthCheck();
  });

  /**
   * Check Python availability
   */
  ipcMain.handle('docling:checkPython', async () => {
    return doclingManager.checkPython();
  });

  /**
   * Check if Docling is running
   */
  ipcMain.handle('docling:isRunning', () => {
    return doclingManager.isRunning();
  });

  // ==================== CONFIGURATION ====================

  /**
   * Get Docling configuration
   */
  ipcMain.handle('docling:getConfig', () => {
    return configManager.getDoclingConfig();
  });

  /**
   * Update Docling configuration
   */
  ipcMain.handle('docling:updateConfig', async (_event, updates: Partial<DoclingConfig>) => {
    const config = configManager.updateDoclingConfig(updates);

    // Restart service if running and critical settings changed
    if (doclingManager.isRunning()) {
      const criticalChanges = ['port', 'processingTier', 'maxConcurrentJobs', 'authToken'];
      const needsRestart = criticalChanges.some((key) => key in updates);

      if (needsRestart) {
        await doclingManager.restart();
      }
    }

    return config;
  });

  /**
   * Select temp folder via dialog
   */
  ipcMain.handle('docling:selectTempFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Temporary Folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const selectedPath = result.filePaths[0];

    // Validate the folder
    if (!configManager.isDoclingTempFolderValid()) {
      return {
        success: false,
        error: 'Selected folder is not accessible or writable',
      };
    }

    // Update config
    configManager.updateDoclingConfig({ tempFolder: selectedPath });

    return { success: true, path: selectedPath };
  });

  // ==================== DOCUMENT PROCESSING ====================

  /**
   * Process a single document
   */
  ipcMain.handle('docling:processDocument', async (_event, filePath: string, options?: DoclingProcessOptions) => {
    if (!doclingManager.isRunning()) {
      return { success: false, error: 'Docling service is not running' };
    }

    const traceId = uuidv4();
    const config = configManager.getDoclingConfig();

    try {
      const response = await fetch(`${doclingManager.getApiBaseUrl()}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.authToken}`,
          'X-Trace-Id': traceId,
        },
        body: JSON.stringify({
          file_path: filePath,
          options: options ? {
            processing_tier: options.processingTier,
            languages: options.languages,
            force_full_page_ocr: options.forceFullPageOcr,
            timeout_seconds: options.timeoutSeconds,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        return {
          success: false,
          error: errorData.detail || `HTTP ${response.status}`,
          traceId,
        };
      }

      const data = await response.json();
      return {
        jobId: data.job_id,
        status: data.status,
        message: data.message,
        traceId: data.trace_id || traceId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process document',
        traceId,
      };
    }
  });

  /**
   * Process multiple documents
   */
  ipcMain.handle('docling:processBatch', async (_event, filePaths: string[], options?: DoclingProcessOptions) => {
    if (!doclingManager.isRunning()) {
      return { success: false, error: 'Docling service is not running' };
    }

    const traceId = uuidv4();
    const config = configManager.getDoclingConfig();

    try {
      const response = await fetch(`${doclingManager.getApiBaseUrl()}/process/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.authToken}`,
          'X-Trace-Id': traceId,
        },
        body: JSON.stringify({
          file_paths: filePaths,
          options: options ? {
            processing_tier: options.processingTier,
            languages: options.languages,
            force_full_page_ocr: options.forceFullPageOcr,
            timeout_seconds: options.timeoutSeconds,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        return {
          success: false,
          error: errorData.detail || `HTTP ${response.status}`,
          traceId,
        };
      }

      const data = await response.json();
      return {
        jobIds: data.job_ids,
        status: data.status,
        totalDocuments: data.total_documents,
        correlationId: data.correlation_id,
        traceId: data.trace_id || traceId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process documents',
        traceId,
      };
    }
  });

  /**
   * Get job status
   */
  ipcMain.handle('docling:getJobStatus', async (_event, jobId: string) => {
    if (!doclingManager.isRunning()) {
      return null;
    }

    const config = configManager.getDoclingConfig();

    try {
      const response = await fetch(`${doclingManager.getApiBaseUrl()}/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        jobId: data.job_id,
        filePath: data.file_path,
        status: data.status,
        progress: data.progress,
        result: data.result ? {
          status: data.result.status,
          markdown: data.result.markdown,
          metadata: data.result.metadata ? {
            pageCount: data.result.metadata.page_count,
            filePath: data.result.metadata.file_path,
            processingTier: data.result.metadata.processing_tier,
            format: data.result.metadata.format,
            processingTimeMs: data.result.metadata.processing_time_ms,
            ocrEngine: data.result.metadata.ocr_engine,
          } : undefined,
          error: data.result.error,
        } : undefined,
        error: data.error,
        errorType: data.error_type,
        createdAt: data.created_at,
        startedAt: data.started_at,
        completedAt: data.completed_at,
        traceId: data.trace_id,
      };
    } catch (error) {
      console.error('Error fetching job status:', error);
      return null;
    }
  });

  /**
   * List all jobs
   */
  ipcMain.handle('docling:listJobs', async () => {
    if (!doclingManager.isRunning()) {
      return [];
    }

    const config = configManager.getDoclingConfig();

    try {
      const response = await fetch(`${doclingManager.getApiBaseUrl()}/jobs`, {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const jobs = await response.json();
      return jobs.map((data: Record<string, unknown>) => ({
        jobId: data.job_id,
        filePath: data.file_path,
        status: data.status,
        progress: data.progress,
        result: data.result ? {
          status: (data.result as Record<string, unknown>).status,
          markdown: (data.result as Record<string, unknown>).markdown,
          metadata: (data.result as Record<string, unknown>).metadata ? {
            pageCount: ((data.result as Record<string, unknown>).metadata as Record<string, unknown>)?.page_count,
            filePath: ((data.result as Record<string, unknown>).metadata as Record<string, unknown>)?.file_path,
            processingTier: ((data.result as Record<string, unknown>).metadata as Record<string, unknown>)?.processing_tier,
            format: ((data.result as Record<string, unknown>).metadata as Record<string, unknown>)?.format,
            processingTimeMs: ((data.result as Record<string, unknown>).metadata as Record<string, unknown>)?.processing_time_ms,
            ocrEngine: ((data.result as Record<string, unknown>).metadata as Record<string, unknown>)?.ocr_engine,
          } : undefined,
          error: (data.result as Record<string, unknown>).error,
        } : undefined,
        error: data.error,
        errorType: data.error_type,
        createdAt: data.created_at,
        startedAt: data.started_at,
        completedAt: data.completed_at,
        traceId: data.trace_id,
      }));
    } catch (error) {
      console.error('Error listing jobs:', error);
      return [];
    }
  });

  /**
   * Cancel a job
   */
  ipcMain.handle('docling:cancelJob', async (_event, jobId: string) => {
    if (!doclingManager.isRunning()) {
      return { success: false, error: 'Docling service is not running' };
    }

    const config = configManager.getDoclingConfig();

    try {
      const response = await fetch(`${doclingManager.getApiBaseUrl()}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        return {
          success: false,
          error: errorData.detail || `HTTP ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel job',
      };
    }
  });

  // ==================== LOGS ====================

  /**
   * Get Docling logs
   */
  ipcMain.handle('docling:getLogs', (_event, lines?: number, traceId?: string) => {
    return doclingManager.getLogs(lines, traceId);
  });

  /**
   * Clear Docling logs
   */
  ipcMain.handle('docling:clearLogs', () => {
    doclingManager.clearLogs();
    return { success: true };
  });

  // ==================== EVENTS ====================

  // Forward status change events to renderer
  doclingManager.on('statusChange', (status: DoclingStatus) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('docling:statusChange', status);
    }
  });

  // Forward restart attempt events
  doclingManager.on('restartAttempt', (attempt: number, maxAttempts: number) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('docling:restartAttempt', attempt, maxAttempts);
    }
  });

  // Forward max restarts exceeded event
  doclingManager.on('maxRestartsExceeded', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('docling:maxRestartsExceeded');
    }
  });
}
