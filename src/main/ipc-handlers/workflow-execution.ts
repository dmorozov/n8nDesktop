/**
 * IPC Handlers for Workflow Execution Popup
 *
 * Handles IPC communication between renderer and main process
 * for workflow popup functionality.
 *
 * Feature: 010-workflow-execution-popup
 */

import { IpcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WorkflowExecutor } from '../services/workflow-executor';
import { N8nAuthManager } from '../services/n8n-auth-manager';
import {
  getPopupConfig,
  setPopupConfig,
  deletePopupConfig,
  clearLastExecution,
  updateLastExecution,
  setLastExecutionId,
  getLastExecutionId,
  clearLastExecutionId,
} from '../stores/popup-config-store';
import type {
  WorkflowPopupConfig,
  ExecuteWorkflowRequest,
  FileSelectOptions,
  FileSaveOptions,
  FileReference,
} from '../../shared/types/workflow-popup';

/** Track active popup by workflow ID (FR-029: one popup per workflow) */
const activePopups = new Set<string>();

/** Track ongoing executions */
const ongoingExecutions = new Map<string, { workflowId: string; startTime: number }>();

/**
 * Get MIME type from file extension
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    json: 'application/json',
  };
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Register all workflow execution popup IPC handlers
 */
export function registerWorkflowExecutionHandlers(
  ipcMain: IpcMain,
  getN8nPort: () => number,
  authManager: N8nAuthManager
): void {
  // Create workflow executor instance
  const executor = new WorkflowExecutor(getN8nPort, authManager);

  // ==================== WORKFLOW ANALYSIS ====================

  /**
   * Analyze workflow to detect input/output nodes
   */
  ipcMain.handle('workflow-popup:analyze', async (_event, workflowId: string) => {
    console.log(`[IPC] workflow-popup:analyze called for workflowId: "${workflowId}"`);
    try {
      const result = await executor.analyzeWorkflow(workflowId);
      console.log(`[IPC] workflow-popup:analyze result:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error(`[IPC] workflow-popup:analyze error:`, error);
      throw error;
    }
  });

  // ==================== CONFIG MANAGEMENT ====================

  /**
   * Get popup configuration for a workflow
   */
  ipcMain.handle('workflow-popup:get-config', async (_event, workflowId: string) => {
    console.log(`[IPC] workflow-popup:get-config called for ${workflowId}`);
    return getPopupConfig(workflowId);
  });

  /**
   * Save popup configuration for a workflow
   */
  ipcMain.handle('workflow-popup:save-config', async (_event, config: WorkflowPopupConfig) => {
    console.log(`[IPC] workflow-popup:save-config called for ${config.workflowId}`);
    try {
      setPopupConfig(config);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error saving popup config:', error);
      return { success: false };
    }
  });

  /**
   * Delete popup configuration for a workflow
   */
  ipcMain.handle('workflow-popup:delete-config', async (_event, workflowId: string) => {
    console.log(`[IPC] workflow-popup:delete-config called for ${workflowId}`);
    const deleted = deletePopupConfig(workflowId);
    return { success: deleted };
  });

  // ==================== EXECUTION ====================

  /**
   * Execute workflow with inputs
   */
  ipcMain.handle('workflow-popup:execute', async (_event, request: ExecuteWorkflowRequest) => {
    console.log(`[IPC] workflow-popup:execute called for ${request.workflowId}`);
    console.log(`[IPC] Input node IDs:`, Object.keys(request.inputs));
    for (const [nodeId, input] of Object.entries(request.inputs)) {
      console.log(`[IPC] Input ${nodeId}: type=${input.nodeType}, valueLen=${typeof input.value === 'string' ? input.value.length : 'files'}`);
    }

    // Check if already executing this workflow (FR-004a)
    if (ongoingExecutions.has(request.workflowId)) {
      return {
        success: false,
        error: 'Workflow is already executing. Please wait for it to complete.',
      };
    }

    // Clear last execution results (FR-020)
    clearLastExecution(request.workflowId);

    // Execute workflow
    const result = await executor.executeWorkflow(request);

    if (result.success && result.executionId) {
      // Track ongoing execution
      ongoingExecutions.set(request.workflowId, {
        workflowId: request.workflowId,
        startTime: Date.now(),
      });

      // Store execution ID for popup resumption
      setLastExecutionId(request.workflowId, result.executionId);

      // Start polling in background (don't await)
      pollAndCompleteExecution(
        executor,
        request.workflowId,
        result.executionId,
        request.timeout
      );
    }

    return result;
  });

  /**
   * Check if a workflow has an ongoing execution
   */
  ipcMain.handle('workflow-popup:get-ongoing-execution', async (_event, workflowId: string) => {
    console.log(`[IPC:get-ongoing-execution] Called for workflow ${workflowId}`);

    // Check if there's an ongoing execution in memory
    const ongoing = ongoingExecutions.get(workflowId);
    console.log(`[IPC:get-ongoing-execution] ongoingExecutions.has(${workflowId}): ${!!ongoing}`);

    if (ongoing) {
      const executionId = getLastExecutionId(workflowId);
      console.log(`[IPC:get-ongoing-execution] Returning isRunning=true, executionId=${executionId}`);
      return {
        isRunning: true,
        executionId,
      };
    }

    // Check if there's a stored execution ID that we should check status for
    const lastExecutionId = getLastExecutionId(workflowId);
    console.log(`[IPC:get-ongoing-execution] lastExecutionId from store: ${lastExecutionId}`);

    // Also check the stored lastExecution result
    const storedConfig = getPopupConfig(workflowId);
    console.log(`[IPC:get-ongoing-execution] storedConfig.lastExecution: ${storedConfig?.lastExecution ? JSON.stringify({
      executionId: storedConfig.lastExecution.executionId,
      status: storedConfig.lastExecution.status,
      error: storedConfig.lastExecution.error
    }) : 'null'}`);

    if (lastExecutionId) {
      try {
        // Check if this execution is still running
        const status = await executor.getExecutionStatus(lastExecutionId);
        console.log(`[IPC:get-ongoing-execution] executor.getExecutionStatus returned: status=${status.status}, hasResult=${!!status.result}`);

        if (status.status === 'running' || status.status === 'waiting') {
          console.log(`[IPC:get-ongoing-execution] Returning isRunning=true (still running)`);
          return {
            isRunning: true,
            executionId: lastExecutionId,
          };
        }

        // Execution completed - prefer the result from status, fall back to stored result
        const result = status.result || storedConfig?.lastExecution;
        console.log(`[IPC:get-ongoing-execution] Returning isRunning=false, result status=${result?.status}, error=${result?.error}`);
        return {
          isRunning: false,
          executionId: lastExecutionId,
          result: result,
        };
      } catch (error) {
        console.log(`[IPC:get-ongoing-execution] Error getting status for execution ${lastExecutionId}:`, error);

        // If we have a stored result, return it instead of clearing
        if (storedConfig?.lastExecution) {
          console.log(`[IPC:get-ongoing-execution] Returning stored lastExecution result`);
          return {
            isRunning: false,
            executionId: lastExecutionId,
            result: storedConfig.lastExecution,
          };
        }

        clearLastExecutionId(workflowId);
        return {
          isRunning: false,
          executionId: null,
        };
      }
    }

    // No lastExecutionId, but check if we have a stored result anyway
    if (storedConfig?.lastExecution) {
      console.log(`[IPC:get-ongoing-execution] No lastExecutionId but have stored lastExecution, returning it`);
      return {
        isRunning: false,
        executionId: storedConfig.lastExecution.executionId,
        result: storedConfig.lastExecution,
      };
    }

    console.log(`[IPC:get-ongoing-execution] No execution found, returning default`);
    return {
      isRunning: false,
      executionId: null,
    };
  });

  /**
   * Get execution status
   */
  ipcMain.handle('workflow-popup:status', async (_event, executionId: string) => {
    return executor.getExecutionStatus(executionId);
  });

  /**
   * Cancel ongoing execution
   */
  ipcMain.handle('workflow-popup:cancel', async (_event, executionId: string) => {
    console.log(`[IPC] workflow-popup:cancel called for ${executionId}`);

    const result = await executor.cancelExecution(executionId);

    // Clean up tracking
    for (const [workflowId, exec] of ongoingExecutions.entries()) {
      if (exec.workflowId === workflowId) {
        ongoingExecutions.delete(workflowId);
        break;
      }
    }

    return result;
  });

  // ==================== FILE OPERATIONS ====================

  /**
   * Open file selection dialog
   */
  ipcMain.handle('workflow-popup:select-files', async (_event, options: FileSelectOptions) => {
    console.log('[IPC] workflow-popup:select-files called');

    const focusedWindow = BrowserWindow.getFocusedWindow();

    const result = await dialog.showOpenDialog(focusedWindow || (undefined as unknown as BrowserWindow), {
      title: options.title || 'Select Files',
      defaultPath: options.defaultPath,
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
      properties: options.multiSelect !== false
        ? ['openFile', 'multiSelections']
        : ['openFile'],
    });

    if (result.canceled) {
      return {
        cancelled: true,
        filePaths: [],
        files: [],
      };
    }

    // Build file references (FR-010a: max 10 files)
    const files: FileReference[] = [];
    const maxFiles = 10;

    for (const filePath of result.filePaths.slice(0, maxFiles)) {
      try {
        const stats = fs.statSync(filePath);
        const ext = path.extname(filePath).slice(1).toLowerCase();

        files.push({
          id: crypto.randomUUID(),
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          mimeType: getMimeType(ext),
          selectedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[IPC] Error getting file info for ${filePath}:`, error);
      }
    }

    return {
      cancelled: false,
      filePaths: result.filePaths.slice(0, maxFiles),
      files,
    };
  });

  /**
   * Open save file dialog
   */
  ipcMain.handle('workflow-popup:save-file', async (_event, options: FileSaveOptions) => {
    console.log('[IPC] workflow-popup:save-file called');

    const focusedWindow = BrowserWindow.getFocusedWindow();

    const result = await dialog.showSaveDialog(focusedWindow || (undefined as unknown as BrowserWindow), {
      title: options.title || 'Save File',
      defaultPath: options.defaultPath,
      filters: options.filters,
    });

    return {
      cancelled: result.canceled,
      filePath: result.filePath,
    };
  });

  /**
   * Copy output file to user-selected location
   */
  ipcMain.handle(
    'workflow-popup:copy-output-file',
    async (_event, sourcePath: string, destinationPath: string) => {
      console.log(`[IPC] workflow-popup:copy-output-file from ${sourcePath} to ${destinationPath}`);

      try {
        // Verify source exists
        if (!fs.existsSync(sourcePath)) {
          return {
            success: false,
            error: 'Source file not found',
          };
        }

        // Copy file
        fs.copyFileSync(sourcePath, destinationPath);

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to copy file';
        console.error('[IPC] Error copying file:', message);
        return {
          success: false,
          error: message,
        };
      }
    }
  );

  // ==================== POPUP TRACKING ====================

  /**
   * Track popup opened (FR-029)
   */
  ipcMain.handle('workflow-popup:opened', async (_event, workflowId: string) => {
    if (activePopups.has(workflowId)) {
      return { success: false, error: 'Popup already open for this workflow' };
    }
    activePopups.add(workflowId);
    return { success: true };
  });

  /**
   * Track popup closed
   */
  ipcMain.handle('workflow-popup:closed', async (_event, workflowId: string) => {
    activePopups.delete(workflowId);
    return { success: true };
  });
}

