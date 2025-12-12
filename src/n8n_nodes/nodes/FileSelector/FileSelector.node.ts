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
  storeNodeFiles,
  getStoredNodeFiles,
  type IExternalFileReference,
  type IStoredFileReference,
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
    subtitle: 'Select local files',
    description: 'Select files from the local file system. Files passed from the execution popup take priority over stored files.',
    defaults: {
      name: 'File Selector',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      // Notice about how the node works
      {
        displayName: 'This node outputs files for the workflow. When executed via the popup, files from the popup are used. Otherwise, click "Execute Node" to select files.',
        name: 'notice',
        type: 'notice',
        default: '',
      },
      // File type filter
      {
        displayName: 'File Type Filter',
        name: 'filterType',
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
            filterType: ['custom'],
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
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Get static data for persisting files across executions (fallback)
    const staticData = this.getWorkflowStaticData('node');

    // Get execution context for external config support (FR-021)
    const executionId = this.getExecutionId();
    const node = this.getNode();
    const nodeId = node.id;
    const nodeName = node.name;

    // Get workflow identifier for bridge storage
    // Use workflow ID if available, otherwise use a placeholder
    const workflow = this.getWorkflow();
    const workflowId = workflow.id || workflow.name || 'unknown';
    const nodeIdentifier = nodeId || nodeName;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        // Priority 1: Check for external config from popup (FR-021)
        // Files passed from the WorkflowExecutionPopup take priority
        if (executionId && nodeIdentifier) {
          const externalConfig = await getExternalNodeConfig(executionId, nodeIdentifier);
          if (externalConfig?.nodeType === 'fileSelector' && Array.isArray(externalConfig.value) && externalConfig.value.length > 0) {
            // Use files from popup
            const externalFiles = externalConfig.value as IExternalFileReference[];
            const files = externalFiles.map((f) => {
              const lastDot = f.name.lastIndexOf('.');
              const extension = lastDot > 0 ? f.name.substring(lastDot + 1).toLowerCase() : '';

              return {
                id: f.id,
                originalName: f.name,
                originalPath: f.path,
                destinationPath: f.path,
                path: f.path, // Alias for compatibility with workflows expecting 'path'
                size: f.size,
                mimeType: f.mimeType,
                extension,
                copiedAt: new Date().toISOString(),
              };
            });

            const output: IDataObject = {
              success: true,
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

        // Priority 2: Try to get stored files from bridge (persists across test executions)
        let storedFiles: Array<IFileReference & { path: string }> = [];
        try {
          const bridgeStoredFiles = await getStoredNodeFiles(workflowId, nodeIdentifier);
          if (bridgeStoredFiles.length > 0) {
            // Convert IStoredFileReference to IFileReference with path alias
            storedFiles = bridgeStoredFiles.map((f: IStoredFileReference) => ({
              id: f.id,
              originalName: f.originalName,
              originalPath: f.originalPath,
              destinationPath: f.destinationPath,
              path: f.destinationPath, // Alias for compatibility with workflows expecting 'path'
              size: f.size,
              mimeType: f.mimeType,
              extension: f.extension,
              copiedAt: f.copiedAt,
            }));
          }
        } catch {
          // Fallback to static data if bridge fails
          const staticFiles = (staticData.files as IFileReference[]) || [];
          storedFiles = staticFiles.map((f) => ({
            ...f,
            path: f.destinationPath, // Add path alias
          }));
        }

        // If no bridge files, try static data as fallback
        if (storedFiles.length === 0) {
          const staticFiles = (staticData.files as IFileReference[]) || [];
          storedFiles = staticFiles.map((f) => ({
            ...f,
            path: f.destinationPath, // Add path alias
          }));
        }

        // Use stored files if available
        if (storedFiles.length > 0) {
          const output: IDataObject = {
            success: true,
            source: 'stored',
            fileCount: storedFiles.length,
            files: storedFiles,
            totalSize: storedFiles.reduce((sum, f) => sum + (f.size || 0), 0),
          };

          returnData.push({
            json: output,
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        // Priority 3: Open file selection dialog
        const bridgeAvailable = await isBridgeAvailable();
        if (!bridgeAvailable) {
          throw new NodeOperationError(
            this.getNode(),
            'Electron bridge is not available. This node requires the n8n Desktop application.',
            { description: 'The File Selector node uses native OS dialogs which are only available in the n8n Desktop application.' }
          );
        }

        // Get selection parameters
        const filterType = this.getNodeParameter('filterType', itemIndex, 'all') as string;
        const customExtensions = this.getNodeParameter('customExtensions', itemIndex, '') as string;
        const allowMultiple = this.getNodeParameter('allowMultiple', itemIndex, DEFAULT_CONFIG.fileSelector.allowMultiple) as boolean;

        // Build file filters
        const filters = buildFileFilters(filterType, customExtensions);

        // Open file selection dialog
        const selectResult = await selectFiles({
          title: 'Select Files',
          filters,
          multiSelect: allowMultiple,
        });

        // Handle cancellation
        if (selectResult.cancelled || selectResult.selectedPaths.length === 0) {
          const output: IDataObject = {
            success: false,
            source: 'dialog',
            cancelled: true,
            fileCount: 0,
            files: [],
            message: 'File selection was cancelled.',
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
          destinationSubfolder: DEFAULT_CONFIG.fileSelector.destinationSubfolder,
          duplicateHandling: DEFAULT_CONFIG.fileSelector.duplicateHandling,
        });

        // Store the files in bridge (persists across test executions)
        // Add path alias for compatibility
        const copiedFilesWithPath = copyResult.copiedFiles.map((f) => ({
          ...f,
          path: f.destinationPath, // Alias for compatibility with workflows expecting 'path'
        }));
        storedFiles = copiedFilesWithPath;

        // Store via bridge for persistence
        const filesToStore: IStoredFileReference[] = copyResult.copiedFiles.map((f) => ({
          id: f.id,
          originalName: f.originalName,
          originalPath: f.originalPath,
          destinationPath: f.destinationPath,
          size: f.size,
          mimeType: f.mimeType,
          extension: f.extension,
          copiedAt: f.copiedAt,
          hash: f.hash,
        }));
        await storeNodeFiles(workflowId, nodeIdentifier, filesToStore);

        // Also store in static data as backup (without path alias to maintain type consistency)
        staticData.files = copyResult.copiedFiles;

        // Build output
        const output: IDataObject = {
          success: copyResult.success,
          source: 'dialog',
          fileCount: storedFiles.length,
          files: storedFiles,
          totalSize: storedFiles.reduce((sum, f) => sum + (f.size || 0), 0),
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
          const storedFiles = (staticData.files as IFileReference[]) || [];
          const errorOutput: IDataObject = {
            success: false,
            source: 'error',
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
