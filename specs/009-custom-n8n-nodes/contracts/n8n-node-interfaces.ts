/**
 * TypeScript interfaces for Custom n8n Nodes
 *
 * These interfaces define the structure of node configurations,
 * inputs, and outputs for the FileSelector, PromptInput, and
 * ResultDisplay custom nodes.
 */

// ============================================================
// File Selector Node
// ============================================================

/**
 * Reference to a file that has been copied to the n8n data folder
 */
export interface IFileReference {
  /** Unique identifier for this file reference */
  id: string;

  /** Original filename as selected by user */
  originalName: string;

  /** Original file path (source location) */
  originalPath: string;

  /** New path in n8n data folder */
  destinationPath: string;

  /** File size in bytes */
  size: number;

  /** MIME type of the file */
  mimeType: string;

  /** File extension (lowercase, without dot) */
  extension: string;

  /** Timestamp when file was copied (ISO 8601) */
  copiedAt: string;

  /** SHA-256 hash of file content (optional) */
  hash?: string;
}

/**
 * Configuration options for File Selector node
 */
export interface IFileSelectorNodeOptions {
  /** Allowed file extensions (empty = all files) */
  allowedExtensions: string[];

  /** Whether to allow multiple file selection */
  allowMultiple: boolean;

  /** Dialog title */
  dialogTitle: string;

  /** Action when file already exists in destination */
  duplicateHandling: 'rename' | 'skip' | 'overwrite';

  /** Subdirectory within data folder for copied files */
  destinationSubfolder: string;

  /** Maximum file size in bytes (0 = unlimited) */
  maxFileSize: number;
}

/**
 * Output from File Selector node execution
 */
export interface IFileSelectorOutput {
  /** Whether file selection was successful */
  success: boolean;

  /** Number of files selected */
  fileCount: number;

  /** Array of file references */
  files: IFileReference[];

  /** Error message if selection failed */
  error?: string;

  /** Whether user cancelled the dialog */
  cancelled: boolean;

  /** Total size of all files in bytes */
  totalSize: number;
}

// ============================================================
// Prompt Input Node
// ============================================================

/**
 * Configuration options for Prompt Input node
 */
export interface IPromptInputNodeOptions {
  /** Prompt content (markdown text) */
  prompt: string;

  /** Placeholder text shown when empty */
  placeholder: string;

  /** Minimum character count (0 = no minimum) */
  minLength: number;

  /** Maximum character count (0 = no maximum) */
  maxLength: number;

  /** Whether to strip HTML tags from input */
  stripHtml: boolean;

  /** Whether to trim whitespace */
  trimWhitespace: boolean;
}

/**
 * Output from Prompt Input node execution
 */
export interface IPromptInputOutput {
  /** The prompt text (raw markdown) */
  prompt: string;

  /** Character count */
  length: number;

  /** Word count (approximate) */
  wordCount: number;

  /** Line count */
  lineCount: number;

  /** Whether prompt passed validation */
  isValid: boolean;

  /** Validation error message if any */
  validationError?: string;
}

// ============================================================
// Result Display Node
// ============================================================

/**
 * Configuration options for Result Display node
 */
export interface IResultDisplayNodeOptions {
  /** JSON path to extract content from (e.g., "data.result.text") */
  propertyPath: string;

  /** Fallback text if property not found */
  fallbackText: string;

  /** Maximum characters to display (0 = unlimited) */
  maxDisplayLength: number;

  /** Whether to render as markdown */
  renderMarkdown: boolean;

  /** Whether to sanitize HTML in content */
  sanitizeHtml: boolean;

  /** Title to display above content */
  displayTitle: string;
}

/**
 * Output from Result Display node execution
 */
export interface IResultDisplayOutput {
  /** Extracted content (raw) */
  content: string;

  /** Rendered content (if markdown rendering enabled) */
  renderedContent?: string;

  /** Whether property was found in input */
  propertyFound: boolean;

  /** Path that was searched */
  searchedPath: string;

