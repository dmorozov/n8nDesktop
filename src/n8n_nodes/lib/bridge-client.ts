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

// ============================================================================
// Workflow Execution Popup Support (Feature: 010-workflow-execution-popup)
// ============================================================================

/**
 * External input configuration for nodes from the popup
 */
export interface IExternalNodeConfig {
  nodeId: string;
  nodeType: 'promptInput' | 'fileSelector';
  value: string | IExternalFileReference[];
}

/**
 * External file reference from popup
 */
export interface IExternalFileReference {
  id: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Get external configuration for a node from the popup
 * Returns null if no external config is available (fallback to internal state)
 *
 * @param executionId - The n8n execution ID
 * @param nodeId - The node ID to get config for
 * @returns External config or null if not available
 */
export async function getExternalNodeConfig(
  executionId: string,
  nodeId: string
): Promise<IExternalNodeConfig | null> {
  try {
    const url = `${getBridgeUrl()}/api/electron-bridge/execution-config/${executionId}/${nodeId}`;
    console.log(`[BridgeClient] Getting external config from: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 404) {
      // No external config - fall back to internal state
      console.log(`[BridgeClient] No external config found (404)`);
      return null;
    }

    if (!response.ok) {
      console.warn(`[BridgeClient] Failed to get external config: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      success: boolean;
      hasExternalConfig: boolean;
      config?: IExternalNodeConfig;
    };

    console.log(`[BridgeClient] Response:`, JSON.stringify(data));

    // Extract the config from the response wrapper
    if (data.hasExternalConfig && data.config) {
      console.log(`[BridgeClient] Found external config for node ${nodeId}:`, JSON.stringify(data.config));
      return data.config;
    }

    console.log(`[BridgeClient] No external config in response (hasExternalConfig: ${data.hasExternalConfig})`);
    return null;
  } catch (error) {
    // Silently fail and fall back to internal state
    console.warn('[BridgeClient] Error getting external config:', error);
    return null;
  }
}

/**
 * Execution result to be sent back to the popup
 */
export interface IExecutionResult {
  executionId: string;
  nodeId: string;
  nodeName: string;
  contentType: 'text' | 'markdown' | 'file';
  content: string;
  fileReference?: {
    path: string;
    name: string;
    size: number;
    mimeType: string;
  };
}

/**
 * Post execution result from ResultDisplay node to the popup
 *
 * @param result - The execution result to post
 * @returns True if successful, false otherwise
 */
export async function postExecutionResult(result: IExecutionResult): Promise<boolean> {
  try {
    const response = await fetch(
      `${getBridgeUrl()}/api/electron-bridge/execution-result`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      console.warn(`[BridgeClient] Failed to post execution result: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    // Silently fail - the popup may not be open
    console.warn('[BridgeClient] Error posting execution result:', error);
    return false;
  }
}

// ============================================================================
// Node Pre-selected Files Storage (persists across test executions)
// ============================================================================

/**
 * File reference structure for storage
 */
export interface IStoredFileReference {
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

/**
 * Store pre-selected files for a node via Electron bridge
 * This persists files even across test executions
 *
 * @param workflowId - The workflow ID (can be actual ID or workflow name for unsaved workflows)
 * @param nodeIdentifier - The node ID or name (unique within workflow)
 * @param files - Array of file references to store
 * @returns True if successful, false otherwise
 */
export async function storeNodeFiles(
  workflowId: string,
  nodeIdentifier: string,
  files: IStoredFileReference[]
): Promise<boolean> {
  try {
    const response = await fetch(
      `${getBridgeUrl()}/api/electron-bridge/node-files/${encodeURIComponent(workflowId)}/${encodeURIComponent(nodeIdentifier)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      console.warn(`[BridgeClient] Failed to store node files: ${response.status}`);
      return false;
    }

    const data = await response.json() as { success: boolean };
    return data.success;
  } catch (error) {
    console.warn('[BridgeClient] Error storing node files:', error);
    return false;
  }
}

/**
 * Retrieve pre-selected files for a node from Electron bridge
 *
 * @param workflowId - The workflow ID
 * @param nodeIdentifier - The node ID or name
 * @returns Array of stored file references, or empty array if none
 */
export async function getStoredNodeFiles(
  workflowId: string,
  nodeIdentifier: string
): Promise<IStoredFileReference[]> {
  try {
    const response = await fetch(
      `${getBridgeUrl()}/api/electron-bridge/node-files/${encodeURIComponent(workflowId)}/${encodeURIComponent(nodeIdentifier)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      console.warn(`[BridgeClient] Failed to get stored node files: ${response.status}`);
      return [];
    }

    const data = await response.json() as { success: boolean; files: IStoredFileReference[] };
    return data.files || [];
  } catch (error) {
    console.warn('[BridgeClient] Error getting stored node files:', error);
    return [];
  }
}

/**
 * Clear pre-selected files for a node
 *
 * @param workflowId - The workflow ID
 * @param nodeIdentifier - The node ID or name
 * @returns True if successful, false otherwise
 */
export async function clearStoredNodeFiles(
  workflowId: string,
  nodeIdentifier: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${getBridgeUrl()}/api/electron-bridge/node-files/${encodeURIComponent(workflowId)}/${encodeURIComponent(nodeIdentifier)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      console.warn(`[BridgeClient] Failed to clear stored node files: ${response.status}`);
      return false;
    }

    const data = await response.json() as { success: boolean };
    return data.success;
  } catch (error) {
    console.warn('[BridgeClient] Error clearing stored node files:', error);
    return false;
  }
}
