/**
 * useWorkflowExecution Hook
 *
 * Custom hook for managing workflow execution from the popup.
 * Handles loading, execution, polling, and result management.
 *
 * Feature: 010-workflow-execution-popup
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $executionState,
  $popupConfig,
  $inputValues,
  $executionResults,
  $executionError,
  $isExecuting,
  $canExecute,
  $isPopupLoading,
  setCurrentWorkflow,
  setPopupConfig,
  updateInputValue,
  startExecution,
  updateExecutionProgress,
  completeExecution,
  failExecution,
  resetExecutionState,
  setPopupLoading,
  clearExecutionResults,
} from '@/stores/workflow-execution';
import type {
  WorkflowPopupAnalysisResult,
  WorkflowPopupConfig,
  WorkflowPopupInputFieldConfig,
  WorkflowPopupFileReference,
} from '../../../preload/types';

/** Polling interval in milliseconds */
const POLL_INTERVAL = 1000;

/** Default timeout (5 minutes) */
const DEFAULT_TIMEOUT = 300000;

export interface UseWorkflowExecutionReturn {
  // State
  isLoading: boolean;
  isExecuting: boolean;
  canExecute: boolean;
  analysis: WorkflowPopupAnalysisResult | null;
  config: WorkflowPopupConfig | null;
  inputs: Record<string, WorkflowPopupInputFieldConfig>;
  results: typeof $executionResults extends { get(): infer T } ? T : never;
  error: string | null;
  executionProgress: number;

  // Actions
  loadWorkflow: (workflowId: string) => Promise<void>;
  updateInput: (nodeId: string, value: string | WorkflowPopupFileReference[]) => void;
  execute: () => Promise<void>;
  cancel: () => Promise<void>;
  saveConfig: () => Promise<void>;
  selectFiles: (nodeId: string) => Promise<void>;
  cleanup: () => void;
}

