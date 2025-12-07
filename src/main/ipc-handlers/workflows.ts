import { IpcMain } from 'electron';
import axios, { AxiosRequestConfig } from 'axios';
import { ConfigManager } from '../config-manager';
import { N8nAuthManager } from '../services/n8n-auth-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  nodes: unknown[];
  connections: unknown;
  settings?: Record<string, unknown>;
  staticData?: unknown;
  tags?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowListResult {
  success: boolean;
  data?: WorkflowData[];
  error?: string;
}

export interface WorkflowResult {
  success: boolean;
  data?: WorkflowData;
  error?: string;
}

// Track recently opened workflows (in-memory for now)
const recentWorkflows: { id: string; openedAt: string }[] = [];
const MAX_RECENT = 10;

export function registerWorkflowHandlers(
  ipcMain: IpcMain,
  configManager: ConfigManager,
  getN8nPort: () => number,
  authManager: N8nAuthManager
): void {
  // Use internal REST API (/rest/) instead of public API (/api/v1/)
  // The internal API works with session cookies, while public API requires API keys
  const getBaseUrl = () => `http://localhost:${getN8nPort()}/rest`;

  // Helper to get request config with authentication headers
  const getAuthConfig = (): AxiosRequestConfig => {
    const headers = authManager.getAuthHeaders();
    console.log('Auth headers for API request:', JSON.stringify(headers));
    return {
      headers,
      withCredentials: true,
    };
  };

  /**
   * List all workflows
   */
  ipcMain.handle('workflows:list', async (): Promise<WorkflowListResult> => {
    try {
      const response = await axios.get(`${getBaseUrl()}/workflows`, getAuthConfig());
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch workflows';
      console.error('Error fetching workflows:', message);
      return { success: false, error: message };
    }
  });

  /**
   * Get a single workflow by ID
   */
  ipcMain.handle('workflows:get', async (_event, id: string): Promise<WorkflowResult> => {
    try {
      const response = await axios.get(`${getBaseUrl()}/workflows/${id}`, getAuthConfig());
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch workflow';
      console.error('Error fetching workflow:', message);
      return { success: false, error: message };
    }
  });

  /**
   * Get recently opened workflows
   */
  ipcMain.handle('workflows:getRecent', async (): Promise<WorkflowListResult> => {
    try {
      if (recentWorkflows.length === 0) {
        return { success: true, data: [] };
      }

      // Fetch all workflows and filter by recent IDs
      const response = await axios.get(`${getBaseUrl()}/workflows`, getAuthConfig());
      const allWorkflows: WorkflowData[] = response.data.data || response.data;

      const recentIds = recentWorkflows.map((r) => r.id);
      const recentData = allWorkflows
        .filter((w) => recentIds.includes(w.id))
        .sort((a, b) => {
          const aIndex = recentIds.indexOf(a.id);
          const bIndex = recentIds.indexOf(b.id);
          return aIndex - bIndex;
        });

      return { success: true, data: recentData };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch recent workflows';
      console.error('Error fetching recent workflows:', message);
      return { success: false, error: message };
    }
  });

  /**
   * Add a workflow to recent list
   */
  ipcMain.handle('workflows:addRecent', async (_event, id: string): Promise<{ success: boolean }> => {
    // Remove if already exists
    const existingIndex = recentWorkflows.findIndex((r) => r.id === id);
    if (existingIndex !== -1) {
      recentWorkflows.splice(existingIndex, 1);
    }

    // Add to front
    recentWorkflows.unshift({ id, openedAt: new Date().toISOString() });

    // Trim to max size
    if (recentWorkflows.length > MAX_RECENT) {
      recentWorkflows.splice(MAX_RECENT);
    }

    return { success: true };
  });

  /**
   * Create a new workflow
   */
  ipcMain.handle(
    'workflows:create',
    async (_event, workflow: Partial<WorkflowData>): Promise<WorkflowResult> => {
      try {
        const response = await axios.post(
          `${getBaseUrl()}/workflows`,
          {
            name: workflow.name || 'New Workflow',
            nodes: workflow.nodes || [],
            connections: workflow.connections || {},
            settings: workflow.settings || {},
            active: false,
          },
          getAuthConfig()
        );
        return {
          success: true,
          data: response.data,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create workflow';
        console.error('Error creating workflow:', message);
        return { success: false, error: message };
      }
    }
  );

  /**
   * Update a workflow
   */
  ipcMain.handle(
    'workflows:update',
    async (_event, id: string, updates: Partial<WorkflowData>): Promise<WorkflowResult> => {
      try {
        const response = await axios.patch(`${getBaseUrl()}/workflows/${id}`, updates, getAuthConfig());
        return {
          success: true,
          data: response.data,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update workflow';
        console.error('Error updating workflow:', message);
        return { success: false, error: message };
      }
    }
  );

  /**
   * Delete a workflow
   * Note: n8n requires workflows to be deactivated and archived before deletion
   */
  ipcMain.handle('workflows:delete', async (_event, id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const baseUrl = getBaseUrl();
      const config = getAuthConfig();

      // First, get the workflow to check if it's active
      console.log('Fetching workflow before delete:', id);
      const getResponse = await axios.get(`${baseUrl}/workflows/${id}`, config);
      const workflow = getResponse.data;

      // If workflow is active, deactivate it first
      if (workflow.active) {
        console.log('Deactivating workflow before delete:', id);
        await axios.patch(`${baseUrl}/workflows/${id}`, { active: false }, config);
      }

      // Archive the workflow first (n8n requires this before deletion)
      console.log('Archiving workflow before delete:', id);
      try {
        await axios.post(`${baseUrl}/workflows/${id}/archive`, {}, config);
      } catch (archiveError) {
        // If archive endpoint doesn't exist (older n8n version), try direct delete
        if (axios.isAxiosError(archiveError) && archiveError.response?.status === 404) {
          console.log('Archive endpoint not found, trying direct delete');
        } else {
          throw archiveError;
        }
      }

      // Now delete the workflow
      console.log('Deleting workflow:', id);
      await axios.delete(`${baseUrl}/workflows/${id}`, config);
      return { success: true };
    } catch (error) {
      let message = 'Failed to delete workflow';
      if (axios.isAxiosError(error)) {
        console.error('Delete workflow error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        });
        message = error.response?.data?.message || error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      console.error('Error deleting workflow:', message);
      return { success: false, error: message };
    }
  });

  /**
   * Duplicate a workflow
   */
  ipcMain.handle('workflows:duplicate', async (_event, id: string): Promise<WorkflowResult> => {
    try {
      // Fetch original workflow
      const getResponse = await axios.get(`${getBaseUrl()}/workflows/${id}`, getAuthConfig());
      const original: WorkflowData = getResponse.data;

      // Create copy with timestamp suffix
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const newWorkflow = {
        name: `${original.name} (Copy ${timestamp})`,
        nodes: original.nodes,
        connections: original.connections,
        settings: original.settings,
        active: false,
      };

      const createResponse = await axios.post(`${getBaseUrl()}/workflows`, newWorkflow, getAuthConfig());
      return {
        success: true,
        data: createResponse.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate workflow';
      console.error('Error duplicating workflow:', message);
      return { success: false, error: message };
    }
  });

  /**
   * Execute a workflow
   */
  ipcMain.handle('workflows:execute', async (_event, id: string): Promise<{ success: boolean; executionId?: string; error?: string }> => {
    try {
      const response = await axios.post(`${getBaseUrl()}/workflows/${id}/run`, {}, getAuthConfig());
      return {
        success: true,
        executionId: response.data.executionId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute workflow';
      console.error('Error executing workflow:', message);
      return { success: false, error: message };
    }
  });

  /**
   * Stop a workflow execution
   */
  ipcMain.handle('workflows:stopExecution', async (_event, executionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await axios.post(`${getBaseUrl()}/executions/${executionId}/stop`, {}, getAuthConfig());
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop execution';
      console.error('Error stopping execution:', message);
      return { success: false, error: message };
    }
  });

  /**
   * Get workflow templates
   */
  ipcMain.handle('workflows:getTemplates', async (): Promise<WorkflowTemplate[]> => {
    try {
      const templatesDir = path.join(__dirname, '../../templates');
      const templateFiles = await fs.readdir(templatesDir);
      const templates: WorkflowTemplate[] = [];

      for (const file of templateFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(templatesDir, file), 'utf-8');
          const template = JSON.parse(content);
          templates.push(template);
        }
      }

      return templates;
    } catch (error) {
      console.error('Error loading templates:', error);
      // Return built-in templates if file loading fails
      return getBuiltInTemplates();
    }
  });
}

// Built-in templates (fallback if template files not found)
function getBuiltInTemplates(): WorkflowTemplate[] {
  return [
    {
      id: 'ai-chat',
      name: 'AI Chat Assistant',
      description: 'Build a chatbot with OpenAI or Anthropic',
      icon: 'bot',
      workflow: {
        name: 'AI Chat Assistant',
        nodes: [
          {
            id: 'trigger',
            name: 'Manual Trigger',
            type: 'n8n-nodes-base.manualTrigger',
            position: [250, 300],
            parameters: {},
          },
        ],
        connections: {},
        settings: {},
      },
    },
    {
      id: 'automation',
      name: 'General Automation',
      description: 'Connect apps and automate tasks',
      icon: 'cog',
      workflow: {
        name: 'General Automation',
        nodes: [
          {
            id: 'trigger',
            name: 'Schedule Trigger',
            type: 'n8n-nodes-base.scheduleTrigger',
            position: [250, 300],
            parameters: {
              rule: {
                interval: [{ field: 'hours', hoursInterval: 1 }],
              },
            },
          },
        ],
        connections: {},
        settings: {},
      },
    },
    {
      id: 'pdf-processing',
      name: 'PDF Processing',
      description: 'Extract and transform document data',
      icon: 'file',
      workflow: {
        name: 'PDF Processing',
        nodes: [
          {
            id: 'trigger',
            name: 'Manual Trigger',
            type: 'n8n-nodes-base.manualTrigger',
            position: [250, 300],
            parameters: {},
          },
        ],
        connections: {},
        settings: {},
      },
    },
  ];
}

// Template type definition
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: 'bot' | 'cog' | 'file';
  workflow: Partial<WorkflowData>;
}
