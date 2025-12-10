import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { DEFAULT_CONFIG } from '../../lib/types';

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

export class ResultDisplay implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Result Display',
    name: 'resultDisplay',
    icon: 'file:resultDisplay.svg',
    group: ['output'],
    version: 1,
    subtitle: 'Display formatted workflow results',
    description: 'Display workflow results as formatted text. Supports extracting specific properties and optional HTML sanitization.',
    defaults: {
      name: 'Result Display',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Property Path',
        name: 'propertyPath',
        type: 'string',
        default: DEFAULT_CONFIG.resultDisplay.propertyPath,
        placeholder: 'json.result.text',
        description: 'Dot-notation path to extract content from input (e.g., "json.result.text", "data[0].message")',
      },
      {
        displayName: 'Display Title',
        name: 'displayTitle',
        type: 'string',
        default: DEFAULT_CONFIG.resultDisplay.displayTitle,
        description: 'Title to display above the content',
      },
      {
        displayName: 'Fallback Text',
        name: 'fallbackText',
        type: 'string',
        default: DEFAULT_CONFIG.resultDisplay.fallbackText,
        description: 'Text to display if the property path is not found',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
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
            displayName: 'Render Markdown',
            name: 'renderMarkdown',
            type: 'boolean',
            default: DEFAULT_CONFIG.resultDisplay.renderMarkdown,
            description: 'Whether to interpret content as markdown (passes through as-is, rendering happens in UI)',
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
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        // Get parameters
        const propertyPath = this.getNodeParameter('propertyPath', itemIndex, DEFAULT_CONFIG.resultDisplay.propertyPath) as string;
        const displayTitle = this.getNodeParameter('displayTitle', itemIndex, DEFAULT_CONFIG.resultDisplay.displayTitle) as string;
        const fallbackText = this.getNodeParameter('fallbackText', itemIndex, DEFAULT_CONFIG.resultDisplay.fallbackText) as string;
        const options = this.getNodeParameter('options', itemIndex, {}) as {
          maxDisplayLength?: number;
          renderMarkdown?: boolean;
          sanitizeHtml?: boolean;
        };

        const maxDisplayLength = options.maxDisplayLength ?? DEFAULT_CONFIG.resultDisplay.maxDisplayLength;
        const renderMarkdown = options.renderMarkdown ?? DEFAULT_CONFIG.resultDisplay.renderMarkdown;
        const sanitizeHtmlOption = options.sanitizeHtml ?? DEFAULT_CONFIG.resultDisplay.sanitizeHtml;

        // Get input item
        const inputItem = items[itemIndex];

        // Extract content using property path
        let extractedValue = getValueByPath(inputItem, propertyPath);
        let propertyFound = extractedValue !== undefined;

        // Convert to string
        let content = propertyFound ? valueToString(extractedValue) : fallbackText;

        // Apply sanitization if enabled
        if (sanitizeHtmlOption) {
          content = sanitizeHtml(content);
        }

        // Apply truncation
        const truncationResult = truncateContent(content, maxDisplayLength);
        content = truncationResult.content;

        // Build output
        const output: IDataObject = {
          title: displayTitle,
          content,
          propertyFound,
          searchedPath: propertyPath,
          contentLength: content.length,
          truncated: truncationResult.truncated,
          renderAsMarkdown: renderMarkdown,
        };

        // Include original content before truncation if truncated
        if (truncationResult.truncated) {
          output.originalLength = valueToString(extractedValue).length;
        }

        returnData.push({
          json: output,
          pairedItem: { item: itemIndex },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          const errorOutput: IDataObject = {
            title: 'Error',
            content: (error as Error).message,
            propertyFound: false,
            searchedPath: '',
            contentLength: 0,
            truncated: false,
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