/**
 * Poll execution until complete and update config with results
 */
async function pollAndCompleteExecution(
  executor: WorkflowExecutor,
  workflowId: string,
  executionId: string,
  timeout?: number
): Promise<void> {
  console.log(`[IPC:pollAndComplete] Starting background poll for workflow=${workflowId}, executionId=${executionId}`);

  let finalStatus: 'success' | 'error' | 'timeout' = 'error';

  try {
    const result = await executor.pollExecution(executionId, timeout);

    console.log(`[IPC:pollAndComplete] Poll completed. Result: status=${result.status}, error=${result.error}, outputs=${result.outputs?.length || 0}`);

    finalStatus = result.status;

    // Store result in config
    updateLastExecution(workflowId, result);
    console.log(`[IPC:pollAndComplete] Stored result via updateLastExecution for workflow=${workflowId}`);

    console.log(`[IPC:pollAndComplete] Execution ${executionId} completed with status: ${result.status}`);
  } catch (error) {
    console.error(`[IPC:pollAndComplete] Error polling execution ${executionId}:`, error);

    finalStatus = 'error';

    // Store error result so popup can show it
    const errorResult = {
      executionId,
      status: 'error' as const,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      outputs: [],
      error: error instanceof Error ? error.message : 'Unknown polling error',
    };
    updateLastExecution(workflowId, errorResult);
    console.log(`[IPC:pollAndComplete] Stored error result for workflow=${workflowId}`);
  } finally {
    // Clean up tracking
    console.log(`[IPC:pollAndComplete] Cleaning up ongoingExecutions for workflow=${workflowId}`);
    ongoingExecutions.delete(workflowId);
    // Note: We keep lastExecutionId so popup can show results when reopened

    // Notify renderer that execution completed so it can update UI
    const { BrowserWindow } = await import('electron');
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('workflow-execution:completed', {
        workflowId,
        executionId,
        status: finalStatus,
      });
    }
    console.log(`[IPC:pollAndComplete] Sent workflow-execution:completed event to renderer`);
  }
}
