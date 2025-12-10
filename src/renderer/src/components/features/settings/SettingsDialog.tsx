import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { Settings, Server, Cpu, FolderOpen, Sliders, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { ServerSettingsTab } from './ServerSettingsTab';
import { AIServicesSettingsTab } from './AIServicesSettingsTab';
import { StorageSettingsTab } from './StorageSettingsTab';
import { DoclingSettingsTab } from './DoclingSettingsTab';
import {
  $settings,
  $hasUnsavedChanges,
  loadSettings,
  saveSettings,
  discardChanges,
} from '@/stores/settings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'general' | 'server' | 'ai' | 'storage' | 'docling';
}

export function SettingsDialog({
  open,
  onOpenChange,
  defaultTab = 'general',
}: SettingsDialogProps) {
  useStore($settings); // Subscribe to settings changes
  const hasUnsavedChanges = useStore($hasUnsavedChanges);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings when dialog opens
  useEffect(() => {
    if (open) {
      loadSettings();
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges) {
      // Could show a confirmation dialog here
      discardChanges();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex-1">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="server" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">Server</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
            <TabsTrigger value="docling" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Docling</span>
            </TabsTrigger>
            <TabsTrigger value="storage" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Storage</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
            <TabsContent value="general" className="mt-0">
              <GeneralSettingsTab
                onSave={handleSave}
                isSaving={isSaving}
                hasChanges={hasUnsavedChanges}
              />
            </TabsContent>

            <TabsContent value="server" className="mt-0">
              <ServerSettingsTab
                onSave={handleSave}
                isSaving={isSaving}
                hasChanges={hasUnsavedChanges}
              />
            </TabsContent>

            <TabsContent value="ai" className="mt-0">
              <AIServicesSettingsTab
                onSave={handleSave}
                isSaving={isSaving}
                hasChanges={hasUnsavedChanges}
              />
            </TabsContent>

            <TabsContent value="docling" className="mt-0">
              <DoclingSettingsTab
                onSave={handleSave}
                isSaving={isSaving}
                hasChanges={hasUnsavedChanges}
              />
            </TabsContent>

            <TabsContent value="storage" className="mt-0">
              <StorageSettingsTab
                onSave={handleSave}
                isSaving={isSaving}
                hasChanges={hasUnsavedChanges}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
