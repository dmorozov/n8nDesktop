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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
