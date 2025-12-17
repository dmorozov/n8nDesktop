# n8n AI Runner - Technical Architecture

This document provides a comprehensive technical overview of n8n AI Runner, an Electron-based desktop application that wraps n8n workflow automation with embedded document processing capabilities.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Core Components](#core-components)
4. [Process Architecture](#process-architecture)
5. [Custom n8n Nodes](#custom-n8n-nodes)
6. [Workflow Execution Popup System](#workflow-execution-popup-system)
7. [Document Processing (Docling)](#document-processing-docling)
8. [AI Services Integration](#ai-services-integration)
9. [Data Management](#data-management)
10. [Security Considerations](#security-considerations)
11. [Build and Packaging](#build-and-packaging)
12. [Extending the Application](#extending-the-application)

---

## Architecture Overview

n8n AI Runner follows a multi-process architecture pattern common in Electron applications, with the addition of two embedded services:

```
┌─────────────────────────────────────────────────────────────────┐
│                     ELECTRON APPLICATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │   Main Process  │    │ Renderer Process │    │ BrowserView │ │
│  │   (Node.js)     │◄──►│    (React UI)    │    │ (n8n Editor)│ │
│  └────────┬────────┘    └─────────────────┘    └─────────────┘ │
│           │                                                     │
│           │ Child Processes                                     │
│           │                                                     │
│  ┌────────▼────────┐    ┌─────────────────┐                    │
│  │   n8n Server    │    │ Docling Service │                    │
│  │  (Node.js)      │    │   (Python)      │                    │
│  │  Port: 5678     │    │  Port: 8765     │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Design Principles

The application follows these core principles from the project constitution:

1. **User-First Simplicity**: No CLI exposure, automatic user creation/login
2. **Data Portability**: All data in user-selected folder, fully portable
3. **Bundled Self-Containment**: Node.js + n8n bundled, no external dependencies
4. **Transparent Server Lifecycle**: Auto-start, tray icon status, graceful shutdown
5. **Test-Required Development**: Tests required before feature merge

---

## Technology Stack

### Frontend (Renderer Process)

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.1 | UI framework |
| TypeScript | 5.9+ | Type-safe JavaScript |
| TailwindCSS | 4.1.17 | Utility-first CSS |
| Radix UI | Various | Accessible UI primitives |
| Nanostores | 1.1.0 | Lightweight state management |
| React Router | 7.10.1 | Client-side routing |
| React Query | 5.90.12 | Server state management |
| Lucide React | 0.556.0 | Icon library |
| React Markdown | 10.1.0 | Markdown rendering |

### Backend (Main Process)

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 39.2.6 | Desktop framework |
| Node.js | 20.x LTS | JavaScript runtime |
| electron-store | 11.0.2 | Persistent JSON storage |
| Axios | 1.13.2 | HTTP client |

### Embedded Services

| Service | Version | Purpose |
|---------|---------|---------|
| n8n | 2.0.0 | Workflow automation engine |
| Docling | 2.15.0 | Document processing |
| docling-core | 2.0.0 | Docling core library |
| FastAPI | 0.115.0 | Docling HTTP API |
| Uvicorn | 0.32.0 | ASGI server |

### Build Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Vite | 7.2.7 | Build tool and dev server |
| Electron Forge | 7.10.2 | Electron packaging |
| Vitest | 4.0.15 | Unit testing |
| Playwright | 1.57.0 | E2E testing |
| ESLint | 9.39.1 | Code linting |
| Prettier | 3.7.4 | Code formatting |

---

## Core Components

### Main Process (`src/main/`)

The main process manages the application lifecycle and embedded services.

#### Key Modules

**`index.ts`** - Application entry point
- Electron app initialization
- Window creation and management
- IPC handler registration
- Service orchestration

**`n8n-manager.ts`** - n8n Server Lifecycle
```typescript
// State machine for n8n server
type N8nState = 'stopped' | 'starting' | 'running' | 'error';

// Key responsibilities:
- Spawn n8n as child process
- Environment variable configuration
- Health check polling (every 5 seconds)
- Log capture and rotation
- Graceful shutdown with timeout
```

**`services/docling-manager.ts`** - Docling Service Lifecycle
```typescript
// Manages Python FastAPI service
- Python virtual environment detection
- Service spawn and monitoring
- Auth token generation
- Health monitoring
- Automatic restart on crash (max 3 attempts)
```

**`services/n8n-auth-manager.ts`** - Authentication
```typescript
// Automatic owner account management
- Check if owner exists
- Create owner with secure random password
- Login and session management
- Cookie injection into BrowserView
```

**`services/workflow-executor.ts`** - Popup Execution Bridge
```typescript
// Bridge between popup UI and n8n execution
- Store external node configurations
- Execute workflows via n8n API
- Stream execution results
- Handle cancellation
```

**`services/config-manager.ts`** - Configuration
```typescript
// electron-store wrapper
- Typed configuration schema
- Migration support
- Secure storage for sensitive data
```

### Renderer Process (`src/renderer/`)

React-based UI with component-driven architecture.

#### Directory Structure

```
src/renderer/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Root component with routing
│   ├── components/
│   │   ├── ui/               # Reusable UI components (Button, Dialog, etc.)
│   │   ├── layout/           # Layout components (Sidebar, StatusBar)
│   │   └── features/         # Feature-specific components
│   │       ├── workflows/    # Workflow management UI
│   │       ├── ai-services/  # AI service configuration
│   │       ├── settings/     # Settings dialogs
│   │       └── workflow-popup/ # Simplified execution UI
│   ├── pages/                # Route pages
│   ├── stores/               # Nanostores state management
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities and helpers
│   └── types/                # TypeScript type definitions
```

#### State Management

Using Nanostores for lightweight reactive state:

```typescript
// src/renderer/src/stores/n8n-store.ts
import { atom, computed } from 'nanostores';

export const $serverStatus = atom<ServerStatus>('stopped');
export const $workflows = atom<Workflow[]>([]);
export const $isLoading = computed($serverStatus, status => status === 'starting');
```

### Preload Script (`src/preload/`)

Secure bridge between renderer and main processes.

```typescript
// src/preload/index.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // n8n server control
  getServerStatus: () => ipcRenderer.invoke('n8n:status'),
  startServer: () => ipcRenderer.invoke('n8n:start'),
  stopServer: () => ipcRenderer.invoke('n8n:stop'),

  // Workflow operations
  getWorkflows: () => ipcRenderer.invoke('workflows:list'),
  executeWorkflow: (id, config) => ipcRenderer.invoke('workflow:execute', id, config),

  // File operations
  selectFiles: (options) => ipcRenderer.invoke('dialog:selectFiles', options),

  // AI services
  getAIServices: () => ipcRenderer.invoke('ai:services:list'),
  saveAIService: (service) => ipcRenderer.invoke('ai:services:save', service),

  // Events
  onServerStatusChange: (callback) => ipcRenderer.on('n8n:status-changed', callback),
});
```

---

## Process Architecture

### Inter-Process Communication (IPC)

The application uses Electron's IPC mechanism with a typed API:

```
┌─────────────────┐         ┌─────────────────┐
│    Renderer     │   IPC   │      Main       │
│    (React UI)   │◄───────►│   (Node.js)     │
└─────────────────┘         └────────┬────────┘
                                     │
                            HTTP/REST│
                     ┌───────────────┼───────────────┐
                     │               │               │
              ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼─────┐
              │ n8n Server  │ │   Docling   │ │  Config   │
              │  :5678      │ │    :8765    │ │   Store   │
              └─────────────┘ └─────────────┘ └───────────┘
```

### Service Communication

**n8n API Communication:**
```typescript
// Main process communicates with n8n via REST API
const response = await axios.get('http://127.0.0.1:5678/api/v1/workflows', {
  headers: { Cookie: sessionCookie }
});
```

**Docling API Communication:**
```typescript
// Workflows call Docling via HTTP Request nodes
POST http://127.0.0.1:8765/api/v1/process
Authorization: Bearer <auth_token>
Content-Type: application/json

{ "file_path": "/path/to/document.pdf" }
```

---

## Custom n8n Nodes

The application includes three custom nodes that enable the simplified execution popup.

### Location

```
src/n8n_nodes/
├── nodes/
│   ├── PromptInput/
│   │   └── PromptInput.node.ts
│   ├── FileSelector/
│   │   └── FileSelector.node.ts
│   └── ResultDisplay/
│       └── ResultDisplay.node.ts
├── package.json
└── tsconfig.json
```

### PromptInput Node (`CUSTOM.promptInput`)

**Purpose**: Rich text input for AI workflows

**Features:**
- HTML editor support
- Min/max length validation
- HTML tag stripping
- External config support (for popup execution)

**Output Schema:**
```typescript
{
  prompt: string;
  chatInput: string;      // AI Agent compatibility
  length: number;
  wordCount: number;
  lineCount: number;
  isValid: boolean;
}
```

**Configuration Priority:**
1. External config from popup (highest)
2. Node parameter default value

### FileSelector Node (`CUSTOM.fileSelector`)

**Purpose**: Native file selection with Electron bridge

**Features:**
- OS native file picker dialog
- File type filtering (documents, images, spreadsheets)
- Multiple file selection
- Automatic file copying to n8n-files folder
- External config support

**Output Schema:**
```typescript
{
  success: boolean;
  source: 'popup' | 'stored' | 'dialog';
  fileCount: number;
  files: Array<{
    id: string;
    originalName: string;
    destinationPath: string;
    size: number;
    mimeType: string;
  }>;
  totalSize: number;
}
```

### ResultDisplay Node (`CUSTOM.resultDisplay`)

**Purpose**: Display workflow results in popup

**Modes:**
- **Text/Markdown**: Auto-detect or custom path extraction
- **Files**: Binary data or file path references

**Auto-detect Paths:**
```typescript
const AUTO_DETECT_PATHS = [
  'json.output',
  'json.text',
  'json.response.text',
  'json.content',
  'json.result',
  'json.summary',
  'json.message',
];
```

### Building Custom Nodes

```bash
cd src/n8n_nodes
npm install
npm run build
```

The built nodes are copied to `~/.n8n/custom/` at runtime for n8n to load.

---

## Workflow Execution Popup System

The popup system provides a simplified interface for non-technical users.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WorkflowExecutionPopup                        │
├──────────────────┬─────────────────────┬────────────────────────┤
│                  │                     │                        │
│   InputPanel     │  CenterIndicator    │    OutputPanel         │
│                  │                     │                        │
│  - PromptInputs  │  - Status display   │  - Text results        │
│  - FileSelectors │  - Progress         │  - Markdown render     │
│                  │  - Error display    │  - File downloads      │
│                  │                     │                        │
└──────────────────┴─────────────────────┴────────────────────────┘
```

### Execution Flow

```
1. User clicks "Run" on workflow card
         │
         ▼
2. WorkflowExecutionPopup opens
         │
         ▼
3. Workflow analyzed for custom nodes
   (PromptInput, FileSelector, ResultDisplay)
         │
         ▼
4. Input fields generated dynamically
         │
         ▼
5. User provides inputs, clicks Execute
         │
         ▼
6. Inputs stored in WorkflowExecutor bridge
         │
         ▼
7. n8n workflow triggered via API
         │
         ▼
8. Custom nodes fetch config from bridge
         │
         ▼
9. Results posted to bridge via ResultDisplay
         │
         ▼
10. OutputPanel displays results
```

### Key Components

**`WorkflowExecutionPopup.tsx`**
- Main container component
- Workflow analysis logic
- Execution state management

**`InputPanel.tsx`**
- Dynamic input field generation
- File selection handling
- Input validation

**`CenterIndicator.tsx`**
- Execution status visualization
- Progress indication
- Error display

**`OutputPanel.tsx`**
- Result rendering (text, markdown, files)
- Auto-scroll behavior
- Download handling

### Workflow Analysis

```typescript
// Detect custom nodes in workflow
function analyzeWorkflow(workflow: Workflow): WorkflowAnalysis {
  const nodes = workflow.nodes;

  return {
    promptInputs: nodes.filter(n => n.type === 'CUSTOM.promptInput'),
    fileSelectors: nodes.filter(n => n.type === 'CUSTOM.fileSelector'),
    resultDisplays: nodes.filter(n => n.type === 'CUSTOM.resultDisplay'),
    isPopupCompatible: /* has at least one custom input/output node */
  };
}
```

---

## Document Processing (Docling)

### Service Architecture

Docling runs as an embedded Python FastAPI service:

```
src/docling/
├── src/
│   └── docling_service/
│       ├── main.py           # FastAPI application
│       ├── api/
│       │   └── routes.py     # API endpoints
│       ├── services/
│       │   └── processor.py  # Document processing logic
│       └── models/
│           └── schemas.py    # Pydantic models
├── pyproject.toml            # Poetry dependencies
└── README.md
```

### API Endpoints

**`POST /api/v1/process`** - Submit document for processing
```json
{
  "file_path": "/path/to/document.pdf",
  "options": {
    "include_page_markers": false,
    "ocr_enabled": true
  }
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "processing"
}
```

**`GET /api/v1/jobs/{job_id}`** - Check job status
```json
{
  "job_id": "uuid",
  "status": "completed",
  "result": {
    "markdown": "# Document Title\n\nContent...",
    "metadata": {
      "pages": 10,
      "format": "pdf"
    }
  }
}
```

**`GET /api/v1/health`** - Health check
```json
{
  "status": "healthy",
  "version": "0.1.0"
}
```

### Processing Pipeline

```
Input Document
      │
      ▼
┌─────────────────┐
│  File Parsing   │ ← PDF, DOCX, images, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      OCR        │ ← EasyOCR for images/scans
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Structure       │ ← Tables, headers, lists
│ Extraction      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Markdown        │ ← Final output format
│ Generation      │
└────────┬────────┘
         │
         ▼
   Output Markdown
```

### Environment Configuration

```typescript
// Injected by DoclingManager
DOCLING_PORT=8765
DOCLING_AUTH_TOKEN=<secure_random_token>
DOCLING_TEMP_FOLDER=/path/to/temp
DOCLING_MAX_CONCURRENT_JOBS=2
```

---

## AI Services Integration

### Service Configuration Schema

```typescript
interface AIService {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'google' | 'lmstudio' | 'custom';
  endpoint: string;
  apiKey?: string;
  isEnabled: boolean;
  models?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Storage

AI service configurations are stored in electron-store:

```json
{
  "aiServices": [
    {
      "id": "service-uuid",
      "name": "OpenAI",
      "type": "openai",
      "endpoint": "https://api.openai.com/v1",
      "apiKey": "<encrypted>",
      "isEnabled": true
    }
  ]
}
```

### Credential Security

API keys are encrypted using Electron's safeStorage:

```typescript
import { safeStorage } from 'electron';

// Encrypt before storing
const encrypted = safeStorage.encryptString(apiKey);

// Decrypt when needed
const decrypted = safeStorage.decryptString(encrypted);
```

### Integration with n8n

AI services are exposed to n8n workflows through:
1. **Environment variables** - Injected at n8n startup
2. **n8n credentials** - Created automatically via n8n API
3. **Template placeholders** - Replaced in workflow templates

---

## Data Management

### Storage Locations

```
User Data Folder (user-configurable)
├── .n8n/
│   ├── database.sqlite     # n8n workflow database
│   ├── config              # n8n configuration
│   └── custom/             # Custom n8n nodes
├── n8n-files/              # Files processed by workflows
└── backups/                # Workflow backups

App Config (system location)
└── ~/.config/n8n AI Runner/
    └── config.json         # Application settings
```

### Backup System

```typescript
// Create backup
await backupManager.createBackup();
// Creates: backups/backup-2024-01-15T10-30-00.zip

// List backups
const backups = await backupManager.listBackups();

// Restore backup
await backupManager.restoreBackup('backup-2024-01-15T10-30-00.zip');
```

### Template Placeholders

Workflow templates support dynamic placeholders:

| Placeholder | Description |
|-------------|-------------|
| `{{DOCLING_API_URL}}` | Full Docling API URL |
| `{{DOCLING_AUTH_TOKEN}}` | Docling authentication token |
| `{{DOCLING_PORT}}` | Docling service port |
| `{{N8N_FILES_FOLDER}}` | Path to n8n-files folder |
| `{{DATA_FOLDER}}` | Base data folder path |

---

## Security Considerations

### Process Isolation

- **nodeIntegration**: Disabled in renderer
- **contextIsolation**: Enabled
- **Sandbox**: Enabled for renderer process
- **CSP**: Content Security Policy configured

### Network Security

- All services bind to `127.0.0.1` only
- No external network exposure
- Internal authentication for service-to-service communication

### Credential Storage

- API keys encrypted with OS keychain (via Electron safeStorage)
- n8n owner password stored encrypted
- Session cookies stored in memory only

### Input Validation

- File path validation before processing
- Sanitization of user inputs
- HTML content sanitization in results

---

## Build and Packaging

### Development

```bash
# Install dependencies
npm run setup:all

# Start development
npm run dev

# Run with debugging
npm run start:debug
```

### Building

```bash
# Type check and package
npm run build

# Create distributable
npm run make
```

### Platform-Specific Packaging

| Platform | Format | Configuration |
|----------|--------|---------------|
| Windows | NSIS installer | `forge.config.ts` |
| macOS | DMG | Notarized |
| Linux | AppImage, DEB, RPM | |

### Resource Bundling

Custom n8n nodes are bundled in `resources/n8n_nodes/` and copied to user's n8n custom folder at runtime.

---

## Extending the Application

### Adding New Custom Nodes

1. Create node in `src/n8n_nodes/nodes/YourNode/`
2. Implement `INodeType` interface
3. Register in package.json
4. Build: `npm run build:n8n-nodes`

### Adding New AI Services

1. Add service type to `AIServiceType` enum
2. Create service configuration component
3. Implement connection testing logic
4. Update electron-store schema

### Adding New Workflow Templates

1. Create template JSON in `templates/`
2. Use standard n8n workflow format
3. Include custom nodes for popup compatibility
4. Add metadata (id, name, description, icon)

### Modifying the UI

1. Components in `src/renderer/src/components/`
2. Use existing UI primitives from `components/ui/`
3. Follow TailwindCSS patterns
4. Add to appropriate feature folder

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Idle memory | <500MB |
| Startup time | <10 seconds |
| Installer size | <300MB |

---

## References

### n8n Documentation
- Website: https://n8n.io/
- Documentation: https://docs.n8n.io/
- Source Code: https://github.com/n8n-io/n8n
- Custom Nodes: https://docs.n8n.io/integrations/creating-nodes/

### Docling Documentation
- Website: https://ds4sd.github.io/docling/
- Source Code: https://github.com/DS4SD/docling
- API Reference: https://ds4sd.github.io/docling/reference/

### Electron Documentation
- Website: https://www.electronjs.org/
- Documentation: https://www.electronjs.org/docs
- Security: https://www.electronjs.org/docs/latest/tutorial/security

---

*Last updated: December 2024*
*n8n AI Runner version 1.0.0*
