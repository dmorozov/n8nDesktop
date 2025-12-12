# Research: Workflow Execution Popup

**Feature**: 010-workflow-execution-popup
**Date**: 2025-12-10

## Research Topics

### 1. n8n Workflow Execution API

**Question**: How to programmatically trigger n8n workflow execution with custom input data?

**Decision**: Use n8n's REST API `/api/v1/workflows/{id}/run` endpoint with POST body containing input data.

**Rationale**:
- n8n exposes a REST API when running (default port 5678)
- The `/api/v1/workflows/{id}/run` endpoint accepts a payload that becomes available to trigger nodes
- Execution can be triggered synchronously (wait for result) or asynchronously (returns execution ID)
- For our use case, async execution with polling is preferred to handle 5-minute timeout

**API Details**:
```typescript
// Trigger execution
POST /api/v1/workflows/{workflowId}/run
Body: {
  "runData": {
    "startNodes": ["PromptInput", "FileSelector"],
    "destinationNode": "ResultDisplay"
  },
  "workflowData": { /* optional override */ }
}

// Check execution status
GET /api/v1/executions/{executionId}
Response: {
  "id": "123",
  "status": "running" | "success" | "error" | "waiting",
  "data": { /* execution data */ }
}
```

**Alternatives Considered**:
- Direct n8n CLI execution: Rejected - requires spawning new process, loses context
- Webhook triggers: Rejected - requires workflow modification, not transparent

### 2. Workflow Node Detection

**Question**: How to detect PromptInput, FileSelector, ResultDisplay nodes in a workflow?

**Decision**: Parse workflow JSON from n8n API, filter nodes by `type` property matching our custom node names.

**Rationale**:
- Workflows are stored as JSON with a `nodes` array
- Each node has a `type` field (e.g., `n8n-nodes-desktop.promptInput`)
- Also has `name` field for display name and `parameters` for configuration
- Simple filtering provides reliable detection

**Implementation**:
```typescript
interface WorkflowNode {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  position: [number, number];
}

function detectInputOutputNodes(workflow: { nodes: WorkflowNode[] }) {
  return {
    promptInputs: workflow.nodes.filter(n => n.type === 'n8n-nodes-desktop.promptInput'),
    fileSelectors: workflow.nodes.filter(n => n.type === 'n8n-nodes-desktop.fileSelector'),
    resultDisplays: workflow.nodes.filter(n => n.type === 'n8n-nodes-desktop.resultDisplay'),
  };
}
```

**Alternatives Considered**:
- AST parsing: Rejected - overkill for simple node detection
- n8n internal APIs: Rejected - not stable, version-dependent

### 3. Passing Data to Custom Nodes

**Question**: How to pass popup input data to PromptInput and FileSelector nodes during execution?

**Decision**: Use n8n's workflow static data and environment variables via Electron bridge.

**Rationale**:
- n8n custom nodes can access `process.env` for configuration
- The Electron bridge URL is already passed as `ELECTRON_BRIDGE_URL`
- Nodes can fetch their input configuration from a new bridge endpoint
- Execution ID ties the config to the specific run

**Implementation Flow**:
1. Before execution, store input config in bridge: `POST /api/electron-bridge/execution-config`
2. Start workflow execution, pass execution ID
3. Custom nodes call `GET /api/electron-bridge/execution-config/{nodeId}`
4. Nodes use external config if available, fall back to internal state

**Alternatives Considered**:
- n8n workflow variables: Limited, not available in community nodes
- Direct injection into workflow JSON: Modifies workflow, not clean

### 4. Retrieving Execution Results

**Question**: How to get ResultDisplay node outputs after execution completes?

**Decision**: Poll n8n execution API, extract ResultDisplay node data from execution result.

**Rationale**:
- Execution results contain output data for each node
- ResultDisplay node outputs its `content` and file references
- Polling every 1 second until completion or timeout
- 5-minute (300s) timeout enforced client-side

