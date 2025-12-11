/**
 * Workflow Executor Service
 *
 * Handles workflow execution from the popup, including:
 * - Analyzing workflows to detect custom input/output nodes
 * - Executing workflows with external inputs
 * - Polling for completion and extracting results
 *
 * Feature: 010-workflow-execution-popup
 */

import axios, { AxiosRequestConfig } from 'axios';
import {
  WorkflowAnalysisResult,
  WorkflowNodeInfo,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  ExecutionStatusResponse,
  ExecutionResult,
  OutputResult,
  InputFieldConfig,
  FileReference,
} from '../../shared/types/workflow-popup';
import { N8nAuthManager } from './n8n-auth-manager';
import { getElectronBridgeUrl } from './electron-bridge';
import fs from 'fs';

/** Default execution timeout (5 minutes) */
const DEFAULT_TIMEOUT = 300000;

/** Polling interval for execution status */
const POLL_INTERVAL = 1000;

/**
 * Custom node type identifiers.
 * n8n uses different prefixes depending on how custom nodes are loaded:
 * - 'CUSTOM.*' when loaded from ~/.n8n/custom/ directory
 * - 'n8n-nodes-desktop.*' when loaded via N8N_CUSTOM_EXTENSIONS
 */
const NODE_TYPE_SUFFIXES = {
  promptInput: 'promptInput',
  fileSelector: 'fileSelector',
  resultDisplay: 'resultDisplay',
} as const;

/** Check if a node type matches one of our custom nodes */
function isCustomNodeType(nodeType: string, suffix: string): boolean {
  return (
    nodeType === `CUSTOM.${suffix}` ||
    nodeType === `n8n-nodes-desktop.${suffix}`
  );
}

/** Workflow node from n8n API */
interface N8nWorkflowNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, unknown>;
}

/** Workflow from n8n API */
interface N8nWorkflow {
  id: string;
  name: string;
  nodes: N8nWorkflowNode[];
  connections: Record<string, unknown>;
  active: boolean;
}

/** Execution from n8n API */
interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  status: 'running' | 'success' | 'error' | 'waiting' | 'canceled';
  startedAt: string;
  stoppedAt?: string;
  data?: {
    resultData?: {
      runData?: Record<string, Array<{
        data?: {
          main?: Array<Array<{ json?: Record<string, unknown> }>>;
        };
        error?: { message: string };
      }>>;
      error?: { message: string };
    };
  };
}

export class WorkflowExecutor {
  private n8nPort: number;
  private authManager: N8nAuthManager;

  constructor(getN8nPort: () => number, authManager: N8nAuthManager) {
    this.n8nPort = getN8nPort();
    this.authManager = authManager;
  }

  private get baseUrl(): string {
    return `http://localhost:${this.n8nPort}/rest`;
  }

  private getAuthConfig(): AxiosRequestConfig {
    return {
      headers: this.authManager.getAuthHeaders(),
      withCredentials: true,
    };
  }

  /**
   * Analyze a workflow to detect input/output nodes
   * @param workflowId - The n8n workflow ID
   * @returns Analysis result with detected nodes
   */
  async analyzeWorkflow(workflowId: string): Promise<WorkflowAnalysisResult> {
    try {
      console.log(`[WorkflowExecutor] Analyzing workflow ${workflowId}`);

      const response = await axios.get<N8nWorkflow>(
        `${this.baseUrl}/workflows/${workflowId}`,
        this.getAuthConfig()
      );

      const workflow = response.data;
      const nodes = workflow.nodes || [];

      // Detect custom nodes by type (supports both CUSTOM.* and n8n-nodes-desktop.* prefixes)
      const promptInputNodes = nodes
        .filter((node) => isCustomNodeType(node.type, NODE_TYPE_SUFFIXES.promptInput))
        .map(this.mapNodeToInfo);

      const fileSelectorNodes = nodes
        .filter((node) => isCustomNodeType(node.type, NODE_TYPE_SUFFIXES.fileSelector))
        .map(this.mapNodeToInfo);

      const resultDisplayNodes = nodes
        .filter((node) => isCustomNodeType(node.type, NODE_TYPE_SUFFIXES.resultDisplay))
        .map(this.mapNodeToInfo);

      const isSupported =
        promptInputNodes.length > 0 ||
        fileSelectorNodes.length > 0 ||
        resultDisplayNodes.length > 0;

      console.log(`[WorkflowExecutor] Found ${promptInputNodes.length} promptInput, ${fileSelectorNodes.length} fileSelector, ${resultDisplayNodes.length} resultDisplay nodes`);

      return {
        workflowId,
        workflowName: workflow.name,
        promptInputNodes,
        fileSelectorNodes,
        resultDisplayNodes,
        isSupported,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze workflow';
      console.error('[WorkflowExecutor] Analysis error:', message);
      return {
        workflowId,
        workflowName: '',
        promptInputNodes: [],
        fileSelectorNodes: [],
        resultDisplayNodes: [],
        isSupported: false,
        error: message,
      };
    }
  }

  private mapNodeToInfo(node: N8nWorkflowNode): WorkflowNodeInfo {
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      parameters: node.parameters,
    };
  }

