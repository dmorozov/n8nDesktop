import { atom, computed } from 'nanostores';

// Workflow type from n8n
export interface Workflow {
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

// Workflow execution info
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'error' | 'waiting';
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

// Filter options
export type WorkflowStatusFilter = 'all' | 'active' | 'inactive';

// Store for workflows list
export const $workflows = atom<Workflow[]>([]);

// Store for current workflow filter
export const $workflowFilter = atom<WorkflowStatusFilter>('all');

// Store for workflow search query
export const $workflowSearch = atom<string>('');

// Store for running executions
export const $runningExecutions = atom<WorkflowExecution[]>([]);

// Store for loading state
export const $isLoadingWorkflows = atom<boolean>(false);

// Computed: filtered workflows
export const $filteredWorkflows = computed(
  [$workflows, $workflowFilter, $workflowSearch],
  (workflows, filter, search) => {
    let result = workflows;

    // Apply status filter
    if (filter === 'active') {
      result = result.filter(w => w.active);
    } else if (filter === 'inactive') {
      result = result.filter(w => !w.active);
    }

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      result = result.filter(
        w =>
          w.name.toLowerCase().includes(searchLower) ||
          (w.description?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    return result;
  }
);

// Computed: workflow counts
export const $workflowCounts = computed($workflows, (workflows) => ({
  total: workflows.length,
  active: workflows.filter(w => w.active).length,
  inactive: workflows.filter(w => !w.active).length,
}));

// Computed: count of currently running workflows
export const $runningWorkflowCount = computed(
  $runningExecutions,
  (executions) => executions.filter(e => e.status === 'running').length
);

// Actions
export function setWorkflows(workflows: Workflow[]): void {
  $workflows.set(workflows);
}

export function setLoadingWorkflows(loading: boolean): void {
  $isLoadingWorkflows.set(loading);
}

export function addWorkflow(workflow: Workflow): void {
  $workflows.set([...$workflows.get(), workflow]);
}

export function updateWorkflow(id: string, updates: Partial<Workflow>): void {
  const workflows = $workflows.get();
  const index = workflows.findIndex(w => w.id === id);
  if (index !== -1) {
    const updated = [...workflows];
    updated[index] = { ...updated[index], ...updates };
    $workflows.set(updated);
  }
}

export function removeWorkflow(id: string): void {
  $workflows.set($workflows.get().filter(w => w.id !== id));
}

export function setWorkflowFilter(filter: WorkflowStatusFilter): void {
  $workflowFilter.set(filter);
}

export function setWorkflowSearch(search: string): void {
  $workflowSearch.set(search);
}

export function startExecution(workflowId: string, executionId: string): void {
  const execution: WorkflowExecution = {
    id: executionId,
    workflowId,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  $runningExecutions.set([...$runningExecutions.get(), execution]);
}

export function stopExecution(executionId: string): void {
  const executions = $runningExecutions.get();
  const index = executions.findIndex(e => e.id === executionId);
  if (index !== -1) {
    const updated = [...executions];
    updated[index] = { ...updated[index], status: 'error', finishedAt: new Date().toISOString() };
    $runningExecutions.set(updated);
  }
}

export function addExecution(execution: WorkflowExecution): void {
  $runningExecutions.set([...$runningExecutions.get(), execution]);
}

export function updateExecution(id: string, updates: Partial<WorkflowExecution>): void {
  const executions = $runningExecutions.get();
  const index = executions.findIndex(e => e.id === id);
  if (index !== -1) {
    const updated = [...executions];
    updated[index] = { ...updated[index], ...updates };
    $runningExecutions.set(updated);
  }
}

export function removeExecution(id: string): void {
  $runningExecutions.set($runningExecutions.get().filter(e => e.id !== id));
}

export function clearCompletedExecutions(): void {
  $runningExecutions.set(
    $runningExecutions.get().filter(e => e.status === 'running' || e.status === 'waiting')
  );
}

// Get a workflow by ID
export function getWorkflowById(id: string): Workflow | undefined {
  return $workflows.get().find(w => w.id === id);
}

// Load workflows from the backend
export async function loadWorkflows(): Promise<void> {
  $isLoadingWorkflows.set(true);
  try {
    const result = await window.electron.workflows.list();
    console.log('loadWorkflows result:', result);
    if (result.success && result.data) {
      $workflows.set(result.data as Workflow[]);
    } else if (result.error) {
      console.error('Failed to load workflows:', result.error);
    }
  } catch (error) {
    console.error('Failed to load workflows:', error);
  } finally {
    $isLoadingWorkflows.set(false);
  }
}

// Check if workflow has AI service nodes
export function workflowUsesAI(workflow: Workflow): boolean {
  const aiNodeTypes = [
    'n8n-nodes-base.openAi',
    'n8n-nodes-base.anthropic',
    '@n8n/n8n-nodes-langchain',
  ];

  return workflow.nodes.some((node: { type?: string }) =>
    node.type && aiNodeTypes.some(aiType => node.type?.includes(aiType))
  );
}
