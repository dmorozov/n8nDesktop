import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $n8nStatus,
  $isN8nRunning,
  $hasN8nError,
  $n8nUrl,
  initN8nStatusSubscription,
  startN8n,
  stopN8n,
  restartN8n,
  refreshN8nStatus,
} from '@/stores/n8n';
import type { N8nStatus } from '../../../preload/types';

interface UseN8nStatusResult {
  status: N8nStatus;
  isRunning: boolean;
  hasError: boolean;
  url: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for accessing n8n server status with real-time updates.
 * Automatically subscribes to status changes when mounted and
 * unsubscribes when unmounted.
 */
export function useN8nStatus(): UseN8nStatusResult {
  const status = useStore($n8nStatus);
  const isRunning = useStore($isN8nRunning);
  const hasError = useStore($hasN8nError);
  const url = useStore($n8nUrl);

  // Set up real-time subscription on mount
  useEffect(() => {
    const unsubscribe = initN8nStatusSubscription();
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    status,
    isRunning,
    hasError,
    url,
    start: startN8n,
    stop: stopN8n,
    restart: restartN8n,
    refresh: refreshN8nStatus,
  };
}

/**
 * Lightweight hook that only subscribes to status without
 * setting up real-time updates. Use this in components that
 * don't need to manage the subscription lifecycle.
 */
export function useN8nStatusValue(): N8nStatus {
  return useStore($n8nStatus);
}
