# n8n Desktop - Architecture Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [Main Process (Electron)](#5-main-process-electron)
6. [n8n Server Integration](#6-n8n-server-integration)
7. [Authentication System](#7-authentication-system)
8. [Renderer Process (React)](#8-renderer-process-react)
9. [IPC Communication](#9-ipc-communication)
10. [State Management](#10-state-management)
11. [UI Component Architecture](#11-ui-component-architecture)
12. [Data Flow Patterns](#12-data-flow-patterns)
13. [Configuration & Storage](#13-configuration--storage)
14. [Build & Packaging](#14-build--packaging)
15. [Security Considerations](#15-security-considerations)
16. [Key Implementation Details](#16-key-implementation-details)

---

## 1. Project Overview

**n8n Desktop** (branded as "n8n AI Runner") is an Electron-based desktop application that wraps the n8n workflow automation server, providing a native desktop experience for non-technical users who want to run AI workflows locally.

### Core Principles

1. **User-First Simplicity**: No CLI required, automatic user creation/login, standard installers
2. **Data Portability**: All data in user-selected folder, fully portable between machines
3. **Bundled Self-Containment**: Node.js + n8n bundled as production dependency, no external dependencies required
4. **Transparent Server Lifecycle**: Auto-start, tray icon status, graceful shutdown
5. **Seamless n8n Integration**: Embedded editor via BrowserView with automatic authentication

### Application Identity

- **Package Name**: `n8n-desktop`
- **Product Name**: `n8n AI Runner`
- **App Bundle ID**: `com.n8n.desktop`
- **License**: MIT

---

## 2. Technology Stack

### Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 33.0.0 | Desktop application shell |
| React | 18.3.1 | UI framework |
| TypeScript | 5.6.0 | Type-safe JavaScript |
| Vite | 5.4.0 | Build tool & dev server |
| n8n | 2.0.0 | Workflow automation engine (bundled) |

### UI & Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| TailwindCSS | 4.1.17 | Utility-first CSS framework |
| Radix UI | Various | Headless UI primitives |
| Lucide React | 0.460.0 | Icon library |
| class-variance-authority | 0.7.0 | Component variant management |

### State Management & Data

| Technology | Version | Purpose |
|------------|---------|---------|
| nanostores | 0.11.0 | Lightweight reactive state |
| @nanostores/react | 0.7.3 | React bindings for nanostores |
| @tanstack/react-query | 5.60.0 | Server state & caching |
| electron-store | 10.0.0 | Persistent configuration storage |
| axios | 1.7.0 | HTTP client for n8n API |

### Build & Development

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron Forge | 7.5.0 | Build, package, and publish |
| ESLint | 9.0.0 | Code linting |
| Prettier | 3.0.0 | Code formatting |
| Vitest | 2.1.0 | Unit testing |
| Playwright | 1.48.0 | End-to-end testing |

### Platform Packaging

| Maker | Target Platform |
|-------|-----------------|
| MakerSquirrel | Windows (.exe installer) |
| MakerDMG | macOS (.dmg installer) |
| MakerZIP | Cross-platform (.zip archive) |

---

## 3. Project Structure

```
n8nDesktop/
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # Application entry point
│   │   ├── config-manager.ts      # Configuration persistence
│   │   ├── n8n-manager.ts         # n8n server lifecycle
│   │   ├── ipc-handlers/          # IPC request handlers
│   │   │   ├── index.ts           # Main IPC registration
│   │   │   ├── workflows.ts       # Workflow API handlers
│   │   │   ├── storage.ts         # Storage operations
│   │   │   └── updates.ts         # Update checking
│   │   ├── services/              # Business logic services
│   │   │   ├── n8n-auth-manager.ts    # n8n authentication
│   │   │   ├── ai-service-tester.ts   # AI service testing
│   │   │   ├── backup-manager.ts      # Backup operations
│   │   │   └── update-checker.ts      # Version checking
│   │   └── utils/                 # Utility functions
│   │       └── port-finder.ts     # Port availability checking
│   │
│   ├── preload/                   # Preload scripts (IPC bridge)
│   │   ├── index.ts               # API exposure to renderer
│   │   └── types.ts               # Shared type definitions
│   │
│   └── renderer/                  # React renderer process
│       └── src/
│           ├── main.tsx           # React entry point
│           ├── App.tsx            # Root component
│           ├── components/        # UI components
│           │   ├── layout/        # Layout components
│           │   ├── ui/            # Base UI components (Shadcn)
│           │   └── features/      # Feature-specific components
│           ├── pages/             # Page components
│           ├── stores/            # Nanostores state
│           ├── hooks/             # Custom React hooks
│           ├── lib/               # Utilities & helpers
│           └── styles/            # Global CSS
│
├── resources/                     # Application assets
│   ├── icon.png                   # App icon (PNG)
│   ├── icon.ico                   # Windows icon
│   └── icon.icns                  # macOS icon
│
├── tests/                         # Test suites
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── e2e/                       # End-to-end tests
│
├── specs/                         # Feature specifications
├── documentation/                 # Documentation
│   └── design/                    # UI design screenshots
│
├── forge.config.mts               # Electron Forge configuration
├── vite.main.config.mts           # Vite config for main process
├── vite.preload.config.mts        # Vite config for preload
├── vite.renderer.config.mts       # Vite config for renderer
├── tsconfig.json                  # Base TypeScript config
├── tsconfig.main.json             # Main process TS config
├── tsconfig.preload.json          # Preload TS config
├── tsconfig.renderer.json         # Renderer TS config
├── package.json                   # Dependencies & scripts
└── ARCHITECTURE.md                # This document
```

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ELECTRON APPLICATION                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        MAIN PROCESS                              │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │ ConfigManager│  │  N8nManager  │  │   N8nAuthManager     │  │   │
│  │  │              │  │              │  │                      │  │   │
│  │  │ electron-    │  │ Child        │  │ • Owner Setup        │  │   │
│  │  │ store        │  │ Process      │  │ • Login/Session      │  │   │
│  │  │              │  │ Management   │  │ • Cookie Injection   │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                    IPC Handlers                           │   │   │
│  │  │  n8n:* | config:* | workflows:* | editor:* | storage:*   │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                              IPC Bridge                                 │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      PRELOAD SCRIPT                              │   │
│  │            contextBridge.exposeInMainWorld('electron', API)      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     RENDERER PROCESS                             │   │
│  │                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────┐     │   │
│  │  │                     React App                           │     │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │     │   │
│  │  │  │ Pages    │  │Components│  │     Nanostores       │ │     │   │
│  │  │  │          │  │          │  │                      │ │     │   │
│  │  │  │ Home     │  │ Layout   │  │ $n8nStatus           │ │     │   │
│  │  │  │ Recent   │  │ Features │  │ $workflows           │ │     │   │
│  │  │  │ AI Svc   │  │ UI       │  │ $settings            │ │     │   │
│  │  │  │ Welcome  │  │          │  │ $editorVisible       │ │     │   │
│  │  │  └──────────┘  └──────────┘  └──────────────────────┘ │     │   │
│  │  └────────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      BROWSER VIEW                                │   │
│  │                   (n8n Editor - Embedded)                        │   │
│  │         Positioned with 64px offset for minimized sidebar        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         N8N SERVER (Child Process)                      │
│                                                                         │
│  • Spawned via: bundled n8n binary from node_modules                    │
│  • Port: Configurable (default 5678)                                    │
│  • Database: SQLite (in user data folder)                              │
│  • REST API: /rest/* endpoints for internal communication              │
│  • Health Check: /healthz endpoint every 5 seconds                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Main Process (Electron)

### Entry Point (`src/main/index.ts`)

The main process is the application's entry point, responsible for:

1. **Window Management**
   - Creates `BrowserWindow` for the React UI
   - Creates `BrowserView` for embedded n8n editor
   - Manages window bounds persistence
   - Handles minimize-to-tray behavior

2. **System Tray**
   - Creates tray icon with context menu
   - Shows server status (Running/Stopped/Error)
   - Dynamic tooltip with port information
   - Click to show/focus window

3. **Lifecycle Management**
   - Initializes all managers and services
   - Starts n8n server on app ready (if not first run)
   - Graceful shutdown with 5-second timeout
   - Handles Squirrel events on Windows

### Initialization Sequence

```
app.whenReady()
    │
    ├── Initialize ConfigManager
    ├── Initialize N8nManager
    ├── Initialize N8nAuthManager
    ├── Initialize UpdateChecker
    │
    ├── Register IPC Handlers
    ├── Register Update Handlers
    │
    ├── Create Main Window
    ├── Create System Tray
    │
    ├── If firstRunComplete:
    │   ├── Start n8n Server
    │   └── Setup n8n Owner Account
    │
    └── Start Auto-Update Checker
```

### Key Constants

```typescript
const MINIMIZED_SIDEBAR_WIDTH = 64;  // px - sidebar width when editor visible
const HEALTH_CHECK_INTERVAL = 5000;   // ms - server health check interval
const STARTUP_TIMEOUT = 60000;        // ms - n8n startup timeout
const SHUTDOWN_TIMEOUT = 5000;        // ms - graceful shutdown timeout
```

---

## 6. n8n Server Integration

### N8nManager (`src/main/n8n-manager.ts`)

Manages the n8n server as a child process.

#### Server Startup

```typescript
// Environment variables passed to n8n
const env = {
  N8N_PORT: port.toString(),
  N8N_HOST: 'localhost',
  N8N_LISTEN_ADDRESS: '127.0.0.1',
  N8N_USER_FOLDER: n8nFolder,  // ~/.config/n8n AI Runner/n8n-data/.n8n
  DB_TYPE: 'sqlite',
  N8N_DIAGNOSTICS_ENABLED: 'false',
  N8N_PERSONALIZATION_ENABLED: 'false',
  N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
  N8N_TEMPLATES_ENABLED: 'false',
  N8N_HIRING_BANNER_ENABLED: 'false',
};

// Find bundled n8n binary and spawn process
const n8nBinary = findN8nBinary(); // Searches node_modules/.bin/n8n
spawn(n8nBinary, ['start'], {
  env,
  shell: isWindows,      // Shell only on Windows for path resolution
  windowsHide: true,     // Hide console window on Windows
  detached: !isWindows,  // Process group on Unix for clean shutdown
});
```

#### Server Lifecycle States

```
stopped ──▶ starting ──▶ running
    ▲           │            │
    │           ▼            ▼
    └────── error ◀──────────┘
```

#### Health Monitoring

- **Interval**: Every 5 seconds
- **Endpoint**: `GET /healthz`
- **Fallback**: Check if process is still alive

#### Process Termination

```typescript
// Platform-specific process tree killing
if (process.platform === 'win32') {
  // Windows: Use taskkill with /T flag for tree kill
  execSync(`taskkill /pid ${pid} /T /F`);
} else {
  // Unix: Kill process group with negative PID
  process.kill(-pid, signal);
}
```

---

## 7. Authentication System

### N8nAuthManager (`src/main/services/n8n-auth-manager.ts`)

Handles automatic n8n owner account creation and session management.

#### Authentication Flow

```
Application Start
       │
       ▼
┌──────────────────┐
│ Wait for n8n     │  GET /healthz (up to 30 attempts, 1s interval)
│ to be ready      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Check if owner   │  GET /rest/settings
│ is set up        │  Check: userManagement.isInstanceOwnerSetUp
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Yes        No
    │         │
    │         ▼
    │   ┌──────────────────┐
    │   │ Create owner     │  POST /rest/owner/setup
    │   │ account          │  { email, firstName, lastName, password }
    │   └────────┬─────────┘
    │            │
    └─────┬──────┘
          │
          ▼
┌──────────────────┐
│ Login to n8n     │  POST /rest/login
│                  │  { emailOrLdapLoginId, password }
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Extract session  │  Set-Cookie: n8n-auth=<value>
│ cookie           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Store session    │  Used for REST API calls
│ cookie in memory │  and BrowserView injection
└──────────────────┘
```

#### Default Owner Account

```typescript
const DEFAULT_OWNER_EMAIL = 'desktop@n8n.local';
const DEFAULT_OWNER_FIRST_NAME = 'Desktop';
const DEFAULT_OWNER_LAST_NAME = 'User';
// Password: 24-character random with uppercase, lowercase, numbers, special
```

#### Password Security

```typescript
// Encryption using Electron's safeStorage
if (safeStorage.isEncryptionAvailable()) {
  const encrypted = safeStorage.encryptString(password);
  return encrypted.toString('base64');
}
// Fallback: base64 encoding (less secure)
```

#### Session Cookie Injection

When opening the n8n editor, the session cookie is injected into the BrowserView:

```typescript
await editorView.webContents.session.cookies.set({
  url: `http://localhost:${port}`,
  name: 'n8n-auth',
  value: cookieValue,
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
});
```

---

## 8. Renderer Process (React)

### Application Structure

```
App.tsx
├── ThemeProvider (dark mode default)
├── Loading State (while settings load)
├── WelcomePage (if !firstRunComplete)
└── MainLayout
    ├── Sidebar / MinimizedSidebar (conditional)
    ├── Main Content Area
    │   ├── UpdateBanner
    │   ├── ServerErrorBanner
    │   ├── DataFolderWarningBanner
    │   └── Page Content (routed)
    ├── ImportConfirmDialog
    └── SettingsDialog
```

### Pages

| Page | Path | Purpose |
|------|------|---------|
| HomePage | `/` | Workflow list with grid/list view, search, filters |
| RecentPage | `/recent` | Recently accessed workflows |
| AIServicesPage | `/ai-services` | AI service configuration |
| WelcomePage | N/A | First-run setup wizard |

### Routing

Simple in-memory routing via state (`currentPath`), not React Router:

```typescript
const [currentPath, setCurrentPath] = useState<Route>('/');

const renderPage = () => {
  switch (currentPath) {
    case '/': return <HomePage />;
    case '/recent': return <RecentPage />;
    case '/ai-services': return <AIServicesPage />;
  }
};
```

---

## 9. IPC Communication

### Preload API Structure

The preload script (`src/preload/index.ts`) exposes a typed API to the renderer:

```typescript
window.electron = {
  n8n: { ... },        // Server management
  editor: { ... },     // BrowserView control
  workflows: { ... },  // Workflow CRUD
  config: { ... },     // Configuration
  ai: { ... },         // AI service testing
  dialog: { ... },     // Native dialogs
  shell: { ... },      // Shell operations
  storage: { ... },    // Storage management
  updates: { ... },    // Update checking
};
```

### Communication Patterns

#### Request/Response (ipcMain.handle)

```typescript
// Renderer
const result = await window.electron.workflows.list();

// Main (handler)
ipcMain.handle('workflows:list', async () => {
  const response = await axios.get(`${getBaseUrl()}/workflows`, getAuthConfig());
  return { success: true, data: response.data.data };
});
```

#### Event Streaming (ipcMain.send)

```typescript
// Main (sender)
mainWindow.webContents.send('n8n:statusChange', status);

// Renderer (subscriber)
window.electron.n8n.onStatusChange((status) => {
  $n8nStatus.set(status);
});
```

### IPC Channels

| Category | Channels | Direction |
|----------|----------|-----------|
| n8n | `n8n:start`, `n8n:stop`, `n8n:restart`, `n8n:getStatus`, `n8n:getLogs`, `n8n:clearLogs`, `n8n:isRunning` | Request/Response |
| n8n Events | `n8n:statusChange`, `n8n:ready` | Main → Renderer |
| Editor | `editor:open`, `editor:close`, `editor:isVisible` | Request/Response |
| Editor Events | `editor:visibilityChanged` | Main → Renderer |
| Workflows | `workflows:list`, `workflows:get`, `workflows:create`, `workflows:update`, `workflows:delete`, `workflows:duplicate`, `workflows:execute`, `workflows:stopExecution`, `workflows:import`, `workflows:export`, `workflows:getRecent`, `workflows:addRecent`, `workflows:getTemplates` | Request/Response |
| Config | `config:get`, `config:set`, `config:getAll`, `config:setMultiple`, `config:reset`, `config:getAIServices`, `config:addAIService`, `config:updateAIService`, `config:deleteAIService` | Request/Response |
| AI | `ai:testConnection`, `ai:getModels` | Request/Response |
| Dialog | `dialog:selectFolder`, `dialog:selectFile`, `dialog:saveFile`, `dialog:showMessage` | Request/Response |
| Shell | `shell:openExternal`, `shell:showItemInFolder`, `shell:openPath` | Request/Response |
| Storage | `storage:getDataFolder`, `storage:checkDataFolder`, `storage:selectDataFolder`, `storage:getStats`, `storage:clearCache`, `storage:canChangeDataFolder`, `storage:createBackup`, `storage:restoreBackup`, `storage:listBackups`, `storage:deleteBackup` | Request/Response |
| Updates | `updates:check`, `updates:getInfo`, `updates:getCurrentVersion`, `updates:download`, `updates:dismiss`, `updates:getLastCheckTime` | Request/Response |
| Update Events | `updates:available`, `updates:dismissed` | Main → Renderer |

---

## 10. State Management

### Nanostores Architecture

The application uses nanostores for lightweight reactive state management.

#### Store Files

| Store | File | Purpose |
|-------|------|---------|
| n8n | `stores/n8n.ts` | Server status, logs, ready state |
| workflows | `stores/workflows.ts` | Workflow list, filters, executions |
| settings | `stores/settings.ts` | App configuration |
| editor | `stores/editor.ts` | Editor visibility |
| ai-services | `stores/ai-services.ts` | AI service connection status |

#### n8n Store

```typescript
// Atoms (primitive state)
export const $n8nStatus = atom<N8nStatus>(defaultStatus);
export const $n8nLogs = atom<string[]>([]);
export const $n8nReady = atom<boolean>(false);

// Computed (derived state)
export const $isN8nRunning = computed($n8nStatus, (s) => s.status === 'running');
export const $hasN8nError = computed($n8nStatus, (s) => s.status === 'error');
export const $n8nUrl = computed($n8nStatus, (s) => s.url);

// Actions
export async function startN8n(): Promise<void> { ... }
export async function stopN8n(): Promise<void> { ... }
export async function restartN8n(): Promise<void> { ... }
```

#### Workflows Store

```typescript
// State
export const $workflows = atom<Workflow[]>([]);
export const $workflowFilter = atom<WorkflowStatusFilter>('all');
export const $workflowSearch = atom<string>('');
export const $runningExecutions = atom<WorkflowExecution[]>([]);
export const $isLoadingWorkflows = atom<boolean>(false);

// Computed
export const $filteredWorkflows = computed([...], (workflows, filter, search) => ...);
export const $workflowCounts = computed($workflows, (w) => ({
  total: w.length,
  active: w.filter(x => x.active).length,
  inactive: w.filter(x => !x.active).length,
}));

// Actions
export async function loadWorkflows(): Promise<void> { ... }
export function addWorkflow(workflow: Workflow): void { ... }
export function removeWorkflow(id: string): void { ... }
```

#### Editor Store

```typescript
export const $editorVisible = atom<boolean>(false);

export function initEditorVisibilitySubscription(): () => void {
  // Get initial state
  window.electron.editor.isVisible().then((visible) => {
    $editorVisible.set(visible);
  });

  // Subscribe to changes
  return window.electron.editor.onVisibilityChange((visible) => {
    $editorVisible.set(visible);
  });
}

export async function closeEditor(): Promise<void> {
  await window.electron.editor.close();
}
```

### React Integration

```typescript
import { useStore } from '@nanostores/react';

function MyComponent() {
  const status = useStore($n8nStatus);
  const workflows = useStore($workflows);
  // Component re-renders when store values change
}
```

---

## 11. UI Component Architecture

### Component Hierarchy

```
components/
├── layout/
│   ├── MainLayout.tsx      # Main app layout with sidebar
│   ├── Sidebar.tsx         # Full sidebar (256px)
│   ├── MinimizedSidebar.tsx # Minimized sidebar (64px)
│   └── StatusBar.tsx       # Bottom status bar
│
├── ui/                     # Shadcn UI components
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── select.tsx
│   ├── switch.tsx
│   ├── tabs.tsx
│   ├── toggle.tsx
│   ├── tooltip.tsx
│   ├── badge.tsx
│   ├── separator.tsx
│   ├── label.tsx
│   ├── textarea.tsx
│   ├── loading-spinner.tsx
│   ├── toast.tsx
│   └── ThemeToggle.tsx
│
└── features/
    ├── workflows/
    │   ├── WorkflowGrid.tsx
    │   ├── WorkflowListView.tsx
    │   ├── WorkflowCard.tsx
    │   ├── WorkflowContextMenu.tsx
    │   ├── WorkflowEmptyState.tsx
    │   ├── DeleteConfirmDialog.tsx
    │   └── ImportConfirmDialog.tsx
    │
    ├── ai-services/
    │   ├── AIServiceCard.tsx
    │   ├── AddAIServiceDialog.tsx
    │   ├── EditAIServiceDialog.tsx
    │   └── DeleteAIServiceDialog.tsx
    │
    ├── settings/
    │   ├── SettingsDialog.tsx
    │   ├── GeneralSettingsTab.tsx
    │   ├── ServerSettingsTab.tsx
    │   ├── AIServicesSettingsTab.tsx
    │   ├── StorageSettingsTab.tsx
    │   └── LogViewerDialog.tsx
    │
    ├── server/
    │   └── ServerErrorBanner.tsx
    │
    ├── storage/
    │   └── DataFolderWarningBanner.tsx
    │
    └── updates/
        └── UpdateBanner.tsx
```

### Sidebar Behavior

The sidebar switches between full and minimized modes based on editor visibility:

```typescript
// MainLayout.tsx
{editorVisible ? (
  <MinimizedSidebar
    onNavigate={onNavigate}
    onOpenSettings={handleOpenSettings}
    onNewWorkflow={handleNewWorkflow}
    onCloseEditor={closeEditor}
  />
) : (
  <Sidebar
    currentPath={currentPath}
    onNavigate={onNavigate}
    onOpenSettings={handleOpenSettings}
    onNewWorkflow={handleNewWorkflow}
    ...
  />
)}
```

| State | Sidebar | Width | Features |
|-------|---------|-------|----------|
| Dashboard | Full | 256px (w-64) | Navigation, New Workflow dropdown, Settings, Status |
| Editor Open | Minimized | 64px (w-16) | Icons only with tooltips, Back button |

### Styling System

- **TailwindCSS 4.1** with OKLCH color space
- **CSS Variables** for theming (light/dark modes)
- **Component Variants** via class-variance-authority

```css
/* globals.css - Theme variables */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.527 0.154 150.069);  /* n8n green */
  /* ... */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... */
}
```

---

## 12. Data Flow Patterns

### Workflow Loading Flow

```
App Mount
    │
    ▼
initN8nStatusSubscription()
    │
    ├── Subscribe to n8n:statusChange
    └── Subscribe to n8n:ready
           │
           ▼
      n8n:ready = true
           │
           ▼
      $n8nReady.set(true)
           │
           ▼
HomePage useEffect([n8nReady])
           │
           ▼
      loadWorkflows()
           │
           ▼
window.electron.workflows.list()
           │
           ▼
      IPC: workflows:list
           │
           ▼
Main: axios.get('/rest/workflows', { Cookie: session })
           │
           ▼
      Response: { data: Workflow[] }
           │
           ▼
      $workflows.set(data)
           │
           ▼
      Component re-render
```

### Editor Opening Flow

```
User clicks "Edit" on workflow
           │
           ▼
window.electron.editor.open(workflowId)
           │
           ▼
      IPC: editor:open
           │
           ▼
Main: showEditor(workflowId)
    │
    ├── Create BrowserView (if needed)
    ├── Inject session cookie
    ├── Set bounds (64px offset for sidebar)
    ├── Load URL: http://localhost:5678/workflow/{id}
    ├── Set isEditorVisible = true
    └── Send: editor:visibilityChanged(true)
           │
           ▼
Renderer: onVisibilityChange callback
           │
           ▼
      $editorVisible.set(true)
           │
           ▼
MainLayout re-renders with MinimizedSidebar
```

### Settings Update Flow

```
User changes setting in SettingsDialog
           │
           ▼
updatePendingSetting(key, value)
           │
           ▼
$pendingSettings updated
           │
           ▼
$hasUnsavedChanges = true
           │
           ▼
User clicks "Save"
           │
           ▼
saveSettings()
           │
           ▼
window.electron.config.setMultiple(pending)
           │
           ▼
      IPC: config:setMultiple
           │
           ▼
Main: configManager.setMultiple(values)
           │
           ▼
      electron-store persists to disk
           │
           ▼
      Success response
           │
           ▼
$settings.set({ ...settings, ...pending })
$pendingSettings.set({})
$hasUnsavedChanges = false
```

---

## 13. Configuration & Storage

### ConfigManager (`src/main/config-manager.ts`)

Uses `electron-store` for persistent JSON configuration.

#### Configuration Schema

```typescript
interface AppConfig {
  // First run
  firstRunComplete: boolean;

  // n8n settings
  n8nPort: number;                    // 1024-65535, default: 5678
  dataFolder: string;                 // User data location

  // n8n owner account
  n8nOwnerSetupComplete: boolean;
  n8nOwnerCredentials?: {
    email: string;
    firstName: string;
    lastName: string;
    encryptedPassword?: string;       // Encrypted via safeStorage
  };
  n8nApiKey?: string;

  // App behavior
  startWithSystem: boolean;           // Auto-launch on login
  minimizeToTray: boolean;            // Minimize to tray instead of taskbar
  runInBackground: boolean;           // Keep running when window closed

  // Workflow settings
  maxConcurrentWorkflows: number;     // 1-10, default: 3

  // AI Services
  aiServices: AIServiceConfig[];

  // Window state
  windowBounds: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    maximized?: boolean;
  };
}
```

#### Storage Locations

| Data | Location | Purpose |
|------|----------|---------|
| App Config | `~/.config/n8n AI Runner/config.json` | Application settings |
| n8n Data | `~/.config/n8n AI Runner/n8n-data/` | User-selected data folder |
| n8n Database | `{dataFolder}/.n8n/database.sqlite` | Workflow storage |
| n8n Files | `{dataFolder}/.n8n/` | n8n internal files |

### AI Service Configuration

```typescript
interface AIServiceConfig {
  id: string;                         // UUID
  name: string;                       // Display name
  type: 'openai' | 'anthropic' | 'ollama' | 'custom';
  endpoint: string;                   // API endpoint URL
  apiKey?: string;                    // API key (if required)
  isEnabled: boolean;                 // Enable/disable toggle
  createdAt: string;                  // ISO timestamp
  updatedAt: string;                  // ISO timestamp
}
```

---

## 14. Build & Packaging

### Vite Configurations

| Config | Target | Output Format | Key Settings |
|--------|--------|---------------|--------------|
| `vite.main.config.mts` | Main Process | ESM (.mjs) | Externalizes electron, node builtins |
| `vite.preload.config.mts` | Preload | CommonJS (.cjs) | Externalizes electron, node builtins |
| `vite.renderer.config.mts` | Renderer | ESM | React, TailwindCSS plugins |

### Electron Forge Configuration

```typescript
// forge.config.mts
const config: ForgeConfig = {
  packagerConfig: {
    asar: true,                       // Package as ASAR archive
    icon: 'resources/icon',           // App icon
    name: 'n8n AI Runner',
    executableName: 'n8n-desktop',
    appBundleId: 'com.n8n.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    extraResource: ['resources'],     // Include resources folder
    osxSign: {},                      // macOS signing (CI)
  },
  makers: [
    MakerSquirrel({ ... }),           // Windows .exe
    MakerDMG({ ... }),                // macOS .dmg
    MakerZIP({}, ['darwin', 'linux']) // Cross-platform .zip
  ],
  plugins: [
    VitePlugin({ ... })               // Vite build integration
  ],
};
```

### NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm start` | `electron-forge start` | Development mode |
| `npm run build` | `electron-forge package` | Package application |
| `npm run make` | `electron-forge make` | Create distributables |
| `npm run lint` | `eslint src/` | Run linter |
| `npm run typecheck` | `tsc --noEmit` | Type checking |
| `npm test` | `vitest` | Run tests |

---

## 15. Security Considerations

### Process Isolation

```typescript
// Main window
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,    // Disable Node.js in renderer
    contextIsolation: true,    // Isolate preload context
    sandbox: false,            // Required for preload functionality
    preload: 'index.cjs',      // Explicit preload script
  }
});

// BrowserView (n8n editor)
new BrowserView({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,             // Full sandbox for external content
  }
});
```

### Credential Security

1. **Password Encryption**: Uses Electron's `safeStorage` API
   - OS-level encryption (Keychain on macOS, Credential Store on Windows)
   - Fallback to base64 encoding if unavailable

2. **Session Management**: Session cookies are memory-only
   - Not persisted to disk
   - Cleared on restart

3. **Network Isolation**: n8n binds to localhost only
   ```typescript
   N8N_HOST: 'localhost',
   N8N_LISTEN_ADDRESS: '127.0.0.1',
   ```

### IPC Security

- All IPC communication goes through validated channels
- Type-safe API via TypeScript interfaces
- No arbitrary code execution from renderer

---

## 16. Key Implementation Details

### BrowserView Sidebar Offset

The n8n editor is displayed in a BrowserView offset by 64px to leave space for the minimized sidebar:

```typescript
const MINIMIZED_SIDEBAR_WIDTH = 64;

editorView.setBounds({
  x: MINIMIZED_SIDEBAR_WIDTH,        // 64px offset from left
  y: 0,
  width: bounds.width - MINIMIZED_SIDEBAR_WIDTH,
  height: bounds.height,
});

// Handle window resize
mainWindow.on('resize', () => {
  if (editorView && isEditorVisible) {
    const newBounds = mainWindow.getContentBounds();
    editorView.setBounds({
      x: MINIMIZED_SIDEBAR_WIDTH,
      y: 0,
      width: newBounds.width - MINIMIZED_SIDEBAR_WIDTH,
      height: newBounds.height,
    });
  }
});
```

### n8n REST API Usage

The application uses n8n's internal REST API (`/rest/*`) instead of the public API (`/api/v1/*`) because:

1. Internal API works with session cookies
2. Public API requires API keys (enterprise feature for scopes)
3. Session-based auth is simpler for embedded use

```typescript
// Workflow API calls
const getBaseUrl = () => `http://localhost:${getN8nPort()}/rest`;

const getAuthConfig = () => ({
  headers: { Cookie: authManager.getSessionCookie() },
  withCredentials: true,
});

// Example: List workflows
const response = await axios.get(`${getBaseUrl()}/workflows`, getAuthConfig());
```

### Graceful Shutdown

```typescript
const gracefulShutdown = async () => {
  isQuitting = true;

  // Check for running workflows
  if (n8nManager.hasRunningWorkflows()) {
    // Show confirmation dialog
  }

  // Stop with timeout
  if (n8nManager.isRunning()) {
    const shutdown = n8nManager.stop();
    const timeout = new Promise(resolve => setTimeout(resolve, 5000));
    await Promise.race([shutdown, timeout]);
  }

  app.quit();
};
```

### Process Tree Killing

On Unix systems, the n8n process is spawned with `detached: true` to create a process group, allowing clean shutdown:

```typescript
// Start with process group
const n8nBinary = findN8nBinary();
spawn(n8nBinary, ['start'], {
  detached: !isWindows,
});

// Kill process group
process.kill(-pid, 'SIGTERM');  // Negative PID = process group
```

On Windows, `taskkill` with `/T` flag is used:

```typescript
execSync(`taskkill /pid ${pid} /T /F`);
```

---

## Appendix: Type Definitions

See `src/preload/types.ts` for complete type definitions including:

- `N8nStatus`, `N8nStartResult`
- `AppConfig`, `AIServiceConfig`, `WindowBounds`
- `WorkflowData`, `WorkflowResult`, `WorkflowListResult`
- `DialogResult`, `MessageResult`, `SimpleResult`
- `UpdateInfo`, `UpdateCheckResult`
- `ElectronAPI` (complete preload API interface)

---

*Last updated: December 2024*
