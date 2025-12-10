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
} from '../../lib/bridge-client';
import { DEFAULT_CONFIG, FILE_FILTER_PRESETS } from '../../lib/types';

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
    subtitle: 'Select and import local files',
    description: 'Select files from the local filesystem using a native file dialog. Files are copied to the n8n data folder for workflow access.',
    defaults: {
      name: 'File Selector',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Dialog Title',
        name: 'dialogTitle',
        type: 'string',
        default: DEFAULT_CONFIG.fileSelector.dialogTitle,
        description: 'Title shown in the file selection dialog',
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
      },
      {
        displayName: 'Destination Subfolder',
        name: 'destinationSubfolder',
        type: 'string',
        default: DEFAULT_CONFIG.fileSelector.destinationSubfolder,
        description: 'Subfolder within the data folder where files will be copied',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Check if bridge is available
    const bridgeAvailable = await isBridgeAvailable();
    if (!bridgeAvailable) {
      throw new NodeOperationError(
        this.getNode(),
        'Electron bridge is not available. This node requires the n8n Desktop application.',
        { description: 'The File Selector node uses native OS dialogs which are only available in the n8n Desktop application.' }
      );
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        // Get parameters
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
            cancelled: true,
            fileCount: 0,
            files: [],
            totalSize: 0,
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

        // Build output with file references
        const output: IDataObject = {
          success: copyResult.success,
          cancelled: false,
          fileCount: copyResult.copiedFiles.length,
          files: copyResult.copiedFiles.map((file) => ({
            id: file.id,
            originalName: file.originalName,
            originalPath: file.originalPath,
            destinationPath: file.destinationPath,
            size: file.size,
            mimeType: file.mimeType,
            extension: file.extension,
            copiedAt: file.copiedAt,
            hash: file.hash,
          })),
          skippedFiles: copyResult.skippedFiles,
          totalSize: copyResult.totalSize,
        };

        returnData.push({
          json: output,
          pairedItem: { item: itemIndex },
        });
      } catch (error) {
        if (isBridgeUnavailableError(error)) {
          throw new NodeOperationError(
            this.getNode(),
            'Lost connection to Electron bridge. Please restart the application.',
            { itemIndex }
          );
        }

        if (this.continueOnFail()) {
          const errorOutput: IDataObject = {
            success: false,
            cancelled: false,
            fileCount: 0,
            files: [],
            totalSize: 0,
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
