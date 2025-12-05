import { atom } from 'nanostores';
import type { AIServiceConfig } from '../../../preload/types';

// Connection status for AI services
export interface AIServiceConnectionStatus {
  id: string;
  isConnected: boolean;
  isChecking: boolean;
  lastChecked?: string;
  error?: string;
  modelCount?: number;
}

// Store for AI service connection statuses
export const $aiServiceStatuses = atom<Record<string, AIServiceConnectionStatus>>({});

// Store for currently testing service
export const $testingServiceId = atom<string | null>(null);

// Computed: get connection status for a service
export function getServiceStatus(id: string): AIServiceConnectionStatus | undefined {
  return $aiServiceStatuses.get()[id];
}

// Update connection status for a service
export function setServiceStatus(id: string, status: Partial<AIServiceConnectionStatus>): void {
  const current = $aiServiceStatuses.get();
  $aiServiceStatuses.set({
    ...current,
    [id]: {
      ...current[id],
      id,
      ...status,
    },
  });
}

// Test connection to an AI service
export async function testAIServiceConnection(service: AIServiceConfig): Promise<boolean> {
  $testingServiceId.set(service.id);
  setServiceStatus(service.id, { isChecking: true, error: undefined });

  try {
    let isConnected = false;
    let modelCount = 0;

    switch (service.type) {
      case 'openai': {
        const response = await fetch(`${service.endpoint}/v1/models`, {
          headers: {
            'Authorization': `Bearer ${service.apiKey}`,
          },
        });
        isConnected = response.ok;
        if (isConnected) {
          const data = await response.json();
          modelCount = data.data?.length ?? 0;
        }
        break;
      }

      case 'anthropic': {
        // Anthropic doesn't have a models endpoint, so we just check if the API is reachable
        const response = await fetch(`${service.endpoint}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': service.apiKey ?? '',
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        // 400 means API is reachable but request was invalid (which is fine for connection test)
        isConnected = response.ok || response.status === 400;
        modelCount = isConnected ? 3 : 0; // Anthropic has 3 main models
        break;
      }

      case 'ollama': {
        const response = await fetch(`${service.endpoint}/api/tags`);
        isConnected = response.ok;
        if (isConnected) {
          const data = await response.json();
          modelCount = data.models?.length ?? 0;
        }
        break;
      }

      case 'custom': {
        // For custom endpoints, just check if reachable
        const response = await fetch(service.endpoint, { method: 'HEAD' });
        isConnected = response.ok;
        break;
      }
    }

    setServiceStatus(service.id, {
      isConnected,
      isChecking: false,
      lastChecked: new Date().toISOString(),
      modelCount,
      error: undefined,
    });

    return isConnected;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    setServiceStatus(service.id, {
      isConnected: false,
      isChecking: false,
      lastChecked: new Date().toISOString(),
      error: errorMessage,
    });
    return false;
  } finally {
    $testingServiceId.set(null);
  }
}

// Test all enabled AI services
export async function testAllAIServices(services: AIServiceConfig[]): Promise<void> {
  const enabledServices = services.filter(s => s.isEnabled);
  await Promise.all(enabledServices.map(testAIServiceConnection));
}

// Get display text for connection status
export function getConnectionStatusText(status: AIServiceConnectionStatus | undefined): string {
  if (!status) return 'Not checked';
  if (status.isChecking) return 'Checking...';
  if (status.error) return `Error: ${status.error}`;
  if (!status.isConnected) return 'Disconnected';
  if (status.modelCount === 0) return 'Connected (No models)';
  return `Connected (${status.modelCount} models)`;
}

// Get status color class
export function getConnectionStatusColor(status: AIServiceConnectionStatus | undefined): string {
  if (!status || status.isChecking) return 'text-muted-foreground';
  if (status.error || !status.isConnected) return 'text-destructive';
  if (status.modelCount === 0) return 'text-yellow-500';
  return 'text-green-500';
}
