/**
 * Electron Bridge Service
 *
 * HTTP server that provides an API for n8n custom nodes to communicate
 * with Electron's main process for native OS integrations.
 */

import http from 'http';
import { dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ConfigManager } from '../config-manager';

/** Default port for the Electron bridge */
// Note: Port 5679 is reserved for n8n Task Broker, so we use 5680
const DEFAULT_BRIDGE_PORT = 5680;

/** File reference structure */
interface IFileReference {
  id: string;
  originalName: string;
  originalPath: string;
  destinationPath: string;
  size: number;
  mimeType: string;
  extension: string;
  copiedAt: string;
  hash?: string;
}

/** Bridge server instance */
let bridgeServer: http.Server | null = null;
let bridgePort = DEFAULT_BRIDGE_PORT;

/** In-memory store for execution configs (for workflow popup) */
const executionConfigs = new Map<string, Record<string, {
  nodeId: string;
  nodeType: 'promptInput' | 'fileSelector';
  value: string | IFileReference[];
}>>();

/** In-memory store for execution results (from ResultDisplay nodes) */
const executionResults = new Map<string, Array<{
  nodeId: string;
  nodeName: string;
  contentType: 'markdown' | 'text' | 'file';
  content: string;
  fileReference: { path: string; name: string; size: number; mimeType: string } | null;
}>>();

/** In-memory store for node pre-selected files (persists across test executions) */
const nodeStoredFiles = new Map<string, IFileReference[]>();

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
    webp: 'image/webp',
    bmp: 'image/bmp',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
  };
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Calculate file hash (SHA-256)
 */
async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Generate unique filename for duplicates
 */
function generateUniqueFilename(destinationFolder: string, filename: string): string {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let counter = 1;
  let newName = filename;

  while (fs.existsSync(path.join(destinationFolder, newName))) {
    newName = `${base}_${counter}${ext}`;
    counter++;
  }

  return newName;
}

/**
 * Parse JSON body from request
 */
async function parseRequestBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJsonResponse(
  res: http.ServerResponse,
  statusCode: number,
  data: unknown
): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle health check endpoint
 */
