import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ConfigManager, AIServiceConfig } from '../config-manager';
import { N8nAuthManager } from './n8n-auth-manager';

/**
 * Maps our AI service types to n8n credential types
 */
const SERVICE_TYPE_TO_N8N_CREDENTIAL: Record<AIServiceConfig['type'], string> = {
  openai: 'openAiApi',
  anthropic: 'anthropicApi',
  ollama: 'ollamaApi',
  custom: 'httpHeaderAuth', // Generic HTTP header auth for custom services
};

interface N8nCredential {
  id?: string;
  name: string;
  type: string;
  data: Record<string, unknown>;
}

interface N8nCredentialResponse {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service to sync AI services from the desktop app to n8n credentials
 */
export class N8nCredentialSync {
  private configManager: ConfigManager;
  private authManager: N8nAuthManager;
  private axiosInstance: AxiosInstance;
  private syncedCredentials: Map<string, string> = new Map(); // aiServiceId -> n8nCredentialId

  constructor(configManager: ConfigManager, authManager: N8nAuthManager) {
    this.configManager = configManager;
    this.authManager = authManager;
    this.axiosInstance = axios.create({
      timeout: 30000,
      validateStatus: () => true,
    });
  }

  /**
   * Get the base URL for n8n REST API
   */
  private getBaseUrl(): string {
    const port = this.configManager.get('n8nPort') ?? 5678;
    return `http://localhost:${port}/rest`;
  }

  /**
   * Get axios config with authentication
   */
  private getAuthConfig(): AxiosRequestConfig {
    const headers = this.authManager.getAuthHeaders();
    return { headers };
  }

  /**
   * Convert an AI service to n8n credential format
   */
  private serviceToCredential(service: AIServiceConfig): N8nCredential {
    const credentialType = SERVICE_TYPE_TO_N8N_CREDENTIAL[service.type];

    // Build credential data based on service type
    let data: Record<string, unknown> = {};

    switch (service.type) {
      case 'openai':
        data = {
          apiKey: service.apiKey || '',
          // Use custom base URL if not the default OpenAI endpoint
          ...(service.endpoint !== 'https://api.openai.com/v1' && {
            url: service.endpoint,
          }),
        };
        break;

      case 'anthropic':
        data = {
          apiKey: service.apiKey || '',
          // Anthropic doesn't use custom endpoints in the same way
        };
        break;

      case 'ollama':
        data = {
          baseUrl: service.endpoint || 'http://localhost:11434',
        };
        break;

      case 'custom':
        // For custom services, use HTTP header auth with API key
        data = {
          name: 'Authorization',
          value: `Bearer ${service.apiKey || ''}`,
        };
        break;
    }

    return {
      name: `[Desktop] ${service.name}`,
      type: credentialType,
      data,
    };
  }

