import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { RefreshCw, Play, Square, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { $settings, updatePendingSetting, getSetting } from '@/stores/settings';
import { $n8nStatus } from '@/stores/n8n';
import { LogViewerDialog } from './LogViewerDialog';

interface ServerSettingsTabProps {
  onSave: () => Promise<void>;
  isSaving: boolean;
  hasChanges: boolean;
}

export function ServerSettingsTab({ onSave, isSaving, hasChanges }: ServerSettingsTabProps) {
  useStore($settings); // Subscribe to settings changes
  const n8nStatus = useStore($n8nStatus);
  const [isRestarting, setIsRestarting] = useState(false);
  const [logViewerOpen, setLogViewerOpen] = useState(false);

  const n8nPort = getSetting('n8nPort');
  const maxConcurrentWorkflows = getSetting('maxConcurrentWorkflows');
  const startWithSystem = getSetting('startWithSystem');
  const runInBackground = getSetting('runInBackground');
  const minimizeToTray = getSetting('minimizeToTray');

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await window.electron.n8n.restart();
    } catch (error) {
      console.error('Failed to restart n8n:', error);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleStart = async () => {
    try {
      await window.electron.n8n.start();
    } catch (error) {
      console.error('Failed to start n8n:', error);
    }
  };

  const handleStop = async () => {
    try {
      await window.electron.n8n.stop();
    } catch (error) {
      console.error('Failed to stop n8n:', error);
    }
  };

  const getStatusBadge = () => {
    switch (n8nStatus.status) {
      case 'running':
        return <Badge variant="success">Running</Badge>;
      case 'starting':
        return <Badge variant="secondary">Starting...</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Stopped</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Server Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure the n8n server port and workflow execution settings.
        </p>
      </div>

      <Separator />

      {/* Server Status */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Server Status</Label>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {n8nStatus.status === 'running' && (
                <span className="text-sm text-muted-foreground">
                  Port {n8nStatus.port} - Uptime: {formatUptime(n8nStatus.uptime)}
                </span>
              )}
              {n8nStatus.version && (
                <span className="text-sm text-muted-foreground">
                  - v{n8nStatus.version}
                </span>
              )}
              {n8nStatus.error && (
                <span className="text-sm text-destructive">{n8nStatus.error}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {n8nStatus.status === 'running' ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestart}
                  disabled={isRestarting}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRestarting ? 'animate-spin' : ''}`} />
                  Restart
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStop}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </>
            ) : n8nStatus.status === 'starting' ? (
              <Button variant="outline" size="sm" disabled>
                Starting...
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStart}
              >
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* View Logs */}
      <div className="space-y-2">
        <Label>Server Logs</Label>
        <p className="text-sm text-muted-foreground">
          View server output and debug information.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLogViewerOpen(true)}
        >
          <FileText className="mr-2 h-4 w-4" />
          View Logs
        </Button>
      </div>

      <Separator />

      {/* Port */}
      <div className="space-y-2">
        <Label htmlFor="port">Server Port</Label>
        <Input
          id="port"
          type="number"
          min={1024}
          max={65535}
          value={n8nPort}
          onChange={(e) => updatePendingSetting('n8nPort', parseInt(e.target.value) || 5678)}
          disabled={isSaving || n8nStatus.status === 'running'}
          className="max-w-[200px]"
        />
        <p className="text-sm text-muted-foreground">
          {n8nStatus.status === 'running'
            ? 'Stop the server to change the port.'
            : 'The port n8n will listen on (1024-65535)'}
        </p>
      </div>

      {/* Max Concurrent Workflows */}
      <div className="space-y-2">
        <Label htmlFor="maxConcurrent">Max Concurrent Workflows</Label>
        <Input
          id="maxConcurrent"
          type="number"
          min={1}
          max={20}
          value={maxConcurrentWorkflows}
          onChange={(e) => updatePendingSetting('maxConcurrentWorkflows', parseInt(e.target.value) || 3)}
          disabled={isSaving}
          className="max-w-[200px]"
        />
        <p className="text-sm text-muted-foreground">
          Maximum number of workflows that can run simultaneously (1-20)
        </p>
      </div>

      <Separator />

      {/* Advanced Settings */}
      <div className="space-y-4">
        <div>
          <Label>Advanced Settings</Label>
          <p className="text-sm text-muted-foreground">
            Configure application startup and background behavior.
          </p>
        </div>

        {/* Start on System Boot */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="startWithSystem">Start on System Boot</Label>
            <p className="text-sm text-muted-foreground">
              Automatically launch the application when your computer starts.
            </p>
          </div>
          <Switch
            id="startWithSystem"
            checked={startWithSystem}
            onCheckedChange={(checked) => updatePendingSetting('startWithSystem', checked)}
            disabled={isSaving}
          />
        </div>

        {/* Run in Background */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="runInBackground">Run in Background</Label>
            <p className="text-sm text-muted-foreground">
              Keep n8n server running when the window is closed.
            </p>
          </div>
          <Switch
            id="runInBackground"
            checked={runInBackground}
            onCheckedChange={(checked) => updatePendingSetting('runInBackground', checked)}
            disabled={isSaving}
          />
        </div>

        {/* Minimize to Tray */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="minimizeToTray">Minimize to Tray</Label>
            <p className="text-sm text-muted-foreground">
              Minimize to system tray instead of taskbar.
            </p>
          </div>
          <Switch
            id="minimizeToTray"
            checked={minimizeToTray}
            onCheckedChange={(checked) => updatePendingSetting('minimizeToTray', checked)}
            disabled={isSaving}
          />
        </div>
      </div>

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!hasChanges || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Log Viewer Dialog */}
      <LogViewerDialog open={logViewerOpen} onOpenChange={setLogViewerOpen} />
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
