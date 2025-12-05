import { useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { Plus, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AIServiceCard,
  AddAIServiceDialog,
  EditAIServiceDialog,
  DeleteAIServiceDialog,
} from '@/components/features/ai-services';
import {
  $aiServices,
  addAIService,
  updateAIService,
  deleteAIService,
  toggleAIService,
} from '@/stores/settings';
import type { AIServiceConfig } from '@/preload/types';

interface AIServicesSettingsTabProps {
  onSave: () => Promise<void>;
  isSaving: boolean;
  hasChanges: boolean;
}

export function AIServicesSettingsTab({
  onSave,
  isSaving,
  hasChanges,
}: AIServicesSettingsTabProps) {
  const aiServices = useStore($aiServices);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<AIServiceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddService = useCallback(async (
    service: Omit<AIServiceConfig, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    setIsLoading(true);
    try {
      await addAIService(service);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleConfigureService = useCallback((id: string) => {
    const service = aiServices.find((s) => s.id === id);
    if (service) {
      setSelectedService(service);
      setEditDialogOpen(true);
    }
  }, [aiServices]);

  const handleSaveService = useCallback(async (
    id: string,
    updates: Partial<Omit<AIServiceConfig, 'id' | 'createdAt'>>
  ) => {
    setIsLoading(true);
    try {
      await updateAIService(id, updates);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteClick = useCallback((id: string) => {
    const service = aiServices.find((s) => s.id === id);
    if (service) {
      setSelectedService(service);
      setDeleteDialogOpen(true);
    }
  }, [aiServices]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedService) return;

    setIsLoading(true);
    try {
      await deleteAIService(selectedService.id);
      setDeleteDialogOpen(false);
      setSelectedService(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedService]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setSelectedService(null);
  }, []);

  const handleToggleService = useCallback(async (id: string) => {
    await toggleAIService(id);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">AI Services</h3>
          <p className="text-sm text-muted-foreground">
            Configure AI service providers for your workflows.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

      <Separator />

      {/* Services List */}
      {aiServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Cpu className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            No AI services configured yet.
          </p>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Service
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {aiServices.map((service) => (
            <AIServiceCard
              key={service.id}
              service={service}
              onConfigure={handleConfigureService}
              onDelete={handleDeleteClick}
              onToggle={handleToggleService}
            />
          ))}
        </div>
      )}

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!hasChanges || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Dialogs */}
      <AddAIServiceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddService}
        isLoading={isLoading}
      />

      <EditAIServiceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        service={selectedService}
        onSave={handleSaveService}
        isLoading={isLoading}
      />

      <DeleteAIServiceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        serviceName={selectedService?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={isLoading}
      />
    </div>
  );
}
