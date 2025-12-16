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
  startExecution as startPopupExecution,
  updateExecutionProgress,
  completeExecution as completePopupExecution,
  failExecution as failPopupExecution,
  resetExecutionState,
  setPopupLoading,
  clearExecutionResults,
} from '@/stores/workflow-execution';
import {
  startExecution as startWorkflowExecution,
  updateExecution as updateWorkflowExecution,
  removeExecution,
} from '@/stores/workflows';
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
   * Start polling for execution status
   */
  const startPolling = useCallback((executionId: string) => {
    let progress = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    pollingRef.current = setInterval(async () => {
      try {
        const status = await window.electron.workflowPopup.status(executionId);

        // Reset error counter on successful poll
        consecutiveErrors = 0;

        // Update progress indicator
        progress = Math.min(progress + 5, 95);
        updateExecutionProgress(status.progress ?? progress);

        // Check for completion
        if (status.status === 'success') {
          console.log(`[useWorkflowExecution] Execution ${executionId} completed successfully`);
          stopPolling();
          completePopupExecution(status.result?.outputs || []);
          // Update workflows store
          updateWorkflowExecution(executionId, { status: 'success', finishedAt: new Date().toISOString() });

          // Save config with results
          if (config && workflowId) {
            await window.electron.workflowPopup.saveConfig({
              ...config,
              inputs,
              lastExecution: status.result || {
                executionId,
                status: 'success',
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: 0,
                outputs: [],
                error: null,
              },
              lastUpdated: new Date().toISOString(),
            });
          }
        } else if (status.status === 'error') {
          console.error(`[useWorkflowExecution] Execution ${executionId} failed:`, status.result?.error);
          stopPolling();
          failPopupExecution(status.result?.error || 'Workflow execution failed');
          // Update workflows store
          updateWorkflowExecution(executionId, { status: 'error', finishedAt: new Date().toISOString() });
        }
      } catch (err) {
        consecutiveErrors++;
        console.error(`[useWorkflowExecution] Polling error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err);

        // Stop polling after too many consecutive errors to prevent infinite loop
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error('[useWorkflowExecution] Too many consecutive polling errors, stopping');
          stopPolling();
          failPopupExecution('Lost connection to execution status - please check n8n logs');
          // Update workflows store
          updateWorkflowExecution(executionId, { status: 'error', finishedAt: new Date().toISOString() });
        }
      }
    }, POLL_INTERVAL);
  }, [config, inputs, workflowId, stopPolling]);

  // Use ref to store startPolling to avoid dependency chain issues
  const startPollingRef = useRef(startPolling);
  startPollingRef.current = startPolling;

  /**
   * Check for ongoing or completed execution and resume/display results
   */
  const checkAndResumeExecution = useCallback(async (wfId: string) => {
    try {
      console.log(`[useWorkflowExecution:checkAndResume] Checking for workflow ${wfId}`);
      const ongoingStatus = await window.electron.workflowPopup.getOngoingExecution(wfId);

      console.log(`[useWorkflowExecution:checkAndResume] Response:`, {
        isRunning: ongoingStatus.isRunning,
        executionId: ongoingStatus.executionId,
        hasResult: !!ongoingStatus.result,
        resultStatus: ongoingStatus.result?.status,
        resultError: ongoingStatus.result?.error,
      });

      if (ongoingStatus.isRunning && ongoingStatus.executionId) {
        // Execution is still running - resume polling
        console.log(`[useWorkflowExecution:checkAndResume] Resuming polling for execution ${ongoingStatus.executionId}`);
        executionIdRef.current = ongoingStatus.executionId;
        // Update both popup and workflows store
        startPopupExecution(wfId, ongoingStatus.executionId);
        startWorkflowExecution(wfId, ongoingStatus.executionId);
        startPollingRef.current(ongoingStatus.executionId);
      } else if (!ongoingStatus.isRunning && ongoingStatus.result) {
        // Execution completed while popup was closed - display results
        console.log(`[useWorkflowExecution:checkAndResume] Displaying completed execution. Status=${ongoingStatus.result.status}, Error=${ongoingStatus.result.error}`);

        // Also update workflows store to clear the "running" status
        if (ongoingStatus.executionId) {
          updateWorkflowExecution(ongoingStatus.executionId, {
            status: ongoingStatus.result.status === 'success' ? 'success' : 'error',
            finishedAt: new Date().toISOString(),
          });
        }

        if (ongoingStatus.result.status === 'success') {
          completePopupExecution(ongoingStatus.result.outputs || []);
        } else {
          failPopupExecution(ongoingStatus.result.error || 'Workflow execution failed');
        }
      } else {
        console.log(`[useWorkflowExecution:checkAndResume] No previous execution or result to display`);
      }
    } catch (err) {
      console.error('[useWorkflowExecution:checkAndResume] Error:', err);
    }
  }, []); // No dependencies - uses refs for stable references

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
        console.error(`[useWorkflowExecution] Analysis error: ${analysisResult.error}`);
        failPopupExecution(analysisResult.error);
        return;
      }

      // Load existing config
      const existingConfig = await window.electron.workflowPopup.getConfig(id);

      // Always rebuild inputs from analysis to ensure we have all detected nodes
      const mergedInputs: Record<string, WorkflowPopupInputFieldConfig> = {};

      // Add prompt inputs from analysis
      for (const node of analysisResult.promptInputNodes || []) {
        const existingInput = existingConfig?.inputs?.[node.nodeId];
        mergedInputs[node.nodeId] = {
          nodeId: node.nodeId,
          nodeType: 'promptInput',
          nodeName: node.nodeName,
          value: existingInput?.nodeType === 'promptInput' ? existingInput.value : '',
          required: true,
        };
      }

      // Add file selectors from analysis
      for (const node of analysisResult.fileSelectorNodes || []) {
        const existingInput = existingConfig?.inputs?.[node.nodeId];
        mergedInputs[node.nodeId] = {
          nodeId: node.nodeId,
          nodeType: 'fileSelector',
          nodeName: node.nodeName,
          value: existingInput?.nodeType === 'fileSelector' ? existingInput.value : [],
          required: true,
        };
      }

      const newConfig: WorkflowPopupConfig = {
        workflowId: id,
        workflowName: analysisResult.workflowName,
        lastUpdated: new Date().toISOString(),
        inputs: mergedInputs,
        lastExecution: existingConfig?.lastExecution || null,
        lastExecutionId: existingConfig?.lastExecutionId || null,
      };

      setPopupConfig(newConfig);
      setCurrentWorkflow(id);

      // Check for ongoing/completed execution and resume if needed
      await checkAndResumeExecution(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workflow';
      console.error(`[useWorkflowExecution] Error loading workflow:`, err);
      failPopupExecution(message);
    } finally {
      setPopupLoading(false);
    }
  }, []); // checkAndResumeExecution is stable (no deps), so loadWorkflow can be stable too

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

    // Log execution details for debugging
    console.log(`[useWorkflowExecution] Executing workflow ${workflowId}`);
    console.log(`[useWorkflowExecution] Input node IDs:`, Object.keys(inputs));
    for (const [nodeId, input] of Object.entries(inputs)) {
      console.log(`[useWorkflowExecution] Input ${nodeId}: type=${input.nodeType}, value="${typeof input.value === 'string' ? input.value.substring(0, 100) : 'files'}"`);
    }

    try {
      const response = await window.electron.workflowPopup.execute({
        workflowId,
        inputs,
        timeout: DEFAULT_TIMEOUT,
      });

      if (!response.success) {
        failPopupExecution(response.error || 'Failed to start execution');
        return;
      }

      const executionId = response.executionId!;
      executionIdRef.current = executionId;
      // Update both popup and workflows store
      startPopupExecution(workflowId, executionId);
      startWorkflowExecution(workflowId, executionId);

      // Start polling for results
      startPolling(executionId);

      // Set timeout (FR-004b)
      timeoutRef.current = setTimeout(() => {
        stopPolling();
        failPopupExecution('Workflow execution timed out after 5 minutes');
        // Also update workflows store
        if (executionIdRef.current) {
          updateWorkflowExecution(executionIdRef.current, { status: 'error', finishedAt: new Date().toISOString() });
        }
      }, DEFAULT_TIMEOUT);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to execute workflow';
      failPopupExecution(message);
    }
  }, [workflowId, inputs, canExecute, startPolling, stopPolling]);

  /**
   * Cancel ongoing execution
   */
  const cancel = useCallback(async () => {
    stopPolling();

    if (executionIdRef.current) {
      try {
        await window.electron.workflowPopup.cancel(executionIdRef.current);
        // Update workflows store
        removeExecution(executionIdRef.current);
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
   * Cleanup on popup close
   * Note: Only stops polling but does NOT cancel execution.
   * Execution continues in the background and results will be shown when popup reopens.
   */
  const cleanup = useCallback(() => {
    stopPolling();
    setCurrentWorkflow(null);
    // Don't reset execution state - allow background execution to continue
    // Results will be restored when popup reopens via checkAndResumeExecution
  }, [stopPolling]);

  // Use ref for stopPolling to avoid dependency issues in useEffect
  const stopPollingRef = useRef(stopPolling);
  stopPollingRef.current = stopPolling;

  // Load workflow when ID changes
  useEffect(() => {
    if (workflowId) {
      loadWorkflow(workflowId);
    }

    return () => {
      stopPollingRef.current();
    };
  }, [workflowId]); // loadWorkflow is stable (no deps), stopPolling accessed via ref

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
