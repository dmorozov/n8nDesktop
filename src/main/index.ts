import { app, BrowserWindow, BrowserView, ipcMain, Menu, Tray, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc-handlers';
import { N8nManager } from './n8n-manager';
import { ConfigManager } from './config-manager';
import { UpdateChecker } from './services/update-checker';
import { registerUpdateHandlers } from './ipc-handlers/updates';
import { N8nAuthManager } from './services/n8n-auth-manager';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
const handleSquirrelStartup = async () => {
  if (process.platform === 'win32') {
    try {
      const { default: squirrelStartup } = await import('electron-squirrel-startup');
      if (squirrelStartup) {
        app.quit();
      }
    } catch {
      // electron-squirrel-startup not available, continue
    }
  }
};
handleSquirrelStartup();

// Global references
let mainWindow: BrowserWindow | null = null;
let editorView: BrowserView | null = null;
let tray: Tray | null = null;
let n8nManager: N8nManager | null = null;
let configManager: ConfigManager | null = null;
let updateChecker: UpdateChecker | null = null;
let authManager: N8nAuthManager | null = null;
let isEditorVisible = false;
let isQuitting = false; // Flag to track if we're actually quitting

// Sidebar width for minimized sidebar when editor is visible
const MINIMIZED_SIDEBAR_WIDTH = 64;

// Declare vite dev server URL (injected by Electron Forge)
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// BrowserView management for n8n editor embedding
const createEditorView = (): BrowserView => {
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  return view;
};

const showEditor = async (workflowId?: string): Promise<void> => {
  if (!mainWindow || !n8nManager || !authManager) return;

  const n8nUrl = n8nManager.getUrl();
  if (!n8nUrl) {
    console.error('n8n server not running');
    return;
  }

  // Create editor view if it doesn't exist
  if (!editorView) {
    editorView = createEditorView();
  }

  // Inject session cookie into BrowserView before loading
  const cookieValue = authManager.getSessionCookieValue();
  if (cookieValue) {
    const port = authManager.getN8nPort();
    try {
      await editorView.webContents.session.cookies.set({
        url: `http://localhost:${port}`,
        name: 'n8n-auth',
        value: cookieValue,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
      console.log('Session cookie injected into BrowserView');
    } catch (error) {
      console.error('Failed to inject session cookie:', error);
    }
  } else {
    console.warn('No session cookie available, n8n may show login screen');
  }

  // Attach to window
  mainWindow.setBrowserView(editorView);

  // Set bounds to leave space for minimized sidebar on the left
  const bounds = mainWindow.getContentBounds();
  editorView.setBounds({
    x: MINIMIZED_SIDEBAR_WIDTH,
    y: 0,
    width: bounds.width - MINIMIZED_SIDEBAR_WIDTH,
    height: bounds.height,
  });

  // Configure auto-resize (note: we need to manually handle resize for the sidebar offset)
  editorView.setAutoResize({
    width: true,
    height: true,
    horizontal: false,
    vertical: false,
  });

  // Handle window resize to maintain sidebar space
  const handleResize = () => {
    if (editorView && mainWindow && isEditorVisible) {
      const newBounds = mainWindow.getContentBounds();
      editorView.setBounds({
        x: MINIMIZED_SIDEBAR_WIDTH,
        y: 0,
        width: newBounds.width - MINIMIZED_SIDEBAR_WIDTH,
        height: newBounds.height,
      });
    }
  };

  // Remove any existing listener and add new one
  mainWindow.removeAllListeners('resize');
  mainWindow.on('resize', handleResize);

  // Load n8n editor URL
  const editorUrl = workflowId
    ? `${n8nUrl}/workflow/${workflowId}`
    : `${n8nUrl}/workflow/new`;

  editorView.webContents.loadURL(editorUrl);
  isEditorVisible = true;

  // Notify renderer that editor is visible
  mainWindow.webContents.send('editor:visibilityChanged', true);
};

const hideEditor = (): void => {
  if (!mainWindow) return;

  if (editorView) {
    mainWindow.removeBrowserView(editorView);
  }
  isEditorVisible = false;

  // Notify renderer that editor is hidden
  mainWindow.webContents.send('editor:visibilityChanged', false);
};

const isEditorShowing = (): boolean => {
  return isEditorVisible;
};

const createWindow = (): void => {
  // Get stored window bounds
  const windowBounds = configManager?.getWindowBounds();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: windowBounds?.width ?? 1200,
    height: windowBounds?.height ?? 800,
    x: windowBounds?.x,
    y: windowBounds?.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Restore maximized state
  if (windowBounds?.maximized) {
    mainWindow.maximize();
  }

  // Load the index.html or dev server
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Save window bounds on close
  mainWindow.on('close', (event) => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      const maximized = mainWindow.isMaximized();
      configManager?.setWindowBounds({
        ...bounds,
        maximized,
      });
    }

    // If not quitting, hide to tray instead of closing (minimize-to-tray on close)
    const minimizeToTray = configManager?.get('minimizeToTray') ?? true;
    const runInBackground = configManager?.get('runInBackground') ?? true;

    if (!isQuitting && minimizeToTray && runInBackground && tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Handle minimize to tray
  mainWindow.on('minimize', () => {
    const minimizeToTray = configManager?.get('minimizeToTray') ?? true;
    if (minimizeToTray && tray) {
      mainWindow?.hide();
    }
  });

  // Open the DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

const createTray = (): void => {
  // Create tray icon - try multiple paths, fallback to generated icon
  const possiblePaths = [
    path.join(__dirname, '../../resources/icon.png'),
    path.join(__dirname, '../resources/icon.png'),
    path.join(app.getAppPath(), 'resources/icon.png'),
  ];

  let trayIcon: nativeImage | null = null;

  // Try to load icon from possible paths
  for (const iconPath of possiblePaths) {
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        trayIcon = icon;
        break;
      }
    } catch {
      // Continue to next path
    }
  }

  // If no icon found, create a simple colored icon programmatically
  if (!trayIcon || trayIcon.isEmpty()) {
    // Create a simple 16x16 green circle icon as fallback
    // Using a data URL for a simple green circle SVG converted to PNG-compatible format
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4); // RGBA

    // Create a simple green circle
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 1;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
          // Green color (n8n brand-ish)
          canvas[idx] = 34;     // R
          canvas[idx + 1] = 197; // G
          canvas[idx + 2] = 94;  // B
          canvas[idx + 3] = 255; // A
        } else {
          // Transparent
          canvas[idx] = 0;
          canvas[idx + 1] = 0;
          canvas[idx + 2] = 0;
          canvas[idx + 3] = 0;
        }
      }
    }

    trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  tray = new Tray(trayIcon);

  const updateTrayMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Window',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      { type: 'separator' },
      {
        label: n8nManager?.isRunning() ? 'Server: Running' : 'Server: Stopped',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: async () => {
          await gracefulShutdown();
        },
      },
    ]);
    tray?.setContextMenu(contextMenu);
  };

  updateTrayMenu();

  // Update tray tooltip based on n8n status
  const updateTrayStatus = () => {
    const status = n8nManager?.getStatus();
    if (status) {
      const statusText = status.status === 'running'
        ? `n8n AI Runner - Running on port ${status.port}`
        : status.status === 'error'
        ? `n8n AI Runner - Error: ${status.error || 'Unknown'}`
        : 'n8n AI Runner - Stopped';
      tray?.setToolTip(statusText);
    }
    updateTrayMenu();
  };

  // Update tray when status changes
  n8nManager?.on('statusChange', updateTrayStatus);
  updateTrayStatus();

  // Show window on tray icon click
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
};

