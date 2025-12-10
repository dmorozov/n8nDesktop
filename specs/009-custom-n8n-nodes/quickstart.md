# Quickstart: Custom n8n Nodes

**Feature**: 009-custom-n8n-nodes
**Date**: 2025-12-10

## Overview

This guide provides quick instructions for setting up, developing, and testing the custom n8n nodes for n8n Desktop.

---

## Prerequisites

- Node.js v22 or higher
- npm 10+
- n8n Desktop project cloned and dependencies installed
- Basic understanding of TypeScript and n8n workflows

---

## Project Setup

### 1. Initialize the n8n_nodes sub-project

```bash
# From project root
mkdir -p src/n8n_nodes
cd src/n8n_nodes

# Initialize npm package
npm init -y

# Install dependencies
npm install n8n-workflow
npm install -D @n8n/node-cli typescript @types/node
```

### 2. Configure package.json

Update `src/n8n_nodes/package.json`:

```json
{
  "name": "n8n-nodes-desktop",
  "version": "1.0.0",
  "description": "Custom n8n nodes for n8n Desktop application",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && node-cli build",
    "dev": "tsc -w",
    "lint": "eslint nodes/",
    "lint:fix": "eslint nodes/ --fix"
  },
  "n8n": {
    "n8nNodesApiVersion": 1,
    "nodes": [
      "dist/nodes/FileSelector/FileSelector.node.js",
      "dist/nodes/PromptInput/PromptInput.node.js",
      "dist/nodes/ResultDisplay/ResultDisplay.node.js"
    ],
    "credentials": []
  },
  "devDependencies": {
    "@n8n/node-cli": "^1.0.0",
    "@types/node": "^24.10.2",
    "typescript": "^5.9.3",
    "eslint": "^9.39.1",
    "typescript-eslint": "^8.49.0"
  },
  "dependencies": {
    "n8n-workflow": "^1.0.0"
  }
}
```

### 3. Configure TypeScript

Create `src/n8n_nodes/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["nodes/**/*", "*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Configure ESLint

Create `src/n8n_nodes/eslint.config.mjs`:

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: ['node_modules/', 'dist/'],
  }
);
```

---

## Creating a Node

### 1. Create Node Directory Structure

```bash
mkdir -p nodes/FileSelector
mkdir -p nodes/PromptInput
mkdir -p nodes/ResultDisplay
```

### 2. Create Node Files

Each node needs:
- `NodeName.node.ts` - Main node implementation
- `NodeName.node.json` - Codex file (metadata)
- `icon.svg` or `icon.png` - Node icon

### 3. Example: PromptInput Node

`nodes/PromptInput/PromptInput.node.ts`:

```typescript
import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class PromptInput implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Prompt Input',
    name: 'promptInput',
    icon: 'file:promptInput.svg',
    group: ['input'],
    version: 1,
    description: 'Enter formatted prompt text with markdown support',
    defaults: {
      name: 'Prompt Input',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        typeOptions: {
          editor: 'htmlEditor',
          rows: 10,
        },
        default: '',
        placeholder: 'Enter your prompt here...',
        description: 'The prompt text (supports markdown)',
      },
      {
        displayName: 'Trim Whitespace',
        name: 'trimWhitespace',
        type: 'boolean',
        default: true,
        description: 'Remove leading/trailing whitespace',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      let prompt = this.getNodeParameter('prompt', i, '') as string;
      const trimWhitespace = this.getNodeParameter('trimWhitespace', i, true) as boolean;

      if (trimWhitespace) {
        prompt = prompt.trim();
      }

      const wordCount = prompt.split(/\s+/).filter(Boolean).length;
      const lineCount = prompt.split('\n').length;

      returnData.push({
        json: {
          prompt,
          length: prompt.length,
          wordCount,
          lineCount,
          isValid: true,
        },
      });
    }

    return [returnData];
  }
}
```

`nodes/PromptInput/PromptInput.node.json`:

