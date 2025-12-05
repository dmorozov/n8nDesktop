/**
 * Vitest test setup file
 * Global setup for all unit tests
 */

import { vi } from 'vitest';

// Mock electron modules that are not available in test environment
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      switch (name) {
        case 'userData':
          return '/tmp/test-app-data';
        case 'home':
          return '/tmp/test-home';
        case 'temp':
          return '/tmp';
        default:
          return '/tmp';
      }
    }),
    getName: vi.fn(() => 'n8n-desktop-test'),
    getVersion: vi.fn(() => '1.0.0-test'),
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
    },
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  Tray: vi.fn().mockImplementation(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
  })),
  Menu: {
    buildFromTemplate: vi.fn(),
    setApplicationMenu: vi.fn(),
  },
  nativeTheme: {
    themeSource: 'system',
    shouldUseDarkColors: true,
  },
}));

// Mock electron-store
vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const store = new Map<string, unknown>();
      return {
        get: vi.fn((key: string, defaultValue?: unknown) => store.get(key) ?? defaultValue),
        set: vi.fn((key: string, value: unknown) => store.set(key, value)),
        delete: vi.fn((key: string) => store.delete(key)),
        clear: vi.fn(() => store.clear()),
        has: vi.fn((key: string) => store.has(key)),
        store: Object.fromEntries(store),
        path: '/tmp/test-config.json',
      };
    }),
  };
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