  /**
   * Get all existing credentials from n8n
   */
  async getExistingCredentials(): Promise<N8nCredentialResponse[]> {
    try {
      const response = await this.axiosInstance.get(
        `${this.getBaseUrl()}/credentials`,
        this.getAuthConfig()
      );

      if (response.status === 200) {
        return response.data?.data || response.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching n8n credentials:', error);
      return [];
    }
  }

  /**
   * Find an existing credential by name prefix
   */
  async findCredentialByName(name: string): Promise<N8nCredentialResponse | null> {
    const credentials = await this.getExistingCredentials();
    return credentials.find(c => c.name === name) || null;
  }

  /**
   * Create a credential in n8n
   */
  async createCredential(credential: N8nCredential): Promise<string | null> {
    try {
      console.log('Creating n8n credential:', credential.name, 'type:', credential.type);

      const response = await this.axiosInstance.post(
        `${this.getBaseUrl()}/credentials`,
        credential,
        this.getAuthConfig()
      );

      if (response.status === 200 || response.status === 201) {
        const created = response.data?.data || response.data;
        console.log('Credential created successfully:', created?.id);
        return created?.id || null;
      } else {
        console.error('Failed to create credential:', response.status, response.data);
        return null;
      }
    } catch (error) {
      console.error('Error creating n8n credential:', error);
      return null;
    }
  }

  /**
   * Update a credential in n8n
   */
  async updateCredential(id: string, credential: N8nCredential): Promise<boolean> {
    try {
      console.log('Updating n8n credential:', id, credential.name);

      const response = await this.axiosInstance.patch(
        `${this.getBaseUrl()}/credentials/${id}`,
        credential,
        this.getAuthConfig()
      );

      if (response.status === 200) {
        console.log('Credential updated successfully');
        return true;
      } else {
        console.error('Failed to update credential:', response.status, response.data);
        return false;
      }
    } catch (error) {
      console.error('Error updating n8n credential:', error);
      return false;
    }
  }

  /**
   * Delete a credential from n8n
   */
  async deleteCredential(id: string): Promise<boolean> {
    try {
      console.log('Deleting n8n credential:', id);

      const response = await this.axiosInstance.delete(
        `${this.getBaseUrl()}/credentials/${id}`,
        this.getAuthConfig()
      );

      if (response.status === 200 || response.status === 204) {
        console.log('Credential deleted successfully');
        return true;
      } else {
        console.error('Failed to delete credential:', response.status, response.data);
        return false;
      }
    } catch (error) {
      console.error('Error deleting n8n credential:', error);
      return false;
    }
  }

  /**
   * Sync a single AI service to n8n
   */
  async syncService(service: AIServiceConfig): Promise<boolean> {
    if (!service.isEnabled) {
      console.log('Service is disabled, skipping sync:', service.name);
      // If service is disabled, try to delete the credential
      const existingName = `[Desktop] ${service.name}`;
      const existing = await this.findCredentialByName(existingName);
      if (existing) {
        await this.deleteCredential(existing.id);
        this.syncedCredentials.delete(service.id);
      }
      return true;
    }

    const credential = this.serviceToCredential(service);

    // Check if credential already exists
    const existing = await this.findCredentialByName(credential.name);

    if (existing) {
      // Update existing credential
      const success = await this.updateCredential(existing.id, credential);
      if (success) {
        this.syncedCredentials.set(service.id, existing.id);
      }
      return success;
    } else {
      // Create new credential
      const credentialId = await this.createCredential(credential);
      if (credentialId) {
        this.syncedCredentials.set(service.id, credentialId);
        return true;
      }
      return false;
    }
  }

  /**
   * Sync all AI services to n8n
   */
  async syncAllServices(): Promise<{ success: number; failed: number }> {
    console.log('Starting full AI services sync to n8n credentials...');

    const services = this.configManager.getAIServices();
    let success = 0;
    let failed = 0;

    for (const service of services) {
      const result = await this.syncService(service);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    // Clean up credentials for services that no longer exist
    await this.cleanupOrphanedCredentials(services);

    console.log(`AI services sync complete: ${success} succeeded, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Remove credentials for AI services that no longer exist
   */
  private async cleanupOrphanedCredentials(currentServices: AIServiceConfig[]): Promise<void> {
    const credentials = await this.getExistingCredentials();
    const desktopCredentials = credentials.filter(c => c.name.startsWith('[Desktop] '));

    const currentNames = new Set(currentServices.map(s => `[Desktop] ${s.name}`));

    for (const credential of desktopCredentials) {
      if (!currentNames.has(credential.name)) {
        console.log('Cleaning up orphaned credential:', credential.name);
        await this.deleteCredential(credential.id);
      }
    }
  }

  /**
   * Handle AI service added event
   */
  async onServiceAdded(service: AIServiceConfig): Promise<void> {
    console.log('AI service added, syncing to n8n:', service.name);
    await this.syncService(service);
  }

  /**
   * Handle AI service updated event
   */
  async onServiceUpdated(service: AIServiceConfig): Promise<void> {
    console.log('AI service updated, syncing to n8n:', service.name);
    await this.syncService(service);
  }

  /**
   * Handle AI service deleted event
   */
  async onServiceDeleted(serviceId: string, serviceName: string): Promise<void> {
    console.log('AI service deleted, removing from n8n:', serviceName);

    // Find and delete the credential
    const credentialName = `[Desktop] ${serviceName}`;
    const existing = await this.findCredentialByName(credentialName);

    if (existing) {
      await this.deleteCredential(existing.id);
    }

    this.syncedCredentials.delete(serviceId);
  }
}
