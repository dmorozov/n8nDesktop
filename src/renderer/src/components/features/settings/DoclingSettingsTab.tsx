/**
 * Docling Settings Tab Component (T040-T043, T045a)
 *
 * Provides UI for:
 * - Processing tier selection (T041)
 * - Max concurrent jobs selector (T042)
 * - Timeout action dropdown (T043)
 * - Resource check warning for Advanced tier (T045a)
 * - Service status and control
 */
import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  RefreshCw,
  Play,
  Square,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  $doclingStatus,
  $doclingConfig,
  $pythonInfo,
  $tempFolderDiskSpace,
  startDocling,
  stopDocling,
  restartDocling,
  updateDoclingConfig,
  checkPython,
  refreshTempFolderDiskSpace,
  selectTempFolder,
  TIER_DESCRIPTIONS,
  TIMEOUT_ACTION_DESCRIPTIONS,
} from '@/stores/docling';
import type { DoclingConfig } from '../../../../../preload/types';

interface DoclingSettingsTabProps {
  onSave: () => Promise<void>;
  isSaving: boolean;
  hasChanges: boolean;
}

export function DoclingSettingsTab({
  onSave,
  isSaving,
  hasChanges,
}: DoclingSettingsTabProps) {
  const doclingStatus = useStore($doclingStatus);
  const doclingConfig = useStore($doclingConfig);
  const pythonInfo = useStore($pythonInfo);
  const tempFolderDiskSpace = useStore($tempFolderDiskSpace);

  const [isRestarting, setIsRestarting] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<Partial<DoclingConfig>>(
    {}
  );
  const [showAdvancedWarning, setShowAdvancedWarning] = useState(false);

  // Check Python availability and disk space on mount
  useEffect(() => {
    checkPython();
    refreshTempFolderDiskSpace();
  }, []);

  // Get current config value (pending or saved)
  const getConfigValue = <K extends keyof DoclingConfig>(
    key: K
  ): DoclingConfig[K] => {
    if (key in pendingConfig) {
      return pendingConfig[key] as DoclingConfig[K];
    }
    return doclingConfig[key];
  };

  // Update pending config
  const updatePendingConfig = <K extends keyof DoclingConfig>(
    key: K,
    value: DoclingConfig[K]
  ): void => {
    setPendingConfig((prev) => ({ ...prev, [key]: value }));

    // Show warning when selecting Advanced tier
    if (key === 'processingTier' && value === 'advanced') {
      setShowAdvancedWarning(true);
    } else if (key === 'processingTier') {
      setShowAdvancedWarning(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (Object.keys(pendingConfig).length > 0) {
      await updateDoclingConfig(pendingConfig);
      setPendingConfig({});
    }
    await onSave();
  };

  // Service control handlers
  const handleStart = async () => {
    await startDocling();
  };

  const handleStop = async () => {
    await stopDocling();
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await restartDocling();
    } finally {
      setIsRestarting(false);
    }
  };

  const handleBrowseTempFolder = async () => {
    const result = await selectTempFolder();
    if (result.success && result.path) {
      updatePendingConfig('tempFolder', result.path);
    }
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Status badge
  const getStatusBadge = () => {
    switch (doclingStatus.status) {
      case 'running':
        return (
          <Badge
            variant="success"
            className="flex items-center gap-1"
            data-testid="docling-status-badge"
          >
            <CheckCircle className="h-3 w-3" />
            Running
          </Badge>
        );
      case 'starting':
        return (
          <Badge
            variant="secondary"
            className="flex items-center gap-1"
            data-testid="docling-status-badge"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Starting...
          </Badge>
        );
      case 'error':
        return (
          <Badge
            variant="destructive"
            className="flex items-center gap-1"
            data-testid="docling-status-badge"
          >
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge
            variant="secondary"
            data-testid="docling-status-badge"
          >
            Stopped
          </Badge>
        );
    }
  };

  const hasLocalChanges = Object.keys(pendingConfig).length > 0;
  const currentTier = getConfigValue('processingTier');
  const currentMaxJobs = getConfigValue('maxConcurrentJobs');
  const currentTimeoutAction = getConfigValue('timeoutAction');
  const currentTempFolder = getConfigValue('tempFolder');
  const currentEnabled = getConfigValue('enabled');

  return (
    <div className="space-y-6" data-testid="docling-settings-tab">
      <div>
        <h3 className="text-lg font-medium">Document Processing (Docling)</h3>
        <p className="text-sm text-muted-foreground">
          Configure the Granite Docling OCR service for document conversion.
        </p>
      </div>

      <Separator />

      {/* Python Status Check */}
      {!pythonInfo.available && (
        <div
          className="rounded-lg border border-destructive bg-destructive/10 p-4"
          role="alert"
          aria-live="assertive"
          data-testid="docling-python-warning"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h4 className="font-medium text-destructive">Python Not Found</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Python 3.10+ is required to run the Docling service.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() =>
                  window.electron.shell.openExternal(
                    'https://www.python.org/downloads/'
                  )
                }
              >
                Download Python
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div
        className="flex items-center justify-between rounded-lg border p-4"
        data-testid="docling-enable-toggle"
      >
        <div className="space-y-0.5">
          <Label htmlFor="doclingEnabled">Enable Docling Service</Label>
          <p className="text-sm text-muted-foreground">
            Automatically start the document processing service with the
            application.
          </p>
        </div>
        <Switch
          id="doclingEnabled"
          checked={currentEnabled}
          onCheckedChange={(checked) => updatePendingConfig('enabled', checked)}
          disabled={isSaving || !pythonInfo.available}
          data-testid="docling-enable-switch"
        />
      </div>

      {/* Service Status */}
      <div
        className="rounded-lg border p-4"
        role="status"
        aria-live="polite"
        data-testid="docling-service-status"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Service Status</Label>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {doclingStatus.status === 'running' && (
                <span className="text-sm text-muted-foreground">
                  Port {doclingStatus.port}
                  {doclingStatus.activeJobs > 0 && (
                    <> - {doclingStatus.activeJobs} active job(s)</>
                  )}
                </span>
              )}
              {doclingStatus.error && (
                <span className="text-sm text-destructive">
                  {doclingStatus.error}
                </span>
              )}
              {doclingStatus.restartAttempts > 0 && (
                <span className="text-sm text-muted-foreground">
                  (Restart attempt {doclingStatus.restartAttempts}/3)
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {doclingStatus.status === 'running' ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestart}
                  disabled={isRestarting}
                  data-testid="docling-restart-button"
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${isRestarting ? 'animate-spin' : ''}`}
                  />
                  Restart
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStop}
                  data-testid="docling-stop-button"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </>
            ) : doclingStatus.status === 'starting' ? (
              <Button variant="outline" size="sm" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStart}
                disabled={!pythonInfo.available}
                data-testid="docling-start-button"
              >
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Processing Tier Selection (T041) */}
      <div className="space-y-2" data-testid="docling-tier-section">
        <Label htmlFor="processingTier">Processing Tier</Label>
        <Select
          value={currentTier}
          onValueChange={(value: DoclingConfig['processingTier']) =>
            updatePendingConfig('processingTier', value)
          }
          disabled={isSaving}
        >
          <SelectTrigger
            id="processingTier"
            className="max-w-[300px]"
            data-testid="docling-tier-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              Object.entries(TIER_DESCRIPTIONS) as [
                DoclingConfig['processingTier'],
                (typeof TIER_DESCRIPTIONS)[DoclingConfig['processingTier']]
              ][]
            ).map(([tier, info]) => (
              <SelectItem key={tier} value={tier}>
                {info.name} (~{info.ramEstimate} RAM)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {TIER_DESCRIPTIONS[currentTier].description}
        </p>

        {/* Advanced Tier Warning (T045a) */}
        {showAdvancedWarning && (
          <div
            className="mt-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3"
            role="alert"
            data-testid="docling-advanced-warning"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  High Resource Usage
                </p>
                <p className="text-muted-foreground mt-1">
                  The Advanced tier requires 8-16 GB RAM. Ensure your system has
                  sufficient resources before enabling this tier.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Max Concurrent Jobs (T042) */}
      <div className="space-y-2" data-testid="docling-jobs-section">
        <Label htmlFor="maxConcurrentJobs">Maximum Concurrent Jobs</Label>
        <Select
          value={currentMaxJobs.toString()}
          onValueChange={(value) =>
            updatePendingConfig('maxConcurrentJobs', parseInt(value))
          }
          disabled={isSaving}
        >
          <SelectTrigger
            id="maxConcurrentJobs"
            className="max-w-[300px]"
            data-testid="docling-jobs-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 (Recommended for most systems)</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3 (High-end systems only)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Number of documents that can be processed simultaneously. Higher
          values require more system resources.
        </p>
      </div>

      {/* Timeout Action (T043) */}
      <div className="space-y-2" data-testid="docling-timeout-section">
        <Label htmlFor="timeoutAction">Timeout Action</Label>
        <Select
          value={currentTimeoutAction}
          onValueChange={(value: DoclingConfig['timeoutAction']) =>
            updatePendingConfig('timeoutAction', value)
          }
          disabled={isSaving}
        >
          <SelectTrigger
            id="timeoutAction"
            className="max-w-[300px]"
            data-testid="docling-timeout-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              Object.entries(TIMEOUT_ACTION_DESCRIPTIONS) as [
                DoclingConfig['timeoutAction'],
                (typeof TIMEOUT_ACTION_DESCRIPTIONS)[DoclingConfig['timeoutAction']]
              ][]
            ).map(([action, info]) => (
              <SelectItem key={action} value={action}>
                {info.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {TIMEOUT_ACTION_DESCRIPTIONS[currentTimeoutAction].description}
        </p>
      </div>

      <Separator />

      {/* Temporary Folder */}
      <div className="space-y-2" data-testid="docling-temp-folder-section">
        <Label htmlFor="tempFolder">Temporary Folder</Label>
        <div className="flex gap-2">
          <Input
            id="tempFolder"
            value={currentTempFolder}
            onChange={(e) => updatePendingConfig('tempFolder', e.target.value)}
            placeholder="Default system temp folder"
            disabled={isSaving}
            className="flex-1"
            data-testid="docling-temp-folder-input"
          />
          <Button
            variant="outline"
            onClick={handleBrowseTempFolder}
            disabled={isSaving}
            data-testid="docling-temp-folder-browse"
          >
            Browse
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Location for temporary files during document processing. Leave empty
          to use the system default.
        </p>

        {/* Disk Space Info (T051) */}
        {tempFolderDiskSpace && tempFolderDiskSpace.diskSpace && (
          <div
            className="mt-2 rounded-lg border bg-muted/30 p-3"
            data-testid="docling-disk-space-info"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Disk space for: {tempFolderDiskSpace.path}
              </span>
              <span className="font-medium">
                {formatBytes(tempFolderDiskSpace.diskSpace.freeBytes)} free
                of {formatBytes(tempFolderDiskSpace.diskSpace.totalBytes)}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${
                  tempFolderDiskSpace.diskSpace.usedPercentage > 90
                    ? 'bg-destructive'
                    : tempFolderDiskSpace.diskSpace.usedPercentage > 75
                    ? 'bg-yellow-500'
                    : 'bg-primary'
                }`}
                style={{ width: `${tempFolderDiskSpace.diskSpace.usedPercentage}%` }}
                data-testid="docling-disk-space-bar"
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {tempFolderDiskSpace.diskSpace.usedPercentage}% used
            </div>
          </div>
        )}

        {tempFolderDiskSpace && tempFolderDiskSpace.error && (
          <div
            className="mt-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-2"
            data-testid="docling-disk-space-error"
          >
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Could not get disk space info: {tempFolderDiskSpace.error}
            </p>
          </div>
        )}
      </div>

      {/* View Logs */}
      <div className="space-y-2">
        <Label>Service Logs</Label>
        <p className="text-sm text-muted-foreground">
          View Docling service output and debug information.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={doclingStatus.status !== 'running'}
          data-testid="docling-view-logs-button"
        >
          <FileText className="mr-2 h-4 w-4" />
          View Logs
        </Button>
      </div>

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={(!hasChanges && !hasLocalChanges) || isSaving}
          data-testid="docling-save-button"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
