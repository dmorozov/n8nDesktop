/**
 * Popup Config Store
 *
 * Manages popup configuration persistence for workflows using electron-store.
 * Each workflow has a separate configuration keyed by workflow ID.
 *
 * Feature: 010-workflow-execution-popup
 */

import Store from 'electron-store';
import type {
  WorkflowPopupConfig,
  ExecutionResult,
} from '../../shared/types/workflow-popup';

/** Store schema type */
interface PopupConfigStoreSchema {
  popupConfigs: Record<string, WorkflowPopupConfig>;
}

/** Singleton store instance */
const store = new Store<PopupConfigStoreSchema>({
  name: 'popup-configs',
  defaults: {
    popupConfigs: {},
  },
});

/**
 * Get popup configuration for a workflow
 * @param workflowId - The n8n workflow ID
 * @returns Stored configuration or null if not found
 */
export function getPopupConfig(workflowId: string): WorkflowPopupConfig | null {
  try {
    const configs = store.get('popupConfigs');
    return configs[workflowId] || null;
  } catch (error) {
    console.error('[PopupConfigStore] Error getting config:', error);
    return null;
  }
}

/**
 * Save popup configuration for a workflow
 * @param config - Configuration to save
 */
export function setPopupConfig(config: WorkflowPopupConfig): void {
  try {
    const configs = store.get('popupConfigs');
    configs[config.workflowId] = {
      ...config,
      lastUpdated: new Date().toISOString(),
    };
    store.set('popupConfigs', configs);
    console.log(`[PopupConfigStore] Saved config for workflow ${config.workflowId}`);
  } catch (error) {
    console.error('[PopupConfigStore] Error saving config:', error);
    throw error;
  }
}

/**
 * Delete popup configuration for a workflow
 * @param workflowId - The n8n workflow ID
 * @returns true if deleted, false if not found
 */
export function deletePopupConfig(workflowId: string): boolean {
  try {
    const configs = store.get('popupConfigs');
    if (configs[workflowId]) {
      delete configs[workflowId];
      store.set('popupConfigs', configs);
      console.log(`[PopupConfigStore] Deleted config for workflow ${workflowId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[PopupConfigStore] Error deleting config:', error);
    return false;
  }
}

/**
 * Update last execution result for a workflow
 * @param workflowId - The n8n workflow ID
 * @param executionResult - The execution result to store
 */
export function updateLastExecution(
  workflowId: string,
  executionResult: ExecutionResult
): void {
  try {
    const config = getPopupConfig(workflowId);
    if (config) {
      setPopupConfig({
        ...config,
        lastExecution: executionResult,
      });
    }
  } catch (error) {
    console.error('[PopupConfigStore] Error updating last execution:', error);
  }
}

/**
 * Clear last execution result for a workflow (FR-020)
 * @param workflowId - The n8n workflow ID
 */
export function clearLastExecution(workflowId: string): void {
  try {
    const config = getPopupConfig(workflowId);
    if (config) {
      setPopupConfig({
        ...config,
        lastExecution: null,
      });
    }
  } catch (error) {
    console.error('[PopupConfigStore] Error clearing last execution:', error);
  }
}

/**
 * Get all popup configurations
 * @returns All stored configurations
 */
export function getAllPopupConfigs(): Record<string, WorkflowPopupConfig> {
  try {
    return store.get('popupConfigs');
  } catch (error) {
    console.error('[PopupConfigStore] Error getting all configs:', error);
    return {};
  }
}

/**
 * Reset the store to defaults (useful for testing or recovery from corruption - FR-028)
 */
export function resetPopupConfigStore(): void {
  try {
    store.clear();
    console.log('[PopupConfigStore] Store reset to defaults');
  } catch (error) {
    console.error('[PopupConfigStore] Error resetting store:', error);
  }
}
