import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { FolderOpen, HardDrive, RefreshCw, Download, Upload, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { $settings, updatePendingSetting, getSetting } from '@/stores/settings';
import type { BackupInfo, StorageStats } from '@/preload/types';

interface StorageSettingsTabProps {
  onSave: () => Promise<void>;
  isSaving: boolean;
  hasChanges: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function StorageSettingsTab({ onSave, isSaving, hasChanges }: StorageSettingsTabProps) {
  useStore($settings); // Subscribe to settings changes
  const [isCalculating, setIsCalculating] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [canChangeFolder, setCanChangeFolder] = useState(true);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [filesFolder, setFilesFolder] = useState<string>('');

  const dataFolder = getSetting('dataFolder');

  // Load files folder path on mount
  useEffect(() => {
    window.electron.storage.getFilesFolder().then(setFilesFolder);
  }, [dataFolder]);

  // Check if folder can be changed (no workflows running)
  useEffect(() => {
    window.electron.storage.canChangeDataFolder().then(setCanChangeFolder);
  }, []);

  // Load backups on mount
  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = useCallback(async () => {
    setIsLoadingBackups(true);
    try {
      const result = await window.electron.storage.listBackups();
      if (result.success && result.backups) {
        setBackups(result.backups);
      }
    } finally {
      setIsLoadingBackups(false);
    }
  }, []);

  const handleBrowseFolder = async () => {
    if (!canChangeFolder) {
      await window.electron.dialog.showMessage({
        type: 'warning',
        title: 'Cannot Change Folder',
        message: 'Cannot change data folder while workflows are running.',
        detail: 'Please stop all running workflows before changing the data folder.',
      });
      return;
    }

    try {
      const result = await window.electron.storage.selectDataFolder();

      if (result.success && result.path) {
        updatePendingSetting('dataFolder', result.path);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleOpenFolder = async () => {
    if (dataFolder) {
      await window.electron.shell.openPath(dataFolder);
    }
  };

  const handleOpenFilesFolder = async () => {
    if (filesFolder) {
      await window.electron.shell.openPath(filesFolder);
    }
  };

  const handleCalculateUsage = async () => {
    setIsCalculating(true);
    try {
      const result = await window.electron.storage.getStats();
      if (result.success && result.stats) {
        setStorageStats(result.stats);
      }
    } finally {
      setIsCalculating(false);
    }
  };

  const handleClearCache = async () => {
    const confirm = await window.electron.dialog.showMessage({
      type: 'question',
      title: 'Clear Cache',
      message: 'Are you sure you want to clear the cache?',
      detail: 'This will delete all log files. This action cannot be undone.',
      buttons: ['Cancel', 'Clear Cache'],
    });

    if (confirm.response === 1) {
      await window.electron.storage.clearCache();
      if (storageStats) {
        handleCalculateUsage();
      }
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const result = await window.electron.storage.createBackup();
      if (result.success) {
        await loadBackups();
        await window.electron.dialog.showMessage({
          type: 'info',
          title: 'Backup Created',
          message: 'Backup created successfully.',
          detail: result.backup ? `Saved to: ${result.backup.filename}` : undefined,
        });
      } else {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Backup Failed',
          message: 'Failed to create backup.',
          detail: result.error,
        });
      }
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!canChangeFolder) {
      await window.electron.dialog.showMessage({
        type: 'warning',
        title: 'Cannot Restore',
        message: 'Cannot restore while workflows are running.',
        detail: 'Please stop all running workflows before restoring from backup.',
      });
      return;
    }

    setIsRestoring(true);
    try {
      const result = await window.electron.storage.restoreBackup();
      if (result.success) {
        await window.electron.dialog.showMessage({
          type: 'info',
          title: 'Restore Complete',
          message: 'Backup restored successfully.',
          detail: 'You may need to restart the application for changes to take effect.',
        });
      } else if (!result.canceled) {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Restore Failed',
          message: 'Failed to restore backup.',
          detail: result.error,
        });
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    const confirm = await window.electron.dialog.showMessage({
      type: 'question',
      title: 'Delete Backup',
      message: 'Are you sure you want to delete this backup?',
      detail: 'This action cannot be undone.',
      buttons: ['Cancel', 'Delete'],
    });

    if (confirm.response === 1) {
      const result = await window.electron.storage.deleteBackup(backupId);
      if (result.success) {
        await loadBackups();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Storage Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure where n8n AI Runner stores its data.
        </p>
      </div>

      <Separator />

      {/* Data Folder */}
      <div className="space-y-2">
        <Label htmlFor="dataFolder">Data Folder</Label>
        <div className="flex gap-2">
          <Input
            id="dataFolder"
            value={dataFolder}
            onChange={(e) => updatePendingSetting('dataFolder', e.target.value)}
            disabled={isSaving || !canChangeFolder}
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={handleBrowseFolder}
            disabled={isSaving || !canChangeFolder}
            title={!canChangeFolder ? 'Stop all running workflows to change folder' : undefined}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Browse
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Location where workflows, credentials, and other data are stored.
        </p>
        {!canChangeFolder && (
          <p className="text-sm text-amber-600">
            Stop all running workflows to change the data folder.
          </p>
        )}
        {dataFolder && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm"
            onClick={handleOpenFolder}
          >
            Open folder in file explorer
          </Button>
        )}
      </div>

      <Separator />

      {/* Files Folder */}
      <div className="space-y-2">
        <Label>Workflow Files Folder</Label>
        <div className="flex gap-2">
          <Input
            value={filesFolder}
            readOnly
            className="flex-1 bg-muted"
          />
          <Button
            variant="outline"
            onClick={handleOpenFilesFolder}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Open
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Place files here to access them in your workflows using the "Read Binary File" or "Write Binary File" nodes.
          For security reasons, n8n can only access files within this folder.
        </p>
      </div>

      <Separator />

      {/* Storage Usage */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Storage Usage</Label>
            <p className="text-sm text-muted-foreground">
              See how much disk space n8n is using.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCalculateUsage}
            disabled={isCalculating}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isCalculating ? 'animate-spin' : ''}`} />
            Calculate
          </Button>
        </div>

        {storageStats && (
          <div className="rounded-lg border p-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Workflows</p>
                <p className="text-lg font-semibold">{formatBytes(storageStats.workflowsSize)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Logs</p>
                <p className="text-lg font-semibold">{formatBytes(storageStats.logsSize)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Backups</p>
                <p className="text-lg font-semibold">{formatBytes(storageStats.backupsSize)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-lg font-semibold text-primary">{formatBytes(storageStats.totalSize)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Data Management */}
      <div className="space-y-4">
        <div>
          <Label>Data Management</Label>
          <p className="text-sm text-muted-foreground">
            Manage your n8n data and logs.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
          >
            <HardDrive className="mr-2 h-4 w-4" />
            Clear Logs
          </Button>
        </div>
      </div>

      <Separator />

      {/* Backup & Restore */}
      <div className="space-y-4">
        <div>
          <Label>Backup & Restore</Label>
          <p className="text-sm text-muted-foreground">
            Create backups of your data or restore from a previous backup.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateBackup}
            disabled={isCreatingBackup}
          >
            {isCreatingBackup ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isCreatingBackup ? 'Creating...' : 'Create Backup'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestoreBackup}
            disabled={isRestoring || !canChangeFolder}
            title={!canChangeFolder ? 'Stop all running workflows to restore' : undefined}
          >
            {isRestoring ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isRestoring ? 'Restoring...' : 'Restore from Backup'}
          </Button>
        </div>

        {/* Backups List */}
        {backups.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm">Available Backups</Label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
              {isLoadingBackups ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading backups...</span>
                </div>
              ) : (
                backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{backup.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(backup.createdAt).toLocaleString()} - {formatBytes(backup.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => handleDeleteBackup(backup.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!hasChanges || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