  /** Content length */
  contentLength: number;

  /** Whether content was truncated */
  truncated: boolean;
}

// ============================================================
// Electron Bridge Communication
// ============================================================

/**
 * Request to Electron bridge for file selection
 */
export interface IElectronBridgeSelectFilesRequest {
  requestId: string;
  title: string;
  filters: Array<{
    name: string;
    extensions: string[];
  }>;
  multiSelect: boolean;
  defaultPath?: string;
  timeout: number;
}

/**
 * Response from Electron bridge for file selection
 */
export interface IElectronBridgeSelectFilesResponse {
  requestId: string;
  success: boolean;
  cancelled: boolean;
  selectedPaths: string[];
  fileCount: number;
  error?: string;
}

/**
 * Request to Electron bridge for file copy
 */
export interface IElectronBridgeCopyFilesRequest {
  requestId: string;
  files: Array<{
    sourcePath: string;
    destinationName?: string;
  }>;
  destinationSubfolder: string;
  duplicateHandling: 'rename' | 'skip' | 'overwrite';
}

/**
 * Response from Electron bridge for file copy
 */
export interface IElectronBridgeCopyFilesResponse {
  requestId: string;
  success: boolean;
  copiedFiles: IFileReference[];
  skippedFiles: Array<{
    sourcePath: string;
    reason: string;
  }>;
  totalSize: number;
  error?: string;
}

/**
 * Response from Electron bridge for data folder query
 */
export interface IElectronBridgeDataFolderResponse {
  success: boolean;
  dataFolder: string;
  importsFolder: string;
  freeSpace: number;
}

// ============================================================
// n8n Node Type Extensions
// ============================================================

/**
 * Extended node properties for custom nodes
 */
export interface ICustomNodeProperties {
  /** Electron bridge URL for IPC communication */
  electronBridgeUrl: string;

  /** Request timeout in milliseconds */
  requestTimeout: number;
}

/**
 * Node execution context extension
 */
export interface ICustomExecutionContext {
  /** Get the Electron bridge URL from environment */
  getElectronBridgeUrl(): string;

  /** Get the n8n data folder path */
  getDataFolder(): Promise<string>;

  /** Select files via native dialog */
  selectFiles(options: IElectronBridgeSelectFilesRequest): Promise<IElectronBridgeSelectFilesResponse>;

  /** Copy files to data folder */
  copyFiles(options: IElectronBridgeCopyFilesRequest): Promise<IElectronBridgeCopyFilesResponse>;
}

// ============================================================
// Utility Types
// ============================================================

/**
 * Supported MIME types for file handling
 */
export type SupportedMimeType =
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'text/plain'
  | 'text/markdown'
  | 'text/csv'
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp'
  | string; // Allow other MIME types

/**
 * File filter presets for common use cases
 */
export const FILE_FILTER_PRESETS = {
  documents: {
    name: 'Documents',
    extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'],
  },
  spreadsheets: {
    name: 'Spreadsheets',
    extensions: ['xls', 'xlsx', 'csv'],
  },
  images: {
    name: 'Images',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
  },
  all: {
    name: 'All Files',
    extensions: ['*'],
  },
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  fileSelector: {
    allowedExtensions: [],
    allowMultiple: true,
    dialogTitle: 'Select Files',
    duplicateHandling: 'rename' as const,
    destinationSubfolder: 'imports',
    maxFileSize: 0,
  },
  promptInput: {
    prompt: '',
    placeholder: 'Enter your prompt here...',
    minLength: 0,
    maxLength: 50000,
    stripHtml: false,
    trimWhitespace: true,
  },
  resultDisplay: {
    propertyPath: 'json.result',
    fallbackText: 'No content found',
    maxDisplayLength: 0,
    renderMarkdown: true,
    sanitizeHtml: true,
    displayTitle: 'Result',
  },
  electronBridge: {
    requestTimeout: 60000,
    port: 5679,
  },
} as const;
