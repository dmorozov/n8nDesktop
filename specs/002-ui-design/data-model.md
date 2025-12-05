# Data Model: n8n Desktop Application

**Date**: 2025-12-04
**Branch**: `002-ui-design`
**Specs**: `001-n8n-desktop-app`, `002-ui-design`

---

## Overview

The n8n Desktop application has two data layers:

1. **n8n Internal Data** - Stored in n8n's SQLite database (managed by n8n server)
2. **Application Configuration** - Stored in electron-store JSON files (managed by Electron app)

---

## 1. n8n Internal Entities (Read via n8n REST API)

These entities are managed by n8n and accessed via its REST API.

### Workflow

Stored in n8n's SQLite database. Accessed via `/api/v1/workflows`.

```typescript
interface Workflow {
  id: string;                    // UUID, primary key
  name: string;                  // User-defined name
  active: boolean;               // Whether triggers are active (not used in desktop - no auto-start)
  nodes: WorkflowNode[];         // Array of nodes
  connections: WorkflowConnections;
  settings?: WorkflowSettings;
  staticData?: object;           // Workflow-specific persistent data
  tags?: Tag[];
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

interface WorkflowNode {
  id: string;
  name: string;
  type: string;                  // e.g., 'n8n-nodes-base.httpRequest'
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, CredentialReference>;
}

interface WorkflowConnections {
  [sourceNodeName: string]: {
    [outputType: string]: Array<{
      node: string;              // Target node name
      type: string;
      index: number;
    }>[];
  };
}
```

**Validation Rules**:
- `name`: Required, max 128 characters
- `id`: Auto-generated UUID by n8n
- `nodes`: At least one node for valid workflow

**State Transitions** (execution status):
```
inactive → running → completed
                   → failed
                   → cancelled
```

### Credential

Stored encrypted in n8n's database. Accessed via `/api/v1/credentials`.

```typescript
interface Credential {
  id: string;                    // UUID
  name: string;                  // User-defined name
  type: string;                  // e.g., 'openAiApi', 'httpBasicAuth'
  data: EncryptedData;           // Encrypted by n8n
  nodesAccess: NodeAccess[];     // Which node types can use this
  createdAt: string;
  updatedAt: string;
}

interface CredentialReference {
  id: string;
  name: string;
}
```

### Execution

Workflow execution history. Accessed via `/api/v1/executions`.

```typescript
interface Execution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: 'manual' | 'trigger' | 'retry';
  startedAt: string;
  stoppedAt?: string;
  status: 'new' | 'running' | 'success' | 'failed' | 'waiting';
  data?: ExecutionData;          // Input/output data (may be truncated)
  retryOf?: string;              // ID of execution being retried
  retrySuccessId?: string;
}
```

---

## 2. Application Configuration Entities

Stored in electron-store JSON files in `app.getPath('userData')`.

### AppConfig

Main application configuration. Stored in `config.json`.

```typescript
interface AppConfig {
  version: string;               // Config schema version for migrations

  // First Run
  dataFolder: string;            // User-selected data folder path
  firstRunComplete: boolean;

  // Appearance
  theme: 'dark' | 'light' | 'system';

  // Window
  windowBounds?: WindowBounds;
  minimizeToTray: boolean;

  // n8n Server
  n8nPort: number;               // Default: 5678
  startOnBoot: boolean;
  runInBackground: boolean;

  // Updates
  checkForUpdates: boolean;
  lastUpdateCheck?: string;      // ISO timestamp

  // Storage
  autoSave: boolean;
  createBackups: boolean;

  // Recent items
  recentWorkflows: RecentWorkflow[];
}

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

interface RecentWorkflow {
  id: string;
  name: string;
  lastOpened: string;            // ISO timestamp
}
```

**Default Values**:
```typescript
const defaultConfig: AppConfig = {
  version: '1.0.0',
  dataFolder: '',                // Set on first run
  firstRunComplete: false,
  theme: 'dark',
  minimizeToTray: true,
  n8nPort: 5678,
  startOnBoot: false,
  runInBackground: true,
  checkForUpdates: true,
  autoSave: true,
  createBackups: true,
  recentWorkflows: [],
};
```

### AIServiceConfig

AI service configurations. Stored in `ai-services.json`.

```typescript
interface AIServicesStore {
  services: Record<string, AIServiceConfig>;
}

interface AIServiceConfig {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  type: 'openai' | 'gemini' | 'ollama' | 'lm-studio';
  provider: 'cloud' | 'local';
  enabled: boolean;

  // Connection details (non-sensitive stored here)
  serverUrl?: string;            // For local services (Ollama, LM Studio)
  defaultModel?: string;
  availableModels?: string[];

  // Status
  status: 'connected' | 'disconnected' | 'error' | 'not-configured';
  lastTested?: string;           // ISO timestamp
  lastError?: string;

  // API key stored separately via safeStorage
  hasApiKey: boolean;            // Indicates if key is stored
}
```

**Supported Services**:

| Service | Type | Provider | URL Pattern |
|---------|------|----------|-------------|
| OpenAI | `openai` | cloud | N/A (uses API) |
| Google Gemini | `gemini` | cloud | N/A (uses API) |
| Ollama | `ollama` | local | `http://localhost:11434` |
| LM Studio | `lm-studio` | local | `http://localhost:1234` |

### SecureCredentials

API keys and secrets. Stored encrypted using Electron safeStorage.

```typescript
// Stored in credentials.json (encrypted values)
interface SecureCredentialsStore {
  [serviceId: string]: {
    apiKey: string;              // Encrypted using safeStorage
    encryptedAt: string;         // ISO timestamp
  };
}
```

**Security Notes**:
- Keys encrypted using OS-native encryption (Keychain, DPAPI, gnome-keyring)
- Decryption only possible on same machine/user
- Fallback warning shown if secure storage unavailable

---

## 3. Data Folder Structure

User-selected data folder containing n8n data and backups.

```
[User Selected Data Folder]/
├── .n8n/                        # n8n user folder
│   ├── database.sqlite          # n8n's SQLite database
│   ├── config                   # n8n configuration
│   └── .n8n-encryption-key      # n8n credential encryption key
├── backups/                     # Application backups
│   ├── backup-2025-01-15.zip
│   └── backup-2025-01-14.zip
├── exports/                     # Exported workflow JSON files
│   └── my-workflow.json
└── logs/                        # Application logs
    ├── app.log
    └── n8n.log
```

### Backup Archive

Created by backup feature. ZIP file containing:

```typescript
interface BackupManifest {
  version: string;               // App version that created backup
  createdAt: string;             // ISO timestamp
  dataFolder: string;            // Original data folder path
  contents: {
    n8nDatabase: boolean;        // database.sqlite included
    n8nConfig: boolean;          // n8n config included
    appConfig: boolean;          // Application config included
    aiServices: boolean;         // AI service configs included
    credentials: boolean;        // Note: encrypted, may not restore on different machine
  };
}
```

**Backup Contents**:
- `manifest.json` - Backup metadata
- `.n8n/` - Complete n8n user folder
- `config/` - Application configuration files

---

## 4. Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  AppConfig   │    │ AIServices   │    │  Credentials │       │
│  │  (JSON)      │    │  (JSON)      │    │  (Encrypted) │       │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘       │
│                             │                    │               │
│                             │ references         │ encrypts      │
│                             ▼                    ▼               │
│                      ┌─────────────────────────────┐            │
│                      │       SecureStorage         │            │
│                      │   (safeStorage API)         │            │
│                      └─────────────────────────────┘            │
│                                                                  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   │ IPC calls
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                          n8n Layer                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Workflow    │◄───│  Execution   │    │  Credential  │       │
│  │              │    │              │    │  (Encrypted) │       │
│  └──────┬───────┘    └──────────────┘    └──────────────┘       │
│         │                                                        │
│         │ contains                                               │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │   Nodes      │────────► uses ────────► Credentials           │
│  │              │                                               │
│  └──────────────┘                                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    SQLite Database                        │   │
│  │                    (database.sqlite)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. API Access Patterns

### Workflow Operations

| Operation | Method | Endpoint | Notes |
|-----------|--------|----------|-------|
| List all | GET | `/api/v1/workflows` | Paginated |
| Get one | GET | `/api/v1/workflows/{id}` | Full workflow data |
| Create | POST | `/api/v1/workflows` | Returns created workflow |
| Update | PATCH | `/api/v1/workflows/{id}` | Partial update |
| Delete | DELETE | `/api/v1/workflows/{id}` | Permanent deletion |
| Execute | POST | `/api/v1/workflows/{id}/run` | Manual execution |
| Activate | PATCH | `/api/v1/workflows/{id}/activate` | Enable triggers |
| Deactivate | PATCH | `/api/v1/workflows/{id}/deactivate` | Disable triggers |

### Execution Operations

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List | GET | `/api/v1/executions` |
| Get | GET | `/api/v1/executions/{id}` |
| Delete | DELETE | `/api/v1/executions/{id}` |
| Stop | POST | `/api/v1/executions/{id}/stop` |

### Credential Operations

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List | GET | `/api/v1/credentials` |
| Create | POST | `/api/v1/credentials` |
| Update | PATCH | `/api/v1/credentials/{id}` |
| Delete | DELETE | `/api/v1/credentials/{id}` |

---

## 6. Type Definitions Summary

```typescript
// Core types for renderer process
export type Theme = 'dark' | 'light' | 'system';
export type N8nServerStatus = 'starting' | 'running' | 'stopped' | 'error';
export type WorkflowStatus = 'active' | 'inactive';
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'waiting';
export type AIServiceType = 'openai' | 'gemini' | 'ollama' | 'lm-studio';
export type AIServiceProvider = 'cloud' | 'local';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'not-configured';

// UI-specific types
export interface WorkflowCard {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  lastModified: string;
  status: WorkflowStatus;
  aiService?: string;
}

export interface AIServiceCard {
  id: string;
  name: string;
  type: AIServiceType;
  provider: AIServiceProvider;
  status: ConnectionStatus;
  models: string[];
}
```
