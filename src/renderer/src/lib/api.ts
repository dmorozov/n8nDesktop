/**
 * API helpers for communicating with the main process via IPC
 */

export const api = {
  n8n: window.electron.n8n,
  config: window.electron.config,
  dialog: window.electron.dialog,
  shell: window.electron.shell,
};

// Re-export types that are used in renderer
export interface N8nStatus {
  status: 'starting' | 'running' | 'stopped' | 'error';
  port: number;
  version: string;
  uptime: number;
  url: string;
  error?: string;
}

export interface AIServiceConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'custom';
  endpoint: string;
  apiKey?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  firstRunComplete: boolean;
  n8nPort: number;
  dataFolder: string;
  startWithSystem: boolean;
  minimizeToTray: boolean;
  runInBackground: boolean;
  maxConcurrentWorkflows: number;
  aiServices: AIServiceConfig[];
  windowBounds: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    maximized?: boolean;
  };
}