```json
{
  "node": "n8n-nodes-desktop.promptInput",
  "nodeVersion": "1.0",
  "codexVersion": "1.0",
  "categories": ["Core Nodes"],
  "resources": {
    "primaryDocumentation": [
      {
        "url": "https://github.com/your-repo/n8n-desktop"
      }
    ]
  }
}
```

---

## Building & Testing

### Build the Nodes

```bash
# From src/n8n_nodes
npm run build
```

### Run in Development Mode

```bash
# From project root
npm run dev

# In another terminal, start n8n with custom nodes
N8N_CUSTOM_EXTENSIONS=/path/to/n8nDesktop/src/n8n_nodes/dist npm run start
```

### Test in n8n Workflow

1. Start the n8n Desktop application
2. Open n8n editor
3. Search for "Prompt Input" in nodes panel
4. Add node to workflow
5. Configure and execute

---

## Integrating with Root Build

### Update Root package.json

Add to root `package.json` scripts:

```json
{
  "scripts": {
    "build:n8n-nodes": "cd src/n8n_nodes && npm run build",
    "setup:n8n-nodes": "cd src/n8n_nodes && npm install",
    "setup:all": "npm install && npm run setup:docling && npm run setup:n8n-nodes",
    "build:all": "npm run setup:all && npm run build:n8n-nodes && npm run build"
  }
}
```

### Update n8n Manager

In `src/main/n8n-manager.ts`, add to environment variables:

```typescript
import path from 'path';
import { app } from 'electron';

const getCustomNodesPath = () => {
  // In development
  if (process.env.NODE_ENV === 'development') {
    return path.join(process.cwd(), 'src/n8n_nodes/dist');
  }
  // In production (packaged app)
  return path.join(app.getAppPath(), 'src/n8n_nodes/dist');
};

const env = {
  // ... existing env vars
  N8N_CUSTOM_EXTENSIONS: getCustomNodesPath(),
};
```

---

## Electron Bridge Setup

### Create Bridge Server

In `src/main/services/electron-bridge.ts`:

```typescript
import http from 'http';
import { dialog } from 'electron';
import { configManager } from '../config-manager';

// Note: Port 5679 is reserved for n8n Task Broker, so we use 5680
const BRIDGE_PORT = 5680;

export function startElectronBridge() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${BRIDGE_PORT}`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5678');

    if (url.pathname === '/api/electron-bridge/health') {
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    if (url.pathname === '/api/electron-bridge/files/select' && req.method === 'POST') {
      // Handle file selection
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
      });

      res.end(JSON.stringify({
        success: !result.canceled,
        cancelled: result.canceled,
        selectedPaths: result.filePaths,
        fileCount: result.filePaths.length,
      }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(BRIDGE_PORT, '127.0.0.1', () => {
    console.log(`Electron bridge listening on http://127.0.0.1:${BRIDGE_PORT}`);
  });

  return server;
}
```

### Start Bridge on App Ready

In `src/main/index.ts`:

```typescript
import { startElectronBridge } from './services/electron-bridge';

app.whenReady().then(async () => {
  // ... existing initialization

  // Start Electron bridge for custom nodes
  startElectronBridge();
});
```

---

## Common Issues & Solutions

### Node Not Appearing in n8n

1. Check `N8N_CUSTOM_EXTENSIONS` path is correct
2. Verify build completed without errors
3. Restart n8n after adding new nodes
4. Check n8n logs for loading errors

### TypeScript Errors

1. Ensure `n8n-workflow` types are installed
2. Check TypeScript version compatibility
3. Run `npm run lint` to identify issues

### Bridge Connection Fails

1. Verify Electron bridge is running (check console)
2. Ensure port 5680 is not in use (port 5679 is reserved for n8n Task Broker)
3. Check CORS headers if testing from browser

---

## Next Steps

1. Implement FileSelector node with full IPC
2. Implement ResultDisplay node
3. Add comprehensive error handling
4. Add unit tests for each node
5. Document node usage for end users
