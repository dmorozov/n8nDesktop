import { useState } from 'react';
import { Cpu, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { AIServiceConfig } from '@/preload/types';

type AIServiceType = AIServiceConfig['type'];

interface AddAIServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (service: Omit<AIServiceConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  isLoading?: boolean;
}

const serviceTypeDefaults: Record<AIServiceType, { endpoint: string; requiresApiKey: boolean }> = {
  openai: { endpoint: 'https://api.openai.com/v1', requiresApiKey: true },
  anthropic: { endpoint: 'https://api.anthropic.com', requiresApiKey: true },
  ollama: { endpoint: 'http://localhost:11434', requiresApiKey: false },
  custom: { endpoint: '', requiresApiKey: false },
};

export function AddAIServiceDialog({
  open,
  onOpenChange,
  onAdd,
  isLoading = false,
}: AddAIServiceDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AIServiceType>('openai');
  const [endpoint, setEndpoint] = useState(serviceTypeDefaults.openai.endpoint);
  const [apiKey, setApiKey] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresApiKey = serviceTypeDefaults[type].requiresApiKey;

  const handleTypeChange = (value: string) => {
    const newType = value as AIServiceType;
    setType(newType);
    setEndpoint(serviceTypeDefaults[newType].endpoint);
    if (!serviceTypeDefaults[newType].requiresApiKey) {
      setApiKey('');
    }
  };

  const resetForm = () => {
    setName('');
    setType('openai');
    setEndpoint(serviceTypeDefaults.openai.endpoint);
    setApiKey('');
    setIsEnabled(true);
    setShowApiKey(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!endpoint.trim()) {
      setError('Endpoint URL is required');
      return;
    }

    if (requiresApiKey && !apiKey.trim()) {
      setError('API key is required for this service type');
      return;
    }

    try {
      await onAdd({
        name: name.trim(),
        type,
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim() || undefined,
        isEnabled,
      });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add service');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            Add AI Service
          </DialogTitle>
          <DialogDescription>
            Configure a new AI service provider for your workflows.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Service Name</Label>
            <Input
              id="name"
              placeholder="My OpenAI Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Service Type</Label>
            <Select value={type} onValueChange={handleTypeChange} disabled={isLoading}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-2">
            <Label htmlFor="endpoint">API Endpoint</Label>
            <Input
              id="endpoint"
              placeholder="https://api.example.com/v1"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {type === 'ollama'
                ? 'Default Ollama endpoint is http://localhost:11434'
                : 'The base URL for the API'}
            </p>
          </div>

          {/* API Key */}
          {requiresApiKey && (
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                  disabled={isLoading}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enable Service</Label>
            <Switch
              id="enabled"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              disabled={isLoading}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
