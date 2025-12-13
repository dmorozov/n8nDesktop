import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { DEFAULT_CONFIG } from '../../lib/types';
import { getExternalNodeConfig } from '../../lib/bridge-client';

/**
 * Strip HTML tags from text
 */
function stripHtmlTags(html: string): string {
  // Replace common block elements with newlines
  let text = html.replace(/<\/(p|div|br|h[1-6]|li)>/gi, '\n');
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Normalize multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text;
}

/**
 * Validate text length against min/max constraints
 */
function validateLength(
  text: string,
  minLength: number,
  maxLength: number
): { isValid: boolean; error?: string } {
  if (minLength > 0 && text.length < minLength) {
    return {
      isValid: false,
      error: `Prompt is too short. Minimum ${minLength} characters required, got ${text.length}.`,
    };
  }

  if (maxLength > 0 && text.length > maxLength) {
    return {
      isValid: false,
      error: `Prompt is too long. Maximum ${maxLength} characters allowed, got ${text.length}.`,
    };
  }

  return { isValid: true };
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  if (!text.trim()) {
    return 0;
  }
  // Split by whitespace and filter empty strings
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Count lines in text
 */
function countLines(text: string): number {
  if (!text) {
    return 0;
  }
  return text.split(/\r\n|\r|\n/).length;
}

export class PromptInput implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Prompt Input',
    name: 'promptInput',
    icon: 'file:promptInput.svg',
    group: ['input'],
    version: 1,
    subtitle: 'Enter formatted prompt text',
    description: 'Enter and format prompt text using a rich text editor',
    defaults: {
      name: 'Prompt Input',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        typeOptions: {
          editor: 'htmlEditor',
        },
        default: '',
        placeholder: DEFAULT_CONFIG.promptInput.placeholder,
        description: 'Enter your prompt text. Supports basic HTML formatting.',
        required: true,
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Minimum Length',
            name: 'minLength',
            type: 'number',
            default: DEFAULT_CONFIG.promptInput.minLength,
            description: 'Minimum character count (0 = no minimum)',
            typeOptions: {
              minValue: 0,
            },
          },
          {
            displayName: 'Maximum Length',
            name: 'maxLength',
            type: 'number',
            default: DEFAULT_CONFIG.promptInput.maxLength,
            description: 'Maximum character count (0 = no maximum)',
            typeOptions: {
              minValue: 0,
            },
          },
          {
            displayName: 'Strip HTML Tags',
            name: 'stripHtml',
            type: 'boolean',
            default: DEFAULT_CONFIG.promptInput.stripHtml,
            description: 'Whether to remove HTML tags from the output, leaving only plain text',
          },
          {
            displayName: 'Trim Whitespace',
            name: 'trimWhitespace',
            type: 'boolean',
            default: DEFAULT_CONFIG.promptInput.trimWhitespace,
            description: 'Whether to remove leading and trailing whitespace',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Get execution context for external config support (FR-022)
    // Use workflowId as the key (not executionId) because we can't pass our popup
    // execution ID to n8n, but nodes can access the workflow ID
    console.log('[PromptInput] Execute started');

    let workflow;
    try {
      workflow = this.getWorkflow();
      console.log('[PromptInput] Got workflow:', workflow ? 'yes' : 'no');
      console.log('[PromptInput] Workflow id:', workflow?.id);
      console.log('[PromptInput] Workflow name:', workflow?.name);
    } catch (e) {
      console.error('[PromptInput] Error getting workflow:', e);
    }

    const workflowId = workflow?.id;

    let node;
    try {
      node = this.getNode();
      console.log('[PromptInput] Got node:', node ? 'yes' : 'no');
      console.log('[PromptInput] Node id:', node?.id);
      console.log('[PromptInput] Node name:', node?.name);
    } catch (e) {
      console.error('[PromptInput] Error getting node:', e);
    }

    const nodeId = node?.id || node?.name; // Fallback to name if id not available
    console.log('[PromptInput] Using workflowId:', workflowId);
    console.log('[PromptInput] Using nodeId:', nodeId);

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        // Get parameters
        let prompt = this.getNodeParameter('prompt', itemIndex, '') as string;

        // Check for external config from popup (FR-022)
        // This allows the popup to provide prompt text without editing the node
        if (workflowId && nodeId) {
          console.log('[PromptInput] Fetching external config for', workflowId, nodeId);
          const externalConfig = await getExternalNodeConfig(workflowId, nodeId);
          console.log('[PromptInput] External config result:', JSON.stringify(externalConfig));
          if (externalConfig?.nodeType === 'promptInput' && typeof externalConfig.value === 'string') {
            // Use prompt from popup instead of node parameter
            const originalPrompt = prompt;
            prompt = externalConfig.value;
            console.log('[PromptInput] Using external prompt instead of default');
            console.log('[PromptInput] Original prompt:', originalPrompt);
            console.log('[PromptInput] External prompt:', prompt);
          } else {
            console.log('[PromptInput] No valid external config, using default prompt:', prompt);
          }
        } else {
          console.log('[PromptInput] No workflowId/nodeId, using default prompt:', prompt);
        }
        const options = this.getNodeParameter('options', itemIndex, {}) as {
          minLength?: number;
          maxLength?: number;
          stripHtml?: boolean;
          trimWhitespace?: boolean;
        };

        const minLength = options.minLength ?? DEFAULT_CONFIG.promptInput.minLength;
        const maxLength = options.maxLength ?? DEFAULT_CONFIG.promptInput.maxLength;
        const stripHtmlOption = options.stripHtml ?? DEFAULT_CONFIG.promptInput.stripHtml;
        const trimWhitespace = options.trimWhitespace ?? DEFAULT_CONFIG.promptInput.trimWhitespace;

        // Process the prompt text
        if (stripHtmlOption) {
          prompt = stripHtmlTags(prompt);
        }

        if (trimWhitespace) {
          prompt = prompt.trim();
        }

        // Validate length constraints
        const validationResult = validateLength(prompt, minLength, maxLength);

        // Calculate text metrics
        const wordCountValue = countWords(prompt);
        const lineCountValue = countLines(prompt);

        // Build output
        const output: IDataObject = {
          prompt,
          length: prompt.length,
          wordCount: wordCountValue,
          lineCount: lineCountValue,
          isValid: validationResult.isValid,
        };

        if (validationResult.error) {
          output.validationError = validationResult.error;
        }

        returnData.push({
          json: output,
          pairedItem: { item: itemIndex },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          const errorOutput: IDataObject = {
            prompt: '',
            length: 0,
            wordCount: 0,
            lineCount: 0,
            isValid: false,
            validationError: (error as Error).message,
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
