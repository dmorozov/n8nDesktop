import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
  selectFiles,
  copyFiles,
  isBridgeAvailable,
  isBridgeUnavailableError,
  getExternalNodeConfig,
  type IExternalFileReference,
} from '../../lib/bridge-client';
import { DEFAULT_CONFIG, FILE_FILTER_PRESETS } from '../../lib/types';
import type { IFileReference } from '../../lib/types';

/**
 * Build file filters based on filter type selection
 */
function buildFileFilters(
  filterType: string,
  customExtensions: string
): Array<{ name: string; extensions: string[] }> {
  switch (filterType) {
    case 'documents':
      return [{ name: FILE_FILTER_PRESETS.documents.name, extensions: [...FILE_FILTER_PRESETS.documents.extensions] }];
    case 'spreadsheets':
      return [{ name: FILE_FILTER_PRESETS.spreadsheets.name, extensions: [...FILE_FILTER_PRESETS.spreadsheets.extensions] }];
    case 'images':
      return [{ name: FILE_FILTER_PRESETS.images.name, extensions: [...FILE_FILTER_PRESETS.images.extensions] }];
    case 'custom':
      if (customExtensions.trim()) {
        const extensions = customExtensions
          .split(',')
          .map((ext) => ext.trim().toLowerCase().replace(/^\./, ''))
          .filter(Boolean);
        return [{ name: 'Custom Files', extensions }];
      }
      return [{ name: FILE_FILTER_PRESETS.all.name, extensions: [...FILE_FILTER_PRESETS.all.extensions] }];
    case 'all':
    default:
      return [{ name: FILE_FILTER_PRESETS.all.name, extensions: [...FILE_FILTER_PRESETS.all.extensions] }];
  }
}

