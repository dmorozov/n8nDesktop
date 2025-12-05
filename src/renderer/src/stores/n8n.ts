import { atom, computed } from 'nanostores';
import type { N8nStatus } from '../../../preload/types';

// Default status when app starts
const defaultStatus: N8nStatus = {
  status: 'stopped',
  port: 5678,
  version: '',
  uptime: 0,
  url: '',
};

// Store for n8n server status
export const $n8nStatus = atom<N8nStatus>(defaultStatus);

// Store for n8n logs
export const $n8nLogs = atom<string[]>([]);

// Store for n8n ready state (authenticated and ready for API calls)
export const $n8nReady = atom<boolean>(false);

// Computed store for whether n8n is running
export const $isN8nRunning = computed($n8nStatus, (status) => status.status === 'running');

// Computed store for whether n8n has an error
export const $hasN8nError = computed($n8nStatus, (status) => status.status === 'error');

// Computed store for n8n URL
export const $n8nUrl = computed($n8nStatus, (status) => status.url);

// Actions
export async function startN8n(): Promise<void> {
  const result = await window.electron.n8n.start();
  if (!result.success && result.error) {
    $n8nStatus.set({
      ...$n8nStatus.get(),
      status: 'error',
      error: result.error,
    });
  }
}

export async function stopN8n(): Promise<void> {
  await window.electron.n8n.stop();
}

export async function restartN8n(): Promise<void> {
  const result = await window.electron.n8n.restart();
  if (!result.success && result.error) {
    $n8nStatus.set({
      ...$n8nStatus.get(),
      status: 'error',
      error: result.error,
    });
  }
}

export async function refreshN8nStatus(): Promise<void> {
  const status = await window.electron.n8n.getStatus();
  $n8nStatus.set(status);
}

export async function refreshN8nLogs(lines?: number): Promise<void> {
  const logs = await window.electron.n8n.getLogs(lines);
  $n8nLogs.set(logs);
}

export async function clearN8nLogs(): Promise<void> {
  await window.electron.n8n.clearLogs();
  $n8nLogs.set([]);
}

// Initialize status subscription
export function initN8nStatusSubscription(): () => void {
  // Get initial status
  refreshN8nStatus();

  // Subscribe to status changes
  const unsubscribeStatus = window.electron.n8n.onStatusChange((status) => {
    $n8nStatus.set(status);
  });

  // Subscribe to ready event (n8n authenticated and ready for API calls)
  const unsubscribeReady = window.electron.n8n.onReady((ready) => {
    console.log('n8n ready event received:', ready);
    $n8nReady.set(ready);
  });

  return () => {
    unsubscribeStatus();
    unsubscribeReady();
  };
}
