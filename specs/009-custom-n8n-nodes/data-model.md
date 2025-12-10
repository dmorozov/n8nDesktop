# Data Model: Custom n8n Nodes

**Feature**: 009-custom-n8n-nodes
**Date**: 2025-12-10

## Overview

This document defines the data structures for the custom n8n nodes feature. The nodes handle file references, prompt content, and result display configuration.

---

## Entities

### 1. FileReference

Represents a file that has been selected and copied to the n8n data folder.

```typescript
interface FileReference {
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

  /** Timestamp when file was copied */
  copiedAt: string; // ISO 8601

  /** SHA-256 hash of file content (for deduplication) */
  hash?: string;
}
```

**Relationships**:
- Part of `FileSelectorOutput` (one-to-many)
- Referenced by workflow nodes via `destinationPath`

**Validation Rules**:
- `originalName`: Required, 1-255 characters
- `originalPath`: Required, valid file system path
- `destinationPath`: Required, must be within n8n data folder
- `size`: Required, >= 0
- `mimeType`: Required, valid MIME type format
- `extension`: Required, lowercase alphanumeric

---

### 2. FileSelectorConfig

Configuration for the File Selector node.

```typescript
interface FileSelectorConfig {
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
```

**Default Values**:
```typescript
const defaultFileSelectorConfig: FileSelectorConfig = {
  allowedExtensions: [],
  allowMultiple: true,
  dialogTitle: 'Select Files',
  duplicateHandling: 'rename',
  destinationSubfolder: 'imports',
  maxFileSize: 0,
};
```

---

### 3. FileSelectorOutput

Output structure from the File Selector node execution.

```typescript
interface FileSelectorOutput {
  /** Whether file selection was successful */
  success: boolean;

  /** Number of files selected */
  fileCount: number;

  /** Array of file references */
  files: FileReference[];

  /** Error message if selection failed */
  error?: string;

  /** Whether user cancelled the dialog */
  cancelled: boolean;

  /** Total size of all files in bytes */
  totalSize: number;
}
```

---

### 4. PromptInputConfig

Configuration for the Prompt Input node.

```typescript
interface PromptInputConfig {
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
```

**Default Values**:
```typescript
const defaultPromptInputConfig: PromptInputConfig = {
  prompt: '',
  placeholder: 'Enter your prompt here...',
  minLength: 0,
  maxLength: 50000,
  stripHtml: false,
  trimWhitespace: true,
};
```

---

### 5. PromptInputOutput

Output structure from the Prompt Input node execution.

```typescript
interface PromptInputOutput {
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
```

---

### 6. ResultDisplayConfig

Configuration for the Result Display node.

```typescript
interface ResultDisplayConfig {
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
```

**Default Values**:
```typescript
const defaultResultDisplayConfig: ResultDisplayConfig = {
  propertyPath: 'json.result',
  fallbackText: 'No content found',
  maxDisplayLength: 0,
  renderMarkdown: true,
  sanitizeHtml: true,
  displayTitle: 'Result',
};
```

---

### 7. ResultDisplayOutput

Output structure from the Result Display node execution.

```typescript
interface ResultDisplayOutput {
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
```

---

### 8. ElectronBridgeRequest

Request structure for Electron IPC communication from nodes.

```typescript
interface ElectronBridgeRequest {
  /** Request type */
  type: 'selectFiles' | 'copyFiles' | 'getDataFolder';

  /** Request payload */
  payload: ElectronBridgeSelectFilesPayload | ElectronBridgeCopyFilesPayload | {};

  /** Unique request ID for correlation */
  requestId: string;

  /** Timeout in milliseconds */
  timeout: number;
}

interface ElectronBridgeSelectFilesPayload {
  title: string;
  filters: Array<{ name: string; extensions: string[] }>;
  multiSelect: boolean;
  defaultPath?: string;
}

interface ElectronBridgeCopyFilesPayload {
  files: Array<{ sourcePath: string; fileName: string }>;
  destinationFolder: string;
  duplicateHandling: 'rename' | 'skip' | 'overwrite';
}
```

---

### 9. ElectronBridgeResponse

Response structure from Electron IPC bridge.

```typescript
interface ElectronBridgeResponse {
  /** Request ID for correlation */
  requestId: string;

  /** Whether operation succeeded */
  success: boolean;

  /** Response data */
  data?: {
    /** Selected file paths (for selectFiles) */
    selectedPaths?: string[];

    /** Copied file references (for copyFiles) */
    copiedFiles?: FileReference[];

    /** Data folder path (for getDataFolder) */
    dataFolder?: string;
  };

  /** Error message if failed */
  error?: string;

  /** Whether operation was cancelled by user */
  cancelled?: boolean;
}
```

---

## State Transitions

### File Selector Node

```
┌─────────┐     execute()     ┌───────────────┐
│  idle   │ ─────────────────▶│ awaiting_dialog│
└─────────┘                   └───────┬───────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
           ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
           │ files_selected│  │  cancelled   │  │    error     │
           └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                  │                 │                 │
                  ▼                 │                 │
           ┌──────────────┐        │                 │
           │   copying    │        │                 │
           └──────┬───────┘        │                 │
                  │                 │                 │
                  ▼                 ▼                 ▼
           ┌──────────────────────────────────────────────┐
           │                  complete                     │
           │  (success: true/false, files: [...]/[])      │
           └──────────────────────────────────────────────┘
```

### Prompt Input Node

```
┌─────────┐     execute()     ┌───────────────┐
│  idle   │ ─────────────────▶│  validating   │
└─────────┘                   └───────┬───────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
           ┌──────────────┐                    ┌──────────────┐
           │    valid     │                    │   invalid    │
           │ (output text)│                    │ (error msg)  │
           └──────────────┘                    └──────────────┘
```

### Result Display Node

```
┌─────────┐     execute()     ┌───────────────┐
│  idle   │ ─────────────────▶│  extracting   │
└─────────┘                   └───────┬───────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
           ┌──────────────┐                    ┌──────────────┐
           │    found     │                    │  not_found   │
           └──────┬───────┘                    │ (fallback)   │
                  │                            └──────┬───────┘
                  ▼                                   │
           ┌──────────────┐                          │
           │  rendering   │                          │
           └──────┬───────┘                          │
                  │                                   │
                  └─────────────┬─────────────────────┘
                                ▼
                         ┌──────────────┐
                         │   complete   │
                         │ (output data)│
                         └──────────────┘
```

---

## Data Storage

### File Storage Locations

| Data Type | Location | Format |
|-----------|----------|--------|
| Copied files | `{dataFolder}/imports/` | Original files |
| Node configurations | n8n workflow JSON | Part of workflow |
| Temporary files | System temp dir | Auto-cleaned |

### n8n Data Folder Structure

```
{dataFolder}/
├── .n8n/
│   ├── database.sqlite    # n8n workflows & settings
│   └── ...                # n8n internal files
└── imports/               # Files copied by FileSelector node
    ├── document1.pdf
    ├── document1_2.pdf    # Renamed duplicate
    └── image.png
```

---

## Validation Rules Summary

| Entity | Field | Rule |
|--------|-------|------|
| FileReference | originalName | 1-255 chars, no path separators |
| FileReference | size | >= 0, <= maxFileSize if configured |
| FileReference | mimeType | Valid MIME format |
| PromptInputConfig | maxLength | 0-100000 |
| PromptInputOutput | isValid | minLength <= length <= maxLength |
| ResultDisplayConfig | propertyPath | Valid JSON path syntax |
| ElectronBridgeRequest | timeout | 1000-300000 ms |
