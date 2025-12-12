/**
 * Workflow Execution Store
 *
 * Nanostores-based state management for workflow execution popup.
 * Manages execution state, results, and errors.
 *
 * Feature: 010-workflow-execution-popup
 */

import { atom, computed } from 'nanostores';
import type {
  OutputResult,
  WorkflowPopupConfig,
  InputFieldConfig,
} from '../../../shared/types/workflow-popup';

// ============================================================================
// Execution State Types
// ============================================================================

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface ExecutionState {
  status: ExecutionStatus;
  workflowId: string | null;
  executionId: string | null;
  progress: number; // 0-100
  startedAt: string | null;
  error: string | null;
}

// ============================================================================
// Atoms (Core State)
// ============================================================================

/** Current execution state */
export const $executionState = atom<ExecutionState>({
  status: 'idle',
  workflowId: null,
  executionId: null,
  progress: 0,
  startedAt: null,
  error: null,
});

/** Current workflow ID being viewed in popup */
export const $currentWorkflowId = atom<string | null>(null);

/** Current popup configuration */
export const $popupConfig = atom<WorkflowPopupConfig | null>(null);

/** Execution results from ResultDisplay nodes */
export const $executionResults = atom<OutputResult[]>([]);

/** Last execution error message */
export const $executionError = atom<string | null>(null);

/** Loading state for popup initialization */
export const $isPopupLoading = atom<boolean>(false);

/** Input values being edited (keyed by nodeId) */
export const $inputValues = atom<Record<string, InputFieldConfig>>({});

// ============================================================================
// Computed Values
// ============================================================================

/** Check if execution is currently running */
export const $isExecuting = computed(
  $executionState,
  (state) => state.status === 'running'
);

/** Check if execution has completed (success or failure) */
export const $isExecutionComplete = computed(
  $executionState,
  (state) => state.status === 'completed' || state.status === 'failed'
);

/** Get execution progress percentage */
export const $executionProgress = computed(
  $executionState,
  (state) => state.progress
);

/** Check if all required inputs are filled */
export const $areRequiredInputsFilled = computed($inputValues, (inputs) => {
  const inputsArray = Object.values(inputs);
  return inputsArray.every((input) => {
    if (!input.required) return true;
    if (input.nodeType === 'promptInput') {
      return typeof input.value === 'string' && input.value.trim().length > 0;
    }
    if (input.nodeType === 'fileSelector') {
      return Array.isArray(input.value) && input.value.length > 0;
    }
    return true;
  });
});

/** Check if execute button should be enabled */
export const $canExecute = computed(
  [$isExecuting, $areRequiredInputsFilled],
  (isExecuting, inputsFilled) => !isExecuting && inputsFilled
);

// ============================================================================
// Actions
// ============================================================================

/**
 * Set current workflow for popup
 */
export function setCurrentWorkflow(workflowId: string | null): void {
  $currentWorkflowId.set(workflowId);
  if (!workflowId) {
    resetExecutionState();
  }
}

/**
 * Set popup configuration
 */
export function setPopupConfig(config: WorkflowPopupConfig | null): void {
  console.log(`[workflow-execution store] setPopupConfig called`);
  console.log(`[workflow-execution store] config:`, config ? JSON.stringify(config, null, 2) : 'null');

  $popupConfig.set(config);
  if (config) {
    console.log(`[workflow-execution store] Setting $inputValues with ${Object.keys(config.inputs).length} inputs`);
    console.log(`[workflow-execution store] Input keys:`, Object.keys(config.inputs));
    $inputValues.set(config.inputs);
  } else {
    console.log(`[workflow-execution store] Clearing $inputValues (config is null)`);
    $inputValues.set({});
  }

  console.log(`[workflow-execution store] $inputValues after set:`, $inputValues.get());
}

/**
 * Update a single input value
 */
export function updateInputValue(nodeId: string, value: string | import('../../../shared/types/workflow-popup').FileReference[]): void {
  const inputs = $inputValues.get();
  if (inputs[nodeId]) {
    $inputValues.set({
      ...inputs,
      [nodeId]: {
        ...inputs[nodeId],
        value,
      },
    });
  }
}

/**
 * Start execution
 */
export function startExecution(workflowId: string, executionId: string): void {
  $executionState.set({
    status: 'running',
    workflowId,
    executionId,
    progress: 0,
    startedAt: new Date().toISOString(),
    error: null,
  });
  $executionResults.set([]);
  $executionError.set(null);
}

/**
 * Update execution progress
 */
export function updateExecutionProgress(progress: number): void {
  const state = $executionState.get();
  if (state.status === 'running') {
    $executionState.set({
      ...state,
      progress: Math.min(100, Math.max(0, progress)),
    });
  }
}

/**
 * Complete execution successfully
 */
export function completeExecution(results: OutputResult[]): void {
  const state = $executionState.get();
  $executionState.set({
    ...state,
    status: 'completed',
    progress: 100,
  });
  $executionResults.set(results);
  $executionError.set(null);
}

/**
 * Fail execution with error
 */
export function failExecution(error: string): void {
  const state = $executionState.get();
  $executionState.set({
    ...state,
    status: 'failed',
    progress: 0,
    error,
  });
  $executionError.set(error);
}

/**
 * Reset execution state to idle
 */
export function resetExecutionState(): void {
  $executionState.set({
    status: 'idle',
    workflowId: null,
    executionId: null,
    progress: 0,
    startedAt: null,
    error: null,
  });
  $executionResults.set([]);
  $executionError.set(null);
}

/**
 * Set popup loading state
 */
export function setPopupLoading(loading: boolean): void {
  $isPopupLoading.set(loading);
}

/**
 * Add execution result (called when ResultDisplay emits output)
 */
export function addExecutionResult(result: OutputResult): void {
  $executionResults.set([...$executionResults.get(), result]);
}

/**
 * Clear execution results (before new execution - FR-020)
 */
export function clearExecutionResults(): void {
  $executionResults.set([]);
}
