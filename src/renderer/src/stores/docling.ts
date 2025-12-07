/**
 * Docling service state management using nanostores.
 *
 * Follows the same patterns as n8n.ts for service lifecycle management.
 */
import { atom, computed } from 'nanostores';
import type {
  DoclingStatus,
  DoclingConfig,
  DoclingJobStatus,
  DoclingPythonInfo,
  DiskSpaceInfo,
} from '../../../preload/types';

// Default status when app starts
const defaultStatus: DoclingStatus = {
  status: 'stopped',
  port: 8765,
  version: '',
  uptime: 0,
  url: '',
  restartAttempts: 0,
  pythonAvailable: false,
  queueSize: 0,
  activeJobs: 0,
};

// Default config
const defaultConfig: DoclingConfig = {
  enabled: true,
  processingTier: 'standard',
  tempFolder: '',
  maxConcurrentJobs: 1,
  timeoutAction: 'notify',
  port: 8765,
  authToken: '',
};

// Store for Docling service status
export const $doclingStatus = atom<DoclingStatus>(defaultStatus);

// Store for Docling configuration
export const $doclingConfig = atom<DoclingConfig>(defaultConfig);

// Store for Docling logs
export const $doclingLogs = atom<string[]>([]);

// Store for Python availability info
export const $pythonInfo = atom<DoclingPythonInfo>({ available: false });

// Store for active jobs
export const $doclingJobs = atom<DoclingJobStatus[]>([]);

// Store for disk space info
export interface TempFolderDiskSpace {
  path: string;
  diskSpace?: DiskSpaceInfo;
  error?: string;
}
export const $tempFolderDiskSpace = atom<TempFolderDiskSpace | null>(null);

// Computed store for whether Docling is running
export const $isDoclingRunning = computed(
  $doclingStatus,
  (status) => status.status === 'running'
);

// Computed store for whether Docling has an error
export const $hasDoclingError = computed(
  $doclingStatus,
  (status) => status.status === 'error'
);

// Computed store for Docling URL
export const $doclingUrl = computed($doclingStatus, (status) => status.url);

// Computed store for whether Python is available
export const $isPythonAvailable = computed(
  $pythonInfo,
  (info) => info.available
);

// Computed store for queue status
export const $doclingQueueStatus = computed($doclingStatus, (status) => ({
  queueSize: status.queueSize,
  activeJobs: status.activeJobs,
  isProcessing: status.activeJobs > 0,
}));

// Actions - Service Management
export async function startDocling(): Promise<void> {
  const result = await window.electron.docling.start();
  if (!result.success && result.error) {
    $doclingStatus.set({
      ...$doclingStatus.get(),
      status: 'error',
      error: result.error,
    });
  }
}

export async function stopDocling(): Promise<void> {
  await window.electron.docling.stop();
}

export async function restartDocling(): Promise<void> {
  const result = await window.electron.docling.restart();
  if (!result.success && result.error) {
    $doclingStatus.set({
      ...$doclingStatus.get(),
      status: 'error',
      error: result.error,
    });
  }
}

export async function refreshDoclingStatus(): Promise<void> {
  const status = await window.electron.docling.getStatus();
  $doclingStatus.set(status);
}

export async function refreshDoclingConfig(): Promise<void> {
  const config = await window.electron.docling.getConfig();
  $doclingConfig.set(config);
}

export async function updateDoclingConfig(
  updates: Partial<DoclingConfig>
): Promise<void> {
  const newConfig = await window.electron.docling.updateConfig(updates);
  $doclingConfig.set(newConfig);
}

export async function checkPython(): Promise<DoclingPythonInfo> {
  const info = await window.electron.docling.checkPython();
  $pythonInfo.set(info);
  return info;
}

// Actions - Temp Folder
export async function refreshTempFolderDiskSpace(): Promise<void> {
  const result = await window.electron.docling.getTempFolderDiskSpace();
  $tempFolderDiskSpace.set({
    path: result.path,
    diskSpace: result.success ? result.diskSpace : undefined,
    error: result.error,
  });
}

export async function selectTempFolder(): Promise<{ success: boolean; path?: string; error?: string }> {
  const result = await window.electron.docling.selectTempFolder();
  if (result.success && result.path) {
    await refreshDoclingConfig();
    await refreshTempFolderDiskSpace();
  }
  return result;
}

export async function validateTempFolder(folderPath: string): Promise<{ valid: boolean; message: string }> {
  return window.electron.docling.validateTempFolder(folderPath);
}

// Actions - Job Management
export async function refreshDoclingJobs(): Promise<void> {
  const jobs = await window.electron.docling.listJobs();
  $doclingJobs.set(jobs);
}

export async function cancelDoclingJob(jobId: string): Promise<void> {
  await window.electron.docling.cancelJob(jobId);
  await refreshDoclingJobs();
}

// Actions - Logs
export async function refreshDoclingLogs(
  lines?: number,
  traceId?: string
): Promise<void> {
  const logs = await window.electron.docling.getLogs(lines, traceId);
  $doclingLogs.set(logs);
}

export async function clearDoclingLogs(): Promise<void> {
  await window.electron.docling.clearLogs();
  $doclingLogs.set([]);
}

// Initialize status subscription
export function initDoclingStatusSubscription(): () => void {
  // Get initial status and config
  refreshDoclingStatus();
  refreshDoclingConfig();
  checkPython();

  // Subscribe to status changes
  const unsubscribeStatus = window.electron.docling.onStatusChange((status) => {
    $doclingStatus.set(status);
  });

  // Subscribe to restart attempts
  const unsubscribeRestart = window.electron.docling.onRestartAttempt(
    (attempt, maxAttempts) => {
      console.log(`Docling restart attempt ${attempt}/${maxAttempts}`);
      $doclingStatus.set({
        ...$doclingStatus.get(),
        restartAttempts: attempt,
      });
    }
  );

  // Subscribe to max restarts exceeded
  const unsubscribeMaxRestarts = window.electron.docling.onMaxRestartsExceeded(
    () => {
      console.log('Docling max restarts exceeded');
      $doclingStatus.set({
        ...$doclingStatus.get(),
        status: 'error',
        error:
          'Service crashed repeatedly. Manual restart required.',
      });
    }
  );

  return () => {
    unsubscribeStatus();
    unsubscribeRestart();
    unsubscribeMaxRestarts();
  };
}

// Tier descriptions for UI
export const TIER_DESCRIPTIONS: Record<
  DoclingConfig['processingTier'],
  { name: string; description: string; ramEstimate: string }
> = {
  lightweight: {
    name: 'Lightweight',
    description: 'Fast processing with basic OCR. Best for simple documents.',
    ramEstimate: '2-4 GB',
  },
  standard: {
    name: 'Standard',
    description: 'Balanced processing with table and code detection.',
    ramEstimate: '4-8 GB',
  },
  advanced: {
    name: 'Advanced',
    description: 'Full VLM pipeline with equation and chart recognition.',
    ramEstimate: '8-16 GB',
  },
};

// Timeout action descriptions for UI
export const TIMEOUT_ACTION_DESCRIPTIONS: Record<
  DoclingConfig['timeoutAction'],
  { name: string; description: string }
> = {
  cancel: {
    name: 'Cancel Job',
    description: 'Automatically cancel the job when timeout is exceeded.',
  },
  extend: {
    name: 'Extend Timeout',
    description: 'Automatically extend the timeout and continue processing.',
  },
  notify: {
    name: 'Notify User',
    description: 'Show a notification asking what to do.',
  },
};