export function useWorkflowExecution(workflowId: string | null): UseWorkflowExecutionReturn {
  const isLoading = useStore($isPopupLoading);
  const isExecuting = useStore($isExecuting);
  const canExecute = useStore($canExecute);
  const config = useStore($popupConfig);
  const inputs = useStore($inputValues);
  const results = useStore($executionResults);
  const error = useStore($executionError);
  const executionState = useStore($executionState);

  const [analysis, setAnalysis] = useState<WorkflowPopupAnalysisResult | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const executionIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load workflow analysis and configuration
   */
  const loadWorkflow = useCallback(async (id: string) => {
    setPopupLoading(true);
    setAnalysis(null);

    try {
      // Analyze workflow to detect custom nodes
      const analysisResult = await window.electron.workflowPopup.analyze(id);
      setAnalysis(analysisResult);

      if (analysisResult.error) {
        failExecution(analysisResult.error);
        return;
      }

      // Load existing config or create new one
      let existingConfig = await window.electron.workflowPopup.getConfig(id);

      if (!existingConfig) {
        // Create default config from analysis
        const defaultInputs: Record<string, WorkflowPopupInputFieldConfig> = {};

        // Add prompt inputs
        for (const node of analysisResult.promptInputNodes) {
          defaultInputs[node.nodeId] = {
            nodeId: node.nodeId,
            nodeType: 'promptInput',
            nodeName: node.nodeName,
            value: '',
            required: true,
          };
        }

        // Add file selectors
        for (const node of analysisResult.fileSelectorNodes) {
          defaultInputs[node.nodeId] = {
            nodeId: node.nodeId,
            nodeType: 'fileSelector',
            nodeName: node.nodeName,
            value: [],
            required: true,
          };
        }

        existingConfig = {
          workflowId: id,
          workflowName: analysisResult.workflowName,
          lastUpdated: new Date().toISOString(),
          inputs: defaultInputs,
          lastExecution: null,
        };
      }

      setPopupConfig(existingConfig);
      setCurrentWorkflow(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workflow';
      failExecution(message);
    } finally {
      setPopupLoading(false);
    }
  }, []);

  /**
   * Update input value
   */
  const updateInput = useCallback((nodeId: string, value: string | WorkflowPopupFileReference[]) => {
    updateInputValue(nodeId, value);
  }, []);

  /**
   * Execute workflow
   */
  const execute = useCallback(async () => {
    if (!workflowId || !canExecute) return;

    // Clear previous results (FR-020)
    clearExecutionResults();

    try {
      const response = await window.electron.workflowPopup.execute({
        workflowId,
        inputs,
        timeout: DEFAULT_TIMEOUT,
      });

      if (!response.success) {
        failExecution(response.error || 'Failed to start execution');
        return;
      }

      const executionId = response.executionId!;
      executionIdRef.current = executionId;
      startExecution(workflowId, executionId);

      // Start polling for results
      startPolling(executionId);

      // Set timeout (FR-004b)
      timeoutRef.current = setTimeout(() => {
        stopPolling();
        failExecution('Workflow execution timed out after 5 minutes');
      }, DEFAULT_TIMEOUT);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to execute workflow';
      failExecution(message);
    }
  }, [workflowId, inputs, canExecute]);

  /**
   * Start polling for execution status
   */
  const startPolling = useCallback((executionId: string) => {
    let progress = 0;

    pollingRef.current = setInterval(async () => {
      try {
        const status = await window.electron.workflowPopup.status(executionId);

        // Update progress indicator
        progress = Math.min(progress + 5, 95);
        updateExecutionProgress(status.progress ?? progress);

        if (status.status === 'success' && status.result) {
          stopPolling();
          completeExecution(status.result.outputs);

          // Save config with results
          if (config && workflowId) {
            await window.electron.workflowPopup.saveConfig({
              ...config,
              inputs,
              lastExecution: status.result,
              lastUpdated: new Date().toISOString(),
            });
          }
        } else if (status.status === 'error') {
          stopPolling();
          failExecution(status.result?.error || 'Workflow execution failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Continue polling on transient errors
      }
    }, POLL_INTERVAL);
  }, [config, inputs, workflowId]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Cancel ongoing execution
   */
  const cancel = useCallback(async () => {
    stopPolling();

    if (executionIdRef.current) {
      try {
        await window.electron.workflowPopup.cancel(executionIdRef.current);
      } catch (err) {
        console.error('Cancel error:', err);
      }
      executionIdRef.current = null;
    }

    resetExecutionState();
  }, [stopPolling]);

  /**
   * Save current configuration
   */
  const saveConfig = useCallback(async () => {
    if (!config || !workflowId) return;

    await window.electron.workflowPopup.saveConfig({
      ...config,
      inputs,
      lastUpdated: new Date().toISOString(),
    });
  }, [config, inputs, workflowId]);

  /**
   * Open file selection dialog
   */
  const selectFiles = useCallback(async (nodeId: string) => {
    try {
      const result = await window.electron.workflowPopup.selectFiles({
        title: 'Select Files',
        multiSelect: true,
      });

      if (!result.cancelled && result.files.length > 0) {
        // Merge with existing files (up to 10 - FR-010a)
        const existingValue = inputs[nodeId]?.value;
        const existingFiles = Array.isArray(existingValue) ? existingValue : [];
        const newFiles = [...existingFiles, ...result.files].slice(0, 10);
        updateInputValue(nodeId, newFiles);
      }
    } catch (err) {
      console.error('File selection error:', err);
    }
  }, [inputs]);

  /**
   * Cleanup on unmount
   */
  const cleanup = useCallback(() => {
    stopPolling();
    setCurrentWorkflow(null);
    resetExecutionState();
  }, [stopPolling]);

  // Load workflow when ID changes
  useEffect(() => {
    if (workflowId) {
      loadWorkflow(workflowId);
    }

    return () => {
      stopPolling();
    };
  }, [workflowId, loadWorkflow, stopPolling]);

  return {
    isLoading,
    isExecuting,
    canExecute,
    analysis,
    config,
    inputs,
    results,
    error,
    executionProgress: executionState.progress,
    loadWorkflow,
    updateInput,
    execute,
    cancel,
    saveConfig,
    selectFiles,
    cleanup,
  };
}