function handleHealthCheck(res: http.ServerResponse): void {
  sendJsonResponse(res, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}

/**
 * Handle file selection endpoint
 */
async function handleFileSelect(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  configManager: ConfigManager
): Promise<void> {
  try {
    const body = (await parseRequestBody(req)) as {
      requestId?: string;
      title?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      multiSelect?: boolean;
      defaultPath?: string;
    };

    const requestId = body.requestId || crypto.randomUUID();
    const focusedWindow = BrowserWindow.getFocusedWindow();

    const result = await dialog.showOpenDialog(focusedWindow || undefined as unknown as BrowserWindow, {
      title: body.title || 'Select Files',
      defaultPath: body.defaultPath || configManager.get('dataFolder'),
      filters: body.filters || [{ name: 'All Files', extensions: ['*'] }],
      properties: body.multiSelect !== false
        ? ['openFile', 'multiSelections']
        : ['openFile'],
    });

    sendJsonResponse(res, 200, {
      requestId,
      success: !result.canceled,
      cancelled: result.canceled,
      selectedPaths: result.filePaths,
      fileCount: result.filePaths.length,
    });
  } catch (error) {
    const err = error as Error;
    console.error('File select error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

/**
 * Handle file copy endpoint
 */
async function handleFileCopy(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  configManager: ConfigManager
): Promise<void> {
  try {
    const body = (await parseRequestBody(req)) as {
      requestId?: string;
      files: Array<{ sourcePath: string; destinationName?: string }>;
      destinationSubfolder?: string;
      duplicateHandling?: 'rename' | 'skip' | 'overwrite';
    };

    const requestId = body.requestId || crypto.randomUUID();
    const dataFolder = configManager.get('dataFolder');
    const destinationSubfolder = body.destinationSubfolder || 'imports';
    const duplicateHandling = body.duplicateHandling || 'rename';

    // Ensure destination folder exists
    const destinationFolder = path.join(dataFolder, destinationSubfolder);
    if (!fs.existsSync(destinationFolder)) {
      fs.mkdirSync(destinationFolder, { recursive: true });
    }

    const copiedFiles: IFileReference[] = [];
    const skippedFiles: Array<{ sourcePath: string; reason: string }> = [];
    let totalSize = 0;

    for (const file of body.files || []) {
      try {
        if (!fs.existsSync(file.sourcePath)) {
          skippedFiles.push({
            sourcePath: file.sourcePath,
            reason: 'File not found',
          });
          continue;
        }

        const stats = fs.statSync(file.sourcePath);
        const originalName = file.destinationName || path.basename(file.sourcePath);
        const extension = path.extname(originalName).slice(1).toLowerCase();

        let destinationName = originalName;
        const destinationPath = path.join(destinationFolder, destinationName);

        // Handle duplicates
        if (fs.existsSync(destinationPath)) {
          switch (duplicateHandling) {
            case 'skip':
              skippedFiles.push({
                sourcePath: file.sourcePath,
                reason: 'File already exists',
              });
              continue;
            case 'rename':
              destinationName = generateUniqueFilename(destinationFolder, originalName);
              break;
            case 'overwrite':
              // Will overwrite existing file
              break;
          }
        }

        const finalPath = path.join(destinationFolder, destinationName);

        // Copy file
        fs.copyFileSync(file.sourcePath, finalPath);

        // Calculate hash
        const hash = await calculateFileHash(finalPath);

        const fileRef: IFileReference = {
          id: crypto.randomUUID(),
          originalName,
          originalPath: file.sourcePath,
          destinationPath: finalPath,
          size: stats.size,
          mimeType: getMimeType(extension),
          extension,
          copiedAt: new Date().toISOString(),
          hash,
        };

        copiedFiles.push(fileRef);
        totalSize += stats.size;
      } catch (fileError) {
        const err = fileError as Error;
        skippedFiles.push({
          sourcePath: file.sourcePath,
          reason: err.message,
        });
      }
    }

    sendJsonResponse(res, 200, {
      requestId,
      success: copiedFiles.length > 0,
      copiedFiles,
      skippedFiles,
      totalSize,
    });
  } catch (error) {
    const err = error as Error;
    console.error('File copy error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

/**
 * Handle data folder endpoint
 */
function handleDataFolder(
  res: http.ServerResponse,
  configManager: ConfigManager
): void {
  const dataFolder = configManager.get('dataFolder');
  const importsFolder = path.join(dataFolder, 'imports');

  // Ensure imports folder exists
  if (!fs.existsSync(importsFolder)) {
    fs.mkdirSync(importsFolder, { recursive: true });
  }

  // Get available disk space (simplified)
  let freeSpace = 0;
  try {
    // This is a simplified check - real implementation would use os-specific APIs
    const stats = fs.statfsSync ? fs.statfsSync(dataFolder) : null;
    if (stats) {
      freeSpace = stats.bfree * stats.bsize;
    }
  } catch {
    // Ignore errors getting free space
  }

  sendJsonResponse(res, 200, {
    success: true,
    dataFolder,
    importsFolder,
    freeSpace,
  });
}

// ============================================================================
// Execution Config Handlers (for workflow popup)
// ============================================================================

/**
 * Handle POST /api/electron-bridge/execution-config
 * Store execution config before starting workflow
 * Note: Uses workflowId as the key (not executionId) because nodes can't access
 * our popup execution ID, but they can access the workflow ID via this.getWorkflow().id
 */
async function handleSetExecutionConfig(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  try {
    const body = (await parseRequestBody(req)) as {
      executionId: string;  // Actually workflowId now, keeping param name for compatibility
      configs: Record<string, {
        nodeId: string;
        nodeType: 'promptInput' | 'fileSelector';
        value: string | IFileReference[];
      }>;
    };

    if (!body.executionId || !body.configs) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Missing executionId (workflowId) or configs',
      });
      return;
    }

    // Store with workflowId as key
    executionConfigs.set(body.executionId, body.configs);
    console.log(`[Electron Bridge] Stored execution config for workflow ${body.executionId}`);
    console.log(`[Electron Bridge] Config keys:`, Object.keys(body.configs));
    console.log(`[Electron Bridge] Config contents:`, JSON.stringify(body.configs, null, 2));

    sendJsonResponse(res, 200, { success: true });
  } catch (error) {
    const err = error as Error;
    console.error('[Electron Bridge] Set execution config error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

/**
 * Handle GET /api/electron-bridge/execution-config/:executionId/:nodeId
 * Retrieve external input config for a node during execution
 */
function handleGetExecutionConfig(
  pathname: string,
  res: http.ServerResponse
): void {
  try {
    // Parse path: /api/electron-bridge/execution-config/:executionId/:nodeId
    const parts = pathname.split('/').filter(Boolean);
    const executionId = parts[3]; // index 3 after api/electron-bridge/execution-config
    const nodeId = parts[4];

    console.log(`[Electron Bridge] GET execution-config: executionId=${executionId}, nodeId=${nodeId}`);
    console.log(`[Electron Bridge] Available configs:`, Array.from(executionConfigs.keys()));

    if (!executionId) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Missing executionId',
      });
      return;
    }

    const configs = executionConfigs.get(executionId);
    console.log(`[Electron Bridge] Found configs for ${executionId}:`, configs ? 'yes' : 'no');

    if (!configs) {
      console.log(`[Electron Bridge] No configs found for ${executionId}`);
      sendJsonResponse(res, 200, {
        success: true,
        hasExternalConfig: false,
      });
      return;
    }

    if (nodeId) {
      // Return specific node config
      const nodeConfig = configs[nodeId];
      console.log(`[Electron Bridge] Looking for nodeId ${nodeId} in configs:`, Object.keys(configs));
      console.log(`[Electron Bridge] Node config found:`, nodeConfig ? JSON.stringify(nodeConfig) : 'no');

      if (nodeConfig) {
        sendJsonResponse(res, 200, {
          success: true,
          hasExternalConfig: true,
          config: nodeConfig,
        });
      } else {
        sendJsonResponse(res, 200, {
          success: true,
          hasExternalConfig: false,
        });
      }
    } else {
      // Return all configs for execution
      sendJsonResponse(res, 200, {
        success: true,
        hasExternalConfig: true,
        configs,
      });
    }
  } catch (error) {
    const err = error as Error;
    console.error('[Electron Bridge] Get execution config error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

/**
 * Handle DELETE /api/electron-bridge/execution-config/:executionId
 * Clean up execution config after workflow completes
 */
function handleDeleteExecutionConfig(
  pathname: string,
  res: http.ServerResponse
): void {
  try {
    // Parse path: /api/electron-bridge/execution-config/:executionId
    const parts = pathname.split('/').filter(Boolean);
    const executionId = parts[3];

    if (!executionId) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Missing executionId',
      });
      return;
    }

    executionConfigs.delete(executionId);
    executionResults.delete(executionId);
    console.log(`[Electron Bridge] Deleted execution config for ${executionId}`);

    sendJsonResponse(res, 200, { success: true });
  } catch (error) {
    const err = error as Error;
    console.error('[Electron Bridge] Delete execution config error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

/**
 * Handle POST /api/electron-bridge/execution-result
 * Store result from ResultDisplay node during execution
 */
async function handleStoreExecutionResult(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  try {
    const body = (await parseRequestBody(req)) as {
      executionId: string;
      nodeId: string;
      result: {
        nodeId: string;
        nodeName: string;
        contentType: 'markdown' | 'text' | 'file';
        content: string;
        fileReference: { path: string; name: string; size: number; mimeType: string } | null;
      };
    };

    if (!body.executionId || !body.result) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Missing executionId or result',
      });
      return;
    }

    // Get or create results array for this execution
    const results = executionResults.get(body.executionId) || [];
    results.push(body.result);
    executionResults.set(body.executionId, results);

    console.log(`[Electron Bridge] Stored execution result for ${body.executionId}/${body.nodeId}`);

    sendJsonResponse(res, 200, { success: true });
  } catch (error) {
    const err = error as Error;
    console.error('[Electron Bridge] Store execution result error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

/**
 * Handle GET /api/electron-bridge/execution-results/:executionId
 * Retrieve all stored results for an execution
 */
function handleGetExecutionResults(
  pathname: string,
  res: http.ServerResponse
): void {
  try {
    // Parse path: /api/electron-bridge/execution-results/:executionId
    const parts = pathname.split('/').filter(Boolean);
    const executionId = parts[3];

    if (!executionId) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Missing executionId',
      });
      return;
    }

    const results = executionResults.get(executionId) || [];

    sendJsonResponse(res, 200, {
      success: true,
      results,
    });
  } catch (error) {
    const err = error as Error;
    console.error('[Electron Bridge] Get execution results error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

// ============================================================================
// Node Stored Files Handlers (persist across test executions)
// ============================================================================

/**
 * Generate storage key for node files
 */
function getNodeFilesKey(workflowId: string, nodeIdentifier: string): string {
  return `${workflowId}:${nodeIdentifier}`;
}

/**
 * Handle POST /api/electron-bridge/node-files/:workflowId/:nodeIdentifier
 * Store pre-selected files for a node (persists across test executions)
 */
async function handleSetNodeFiles(
  req: http.IncomingMessage,
  pathname: string,
  res: http.ServerResponse
): Promise<void> {
  try {
    // Parse path: /api/electron-bridge/node-files/:workflowId/:nodeIdentifier
    const parts = pathname.split('/').filter(Boolean);
    const workflowId = parts[3];
    const nodeIdentifier = decodeURIComponent(parts[4] || '');

    if (!workflowId || !nodeIdentifier) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Missing workflowId or nodeIdentifier',
      });
      return;
    }

    const body = (await parseRequestBody(req)) as {
      files: IFileReference[];
    };

    if (!Array.isArray(body.files)) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Missing or invalid files array',
      });
      return;
    }

    const key = getNodeFilesKey(workflowId, nodeIdentifier);
    nodeStoredFiles.set(key, body.files);
    console.log(`[Electron Bridge] Stored ${body.files.length} files for ${key}`);

    sendJsonResponse(res, 200, { success: true, fileCount: body.files.length });
  } catch (error) {
    const err = error as Error;
    console.error('[Electron Bridge] Set node files error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

/**
 * Handle GET /api/electron-bridge/node-files/:workflowId/:nodeIdentifier
 * Retrieve stored files for a node
 */
function handleGetNodeFiles(
  pathname: string,
  res: http.ServerResponse
): void {
  try {
    // Parse path: /api/electron-bridge/node-files/:workflowId/:nodeIdentifier
    const parts = pathname.split('/').filter(Boolean);
    const workflowId = parts[3];
    const nodeIdentifier = decodeURIComponent(parts[4] || '');

    if (!workflowId || !nodeIdentifier) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Missing workflowId or nodeIdentifier',
      });
      return;
    }

    const key = getNodeFilesKey(workflowId, nodeIdentifier);
    const files = nodeStoredFiles.get(key) || [];

    console.log(`[Electron Bridge] Retrieved ${files.length} files for ${key}`);

    sendJsonResponse(res, 200, {
      success: true,
      files,
      fileCount: files.length,
    });
  } catch (error) {
    const err = error as Error;
    console.error('[Electron Bridge] Get node files error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

/**
 * Handle DELETE /api/electron-bridge/node-files/:workflowId/:nodeIdentifier
 * Clear stored files for a node
 */
function handleDeleteNodeFiles(
  pathname: string,
  res: http.ServerResponse
): void {
  try {
    // Parse path: /api/electron-bridge/node-files/:workflowId/:nodeIdentifier
    const parts = pathname.split('/').filter(Boolean);
    const workflowId = parts[3];
    const nodeIdentifier = decodeURIComponent(parts[4] || '');

    if (!workflowId || !nodeIdentifier) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Missing workflowId or nodeIdentifier',
      });
      return;
    }

    const key = getNodeFilesKey(workflowId, nodeIdentifier);
    const deleted = nodeStoredFiles.delete(key);

    console.log(`[Electron Bridge] Deleted stored files for ${key}: ${deleted}`);

    sendJsonResponse(res, 200, { success: true, deleted });
  } catch (error) {
    const err = error as Error;
    console.error('[Electron Bridge] Delete node files error:', err);
    sendJsonResponse(res, 500, {
      success: false,
      error: err.message,
    });
  }
}

/**
 * Start the Electron bridge HTTP server
 */
export function startElectronBridge(
  configManager: ConfigManager,
  port: number = DEFAULT_BRIDGE_PORT
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (bridgeServer) {
      console.log('Electron bridge already running on port', bridgePort);
      resolve(bridgePort);
      return;
    }

    bridgeServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);
      const pathname = url.pathname;

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }

      console.log(`[Electron Bridge] ${req.method} ${pathname}`);

      try {
        // Route handlers
        if (pathname === '/api/electron-bridge/health' && req.method === 'GET') {
          handleHealthCheck(res);
        } else if (
          pathname === '/api/electron-bridge/files/select' &&
          req.method === 'POST'
        ) {
          await handleFileSelect(req, res, configManager);
        } else if (
          pathname === '/api/electron-bridge/files/copy' &&
          req.method === 'POST'
        ) {
          await handleFileCopy(req, res, configManager);
        } else if (
          pathname === '/api/electron-bridge/config/data-folder' &&
          req.method === 'GET'
        ) {
          handleDataFolder(res, configManager);
        }
        // ==================== EXECUTION CONFIG ENDPOINTS ====================
        else if (
          pathname === '/api/electron-bridge/execution-config' &&
          req.method === 'POST'
        ) {
          await handleSetExecutionConfig(req, res);
        } else if (
          pathname.startsWith('/api/electron-bridge/execution-config/') &&
          req.method === 'GET'
        ) {
          handleGetExecutionConfig(pathname, res);
        } else if (
          pathname.startsWith('/api/electron-bridge/execution-config/') &&
          req.method === 'DELETE'
        ) {
          handleDeleteExecutionConfig(pathname, res);
        }
        // ==================== EXECUTION RESULT ENDPOINTS ====================
        else if (
          pathname === '/api/electron-bridge/execution-result' &&
          req.method === 'POST'
        ) {
          await handleStoreExecutionResult(req, res);
        } else if (
          pathname.startsWith('/api/electron-bridge/execution-results/') &&
          req.method === 'GET'
        ) {
          handleGetExecutionResults(pathname, res);
        }
        // ==================== NODE STORED FILES ENDPOINTS ====================
        else if (
          pathname.startsWith('/api/electron-bridge/node-files/') &&
          req.method === 'POST'
        ) {
          await handleSetNodeFiles(req, pathname, res);
        } else if (
          pathname.startsWith('/api/electron-bridge/node-files/') &&
          req.method === 'GET'
        ) {
          handleGetNodeFiles(pathname, res);
        } else if (
          pathname.startsWith('/api/electron-bridge/node-files/') &&
          req.method === 'DELETE'
        ) {
          handleDeleteNodeFiles(pathname, res);
        } else {
          sendJsonResponse(res, 404, {
            success: false,
            error: 'Not found',
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error('[Electron Bridge] Error:', err);
        sendJsonResponse(res, 500, {
          success: false,
          error: err.message,
        });
      }
    });

    bridgeServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${port} in use, trying ${port + 1}`);
        bridgeServer = null;
        startElectronBridge(configManager, port + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(error);
      }
    });

    bridgeServer.listen(port, '127.0.0.1', () => {
      bridgePort = port;
      console.log(`[Electron Bridge] Server started on http://127.0.0.1:${port}`);
      resolve(port);
    });
  });
}

/**
 * Stop the Electron bridge HTTP server
 */
export function stopElectronBridge(): Promise<void> {
  return new Promise((resolve) => {
    if (bridgeServer) {
      bridgeServer.close(() => {
        console.log('[Electron Bridge] Server stopped');
        bridgeServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Get the current bridge URL
 */
export function getElectronBridgeUrl(): string {
  return `http://127.0.0.1:${bridgePort}`;
}

/**
 * Get the current bridge port
 */
export function getElectronBridgePort(): number {
  return bridgePort;
}