// Graceful shutdown with 5-second timeout
const gracefulShutdown = async (): Promise<void> => {
  isQuitting = true;

  // Check for running workflows
  if (n8nManager?.hasRunningWorkflows()) {
    const { dialog } = await import('electron');
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Workflows Running',
      message: 'There are workflows currently running. Are you sure you want to exit?',
      detail: 'Running workflows will be terminated.',
      buttons: ['Cancel', 'Exit Anyway'],
      defaultId: 0,
      cancelId: 0,
    });

    if (result.response === 0) {
      isQuitting = false;
      return;
    }
  }

  // Stop n8n with 5-second timeout
  if (n8nManager?.isRunning()) {
    const shutdownPromise = n8nManager.stop();
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('Shutdown timeout reached, forcing quit');
        resolve();
      }, 5000);
    });

    await Promise.race([shutdownPromise, timeoutPromise]);
  }

  app.quit();
};

const initializeApp = async (): Promise<void> => {
  // Initialize config manager
  configManager = new ConfigManager();

  // Initialize n8n manager
  n8nManager = new N8nManager(configManager);

  // Initialize auth manager
  authManager = new N8nAuthManager(configManager);

  // Initialize update checker
  updateChecker = new UpdateChecker();

  // Forward n8n status changes to renderer
  n8nManager.on('statusChange', (status) => {
    mainWindow?.webContents.send('n8n:statusChange', status);
  });

  // Register IPC handlers (pass authManager for authenticated API calls)
  registerIpcHandlers(ipcMain, n8nManager, configManager, authManager);

  // Register update handlers
  registerUpdateHandlers(ipcMain, updateChecker, () => mainWindow);

  // Create main window
  createWindow();

  // Create system tray
  createTray();

  // Start n8n server if not first run
  if (configManager.get('firstRunComplete')) {
    try {
      const result = await n8nManager.start();
      if (result.success) {
        // After server starts, set up owner account automatically
        await setupN8nOwner();
      }
    } catch (error) {
      console.error('Failed to start n8n server:', error);
      // Error will be shown in UI via status
    }
  }

  // Start auto-checking for updates (after window is created)
  updateChecker.startAutoCheck();
};

/**
 * Set up n8n owner account automatically after server starts
 */
const setupN8nOwner = async (): Promise<void> => {
  if (!authManager) return;

  try {
    console.log('Setting up n8n owner account...');

    // Wait for n8n to be fully ready for API calls
    const ready = await authManager.waitForN8nReady();
    if (!ready) {
      console.error('n8n server not ready for API calls');
      return;
    }

    // Set up owner and authenticate
    const authenticated = await authManager.ensureAuthenticated();
    if (authenticated) {
      console.log('n8n owner account setup and authentication successful');
      // Notify renderer that n8n is ready
      mainWindow?.webContents.send('n8n:ready', true);
    } else {
      console.error('Failed to set up n8n owner account or authenticate');
      mainWindow?.webContents.send('n8n:ready', false);
    }
  } catch (error) {
    console.error('Error during n8n owner setup:', error);
    mainWindow?.webContents.send('n8n:ready', false);
  }
};

// This method will be called when Electron has finished initialization
app.whenReady().then(initializeApp);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit - ensure n8n server is stopped
app.on('before-quit', async (event) => {
  // If already quitting or n8n is not running, let it proceed
  if (isQuitting || !n8nManager?.isRunning()) {
    return;
  }

  // Prevent default to handle shutdown gracefully
  event.preventDefault();

  // Perform graceful shutdown
  await gracefulShutdown();
});

// Export for IPC handlers to access
export { mainWindow, n8nManager, configManager, authManager, showEditor, hideEditor, isEditorShowing };
