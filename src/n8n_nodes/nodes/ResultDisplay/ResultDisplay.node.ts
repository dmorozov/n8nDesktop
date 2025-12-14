import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  IBinaryData,
} from 'n8n-workflow';
import { DEFAULT_CONFIG } from '../../lib/types';
import { postExecutionResult } from '../../lib/bridge-client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extract value from object using dot-notation path
 * Supports paths like "data.result.text" or "items[0].name"
 */
function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || obj === null || obj === undefined) {
    return undefined;
  }

  // Split path by dots and brackets
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Sanitize HTML content to prevent XSS
 * Removes script tags, event handlers, and dangerous attributes
 */
function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove on* event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '');
  sanitized = sanitized.replace(/href\s*=\s*["']data:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']data:(?!image\/)[^"']*["']/gi, '');

  // Remove style tags
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove iframe, object, embed tags
  sanitized = sanitized.replace(/<(iframe|object|embed|form)[^>]*>.*?<\/\1>/gi, '');
  sanitized = sanitized.replace(/<(iframe|object|embed|form)[^>]*\/>/gi, '');

  return sanitized;
}

/**
 * Truncate content to specified maximum length
 */
function truncateContent(content: string, maxLength: number): { content: string; truncated: boolean } {
  if (maxLength <= 0 || content.length <= maxLength) {
    return { content, truncated: false };
  }

  // Try to truncate at a word boundary
  let truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    truncated = truncated.substring(0, lastSpace);
  }

  return {
    content: truncated + '...',
    truncated: true,
  };
}

/**
 * Convert value to string for display
 */
function valueToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Common property paths to try when auto-detecting content
 * Order matters - more specific paths first
 */
const AUTO_DETECT_PATHS = [
  'json.output',           // AI Agent direct output
  'json.text',             // Common text output
  'json.content',          // Common content field
  'json.message.content',  // OpenAI-style response
  'json.result',           // Generic result
  'json.response',         // Generic response
  'json.data',             // Generic data
  'json',                  // Entire JSON object
];

/**
 * Try to auto-detect content from input using common paths
 * Returns the first non-empty string found
 */
function autoDetectContent(inputItem: INodeExecutionData): { content: string; path: string } | null {
  for (const path of AUTO_DETECT_PATHS) {
    const value = getValueByPath(inputItem, path);
    if (value !== undefined && value !== null) {
      const strValue = valueToString(value);
      if (strValue.trim().length > 0) {
        return { content: strValue, path };
      }
    }
  }
  return null;
}

