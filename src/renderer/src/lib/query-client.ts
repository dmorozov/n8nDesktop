import { QueryClient } from '@tanstack/react-query';

/**
 * Configured TanStack Query client for the application
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 1 minute
      staleTime: 1000 * 60,
      // Retry failed requests once
      retry: 1,
      // Retry with a short delay
      retryDelay: 1000,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
  // n8n server
  n8nStatus: ['n8n', 'status'] as const,
  n8nLogs: (lines?: number) => ['n8n', 'logs', lines] as const,

  // Workflows
  workflows: ['workflows'] as const,
  workflow: (id: string) => ['workflows', id] as const,
  recentWorkflows: ['workflows', 'recent'] as const,

  // AI Services
  aiServices: ['ai-services'] as const,
  aiService: (id: string) => ['ai-services', id] as const,
  aiServiceModels: (id: string) => ['ai-services', id, 'models'] as const,

  // Settings
  settings: ['settings'] as const,
  setting: (key: string) => ['settings', key] as const,
};

/**
 * Invalidate all workflow-related queries
 */
export function invalidateWorkflows(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
}

/**
 * Invalidate all AI service-related queries
 */
export function invalidateAIServices(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.aiServices });
}

/**
 * Invalidate all settings
 */
export function invalidateSettings(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.settings });
}
