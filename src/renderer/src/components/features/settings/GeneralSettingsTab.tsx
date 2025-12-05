import { useStore } from '@nanostores/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { $settings, updatePendingSetting, getSetting } from '@/stores/settings';

interface GeneralSettingsTabProps {
  onSave: () => Promise<void>;
  isSaving: boolean;
  hasChanges: boolean;
}

export function GeneralSettingsTab({ onSave, isSaving, hasChanges }: GeneralSettingsTabProps) {
  useStore($settings); // Subscribe to settings changes

  const startWithSystem = getSetting('startWithSystem');
  const minimizeToTray = getSetting('minimizeToTray');
  const runInBackground = getSetting('runInBackground');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">General Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure how n8n AI Runner starts and runs on your system.
        </p>
      </div>

      <Separator />

      {/* Start with System */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="startWithSystem">Start with System</Label>
          <p className="text-sm text-muted-foreground">
            Launch n8n AI Runner when your computer starts
          </p>
        </div>
        <Switch
          id="startWithSystem"
          checked={startWithSystem}
          onCheckedChange={(checked) => updatePendingSetting('startWithSystem', checked)}
          disabled={isSaving}
        />
      </div>

      {/* Minimize to Tray */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="minimizeToTray">Minimize to System Tray</Label>
          <p className="text-sm text-muted-foreground">
            Keep n8n AI Runner in the system tray when minimized
          </p>
        </div>
        <Switch
          id="minimizeToTray"
          checked={minimizeToTray}
          onCheckedChange={(checked) => updatePendingSetting('minimizeToTray', checked)}
          disabled={isSaving}
        />
      </div>

      {/* Run in Background */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="runInBackground">Run in Background</Label>
          <p className="text-sm text-muted-foreground">
            Keep the n8n server running when the window is closed
          </p>
        </div>
        <Switch
          id="runInBackground"
          checked={runInBackground}
          onCheckedChange={(checked) => updatePendingSetting('runInBackground', checked)}
          disabled={isSaving}
        />
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
