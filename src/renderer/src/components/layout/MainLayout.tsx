import { useState, useEffect, type ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import { Sidebar } from './Sidebar';
import { MinimizedSidebar } from './MinimizedSidebar';
import { ImportConfirmDialog } from '../features/workflows/ImportConfirmDialog';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import { UpdateBanner } from '../features/updates/UpdateBanner';
import { ServerErrorBanner } from '../features/server/ServerErrorBanner';
import { DataFolderWarningBanner } from '../features/storage/DataFolderWarningBanner';
import { ThemeToggle } from '../ui/ThemeToggle';
import { $n8nStatus, restartN8n } from '@/stores/n8n';
import { closeEditor } from '@/stores/editor';
import type { UpdateInfo, DataFolderStatus } from '../../../../preload/types';

interface MainLayoutProps {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  editorVisible?: boolean;
}

interface ImportedWorkflowData {
  name: string;
  description?: string;
  nodes?: unknown[];
  fileName: string;
  filePath: string;
}

export function MainLayout({ children, currentPath, onNavigate, editorVisible = false }: MainLayoutProps) {
  const n8nStatus = useStore($n8nStatus);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importedWorkflow, setImportedWorkflow] = useState<ImportedWorkflowData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<'general' | 'server' | 'ai' | 'storage'>('general');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dataFolderStatus, setDataFolderStatus] = useState<DataFolderStatus | null>(null);

  // Check data folder accessibility on mount
  useEffect(() => {
    window.electron.storage.checkDataFolder().then((status) => {
      if (!status.accessible) {
        setDataFolderStatus(status);
      }
    });
  }, []);

  // Subscribe to update notifications
  useEffect(() => {
    // Check for cached update info on mount
    window.electron.updates.getInfo().then((info) => {
      if (info) {
        setUpdateInfo(info);
      }
    });

    // Subscribe to new update notifications
    const unsubscribeAvailable = window.electron.updates.onUpdateAvailable((info) => {
      setUpdateInfo(info);
    });

    // Subscribe to update dismissed notifications
    const unsubscribeDismissed = window.electron.updates.onUpdateDismissed(() => {
      setUpdateInfo(null);
    });

    return () => {
      unsubscribeAvailable();
      unsubscribeDismissed();
    };
  }, []);

  const handleOpenSettings = () => {
    setSettingsDefaultTab('general');
    setSettingsDialogOpen(true);
  };

  const handleOpenServerSettings = () => {
    setSettingsDefaultTab('server');
    setSettingsDialogOpen(true);
  };

  const handleNewWorkflow = async () => {
    try {
      // Create a new blank workflow
      const result = await window.electron.workflows.create({
        name: 'New Workflow',
        nodes: [],
        connections: {},
      });

      if (result.success && result.data) {
        // Open the editor with the new workflow
        await window.electron.editor.open(result.data.id);
        // Add to recent
        await window.electron.workflows.addRecent(result.data.id);
      } else {
        console.error('Failed to create workflow:', result.error);
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Error',
          message: 'Failed to create workflow',
          detail: result.error,
        });
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
      await window.electron.dialog.showMessage({
        type: 'error',
        title: 'Error',
        message: 'Failed to create workflow',
        detail: error instanceof Error ? error.message : 'Make sure the n8n server is running.',
      });
    }
  };

  const handleImportWorkflow = async () => {
    try {
      // Use the import handler which shows file picker
      const result = await window.electron.workflows.import();

      if (result.canceled) {
        return;
      }

      if (result.success && result.data) {
        setImportedWorkflow({
          name: result.data.name,
          description: result.data.description,
          nodes: result.data.nodes,
          fileName: result.data.fileName,
          filePath: result.data.filePath,
        });
        setImportDialogOpen(true);
      } else {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Import Error',
          message: 'Failed to import workflow',
          detail: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      console.error('Error importing workflow:', error);
      await window.electron.dialog.showMessage({
        type: 'error',
        title: 'Import Error',
        message: 'Failed to import workflow',
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleConfirmImport = async (_overrideExisting: boolean) => {
    if (!importedWorkflow) return;

    setIsImporting(true);
    try {
      // Create the workflow from imported data
      const result = await window.electron.workflows.create({
        name: importedWorkflow.name,
        description: importedWorkflow.description,
        nodes: importedWorkflow.nodes as unknown[],
        connections: {},
      });

      if (result.success && result.data) {
        setImportDialogOpen(false);
        setImportedWorkflow(null);

        // Open the editor with the imported workflow
        await window.electron.editor.open(result.data.id);
        await window.electron.workflows.addRecent(result.data.id);
      } else {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Import Error',
          message: 'Failed to create workflow from imported file',
          detail: result.error,
        });
      }
    } catch (error) {
      console.error('Error creating imported workflow:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelImport = () => {
    setImportDialogOpen(false);
    setImportedWorkflow(null);
  };

  const handleDismissUpdate = async () => {
    await window.electron.updates.dismiss();
    setUpdateInfo(null);
  };

  const handleDownloadUpdate = async () => {
    if (updateInfo?.downloadUrl) {
      await window.electron.updates.download();
    }
  };

  const handleOpenStorageSettings = () => {
    setSettingsDefaultTab('storage');
    setSettingsDialogOpen(true);
  };

  const handleSelectNewDataFolder = async () => {
    const result = await window.electron.storage.selectDataFolder();
    if (result.success) {
      // Recheck data folder status after selection
      const status = await window.electron.storage.checkDataFolder();
      if (status.accessible) {
        setDataFolderStatus(null);
      } else {
        setDataFolderStatus(status);
      }
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    try {
      // Get templates
      const templates = await window.electron.workflows.getTemplates();
      const template = templates.find((t) => t.id === templateId);

      if (!template) {
        console.error('Template not found:', templateId);
        return;
      }

      // Create workflow from template
      const result = await window.electron.workflows.create({
        name: template.workflow.name || template.name,
        nodes: template.workflow.nodes || [],
        connections: template.workflow.connections || {},
        settings: template.workflow.settings || {},
      });

      if (result.success && result.data) {
        await window.electron.editor.open(result.data.id);
        await window.electron.workflows.addRecent(result.data.id);
      } else {
        console.error('Failed to create workflow from template:', result.error);
      }
    } catch (error) {
      console.error('Error creating workflow from template:', error);
    }
  };

  // Debug: log editorVisible state changes
  useEffect(() => {
    console.log('MainLayout editorVisible:', editorVisible);
  }, [editorVisible]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Show minimized sidebar when editor is visible, full sidebar otherwise */}
      {editorVisible ? (
        <MinimizedSidebar
          onNavigate={onNavigate}
          onOpenSettings={handleOpenSettings}
          onNewWorkflow={handleNewWorkflow}
          onCloseEditor={closeEditor}
        />
      ) : (
        <Sidebar
          currentPath={currentPath}
          onNavigate={onNavigate}
          onOpenSettings={handleOpenSettings}
          onOpenServerSettings={handleOpenServerSettings}
          onNewWorkflow={handleNewWorkflow}
          onImportWorkflow={handleImportWorkflow}
          onSelectTemplate={handleSelectTemplate}
        />
      )}
      {/* Main content area - hidden when editor is visible (BrowserView covers it) */}
      <main className={`flex-1 flex flex-col overflow-hidden relative ${editorVisible ? 'invisible' : ''}`}>
        {/* Theme Toggle - floating top-right */}
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        {/* Update Banner */}
        <UpdateBanner
          updateInfo={updateInfo}
          onDismiss={handleDismissUpdate}
          onDownload={handleDownloadUpdate}
        />
        {/* Server Error Banner */}
        <ServerErrorBanner
          status={n8nStatus}
          onRetry={restartN8n}
          onOpenSettings={handleOpenServerSettings}
        />
        {/* Data Folder Warning Banner */}
        {dataFolderStatus && dataFolderStatus.errorType && (
          <DataFolderWarningBanner
            dataFolder={dataFolderStatus.dataFolder}
            errorType={dataFolderStatus.errorType}
            onOpenSettings={handleOpenStorageSettings}
            onSelectFolder={handleSelectNewDataFolder}
          />
        )}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Import Confirmation Dialog */}
      <ImportConfirmDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        workflowData={importedWorkflow}
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
        isLoading={isImporting}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        defaultTab={settingsDefaultTab}
      />
    </div>
  );
}