export class FileSelector implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'File Selector',
    name: 'fileSelector',
    icon: 'file:fileSelector.svg',
    group: ['input'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Select and manage local files. Files are stored in the node and output when the workflow runs.',
    defaults: {
      name: 'File Selector',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      // Operation mode
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Use Stored Files',
            value: 'useStored',
            description: 'Output the files that are already stored in this node',
            action: 'Output stored files',
          },
          {
            name: 'Select New Files',
            value: 'selectNew',
            description: 'Open a file dialog to select new files (replaces stored files)',
            action: 'Open file dialog and select new files',
          },
          {
            name: 'Add More Files',
            value: 'addMore',
            description: 'Open a file dialog to add files to the existing list',
            action: 'Open file dialog and add to stored files',
          },
          {
            name: 'Clear All Files',
            value: 'clear',
            description: 'Remove all stored files',
            action: 'Clear all stored files',
          },
        ],
        default: 'useStored',
        description: 'Choose whether to use stored files or select new ones',
      },
      // Notice about stored files
      {
        displayName: 'This node stores files persistently. Run the workflow with "Select New Files" to pick files, then switch back to "Use Stored Files" for subsequent runs.',
        name: 'notice',
        type: 'notice',
        default: '',
      },
      // Stored files display (read-only JSON view)
      {
        displayName: 'Stored Files',
        name: 'storedFilesDisplay',
        type: 'json',
        default: '[]',
        description: 'Files currently stored in this node (read-only view, updated when you select files)',
        displayOptions: {
          show: {
            operation: ['useStored'],
          },
        },
      },
      // File selection options (shown when selecting files)
      {
        displayName: 'Dialog Title',
        name: 'dialogTitle',
        type: 'string',
        default: DEFAULT_CONFIG.fileSelector.dialogTitle,
        description: 'Title shown in the file selection dialog',
        displayOptions: {
          show: {
            operation: ['selectNew', 'addMore'],
          },
        },
      },
      {
        displayName: 'File Type Filter',
        name: 'fileTypeFilter',
        type: 'options',
        options: [
          {
            name: 'All Files',
            value: 'all',
            description: 'Allow selection of any file type',
          },
          {
            name: 'Documents',
            value: 'documents',
            description: 'PDF, Word, text, and markdown files',
          },
          {
            name: 'Spreadsheets',
            value: 'spreadsheets',
            description: 'Excel and CSV files',
          },
          {
            name: 'Images',
            value: 'images',
            description: 'PNG, JPG, GIF, WebP, and BMP files',
          },
          {
            name: 'Custom',
            value: 'custom',
            description: 'Specify custom file extensions',
          },
        ],
        default: 'all',
        description: 'Filter which file types can be selected',
        displayOptions: {
          show: {
            operation: ['selectNew', 'addMore'],
          },
        },
      },
      {
        displayName: 'Custom Extensions',
        name: 'customExtensions',
        type: 'string',
        default: '',
        placeholder: 'pdf,docx,txt',
        description: 'Comma-separated list of file extensions (without dots)',
        displayOptions: {
          show: {
            operation: ['selectNew', 'addMore'],
            fileTypeFilter: ['custom'],
          },
        },
      },
      {
        displayName: 'Allow Multiple Files',
        name: 'allowMultiple',
        type: 'boolean',
        default: DEFAULT_CONFIG.fileSelector.allowMultiple,
        description: 'Whether to allow selecting multiple files at once',
        displayOptions: {
          show: {
            operation: ['selectNew', 'addMore'],
          },
        },
      },
      {
        displayName: 'Duplicate Handling',
        name: 'duplicateHandling',
        type: 'options',
        options: [
          {
            name: 'Rename',
            value: 'rename',
            description: 'Add a number suffix to duplicate filenames',
          },
          {
            name: 'Skip',
            value: 'skip',
            description: 'Skip files that already exist',
          },
          {
            name: 'Overwrite',
            value: 'overwrite',
            description: 'Replace existing files with the same name',
          },
        ],
        default: DEFAULT_CONFIG.fileSelector.duplicateHandling,
        description: 'How to handle files that already exist in the destination',
        displayOptions: {
          show: {
            operation: ['selectNew', 'addMore'],
          },
        },
      },
      {
        displayName: 'Destination Subfolder',
        name: 'destinationSubfolder',
        type: 'string',
        default: DEFAULT_CONFIG.fileSelector.destinationSubfolder,
        description: 'Subfolder within the data folder where files will be copied',
        displayOptions: {
          show: {
            operation: ['selectNew', 'addMore'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Get static data for persisting files across executions
    const staticData = this.getWorkflowStaticData('node');

    // Get execution context for external config support (FR-021)
    const executionId = this.getExecutionId();
    const node = this.getNode();
    const nodeId = node.id;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;

        // Get stored files from static data
        let storedFiles: IFileReference[] = (staticData.files as IFileReference[]) || [];

        // Check for external config from popup (FR-021)
        // This allows the popup to provide files without opening the file selector dialog
        if (operation === 'useStored' && executionId && nodeId) {
          const externalConfig = await getExternalNodeConfig(executionId, nodeId);
          if (externalConfig?.nodeType === 'fileSelector' && Array.isArray(externalConfig.value)) {
            // Use files from popup instead of stored files
            const externalFiles = externalConfig.value as IExternalFileReference[];
            const files: IFileReference[] = externalFiles.map((f) => {
              // Extract extension from filename
              const lastDot = f.name.lastIndexOf('.');
              const extension = lastDot > 0 ? f.name.substring(lastDot + 1).toLowerCase() : '';

              return {
                id: f.id,
                originalName: f.name,
                originalPath: f.path,
                destinationPath: f.path,
                size: f.size,
                mimeType: f.mimeType,
                extension,
                copiedAt: new Date().toISOString(),
              };
            });

            const output: IDataObject = {
              success: true,
              operation: 'externalConfig',
              source: 'popup',
              fileCount: files.length,
              files,
              totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
            };

            returnData.push({
              json: output,
              pairedItem: { item: itemIndex },
            });
            continue;
          }
        }

        if (operation === 'useStored') {
          // Just output the stored files
          const output: IDataObject = {
            success: true,
            operation: 'useStored',
            fileCount: storedFiles.length,
            files: storedFiles,
            totalSize: storedFiles.reduce((sum, f) => sum + (f.size || 0), 0),
          };

          returnData.push({
            json: output,
            pairedItem: { item: itemIndex },
          });
        } else if (operation === 'selectNew' || operation === 'addMore') {
          // Check if bridge is available
          const bridgeAvailable = await isBridgeAvailable();
          if (!bridgeAvailable) {
            throw new NodeOperationError(
              this.getNode(),
              'Electron bridge is not available. This node requires the n8n Desktop application.',
              { description: 'The File Selector node uses native OS dialogs which are only available in the n8n Desktop application.' }
            );
          }

          // Get selection parameters
          const dialogTitle = this.getNodeParameter('dialogTitle', itemIndex, DEFAULT_CONFIG.fileSelector.dialogTitle) as string;
          const fileTypeFilter = this.getNodeParameter('fileTypeFilter', itemIndex, 'all') as string;
          const customExtensions = this.getNodeParameter('customExtensions', itemIndex, '') as string;
          const allowMultiple = this.getNodeParameter('allowMultiple', itemIndex, DEFAULT_CONFIG.fileSelector.allowMultiple) as boolean;
          const duplicateHandling = this.getNodeParameter('duplicateHandling', itemIndex, DEFAULT_CONFIG.fileSelector.duplicateHandling) as 'rename' | 'skip' | 'overwrite';
          const destinationSubfolder = this.getNodeParameter('destinationSubfolder', itemIndex, DEFAULT_CONFIG.fileSelector.destinationSubfolder) as string;

          // Build file filters
          const filters = buildFileFilters(fileTypeFilter, customExtensions);

          // Open file selection dialog
          const selectResult = await selectFiles({
            title: dialogTitle,
            filters,
            multiSelect: allowMultiple,
          });

          // Handle cancellation
          if (selectResult.cancelled || selectResult.selectedPaths.length === 0) {
            const output: IDataObject = {
              success: false,
              operation,
              cancelled: true,
              fileCount: storedFiles.length,
              files: storedFiles,
              message: 'File selection was cancelled. Stored files unchanged.',
            };
            returnData.push({
              json: output,
              pairedItem: { item: itemIndex },
            });
            continue;
          }

          // Copy selected files to data folder
          const copyResult = await copyFiles({
            files: selectResult.selectedPaths.map((sourcePath) => ({ sourcePath })),
            destinationSubfolder,
            duplicateHandling,
          });

          // Update stored files based on operation
          if (operation === 'selectNew') {
            // Replace all files
            storedFiles = copyResult.copiedFiles;
          } else {
            // Add to existing files (avoid duplicates by path)
            const existingPaths = new Set(storedFiles.map(f => f.destinationPath));
            const newFiles = copyResult.copiedFiles.filter(f => !existingPaths.has(f.destinationPath));
            storedFiles = [...storedFiles, ...newFiles];
          }

          // Persist to static data
          staticData.files = storedFiles;

          // Build output
          const output: IDataObject = {
            success: copyResult.success,
            operation,
            cancelled: false,
            fileCount: storedFiles.length,
            files: storedFiles,
            newFilesAdded: copyResult.copiedFiles.length,
            skippedFiles: copyResult.skippedFiles,
            totalSize: storedFiles.reduce((sum, f) => sum + (f.size || 0), 0),
            message: `${copyResult.copiedFiles.length} file(s) added. Total: ${storedFiles.length} file(s) stored.`,
          };

          returnData.push({
            json: output,
            pairedItem: { item: itemIndex },
          });
        } else if (operation === 'clear') {
          // Clear all stored files
          storedFiles = [];
          staticData.files = storedFiles;

          const output: IDataObject = {
            success: true,
            operation: 'clear',
            fileCount: 0,
            files: [],
            totalSize: 0,
            message: 'All stored files have been cleared.',
          };

          returnData.push({
            json: output,
            pairedItem: { item: itemIndex },
          });
        }
      } catch (error) {
        if (isBridgeUnavailableError(error)) {
          throw new NodeOperationError(
            this.getNode(),
            'Lost connection to Electron bridge. Please restart the application.',
            { itemIndex }
          );
        }

        if (this.continueOnFail()) {
          const storedFiles = (staticData.files as IFileReference[]) || [];
          const errorOutput: IDataObject = {
            success: false,
            operation: 'error',
            fileCount: storedFiles.length,
            files: storedFiles,
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
