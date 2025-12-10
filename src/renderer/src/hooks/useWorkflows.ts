import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { setWorkflows, type Workflow } from '@/stores/workflows';

interface WorkflowListResult {
  success: boolean;
  data?: Workflow[];
  error?: string;
}

interface WorkflowResult {
  success: boolean;
  data?: Workflow;
  error?: string;
}

// Export for potential future use
export type { WorkflowResult };

/**
 * Hook for fetching all workflows
 */
export function useWorkflows() {
  return useQuery({
    queryKey: queryKeys.workflows,
    queryFn: async (): Promise<Workflow[]> => {
      const result: WorkflowListResult = await (window as Window).electron.config.getAll()
        .then(() => fetch('http://localhost:5678/api/v1/workflows'))
        .then((res) => res.json())
        .catch(() => ({ success: false, data: [] }));

      // For now, return mock data until IPC is wired up
      // In production, this would use window.electron.workflows.list()
      const workflows = result.data || [];
      setWorkflows(workflows);
      return workflows;
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook for fetching a single workflow
 */
export function useWorkflow(id: string) {
  return useQuery({
    queryKey: queryKeys.workflow(id),
    queryFn: async (): Promise<Workflow | null> => {
      // TODO: Use window.electron.workflows.get(id) when available
      return null;
    },
    enabled: !!id,
  });
}

/**
 * Hook for fetching recent workflows
 */
export function useRecentWorkflows() {
  return useQuery({
    queryKey: queryKeys.recentWorkflows,
    queryFn: async (): Promise<Workflow[]> => {
      // TODO: Use window.electron.workflows.getRecent() when available
      return [];
    },
  });
}

/**
 * Hook for creating a workflow
 */
export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_workflow: Partial<Workflow>): Promise<Workflow> => {
      // TODO: Use window.electron.workflows.create(workflow) when available
      throw new Error('Not implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    },
  });
}

/**
 * Hook for updating a workflow
 */
export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id: _id, updates: _updates }: { id: string; updates: Partial<Workflow> }): Promise<Workflow> => {
      // TODO: Use window.electron.workflows.update(id, updates) when available
      throw new Error('Not implemented');
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow(id) });
    },
  });
}

/**
 * Hook for deleting a workflow
 */
export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_id: string): Promise<void> => {
      // TODO: Use window.electron.workflows.delete(id) when available
      throw new Error('Not implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentWorkflows });
    },
  });
}

/**
 * Hook for duplicating a workflow
 */
export function useDuplicateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_id: string): Promise<Workflow> => {
      // TODO: Use window.electron.workflows.duplicate(id) when available
      throw new Error('Not implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    },
  });
}

/**
 * Hook for executing a workflow
 */
export function useExecuteWorkflow() {
  return useMutation({
    mutationFn: async (_id: string): Promise<{ executionId: string }> => {
      // TODO: Use window.electron.workflows.execute(id) when available
      throw new Error('Not implemented');
    },
  });
}

/**
 * Hook for stopping a workflow execution
 */
export function useStopExecution() {
  return useMutation({
    mutationFn: async (_executionId: string): Promise<void> => {
      // TODO: Use window.electron.workflows.stopExecution(executionId) when available
      throw new Error('Not implemented');
    },
  });
}
