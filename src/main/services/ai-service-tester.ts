/**
 * AI Service Tester - Tests connections to various AI services
 * Supports OpenAI, Anthropic, Ollama, and custom endpoints
 */

import { AIServiceConfig } from '../config-manager';

export interface TestConnectionResult {
  success: boolean;
  error?: string;
  latencyMs?: number;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
}

export interface GetModelsResult {
  success: boolean;
  models?: AIModel[];
  error?: string;
}

// Default endpoints for known services
const DEFAULT_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  ollama: 'http://localhost:11434',
};

/**
 * Test connection to an AI service
 */
export async function testConnection(service: AIServiceConfig): Promise<TestConnectionResult> {
  const startTime = Date.now();

  try {
    const endpoint = service.endpoint || DEFAULT_ENDPOINTS[service.type] || '';

    if (!endpoint) {
      return { success: false, error: 'No endpoint configured' };
    }

    switch (service.type) {
      case 'openai':
        return await testOpenAI(endpoint, service.apiKey);
      case 'anthropic':
        return await testAnthropic(endpoint, service.apiKey);
      case 'ollama':
        return await testOllama(endpoint);
      case 'custom':
        return await testCustomEndpoint(endpoint, service.apiKey);
      default:
        return { success: false, error: `Unknown service type: ${service.type}` };
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs,
    };
  }
}

/**
 * Get available models from an AI service
 */
export async function getModels(service: AIServiceConfig): Promise<GetModelsResult> {
  try {
    const endpoint = service.endpoint || DEFAULT_ENDPOINTS[service.type] || '';

    if (!endpoint) {
      return { success: false, error: 'No endpoint configured' };
    }

    switch (service.type) {
      case 'openai':
        return await getOpenAIModels(endpoint, service.apiKey);
      case 'anthropic':
        return await getAnthropicModels();
      case 'ollama':
        return await getOllamaModels(endpoint);
      case 'custom':
        return await getCustomModels(endpoint, service.apiKey);
      default:
        return { success: false, error: `Unknown service type: ${service.type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== OpenAI ====================

async function testOpenAI(endpoint: string, apiKey?: string): Promise<TestConnectionResult> {
  const startTime = Date.now();

  if (!apiKey) {
    return { success: false, error: 'API key required for OpenAI' };
  }

  try {
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return { success: true, latencyMs };
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMessage = (errorData as { error?: { message?: string } }).error?.message || `HTTP ${response.status}`;
    return { success: false, error: errorMessage, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect',
      latencyMs: Date.now() - startTime,
    };
  }
}

async function getOpenAIModels(endpoint: string, apiKey?: string): Promise<GetModelsResult> {
  if (!apiKey) {
    return { success: false, error: 'API key required for OpenAI' };
  }

  try {
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json() as { data: { id: string }[] };
    const models: AIModel[] = data.data
      .filter((model) => model.id.startsWith('gpt-'))
      .map((model) => ({
        id: model.id,
        name: model.id,
        provider: 'openai',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, models };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch models',
    };
  }
}

// ==================== Anthropic ====================

async function testAnthropic(endpoint: string, apiKey?: string): Promise<TestConnectionResult> {
  const startTime = Date.now();

  if (!apiKey) {
    return { success: false, error: 'API key required for Anthropic' };
  }

  try {
    // Anthropic doesn't have a simple /models endpoint, so we try a minimal message request
    const response = await fetch(`${endpoint}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    const latencyMs = Date.now() - startTime;

    // Any response means the API key is valid (even errors about model/quota)
    if (response.ok || response.status === 400) {
      return { success: true, latencyMs };
    }

    if (response.status === 401) {
      return { success: false, error: 'Invalid API key', latencyMs };
    }

    return { success: false, error: `HTTP ${response.status}`, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect',
      latencyMs: Date.now() - startTime,
    };
  }
}

async function getAnthropicModels(): Promise<GetModelsResult> {
  // Anthropic doesn't have a public models list API, return known models
  const models: AIModel[] = [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
  ];
  return { success: true, models };
}

// ==================== Ollama ====================

async function testOllama(endpoint: string): Promise<TestConnectionResult> {
  const startTime = Date.now();

  try {
    // Ollama has a simple /api/tags endpoint to list models
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return { success: true, latencyMs };
    }

    return { success: false, error: `HTTP ${response.status}`, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to Ollama',
      latencyMs: Date.now() - startTime,
    };
  }
}

async function getOllamaModels(endpoint: string): Promise<GetModelsResult> {
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json() as { models: { name: string }[] };
    const models: AIModel[] = (data.models || []).map((model) => ({
      id: model.name,
      name: model.name,
      provider: 'ollama',
    }));

    return { success: true, models };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch models',
    };
  }
}

// ==================== Custom ====================

async function testCustomEndpoint(endpoint: string, apiKey?: string): Promise<TestConnectionResult> {
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Try to access the models endpoint (common across OpenAI-compatible APIs)
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers,
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return { success: true, latencyMs };
    }

    // If models endpoint fails, try a simple health check
    const healthResponse = await fetch(endpoint, {
      method: 'GET',
      headers,
    });

    if (healthResponse.ok) {
      return { success: true, latencyMs };
    }

    return { success: false, error: `HTTP ${response.status}`, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect',
      latencyMs: Date.now() - startTime,
    };
  }
}

async function getCustomModels(endpoint: string, apiKey?: string): Promise<GetModelsResult> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json() as { data?: { id: string }[]; models?: { id?: string; name?: string }[] };

    // Handle OpenAI-compatible format
    if (data.data && Array.isArray(data.data)) {
      const models: AIModel[] = data.data.map((model) => ({
        id: model.id,
        name: model.id,
        provider: 'custom',
      }));
      return { success: true, models };
    }

    // Handle Ollama-like format
    if (data.models && Array.isArray(data.models)) {
      const models: AIModel[] = data.models.map((model) => ({
        id: model.id || model.name || '',
        name: model.name || model.id || '',
        provider: 'custom',
      }));
      return { success: true, models };
    }

    return { success: true, models: [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch models',
    };
  }
}