  /**
   * Validate file inputs exist before execution (FR-026)
   * @param inputs - Input configurations
   * @returns List of missing files or empty if all valid
   */
  validateFileInputs(inputs: Record<string, InputFieldConfig>): string[] {
    const missingFiles: string[] = [];

    for (const input of Object.values(inputs)) {
      if (input.nodeType === 'fileSelector' && Array.isArray(input.value)) {
        for (const fileRef of input.value as FileReference[]) {
          if (!fs.existsSync(fileRef.path)) {
            missingFiles.push(fileRef.path);
          }
        }
      }
    }

    return missingFiles;
  }

  /**
   * Execute a workflow with provided inputs
   * @param request - Execution request with inputs
   * @returns Execution response with ID
   */
  async executeWorkflow(request: ExecuteWorkflowRequest): Promise<ExecuteWorkflowResponse> {
    try {
      console.log(`[WorkflowExecutor] Executing workflow ${request.workflowId}`);

      // Validate file inputs first (FR-026)
      const missingFiles = this.validateFileInputs(request.inputs);
      if (missingFiles.length > 0) {
        return {
          success: false,
          error: `File(s) not found: ${missingFiles.join(', ')}`,
        };
      }

      // Store execution config in bridge for nodes to fetch
      const executionId = `popup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      await this.storeExecutionConfig(executionId, request.inputs);

      // Execute workflow via n8n API
      const response = await axios.post(
        `${this.baseUrl}/workflows/${request.workflowId}/run`,
        {
          // Pass execution ID as static data for nodes to access
          startNodes: [],
          destinationNode: '',
          runData: {},
        },
        {
          ...this.getAuthConfig(),
          params: {
            // Include execution ID in a way nodes can access
            popupExecutionId: executionId,
          },
        }
      );

      const n8nExecutionId = response.data.executionId || response.data.data?.executionId;

      console.log(`[WorkflowExecutor] Execution started: ${n8nExecutionId}`);

      return {
        success: true,
        executionId: n8nExecutionId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute workflow';
      console.error('[WorkflowExecutor] Execution error:', message);

      // Check if n8n is not running (FR-025)
      if (axios.isAxiosError(error) && !error.response) {
        return {
          success: false,
          error: 'n8n server is not running. Please start the server and try again.',
        };
      }

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Store execution config in bridge for nodes to fetch
   */
  private async storeExecutionConfig(
    executionId: string,
    inputs: Record<string, InputFieldConfig>
  ): Promise<void> {
    try {
      const bridgeUrl = getElectronBridgeUrl();

      // Convert inputs to config format for bridge
      const configs: Record<string, { nodeId: string; nodeType: 'promptInput' | 'fileSelector'; value: string | FileReference[] }> = {};

      for (const [nodeId, input] of Object.entries(inputs)) {
        configs[nodeId] = {
          nodeId: input.nodeId,
          nodeType: input.nodeType,
          value: input.value,
        };
      }

      await axios.post(`${bridgeUrl}/api/electron-bridge/execution-config`, {
        executionId,
        configs,
      });

      console.log(`[WorkflowExecutor] Stored execution config for ${executionId}`);
    } catch (error) {
      console.error('[WorkflowExecutor] Failed to store execution config:', error);
      throw error;
    }
  }

  /**
   * Poll execution status until completion or timeout
   * @param executionId - The n8n execution ID
   * @param timeout - Timeout in milliseconds (default 5 minutes)
   * @returns Execution result
   */
  async pollExecution(
    executionId: string,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    console.log(`[WorkflowExecutor] Polling execution ${executionId} (timeout: ${timeout}ms)`);

    while (Date.now() - startTime < timeout) {
      try {
        const statusResponse = await this.getExecutionStatus(executionId);

        if (statusResponse.status === 'success' || statusResponse.status === 'error') {
          console.log(`[WorkflowExecutor] Execution ${executionId} finished with status: ${statusResponse.status}`);

          if (statusResponse.result) {
            return statusResponse.result;
          }

          // Build result from status
          return this.buildExecutionResult(executionId, statusResponse);
        }

        // Wait before next poll
        await this.sleep(POLL_INTERVAL);
      } catch (error) {
        console.error('[WorkflowExecutor] Poll error:', error);
        // Continue polling on transient errors
        await this.sleep(POLL_INTERVAL);
      }
    }

    // Timeout reached (FR-004b)
    console.log(`[WorkflowExecutor] Execution ${executionId} timed out after ${timeout}ms`);

    return {
      executionId,
      status: 'timeout',
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: timeout,
      outputs: [],
      error: `Execution timed out after ${Math.round(timeout / 1000)} seconds`,
    };
  }

  /**
   * Get current execution status
   * @param executionId - The n8n execution ID
   * @returns Current status
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatusResponse> {
    try {
      const response = await axios.get<N8nExecution>(
        `${this.baseUrl}/executions/${executionId}`,
        this.getAuthConfig()
      );

      const execution = response.data;

      // Map n8n status to our status
      let status: 'running' | 'success' | 'error' | 'waiting' = 'running';
      if (execution.finished) {
        status = execution.status === 'success' ? 'success' : 'error';
      } else if (execution.status === 'waiting') {
        status = 'waiting';
      }

      // Build result if finished
      let result: ExecutionResult | undefined;
      if (execution.finished) {
        result = await this.extractResults(executionId, execution);
      }

      return {
        executionId,
        status,
        result,
      };
    } catch (error) {
      console.error('[WorkflowExecutor] Status check error:', error);
      return {
        executionId,
        status: 'running',
      };
    }
  }

  /**
   * Extract ResultDisplay outputs from execution
   */
  private async extractResults(
    executionId: string,
    execution: N8nExecution
  ): Promise<ExecutionResult> {
    const outputs: OutputResult[] = [];
    let error: string | null = null;

    // Check for execution error
    if (execution.data?.resultData?.error) {
      error = execution.data.resultData.error.message;
    }

    // Extract outputs from ResultDisplay nodes
    const runData = execution.data?.resultData?.runData;
    if (runData) {
      for (const [nodeName, nodeRuns] of Object.entries(runData)) {
        for (const run of nodeRuns) {
          // Check if this is a ResultDisplay node output
          const outputData = run.data?.main?.[0]?.[0]?.json;
          if (outputData && this.isResultDisplayOutput(outputData)) {
            outputs.push({
              nodeId: nodeName,
              nodeName: nodeName,
              contentType: (outputData.contentType as 'markdown' | 'text' | 'file') || 'text',
              content: (outputData.content as string) || '',
              fileReference: outputData.fileReference as OutputResult['fileReference'] || null,
            });
          }
        }
      }
    }

    // Also try to get results from bridge (if ResultDisplay emitted them)
    try {
      const bridgeResults = await this.getResultsFromBridge(executionId);
      if (bridgeResults.length > 0) {
        outputs.push(...bridgeResults);
      }
    } catch {
      // Bridge results are optional
    }

    return {
      executionId,
      status: error ? 'error' : 'success',
      startedAt: execution.startedAt,
      completedAt: execution.stoppedAt || new Date().toISOString(),
      durationMs: execution.stoppedAt
        ? new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()
        : 0,
      outputs,
      error,
    };
  }

  private isResultDisplayOutput(data: Record<string, unknown>): boolean {
    // Check if output has our expected structure
    return 'content' in data || 'contentType' in data || 'fileReference' in data;
  }

  private async getResultsFromBridge(executionId: string): Promise<OutputResult[]> {
    try {
      const bridgeUrl = getElectronBridgeUrl();
      const response = await axios.get(
        `${bridgeUrl}/api/electron-bridge/execution-results/${executionId}`
      );

      if (response.data.success && response.data.results) {
        return response.data.results;
      }
      return [];
    } catch {
      return [];
    }
  }

  private buildExecutionResult(
    executionId: string,
    status: ExecutionStatusResponse
  ): ExecutionResult {
    return {
      executionId,
      status: status.status === 'error' ? 'error' : 'success',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      outputs: [],
      error: null,
    };
  }

  /**
   * Cancel an ongoing execution
   * @param executionId - The n8n execution ID
   * @returns Success status
   */
  async cancelExecution(executionId: string): Promise<{ success: boolean }> {
    try {
      console.log(`[WorkflowExecutor] Cancelling execution ${executionId}`);

      await axios.post(
        `${this.baseUrl}/executions/${executionId}/stop`,
        {},
        this.getAuthConfig()
      );

      // Clean up bridge config
      try {
        const bridgeUrl = getElectronBridgeUrl();
        await axios.delete(`${bridgeUrl}/api/electron-bridge/execution-config/${executionId}`);
      } catch {
        // Ignore cleanup errors
      }

      return { success: true };
    } catch (error) {
      console.error('[WorkflowExecutor] Cancel error:', error);
      return { success: false };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