export class ResultDisplay implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Result Display',
    name: 'resultDisplay',
    icon: 'file:resultDisplay.svg',
    group: ['output'],
    version: 1,
    subtitle: '={{$parameter["outputType"] === "files" ? "Output Files" : "Output Text/Markdown"}}',
    description: 'Display workflow results as formatted text/markdown or downloadable files in the popup.',
    defaults: {
      name: 'Result Display',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Output Type',
        name: 'outputType',
        type: 'options',
        default: 'text',
        description: 'Type of content to display in the popup',
        options: [
          {
            name: 'Text / Markdown',
            value: 'text',
            description: 'Display text or markdown content',
          },
          {
            name: 'Files',
            value: 'files',
            description: 'Display downloadable files',
          },
        ],
      },
      // Text/Markdown mode properties
      {
        displayName: 'Content Source',
        name: 'contentSource',
        type: 'options',
        default: 'auto',
        description: 'How to find the content to display',
        displayOptions: {
          show: {
            outputType: ['text'],
          },
        },
        options: [
          {
            name: 'Auto-detect',
            value: 'auto',
            description: 'Automatically find content from common paths (output, text, content, result, etc.)',
          },
          {
            name: 'Custom Path',
            value: 'custom',
            description: 'Specify a custom property path',
          },
        ],
      },
      {
        displayName: 'Property Path',
        name: 'propertyPath',
        type: 'string',
        default: 'json.output',
        placeholder: 'json.output',
        description: 'Dot-notation path to extract content from input (e.g., "json.output", "json.message.content")',
        displayOptions: {
          show: {
            outputType: ['text'],
            contentSource: ['custom'],
          },
        },
      },
      {
        displayName: 'Fallback Text',
        name: 'fallbackText',
        type: 'string',
        default: DEFAULT_CONFIG.resultDisplay.fallbackText,
        description: 'Text to display if the property path is not found',
        displayOptions: {
          show: {
            outputType: ['text'],
          },
        },
      },
      {
        displayName: 'Text Options',
        name: 'textOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            outputType: ['text'],
          },
        },
        options: [
          {
            displayName: 'Maximum Display Length',
            name: 'maxDisplayLength',
            type: 'number',
            default: DEFAULT_CONFIG.resultDisplay.maxDisplayLength,
            description: 'Maximum characters to display (0 = unlimited)',
            typeOptions: {
              minValue: 0,
            },
          },
          {
            displayName: 'Render as Markdown',
            name: 'renderMarkdown',
            type: 'boolean',
            default: DEFAULT_CONFIG.resultDisplay.renderMarkdown,
            description: 'Whether to interpret content as markdown',
          },
          {
            displayName: 'Sanitize HTML',
            name: 'sanitizeHtml',
            type: 'boolean',
            default: DEFAULT_CONFIG.resultDisplay.sanitizeHtml,
            description: 'Whether to remove potentially dangerous HTML elements',
          },
        ],
      },
      // Files mode properties
      {
        displayName: 'File Source',
        name: 'fileSource',
        type: 'options',
        default: 'binary',
        description: 'Where to get files from',
        displayOptions: {
          show: {
            outputType: ['files'],
          },
        },
        options: [
          {
            name: 'Binary Data',
            value: 'binary',
            description: 'Use binary data from previous node',
          },
          {
            name: 'File Path Property',
            value: 'path',
            description: 'Use file path from input JSON',
          },
        ],
      },
      {
        displayName: 'Binary Property',
        name: 'binaryProperty',
        type: 'string',
        default: 'data',
        description: 'Name of the binary property to use (use * for all binary properties)',
        displayOptions: {
          show: {
            outputType: ['files'],
            fileSource: ['binary'],
          },
        },
      },
      {
        displayName: 'File Path Property',
        name: 'filePathProperty',
        type: 'string',
        default: 'json.filePath',
        placeholder: 'json.filePath',
        description: 'Dot-notation path to the file path in input data',
        displayOptions: {
          show: {
            outputType: ['files'],
            fileSource: ['path'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Get execution context for result posting
    const executionId = this.getExecutionId();
    const node = this.getNode();
    const nodeId = node.id;
    const nodeName = node.name;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const outputType = this.getNodeParameter('outputType', itemIndex, 'text') as 'text' | 'files';

        if (outputType === 'text') {
          // Text/Markdown mode
          const contentSource = this.getNodeParameter('contentSource', itemIndex, 'auto') as 'auto' | 'custom';
          const fallbackText = this.getNodeParameter('fallbackText', itemIndex, DEFAULT_CONFIG.resultDisplay.fallbackText) as string;
          const textOptions = this.getNodeParameter('textOptions', itemIndex, {}) as {
            maxDisplayLength?: number;
            renderMarkdown?: boolean;
            sanitizeHtml?: boolean;
          };

          const maxDisplayLength = textOptions.maxDisplayLength ?? DEFAULT_CONFIG.resultDisplay.maxDisplayLength;
          const renderMarkdown = textOptions.renderMarkdown ?? DEFAULT_CONFIG.resultDisplay.renderMarkdown;
          const sanitizeHtmlOption = textOptions.sanitizeHtml ?? DEFAULT_CONFIG.resultDisplay.sanitizeHtml;

          let content: string;
          let propertyFound: boolean;
          let searchedPath: string;

          if (contentSource === 'auto') {
            // Auto-detect content from common paths
            const detected = autoDetectContent(items[itemIndex]);
            if (detected) {
              content = detected.content;
              propertyFound = true;
              searchedPath = detected.path + ' (auto-detected)';
            } else {
              content = fallbackText;
              propertyFound = false;
              searchedPath = 'auto-detect (no content found)';
            }
          } else {
            // Use custom property path
            const propertyPath = this.getNodeParameter('propertyPath', itemIndex, 'json.output') as string;
            const extractedValue = getValueByPath(items[itemIndex], propertyPath);
            propertyFound = extractedValue !== undefined;
            content = propertyFound ? valueToString(extractedValue) : fallbackText;
            searchedPath = propertyPath;
          }

          // Store original content length before processing
          const originalContentLength = content.length;

          // Apply sanitization if enabled
          if (sanitizeHtmlOption) {
            content = sanitizeHtml(content);
          }

          // Apply truncation
          const truncationResult = truncateContent(content, maxDisplayLength);
          content = truncationResult.content;

          // Build output
          const output: IDataObject = {
            outputType: 'text',
            content,
            propertyFound,
            searchedPath,
            contentLength: content.length,
            truncated: truncationResult.truncated,
            renderAsMarkdown: renderMarkdown,
          };

          if (truncationResult.truncated) {
            output.originalLength = originalContentLength;
          }

          // Post result to popup via Electron bridge
          if (executionId && nodeId) {
            await postExecutionResult({
              executionId,
              nodeId,
              nodeName,
              contentType: renderMarkdown ? 'markdown' : 'text',
              content,
            });
          }

          returnData.push({
            json: output,
            pairedItem: { item: itemIndex },
          });
        } else {
          // Files mode
          const fileSource = this.getNodeParameter('fileSource', itemIndex, 'binary') as 'binary' | 'path';
          const fileReferences: Array<{
            path: string;
            name: string;
            size: number;
            mimeType: string;
          }> = [];

          if (fileSource === 'binary') {
            // Get files from binary data
            const binaryProperty = this.getNodeParameter('binaryProperty', itemIndex, 'data') as string;
            const binaryData = items[itemIndex].binary;

            if (binaryData) {
              const propertiesToProcess = binaryProperty === '*'
                ? Object.keys(binaryData)
                : [binaryProperty];

              for (const propName of propertiesToProcess) {
                const binary = binaryData[propName];
                if (binary) {
                  const fileInfo = await extractBinaryFileInfo(this, binary, propName, itemIndex);
                  if (fileInfo) {
                    fileReferences.push(fileInfo);
                  }
                }
              }
            }
          } else {
            // Get file path from property
            const filePathProperty = this.getNodeParameter('filePathProperty', itemIndex, 'json.filePath') as string;
            const filePath = getValueByPath(items[itemIndex], filePathProperty);

            if (filePath && typeof filePath === 'string') {
              const fileInfo = getFileInfoFromPath(filePath);
              if (fileInfo) {
                fileReferences.push(fileInfo);
              }
            } else if (Array.isArray(filePath)) {
              // Support array of file paths
              for (const fp of filePath) {
                if (typeof fp === 'string') {
                  const fileInfo = getFileInfoFromPath(fp);
                  if (fileInfo) {
                    fileReferences.push(fileInfo);
                  }
                }
              }
            }
          }

          // Build output
          const output: IDataObject = {
            outputType: 'files',
            fileCount: fileReferences.length,
            files: fileReferences,
          };

          // Post result to popup via Electron bridge
          if (executionId && nodeId && fileReferences.length > 0) {
            // Post each file as a separate result
            for (const fileRef of fileReferences) {
              await postExecutionResult({
                executionId,
                nodeId,
                nodeName,
                contentType: 'file',
                content: fileRef.name,
                fileReference: {
                  path: fileRef.path,
                  name: fileRef.name,
                  size: fileRef.size,
                  mimeType: fileRef.mimeType,
                },
              });
            }
          }

          returnData.push({
            json: output,
            pairedItem: { item: itemIndex },
          });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          const errorOutput: IDataObject = {
            outputType: 'error',
            content: (error as Error).message,
            error: (error as Error).message,
          };
          returnData.push({
            json: errorOutput,
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

/**
 * Extract file info from binary data
 */
async function extractBinaryFileInfo(
  context: IExecuteFunctions,
  binary: IBinaryData,
  propertyName: string,
  itemIndex: number
): Promise<{ path: string; name: string; size: number; mimeType: string } | null> {
  try {
    const fileName = binary.fileName || `${propertyName}.${binary.fileExtension || 'bin'}`;
    const mimeType = binary.mimeType || 'application/octet-stream';

    let filePath = '';
    let fileSize = 0;

    if (binary.id) {
      // Binary data is stored in filesystem
      try {
        const binaryDataBuffer = await context.helpers.getBinaryDataBuffer(itemIndex, propertyName);
        fileSize = binaryDataBuffer.length;

        // Create a temp file path for the popup to access
        const tempDir = process.env.N8N_USER_FOLDER || '/tmp';
        filePath = path.join(tempDir, 'binary-exports', binary.id || `temp-${Date.now()}`);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Write the binary data to a temp file if it doesn't exist
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, binaryDataBuffer);
        }
      } catch (e) {
        console.error('[ResultDisplay] Error getting binary data:', e);
        return null;
      }
    } else if (binary.data) {
      // Binary data is base64 encoded in memory
      const buffer = Buffer.from(binary.data, 'base64');
      fileSize = buffer.length;

      // Create a temp file
      const tempDir = process.env.N8N_USER_FOLDER || '/tmp';
      filePath = path.join(tempDir, 'binary-exports', `temp-${Date.now()}-${fileName}`);

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, buffer);
    } else {
      return null;
    }

    return {
      path: filePath,
      name: fileName,
      size: fileSize,
      mimeType,
    };
  } catch (error) {
    console.error('[ResultDisplay] Error extracting binary file info:', error);
    return null;
  }
}

/**
 * Get file info from file path
 */
function getFileInfoFromPath(
  filePath: string
): { path: string; name: string; size: number; mimeType: string } | null {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`[ResultDisplay] File not found: ${filePath}`);
      return null;
    }

    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();

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
      xml: 'application/xml',
      html: 'text/html',
      zip: 'application/zip',
    };

    return {
      path: filePath,
      name: fileName,
      size: stats.size,
      mimeType: mimeTypes[ext] || 'application/octet-stream',
    };
  } catch (error) {
    console.error('[ResultDisplay] Error getting file info:', error);
    return null;
  }
}
