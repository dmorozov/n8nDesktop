import { useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { Cpu, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export function AIServicesPage() {
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">AI Services</h1>
          <Badge variant="secondary">{aiServices.length}</Badge>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

      {/* Content */}
      {aiServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Cpu className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">No AI services configured</h2>
          <p className="mb-6 max-w-md text-center text-muted-foreground">
            Connect your AI services to enable AI-powered workflows. Configure OpenAI, Anthropic,
            Ollama, or other AI providers.
          </p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First AI Service
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Add Service Dialog */}
      <AddAIServiceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddService}
        isLoading={isLoading}
      />

      {/* Edit Service Dialog */}
      <EditAIServiceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        service={selectedService}
        onSave={handleSaveService}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
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
