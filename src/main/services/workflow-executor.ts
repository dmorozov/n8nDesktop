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
  id?: string;  // ID may be undefined in some n8n versions
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
      console.log(`[WorkflowExecutor] ========== ANALYZE WORKFLOW START ==========`);
      console.log(`[WorkflowExecutor] Analyzing workflow ID: "${workflowId}"`);
      console.log(`[WorkflowExecutor] API URL: ${this.baseUrl}/workflows/${workflowId}`);

      const authConfig = this.getAuthConfig();
      console.log(`[WorkflowExecutor] Auth headers present: ${!!authConfig.headers}`);

      const response = await axios.get<N8nWorkflow>(
        `${this.baseUrl}/workflows/${workflowId}`,
        authConfig
      );

      console.log(`[WorkflowExecutor] API response status: ${response.status}`);
      console.log(`[WorkflowExecutor] API response data keys: ${Object.keys(response.data || {}).join(', ')}`);

      // n8n API wraps workflow data in a 'data' property
      // Handle both wrapped { data: {...} } and direct workflow response formats
      const responseData = response.data as N8nWorkflow & { data?: N8nWorkflow };
      const workflow: N8nWorkflow = responseData.data ? responseData.data : responseData;

      console.log(`[WorkflowExecutor] Unwrapped workflow keys: ${Object.keys(workflow || {}).join(', ')}`);

      const nodes = workflow.nodes || [];

      // Log all node types for debugging
      console.log(`[WorkflowExecutor] Workflow name: "${workflow.name}"`);
      console.log(`[WorkflowExecutor] Total nodes count: ${nodes.length}`);
      console.log(`[WorkflowExecutor] All nodes in workflow:`);
      nodes.forEach((node, index) => {
        console.log(`  [${index}] name="${node.name}", id="${node.id || 'none'}", type="${node.type}"`);
      });

      // Log what we're looking for
      console.log(`[WorkflowExecutor] Looking for node types:`);
      console.log(`  - CUSTOM.${NODE_TYPE_SUFFIXES.promptInput}`);
      console.log(`  - n8n-nodes-desktop.${NODE_TYPE_SUFFIXES.promptInput}`);
      console.log(`  - CUSTOM.${NODE_TYPE_SUFFIXES.fileSelector}`);
      console.log(`  - n8n-nodes-desktop.${NODE_TYPE_SUFFIXES.fileSelector}`);

      // Detect custom nodes by type (supports both CUSTOM.* and n8n-nodes-desktop.* prefixes)
      const promptInputNodes = nodes
        .filter((node) => {
          const isMatch = isCustomNodeType(node.type, NODE_TYPE_SUFFIXES.promptInput);
          if (isMatch) {
            console.log(`[WorkflowExecutor] MATCH: "${node.name}" matches promptInput`);
          }
          return isMatch;
        })
        .map((node) => this.mapNodeToInfo(node));

      const fileSelectorNodes = nodes
        .filter((node) => {
          const isMatch = isCustomNodeType(node.type, NODE_TYPE_SUFFIXES.fileSelector);
          if (isMatch) {
            console.log(`[WorkflowExecutor] MATCH: "${node.name}" matches fileSelector`);
          }
          return isMatch;
        })
        .map((node) => this.mapNodeToInfo(node));

      const resultDisplayNodes = nodes
        .filter((node) => {
          const isMatch = isCustomNodeType(node.type, NODE_TYPE_SUFFIXES.resultDisplay);
          if (isMatch) {
            console.log(`[WorkflowExecutor] MATCH: "${node.name}" matches resultDisplay`);
          }
          return isMatch;
        })
        .map((node) => this.mapNodeToInfo(node));

      const isSupported =
        promptInputNodes.length > 0 ||
        fileSelectorNodes.length > 0 ||
        resultDisplayNodes.length > 0;

      console.log(`[WorkflowExecutor] ========== ANALYSIS RESULTS ==========`);
      console.log(`[WorkflowExecutor] promptInputNodes: ${promptInputNodes.length}`);
      console.log(`[WorkflowExecutor] fileSelectorNodes: ${fileSelectorNodes.length}`);
      console.log(`[WorkflowExecutor] resultDisplayNodes: ${resultDisplayNodes.length}`);
      console.log(`[WorkflowExecutor] isSupported: ${isSupported}`);
      console.log(`[WorkflowExecutor] ========== ANALYZE WORKFLOW END ==========`);

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
      console.error('[WorkflowExecutor] ========== ANALYSIS ERROR ==========');
      console.error('[WorkflowExecutor] Error:', error);
      console.error('[WorkflowExecutor] Message:', message);
      if (axios.isAxiosError(error)) {
        console.error('[WorkflowExecutor] Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
      }
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
      // Use node.id if available, otherwise fall back to node.name as unique identifier
      // Some n8n versions don't return id for nodes, but name is always unique within a workflow
      nodeId: node.id || node.name,
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
      // Use workflowId as the key because nodes can access it via this.getWorkflow().id
      // (nodes can't access our popup execution ID, only n8n's internal execution ID)
      await this.storeExecutionConfig(request.workflowId, request.inputs);

      // Execute workflow via n8n API
      // Note: n8n expects an empty body for workflow execution
      const response = await axios.post(
        `${this.baseUrl}/workflows/${request.workflowId}/run`,
        {},
        this.getAuthConfig()
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