**Implementation**:
```typescript
async function pollExecution(executionId: string, timeout: number): Promise<ExecutionResult> {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (Date.now() - startTime < timeout) {
    const result = await fetch(`${n8nUrl}/api/v1/executions/${executionId}`);
    const data = await result.json();

    if (data.status === 'success' || data.status === 'error') {
      return extractResultDisplayOutputs(data);
    }

    await sleep(pollInterval);
  }

  throw new Error('Execution timeout');
}
```

**Alternatives Considered**:
- WebSocket streaming: Not available in n8n community edition
- Callback webhook: Requires external endpoint, complexity

### 5. Responsive Modal Implementation

**Question**: Best approach for 80% width/height responsive modal in React/Radix?

**Decision**: Use Radix Dialog with custom CSS for responsive sizing.

**Rationale**:
- Radix Dialog already used in project (see existing dialogs)
- CSS viewport units (`vw`, `vh`) provide responsive sizing
- Tailwind classes for consistent styling
- Backdrop handling built into Radix

**Implementation**:
```tsx
<Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]
  w-[80vw] h-[80vh] max-w-[1400px] max-h-[900px]
  bg-background rounded-lg shadow-xl overflow-hidden">
  <div className="flex h-full">
    <div className="w-1/3 border-r p-4 overflow-y-auto">/* Input Panel */</div>
    <div className="w-[100px] flex items-center justify-center">/* Center */</div>
    <div className="flex-1 p-4 overflow-y-auto">/* Output Panel */</div>
  </div>
</Dialog.Content>
```

**Alternatives Considered**:
- Headless UI: Not already in project
- Custom modal: More work, less accessible

### 6. electron-store Configuration Schema

**Question**: How to structure popup configuration storage?

**Decision**: Keyed by workflow ID, store inputs, outputs, and metadata.

**Rationale**:
- electron-store supports nested JSON structures
- Workflow ID is unique identifier
- Store last input values for quick re-execution
- Store last output for display on popup reopen

**Schema**:
```typescript
interface PopupConfigStore {
  popupConfigs: {
    [workflowId: string]: {
      workflowId: string;
      workflowName: string;
      lastUpdated: string;
      inputs: {
        [nodeId: string]: {
          nodeType: 'promptInput' | 'fileSelector';
          nodeName: string;
          value: string | FileReference[];
        };
      };
      lastExecution: {
        executionId: string;
        status: 'success' | 'error';
        timestamp: string;
        outputs: OutputResult[];
      } | null;
    };
  };
}
```

**Alternatives Considered**:
- SQLite: Overkill for simple config
- File per workflow: Harder to manage

### 7. File Selection IPC Pattern

**Question**: How to trigger native file picker from renderer and get results?

**Decision**: Extend existing IPC pattern used in backup-manager.

**Rationale**:
- Project already uses Electron IPC for dialogs (see backup-manager.ts)
- `dialog.showOpenDialog` returns file paths
- Can specify filters, multi-select, default path
- Results returned via IPC invoke/response

**Implementation**:
```typescript
// Main process (ipc-handlers/workflow-execution.ts)
ipcMain.handle('workflow-popup:select-files', async (event, options) => {
  const result = await dialog.showOpenDialog({
    title: options.title || 'Select Files',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: ['openFile', 'multiSelections'],
  });
  return {
    cancelled: result.canceled,
    filePaths: result.filePaths,
  };
});

// Renderer (via preload)
const files = await window.electron.workflowPopup.selectFiles({
  title: 'Select documents',
  filters: [{ name: 'Documents', extensions: ['pdf', 'docx'] }],
});
```

**Alternatives Considered**:
- HTML file input: No native look, limited features
- Electron bridge HTTP: Already have IPC, more direct

## Summary

All research topics resolved. Key decisions:
1. Use n8n REST API for workflow execution
2. Parse workflow JSON for node detection
3. Electron bridge stores execution config for nodes to fetch
4. Poll execution status with 5-minute timeout
5. Radix Dialog with viewport-based CSS for modal
6. electron-store with workflow ID keys for persistence
7. Standard Electron IPC for file dialogs
