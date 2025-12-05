import { useState, useEffect, useCallback } from 'react';
import { Cpu, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { notifyError, notifySuccess } from '@/stores/notifications';
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
import type { AIServiceConfig, AIModel } from '@/preload/types';

type AIServiceType = AIServiceConfig['type'];

interface EditAIServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: AIServiceConfig | null;
  onSave: (id: string, updates: Partial<Omit<AIServiceConfig, 'id' | 'createdAt'>>) => Promise<void>;
  isLoading?: boolean;
}

const serviceTypeDefaults: Record<AIServiceType, { requiresApiKey: boolean }> = {
  openai: { requiresApiKey: true },
  anthropic: { requiresApiKey: true },
  ollama: { requiresApiKey: false },
  custom: { requiresApiKey: false },
};

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function EditAIServiceDialog({
  open,
  onOpenChange,
  service,
  onSave,
  isLoading = false,
}: EditAIServiceDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AIServiceType>('openai');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connection test state
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  // Models state
  const [models, setModels] = useState<AIModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const requiresApiKey = serviceTypeDefaults[type].requiresApiKey;

  // Initialize form when service changes
  useEffect(() => {
    if (service) {
      setName(service.name);
      setType(service.type);
      setEndpoint(service.endpoint);
      setApiKey(service.apiKey || '');
      setIsEnabled(service.isEnabled);
      setShowApiKey(false);
      setError(null);
      setTestStatus('idle');
      setTestError(null);
      setTestLatency(null);
      setModels([]);
    }
  }, [service]);

  // Test connection handler
  const handleTestConnection = useCallback(async () => {
    if (!service) return;

    setTestStatus('testing');
    setTestError(null);
    setTestLatency(null);

    try {
      const result = await window.electron.ai.testConnection(service.id);

      if (result.success) {
        setTestStatus('success');
        setTestLatency(result.latencyMs || null);
        notifySuccess('Connection Successful', `Connected to ${service.name} in ${result.latencyMs || 0}ms`);

        // Auto-load models on successful connection
        setLoadingModels(true);
        const modelsResult = await window.electron.ai.getModels(service.id);
        if (modelsResult.success && modelsResult.models) {
          setModels(modelsResult.models);
        }
        setLoadingModels(false);
      } else {
        setTestStatus('error');
        const errorMsg = result.error || 'Connection failed';
        setTestError(errorMsg);

        // Show toast for network-related errors
        const isNetworkError = errorMsg.toLowerCase().includes('network') ||
          errorMsg.toLowerCase().includes('timeout') ||
          errorMsg.toLowerCase().includes('econnrefused') ||
          errorMsg.toLowerCase().includes('unreachable') ||
          errorMsg.toLowerCase().includes('dns');

        if (isNetworkError) {
          notifyError('Network Error', `Could not reach ${service.name}. Check your connection and endpoint URL.`);
        } else {
          notifyError('Connection Failed', errorMsg);
        }
      }
    } catch (err) {
      setTestStatus('error');
      const errorMsg = err instanceof Error ? err.message : 'Test failed';
      setTestError(errorMsg);
      notifyError('Connection Error', errorMsg);
    }
  }, [service]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!service) return;

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
      await onSave(service.id, {
        name: name.trim(),
        type,
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim() || undefined,
        isEnabled,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
    }
  };

  const getTestStatusIcon = () => {
    switch (testStatus) {
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            Edit AI Service
          </DialogTitle>
          <DialogDescription>
            Update the configuration for this AI service.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Service Name</Label>
            <Input
              id="edit-name"
              placeholder="My OpenAI Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="edit-type">Service Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AIServiceType)} disabled={isLoading}>
              <SelectTrigger id="edit-type">
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
            <Label htmlFor="edit-endpoint">API Endpoint</Label>
            <Input
              id="edit-endpoint"
              placeholder="https://api.example.com/v1"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* API Key */}
          {requiresApiKey && (
            <div className="space-y-2">
              <Label htmlFor="edit-apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="edit-apiKey"
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
              <p className="text-xs text-muted-foreground">
                Leave empty to keep the existing API key
              </p>
            </div>
          )}

          {/* Connection Test */}
          <div className="space-y-2">
            <Label>Connection Test</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isLoading || testStatus === 'testing'}
              >
                {testStatus === 'testing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              {getTestStatusIcon()}
              {testStatus === 'success' && testLatency && (
                <span className="text-sm text-muted-foreground">
                  {testLatency}ms
                </span>
              )}
            </div>
            {testStatus === 'error' && testError && (
              <p className="text-sm text-destructive">{testError}</p>
            )}
          </div>

          {/* Available Models */}
          {models.length > 0 && (
            <div className="space-y-2">
              <Label>Available Models</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                {loadingModels ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading models...</span>
                  </div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {models.map((model) => (
                      <li key={model.id} className="truncate text-muted-foreground">
                        {model.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {models.length} model{models.length !== 1 ? 's' : ''} available
              </p>
            </div>
          )}

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-enabled">Enable Service</Label>
            <Switch
              id="edit-enabled"
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
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
