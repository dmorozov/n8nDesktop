/**
 * Electron Bridge Client
 *
 * HTTP client for n8n custom nodes to communicate with the Electron main process.
 * This client provides access to native OS features like file dialogs.
 */

import type {
  IElectronBridgeSelectFilesRequest,
  IElectronBridgeSelectFilesResponse,
  IElectronBridgeCopyFilesRequest,
  IElectronBridgeCopyFilesResponse,
  IElectronBridgeDataFolderResponse,
} from './types';

/** Default bridge URL (can be overridden via ELECTRON_BRIDGE_URL env var) */
// Note: Port 5679 is reserved for n8n Task Broker, so we use 5680
const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:5680';

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT = 60000;

/**
 * Get the Electron bridge base URL from environment or use default
 */
export function getBridgeUrl(): string {
  return process.env.ELECTRON_BRIDGE_URL || DEFAULT_BRIDGE_URL;
}

/**
 * Check if the Electron bridge is available
 */
export async function isBridgeAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getBridgeUrl()}/api/electron-bridge/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Health check response from the bridge
 */
export interface IBridgeHealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

/**
 * Check bridge health and get status
 */
export async function checkBridgeHealth(): Promise<IBridgeHealthResponse> {
  const response = await fetch(`${getBridgeUrl()}/api/electron-bridge/health`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Bridge health check failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<IBridgeHealthResponse>;
}

/**
 * Open a native file selection dialog
 *
 * @param options - File selection options
 * @returns Promise resolving to selected file paths
 */
export async function selectFiles(
  options: Partial<IElectronBridgeSelectFilesRequest> = {}
): Promise<IElectronBridgeSelectFilesResponse> {
  const request: IElectronBridgeSelectFilesRequest = {
    requestId: options.requestId || generateRequestId(),
    title: options.title || 'Select Files',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    multiSelect: options.multiSelect ?? true,
    defaultPath: options.defaultPath,
    timeout: options.timeout || DEFAULT_TIMEOUT,
  };

  const response = await fetch(`${getBridgeUrl()}/api/electron-bridge/files/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(request.timeout),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`File selection failed: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json() as Promise<IElectronBridgeSelectFilesResponse>;
}

/**
 * Copy files to the n8n data folder
 *
 * @param options - File copy options
 * @returns Promise resolving to copied file references
 */
export async function copyFiles(
  options: Omit<IElectronBridgeCopyFilesRequest, 'requestId'> & { requestId?: string }
): Promise<IElectronBridgeCopyFilesResponse> {
  const request: IElectronBridgeCopyFilesRequest = {
    requestId: options.requestId || generateRequestId(),
    files: options.files,
    destinationSubfolder: options.destinationSubfolder || 'imports',
    duplicateHandling: options.duplicateHandling || 'rename',
  };

  const response = await fetch(`${getBridgeUrl()}/api/electron-bridge/files/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`File copy failed: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json() as Promise<IElectronBridgeCopyFilesResponse>;
}

/**
 * Get the configured data folder paths
 *
 * @returns Promise resolving to data folder information
 */
export async function getDataFolder(): Promise<IElectronBridgeDataFolderResponse> {
  const response = await fetch(`${getBridgeUrl()}/api/electron-bridge/config/data-folder`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Get data folder failed: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json() as Promise<IElectronBridgeDataFolderResponse>;
}

/**
 * Select files and copy them to the data folder in one operation
 *
 * This is a convenience method that combines selectFiles and copyFiles.
 *
 * @param selectOptions - File selection options
 * @param copyOptions - File copy options (optional)
 * @returns Promise resolving to copied file references or null if cancelled
 */
export async function selectAndCopyFiles(
  selectOptions: Partial<IElectronBridgeSelectFilesRequest> = {},
  copyOptions: Partial<Pick<IElectronBridgeCopyFilesRequest, 'destinationSubfolder' | 'duplicateHandling'>> = {}
): Promise<IElectronBridgeCopyFilesResponse | null> {
  // First, open file selection dialog
  const selectResult = await selectFiles(selectOptions);

  // If user cancelled or no files selected, return null
  if (selectResult.cancelled || selectResult.selectedPaths.length === 0) {
    return null;
  }

  // Copy selected files to data folder
  const copyResult = await copyFiles({
    files: selectResult.selectedPaths.map((sourcePath) => ({ sourcePath })),
    destinationSubfolder: copyOptions.destinationSubfolder || 'imports',
    duplicateHandling: copyOptions.duplicateHandling || 'rename',
  });

  return copyResult;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Bridge client error class for better error handling
 */
export class BridgeClientError extends Error {
  public readonly statusCode?: number;
  public readonly requestId?: string;

  constructor(message: string, statusCode?: number, requestId?: string) {
    super(message);
    this.name = 'BridgeClientError';
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

/**
 * Check if the error is a bridge unavailable error
 */
export function isBridgeUnavailableError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('network error')
    );
  }
  return false;
}
