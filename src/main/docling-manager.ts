import { spawn, execSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';
import { isPortAvailable } from './utils/port-finder';
import { ConfigManager, DoclingConfig } from './config-manager';

export type DoclingServiceStatus = 'starting' | 'running' | 'stopped' | 'error';

export interface DoclingStatus {
  status: DoclingServiceStatus;
  port: number;
  version: string;
  uptime: number;
  url: string;
  error?: string;
  restartAttempts: number;
  pythonAvailable: boolean;
  queueSize: number;
  activeJobs: number;
}

export interface DoclingStartResult {
  success: boolean;
  port?: number;
  error?: string;
}

export interface DoclingHealthResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  processing_tier: string;
  queue_size: number;
  active_jobs: number;
  trace_id?: string;
}

const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds
const STARTUP_TIMEOUT = 60000; // 60 seconds for Python service startup
const SHUTDOWN_TIMEOUT = 5000; // 5 seconds
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_COOLDOWN = 30000; // 30 seconds before resetting restart counter

/**
 * Check if Python 3 is available on the system
 */
async function checkPythonAvailability(): Promise<{ available: boolean; version?: string; path?: string }> {
  const pythonCommands = process.platform === 'win32'
    ? ['python', 'python3', 'py -3']
    : ['python3', 'python'];

  for (const cmd of pythonCommands) {
    try {
      const result = execSync(`${cmd} --version`, {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      // Check if it's Python 3.10+
      const versionMatch = result.match(/Python (\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1], 10);
        const minor = parseInt(versionMatch[2], 10);
        if (major === 3 && minor >= 10) {
          // Get the full path
          const whichCmd = process.platform === 'win32' ? 'where' : 'which';
          const cmdParts = cmd.split(' ')[0]; // Handle 'py -3' case
          try {
            const pythonPath = execSync(`${whichCmd} ${cmdParts}`, {
              encoding: 'utf-8',
              timeout: 5000,
            }).trim().split('\n')[0];
            return { available: true, version: result, path: pythonPath };
          } catch {
            return { available: true, version: result, path: cmd };
          }
        }
      }
    } catch {
      // Try next command
    }
  }

  return { available: false };
}

/**
 * Find the path to the docling service Python package
 */
function findDoclingServicePath(): string {
  const isPackaged = app.isPackaged;

  const possiblePaths: string[] = [];

  if (isPackaged) {
    const resourcesPath = process.resourcesPath;
    possiblePaths.push(
      path.join(resourcesPath, 'app.asar.unpacked', 'src', 'docling'),
      path.join(resourcesPath, 'docling'),
    );
  } else {
    const appPath = app.getAppPath();
    possiblePaths.push(
      path.join(appPath, 'src', 'docling'),
      path.join(appPath, '..', '..', 'src', 'docling'),
      path.join(appPath, '..', '..', '..', 'src', 'docling'),
    );
  }

  for (const servicePath of possiblePaths) {
    const mainPy = path.join(servicePath, 'src', 'docling_service', 'main.py');
    if (fs.existsSync(mainPy)) {
      console.log('Found Docling service at:', servicePath);
      return servicePath;
    }
  }

  console.warn('Docling service not found. Searched:', possiblePaths);
  throw new Error('Docling service not found');
}

export class DoclingManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private configManager: ConfigManager;
  private status: DoclingStatus;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private logs: string[] = [];
  private maxLogLines = 1000;
  private restartAttempts: number = 0;
  private lastRestartTime: number = 0;
  private pythonInfo: { available: boolean; version?: string; path?: string } = { available: false };

  constructor(configManager: ConfigManager) {
    super();
    this.configManager = configManager;
    const config = configManager.getDoclingConfig();
    this.status = {
      status: 'stopped',
      port: config.port,
      version: '',
      uptime: 0,
      url: '',
      restartAttempts: 0,
      pythonAvailable: false,
      queueSize: 0,
      activeJobs: 0,
    };
  }

  /**
   * Check Python availability and cache the result
   */
  async checkPython(): Promise<{ available: boolean; version?: string; path?: string }> {
    this.pythonInfo = await checkPythonAvailability();
    this.status.pythonAvailable = this.pythonInfo.available;
    return this.pythonInfo;
  }

  /**
   * Start the Docling service
   */
  async start(): Promise<DoclingStartResult> {
    if (this.process) {
      return { success: false, error: 'Docling service is already running' };
    }

    const config = this.configManager.getDoclingConfig();

    if (!config.enabled) {
      return { success: false, error: 'Docling service is disabled' };
    }

    // Check Python availability
    if (!this.pythonInfo.available) {
      await this.checkPython();
    }

    if (!this.pythonInfo.available) {
      this.updateStatus({ status: 'error', error: 'Python 3.10+ not found' });
      return { success: false, error: 'Python 3.10+ is required but not found on this system' };
    }

    // Check port availability
    const portAvailable = await isPortAvailable(config.port);
    if (!portAvailable) {
      this.updateStatus({ status: 'error', error: `Port ${config.port} is already in use` });
      return { success: false, error: `Port ${config.port} is already in use` };
    }

    this.updateStatus({ status: 'starting', port: config.port, error: undefined });

    // Find the docling service path
    let servicePath: string;
    try {
      servicePath = findDoclingServicePath();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.updateStatus({ status: 'error', error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Prepare temp folder
    const tempFolder = config.tempFolder || path.join(os.tmpdir(), 'docling');
    if (!fs.existsSync(tempFolder)) {
      fs.mkdirSync(tempFolder, { recursive: true });
    }

    // Build command arguments
    const args = [
      '-m', 'docling_service.main',
      '--host', '127.0.0.1',
      '--port', config.port.toString(),
      '--auth-token', config.authToken,
      '--processing-tier', config.processingTier,
      '--temp-folder', tempFolder,
      '--max-concurrent', config.maxConcurrentJobs.toString(),
    ];

    // Environment variables
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONPATH: path.join(servicePath, 'src'),
      DOCLING_HOST: '127.0.0.1',
      DOCLING_PORT: config.port.toString(),
      DOCLING_AUTH_TOKEN: config.authToken,
      DOCLING_PROCESSING_TIER: config.processingTier,
      DOCLING_TEMP_FOLDER: tempFolder,
      DOCLING_MAX_CONCURRENT_JOBS: config.maxConcurrentJobs.toString(),
    };

    return new Promise((resolve) => {
      try {
        const pythonCmd = this.pythonInfo.path || 'python3';
        const isWindows = process.platform === 'win32';

        this.addLog(`Starting Docling service with: ${pythonCmd}`);
        this.addLog(`Service path: ${servicePath}`);
        this.addLog(`Arguments: ${args.join(' ')}`);

        this.process = spawn(pythonCmd, args, {
          env,
          cwd: servicePath,
          shell: isWindows,
          windowsHide: true,
          detached: !isWindows,
        });

        this.startTime = Date.now();

        // Handle stdout - look for ready signal
        this.process.stdout?.on('data', (data: Buffer) => {
          const output = data.toString();
          this.addLog(output);

          // Check for startup completion signal
          // The Python service prints: DOCLING_READY|host|port
          if (output.includes('DOCLING_READY|')) {
            this.updateStatus({
              status: 'running',
              url: `http://127.0.0.1:${config.port}`,
            });
            this.startHealthCheck();
            this.restartAttempts = 0;
            resolve({ success: true, port: config.port });
          }
        });

        // Handle stderr (structured logs go here)
        this.process.stderr?.on('data', (data: Buffer) => {
          const output = data.toString();
          this.addLog(`[LOG] ${output}`);
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
          this.addLog(`Docling process exited with code ${code}, signal ${signal}`);
          this.stopHealthCheck();
          this.process = null;

          if (this.status.status === 'starting') {
            this.updateStatus({ status: 'error', error: `Docling failed to start (exit code: ${code})` });
            resolve({ success: false, error: `Docling failed to start (exit code: ${code})` });
          } else if (this.status.status === 'running') {
            // Unexpected exit - attempt restart
            this.handleUnexpectedExit();
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
            this.updateStatus({ status: 'error', error: 'Docling startup timeout' });
            this.stop();
            resolve({ success: false, error: 'Docling startup timeout' });
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
   * Handle unexpected service exit
   */
  private async handleUnexpectedExit(): Promise<void> {
    // Reset restart counter if cooldown has passed
    if (Date.now() - this.lastRestartTime > RESTART_COOLDOWN) {
      this.restartAttempts = 0;
    }

    this.restartAttempts++;
    this.lastRestartTime = Date.now();
    this.status.restartAttempts = this.restartAttempts;

    if (this.restartAttempts <= MAX_RESTART_ATTEMPTS) {
      this.addLog(`Attempting restart (${this.restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
      this.emit('restartAttempt', this.restartAttempts, MAX_RESTART_ATTEMPTS);

      // Wait a bit before restarting
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = await this.start();
      if (!result.success) {
        this.addLog(`Restart attempt ${this.restartAttempts} failed: ${result.error}`);
      }
    } else {
      this.addLog(`Max restart attempts (${MAX_RESTART_ATTEMPTS}) exceeded`);
      this.updateStatus({
        status: 'error',
        error: `Service crashed ${MAX_RESTART_ATTEMPTS} times. Manual restart required.`
      });
      this.emit('maxRestartsExceeded');
    }
  }

  /**
   * Stop the Docling service
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

      const forceKillTimeout = setTimeout(() => {
        this.addLog('Force killing Docling process (timeout exceeded)');
        this.killProcessTree(pid, 'SIGKILL');
      }, SHUTDOWN_TIMEOUT);

      proc.once('exit', () => {
        clearTimeout(forceKillTimeout);
        this.process = null;
        this.updateStatus({ status: 'stopped' });
        resolve();
      });

      this.addLog('Sending SIGTERM to Docling process');
      this.killProcessTree(pid, 'SIGTERM');
    });
  }

  /**
   * Kill the entire process tree
   */
  private killProcessTree(pid: number, signal: 'SIGTERM' | 'SIGKILL'): void {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        try {
          process.kill(-pid, signal);
        } catch {
          process.kill(pid, signal);
        }
      }
    } catch (error) {
      this.addLog(`Error killing process tree: ${error}`);
      try {
        process.kill(pid, signal);
      } catch {
        // Process may already be dead
      }
    }
  }

  /**
   * Restart the Docling service
   */
  async restart(): Promise<DoclingStartResult> {
    this.restartAttempts = 0; // Manual restart resets the counter
    await this.stop();
    return this.start();
  }

  /**
   * Get current status
   */
  getStatus(): DoclingStatus {
    return {
      ...this.status,
      uptime: this.status.status === 'running' ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      restartAttempts: this.restartAttempts,
    };
  }

  /**
   * Check if Docling is running
   */
  isRunning(): boolean {
    return this.status.status === 'running' && this.process !== null;
  }

  /**
   * Get the service port
   */
  getPort(): number {
    return this.status.port;
  }

  /**
   * Get the service URL
   */
  getUrl(): string | null {
    if (this.status.status !== 'running') {
      return null;
    }
    return `http://127.0.0.1:${this.status.port}`;
  }

  /**
   * Get the API base URL for HTTP requests
   */
  getApiBaseUrl(): string {
    return `http://127.0.0.1:${this.status.port}/api/v1`;
  }

  /**
   * Get the authentication token
   */
  getAuthToken(): string {
    return this.configManager.getDoclingConfig().authToken;
  }

  /**
   * Get server logs
   */
  getLogs(lines?: number, traceId?: string): string[] {
    let filtered = this.logs;

    if (traceId) {
      filtered = this.logs.filter((log) => log.includes(traceId));
    }

    if (lines && lines < filtered.length) {
      return filtered.slice(-lines);
    }
    return [...filtered];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Perform a health check
   */
  async healthCheck(): Promise<DoclingHealthResponse | null> {
    if (!this.isRunning()) {
      return null;
    }

    try {
      const config = this.configManager.getDoclingConfig();
      const response = await fetch(`${this.getApiBaseUrl()}/health`, {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json() as DoclingHealthResponse;
        this.status.queueSize = data.queue_size;
        this.status.activeJobs = data.active_jobs;
        this.status.version = data.version;
        return data;
      }
    } catch (error) {
      this.addLog(`Health check error: ${error}`);
    }

    return null;
  }

  /**
   * Update status and emit event
   */
  private updateStatus(update: Partial<DoclingStatus>): void {
    this.status = { ...this.status, ...update };
    this.emit('statusChange', this.getStatus());
  }

  /**
   * Add log entry
   */
  private addLog(message: string): void {
    const timestamp = new Date().toISOString();
    this.logs.push(`[${timestamp}] ${message.trim()}`);

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

    const health = await this.healthCheck();
    if (!health) {
      // Health check failed - service might be unresponsive
      if (this.process && !this.process.killed) {
        this.addLog('Health check failed - service unresponsive');
        this.updateStatus({ status: 'error', error: 'Service unresponsive' });
      }
    }
  }
}
