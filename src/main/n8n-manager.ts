import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { isPortAvailable } from './utils/port-finder';
import { ConfigManager } from './config-manager';

export interface N8nStatus {
  status: 'starting' | 'running' | 'stopped' | 'error';
  port: number;
  version: string;
  uptime: number;
  url: string;
  error?: string;
}

export interface N8nStartResult {
  success: boolean;
  port?: number;
  error?: string;
}

const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds
const STARTUP_TIMEOUT = 60000; // 60 seconds
const SHUTDOWN_TIMEOUT = 5000; // 5 seconds (per spec)

export class N8nManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private configManager: ConfigManager;
  private status: N8nStatus;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private logs: string[] = [];
  private maxLogLines = 1000;

  constructor(configManager: ConfigManager) {
    super();
    this.configManager = configManager;
    this.status = {
      status: 'stopped',
      port: configManager.get('n8nPort') ?? 5678,
      version: '',
      uptime: 0,
      url: '',
    };
  }

  /**
   * Start the n8n server
   */
  async start(): Promise<N8nStartResult> {
    if (this.process) {
      return { success: false, error: 'n8n is already running' };
    }

    const port = this.configManager.get('n8nPort') ?? 5678;
    const dataFolder = this.configManager.get('dataFolder');

    if (!dataFolder) {
      return { success: false, error: 'Data folder not configured' };
    }

    // Check if port is available
    const portAvailable = await isPortAvailable(port);
    if (!portAvailable) {
      this.updateStatus({ status: 'error', error: `Port ${port} is already in use` });
      return { success: false, error: `Port ${port} is already in use` };
    }

    this.updateStatus({ status: 'starting', port, error: undefined });

    // Ensure n8n data folder exists
    const n8nFolder = path.join(dataFolder, '.n8n');
    if (!fs.existsSync(n8nFolder)) {
      fs.mkdirSync(n8nFolder, { recursive: true });
    }

    // Environment variables for n8n
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      N8N_PORT: port.toString(),
      N8N_HOST: 'localhost',
      N8N_LISTEN_ADDRESS: '127.0.0.1',
      N8N_USER_FOLDER: n8nFolder,
      DB_TYPE: 'sqlite',
      N8N_DIAGNOSTICS_ENABLED: 'false',
      N8N_PERSONALIZATION_ENABLED: 'false',
      N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
      N8N_TEMPLATES_ENABLED: 'false',
      // Disable external connections for security
      N8N_HIRING_BANNER_ENABLED: 'false',
    };

    return new Promise((resolve) => {
      try {
        // Spawn n8n process
        // On Unix-like systems, use detached: true to create a new process group
        // This allows us to kill the entire process tree with process.kill(-pid, signal)
        // On Windows, we'll use taskkill /T to kill the tree
        const isWindows = process.platform === 'win32';
        this.process = spawn('npx', ['n8n', 'start'], {
          env,
          shell: isWindows, // Only use shell on Windows for npx
          windowsHide: true,
          detached: !isWindows, // Create new process group on Unix for clean shutdown
        });

        this.startTime = Date.now();

        // Handle stdout
        this.process.stdout?.on('data', (data: Buffer) => {
          const output = data.toString();
          this.addLog(output);

          // Check for startup completion
          if (output.includes('Editor is now accessible via')) {
            this.updateStatus({
              status: 'running',
              url: `http://localhost:${port}`,
            });
            this.startHealthCheck();
            resolve({ success: true, port });
          }
        });

        // Handle stderr
        this.process.stderr?.on('data', (data: Buffer) => {
          const output = data.toString();
          this.addLog(`[ERROR] ${output}`);
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
          this.addLog(`n8n process exited with code ${code}, signal ${signal}`);
          this.stopHealthCheck();
          this.process = null;

          if (this.status.status === 'starting') {
            this.updateStatus({ status: 'error', error: `n8n failed to start (exit code: ${code})` });
            resolve({ success: false, error: `n8n failed to start (exit code: ${code})` });
          } else {
            this.updateStatus({ status: 'stopped' });
          }
        });

        // Handle process error
        this.process.on('error', (error) => {
          this.addLog(`[ERROR] Process error: ${error.message}`);
          this.updateStatus({ status: 'error', error: error.message });
          resolve({ success: false, error: error.message });
        });

        // Timeout for startup
        setTimeout(() => {
          if (this.status.status === 'starting') {
            this.updateStatus({ status: 'error', error: 'n8n startup timeout' });
            this.stop();
            resolve({ success: false, error: 'n8n startup timeout' });
          }
        }, STARTUP_TIMEOUT);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.updateStatus({ status: 'error', error: errorMessage });
        resolve({ success: false, error: errorMessage });
      }
    });
  }

  /**
   * Stop the n8n server
   */
  async stop(): Promise<void> {
    this.stopHealthCheck();

    if (!this.process) {
      this.updateStatus({ status: 'stopped' });
      return;
    }

    return new Promise((resolve) => {
      const proc = this.process;
      if (!proc || !proc.pid) {
        this.process = null;
        this.updateStatus({ status: 'stopped' });
        resolve();
        return;
      }

      const pid = proc.pid;

      // Set up timeout for force kill
      const forceKillTimeout = setTimeout(() => {
        this.addLog('Force killing n8n process tree (timeout exceeded)');
        this.killProcessTree(pid, 'SIGKILL');
      }, SHUTDOWN_TIMEOUT);

      // Handle clean exit
      proc.once('exit', () => {
        clearTimeout(forceKillTimeout);
        this.process = null;
        this.updateStatus({ status: 'stopped' });
        resolve();
      });

      // Send SIGTERM to the entire process tree for graceful shutdown
      this.addLog('Sending SIGTERM to n8n process tree');
      this.killProcessTree(pid, 'SIGTERM');
    });
  }

  /**
   * Kill the entire process tree (including child processes)
   */
  private killProcessTree(pid: number, signal: 'SIGTERM' | 'SIGKILL'): void {
    try {
      if (process.platform === 'win32') {
        // On Windows, use taskkill to kill the process tree
        const { execSync } = require('child_process');
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        // On Unix-like systems, kill the process group
        // First try to kill the process group (negative PID)
        try {
          process.kill(-pid, signal);
        } catch {
          // If process group kill fails, try direct kill
          process.kill(pid, signal);
        }
      }
    } catch (error) {
      this.addLog(`Error killing process tree: ${error}`);
      // Last resort: try direct kill
      try {
        process.kill(pid, signal);
      } catch {
        // Process may already be dead
      }
    }
  }

  /**
   * Restart the n8n server
   */
  async restart(): Promise<N8nStartResult> {
    await this.stop();
    return this.start();
  }

  /**
   * Get current status
   */
  getStatus(): N8nStatus {
    return {
      ...this.status,
      uptime: this.status.status === 'running' ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
    };
  }

  /**
   * Check if n8n is running
   */
  isRunning(): boolean {
    return this.status.status === 'running' && this.process !== null;
  }

  /**
   * Get the n8n server port
   */
  getPort(): number {
    return this.status.port;
  }

  /**
   * Get the n8n server URL
   */
  getUrl(): string | null {
    if (this.status.status !== 'running') {
      return null;
    }
    return `http://localhost:${this.status.port}`;
  }

  /**
   * Check if there are any running workflow executions
   * This is a placeholder - in a full implementation, this would
   * query the n8n API for active executions
   */
  hasRunningWorkflows(): boolean {
    // For now, return false as a placeholder
    // In a full implementation, this would check the n8n API
    // GET /api/v1/executions?status=running
    return false;
  }

  /**
   * Get server logs
   */
  getLogs(lines?: number): string[] {
    if (lines && lines < this.logs.length) {
      return this.logs.slice(-lines);
    }
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Update status and emit event
   */
  private updateStatus(update: Partial<N8nStatus>): void {
    this.status = { ...this.status, ...update };
    this.emit('statusChange', this.getStatus());
  }

  /**
   * Add log entry
   */
  private addLog(message: string): void {
    const timestamp = new Date().toISOString();
    this.logs.push(`[${timestamp}] ${message.trim()}`);

    // Keep logs within limit
    if (this.logs.length > this.maxLogLines) {
      this.logs = this.logs.slice(-this.maxLogLines);
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(() => this.checkHealth(), HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop health check interval
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check server health
   */
  private async checkHealth(): Promise<void> {
    if (!this.process || this.status.status !== 'running') {
      return;
    }

    try {
      const response = await fetch(`http://localhost:${this.status.port}/healthz`);
      if (!response.ok) {
        this.updateStatus({ status: 'error', error: 'Health check failed' });
      }
    } catch {
      // Health check endpoint might not exist in all n8n versions
      // Just verify process is still running
      if (!this.process || this.process.killed) {
        this.updateStatus({ status: 'stopped' });
      }
    }
  }
}
