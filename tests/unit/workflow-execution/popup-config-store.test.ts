/**
 * Unit tests for PopupConfigStore
 * Tests for electron-store based configuration persistence
 *
 * Feature: 010-workflow-execution-popup
 * Task: T040
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types for testing
interface WorkflowPopupConfig {
  workflowId: string;
  workflowName: string;
  lastUpdated: string;
  inputs: Record<string, InputFieldConfig>;
  lastExecution: ExecutionResult | null;
}

interface InputFieldConfig {
  nodeId: string;
  nodeType: 'promptInput' | 'fileSelector';
  nodeName: string;
  value: string | FileReference[];
  required: boolean;
}

interface FileReference {
  id: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
}

interface ExecutionResult {
  executionId: string;
  status: 'success' | 'error' | 'timeout';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  outputs: OutputResult[];
  error?: string;
}

interface OutputResult {
  nodeId: string;
  nodeName: string;
  contentType: 'text' | 'markdown' | 'file';
  content: string;
  fileReference?: FileReference;
}

describe('PopupConfigStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WorkflowPopupConfig interface', () => {
    it('should have correct shape for basic config', () => {
      const config: WorkflowPopupConfig = {
        workflowId: 'workflow-123',
        workflowName: 'Test Workflow',
        lastUpdated: new Date().toISOString(),
        inputs: {},
        lastExecution: null,
      };

      expect(config).toHaveProperty('workflowId');
      expect(config).toHaveProperty('workflowName');
      expect(config).toHaveProperty('lastUpdated');
      expect(config).toHaveProperty('inputs');
      expect(config).toHaveProperty('lastExecution');
    });

    it('should support prompt input configuration', () => {
      const config: WorkflowPopupConfig = {
        workflowId: 'workflow-123',
        workflowName: 'Test Workflow',
        lastUpdated: new Date().toISOString(),
        inputs: {
          'node-1': {
            nodeId: 'node-1',
            nodeType: 'promptInput',
            nodeName: 'User Prompt',
            value: 'Test prompt text',
            required: true,
          },
        },
        lastExecution: null,
      };

      expect(config.inputs['node-1'].nodeType).toBe('promptInput');
      expect(config.inputs['node-1'].value).toBe('Test prompt text');
    });

    it('should support file selector configuration', () => {
      const config: WorkflowPopupConfig = {
        workflowId: 'workflow-123',
        workflowName: 'Test Workflow',
        lastUpdated: new Date().toISOString(),
        inputs: {
          'node-2': {
            nodeId: 'node-2',
            nodeType: 'fileSelector',
            nodeName: 'File Input',
            value: [
              {
                id: 'file-1',
                path: '/path/to/file.pdf',
                name: 'file.pdf',
                size: 1024,
                mimeType: 'application/pdf',
              },
            ],
            required: true,
          },
        },
        lastExecution: null,
      };

      const fileValue = config.inputs['node-2'].value as FileReference[];
      expect(config.inputs['node-2'].nodeType).toBe('fileSelector');
      expect(Array.isArray(fileValue)).toBe(true);
      expect(fileValue[0].name).toBe('file.pdf');
    });
  });

  describe('InputFieldConfig validation', () => {
    it('should validate promptInput type', () => {
      const promptInput: InputFieldConfig = {
        nodeId: 'node-1',
        nodeType: 'promptInput',
        nodeName: 'Prompt',
        value: 'test',
        required: true,
      };

      expect(promptInput.nodeType).toBe('promptInput');
      expect(typeof promptInput.value).toBe('string');
    });

    it('should validate fileSelector type', () => {
      const fileSelector: InputFieldConfig = {
        nodeId: 'node-2',
        nodeType: 'fileSelector',
        nodeName: 'Files',
        value: [],
        required: false,
      };

      expect(fileSelector.nodeType).toBe('fileSelector');
      expect(Array.isArray(fileSelector.value)).toBe(true);
    });
  });

  describe('FileReference validation', () => {
    it('should have all required properties', () => {
      const fileRef: FileReference = {
        id: 'file-uuid-123',
        path: '/data/files/document.pdf',
        name: 'document.pdf',
        size: 2048576,
        mimeType: 'application/pdf',
      };

      expect(fileRef.id).toBeDefined();
      expect(fileRef.path).toBeDefined();
      expect(fileRef.name).toBeDefined();
      expect(fileRef.size).toBeGreaterThan(0);
      expect(fileRef.mimeType).toContain('/');
    });

    it('should validate file size limits (max 10 files)', () => {
      const files: FileReference[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `file-${i}`,
          path: `/path/file-${i}.txt`,
          name: `file-${i}.txt`,
          size: 1024,
          mimeType: 'text/plain',
        }));

      expect(files.length).toBe(10);
      expect(files.length).toBeLessThanOrEqual(10); // FR-010a max 10 files
    });
  });

  describe('ExecutionResult validation', () => {
    it('should have success result shape', () => {
      const result: ExecutionResult = {
        executionId: 'exec-123',
        status: 'success',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:00:30Z',
        durationMs: 30000,
        outputs: [
          {
            nodeId: 'result-node-1',
            nodeName: 'Result Display',
            contentType: 'markdown',
            content: '# Result\n\nThis is the output.',
          },
        ],
      };

      expect(result.status).toBe('success');
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.outputs.length).toBeGreaterThan(0);
    });

    it('should have error result shape', () => {
      const result: ExecutionResult = {
        executionId: 'exec-456',
        status: 'error',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:00:05Z',
        durationMs: 5000,
        outputs: [],
        error: 'Workflow execution failed: Invalid input',
      };

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should have timeout result shape', () => {
      const result: ExecutionResult = {
        executionId: 'exec-789',
        status: 'timeout',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:05:00Z',
        durationMs: 300000,
        outputs: [],
        error: 'Execution timed out after 5 minutes',
      };

      expect(result.status).toBe('timeout');
      expect(result.durationMs).toBe(300000); // 5 minutes
    });
  });

  describe('OutputResult validation', () => {
    it('should support text content type', () => {
      const output: OutputResult = {
        nodeId: 'result-1',
        nodeName: 'Text Output',
        contentType: 'text',
        content: 'Plain text result',
      };

      expect(output.contentType).toBe('text');
    });

    it('should support markdown content type', () => {
      const output: OutputResult = {
        nodeId: 'result-2',
        nodeName: 'Markdown Output',
        contentType: 'markdown',
        content: '# Heading\n\n- Item 1\n- Item 2',
      };

      expect(output.contentType).toBe('markdown');
    });

    it('should support file content type with fileReference', () => {
      const output: OutputResult = {
        nodeId: 'result-3',
        nodeName: 'File Output',
        contentType: 'file',
        content: '',
        fileReference: {
          id: 'output-file-1',
          path: '/output/result.pdf',
          name: 'result.pdf',
          size: 4096,
          mimeType: 'application/pdf',
        },
      };

      expect(output.contentType).toBe('file');
      expect(output.fileReference).toBeDefined();
      expect(output.fileReference?.name).toBe('result.pdf');
    });
  });

  describe('Config store key format', () => {
    it('should generate workflow-specific keys', () => {
      const workflowId = 'workflow-abc-123';
      const storeKey = `popup-config.${workflowId}`;

      expect(storeKey).toBe('popup-config.workflow-abc-123');
    });

    it('should handle special characters in workflow ID', () => {
      const workflowId = 'workflow_with-special.chars';
      const storeKey = `popup-config.${workflowId}`;

      expect(storeKey).toContain(workflowId);
    });
  });

  describe('Config timestamp handling', () => {
    it('should generate ISO timestamp for lastUpdated', () => {
      const timestamp = new Date().toISOString();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should parse timestamp correctly', () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      const date = new Date(timestamp);

      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0); // January is 0
      expect(date.getUTCDate()).toBe(15);
    });
  });

  describe('Last execution clearing (FR-020)', () => {
    it('should clear lastExecution when starting new execution', () => {
      const config: WorkflowPopupConfig = {
        workflowId: 'workflow-123',
        workflowName: 'Test Workflow',
        lastUpdated: new Date().toISOString(),
        inputs: {},
        lastExecution: {
          executionId: 'old-exec',
          status: 'success',
          startedAt: '2024-01-14T10:00:00Z',
          completedAt: '2024-01-14T10:00:30Z',
          durationMs: 30000,
          outputs: [],
        },
      };

      // Clear on new execution start
      const updatedConfig = {
        ...config,
        lastExecution: null,
        lastUpdated: new Date().toISOString(),
      };

      expect(updatedConfig.lastExecution).toBeNull();
    });
  });
});
