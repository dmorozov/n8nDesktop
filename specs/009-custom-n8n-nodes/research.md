# Research: Custom n8n Nodes with User-Friendly UI

**Feature**: 009-custom-n8n-nodes
**Date**: 2025-12-10

## Executive Summary

This research investigates how to create custom n8n nodes with enhanced UI capabilities (file picker, markdown editor, result display) for the n8n Desktop application. The key finding is that n8n's standard node UI system has limitations for truly custom interfaces, but we can achieve our goals through a hybrid approach combining n8n's built-in editor types with Electron IPC communication.

---

## Research Questions & Findings

### 1. Can n8n nodes have custom UI components?

**Decision**: Use n8n's built-in editor types for text editing; implement file picker via Electron IPC triggered by node execution.

**Rationale**: n8n nodes use a predefined set of UI components defined by the `type` and `typeOptions` properties. Available editor types include:
- `htmlEditor` - HTML template editing
- `codeNodeEditor` - Code editing with syntax highlighting
- `jsonEditor` - JSON editing
- `sqlEditor` - SQL query editing

**Alternatives considered**:
1. **Custom React components in n8n nodes** - Not supported; n8n renders UI from JSON definitions
2. **Override n8n's UI** - Would require forking n8n; not maintainable
3. **Separate popup window** - Adds complexity; poor UX

**Source**: [n8n Node UI Elements](https://docs.n8n.io/integrations/creating-nodes/build/reference/ui-elements/)

---

### 2. How can we implement a native file picker in an n8n node?

**Decision**: The File Selector node will trigger Electron's file dialog via IPC during node execution, not through a UI button.

**Rationale**: n8n does not have a native file picker UI component. The File Selector node will:
1. Execute and send an IPC message to Electron main process
2. Electron displays native file dialog (`dialog.showOpenDialog`)
3. Selected files are copied to n8n data folder
4. Node outputs file references

This approach works because:
- n8n allows external HTTP/socket communication in node execute methods
- Our Electron app can expose an IPC endpoint for file operations
- The n8n server runs locally, so localhost communication is secure

**Alternatives considered**:
1. **Text input for file path** - Poor UX; users must type full paths
2. **WebView inside node** - Not supported by n8n
3. **HTTP endpoint with file picker** - Possible but more complex

**Source**: [File Picker Feature Request](https://community.n8n.io/t/file-picker-dialog-for-read-write-files-from-disk-node/73275)

---

### 3. What is the correct package structure for n8n custom nodes?

**Decision**: Follow n8n community node structure with `n8n-nodes-` prefix, using the official starter template patterns.

**Package structure**:
```
src/n8n_nodes/
├── package.json           # n8n config section with nodes array
├── tsconfig.json          # TypeScript config
├── eslint.config.mjs      # ESLint config (flat config format)
├── nodes/
│   ├── FileSelector/
│   │   ├── FileSelector.node.ts
│   │   ├── FileSelector.node.json  # Codex file
│   │   └── fileSelector.svg
│   ├── PromptInput/
│   │   ├── PromptInput.node.ts
│   │   ├── PromptInput.node.json
│   │   └── promptInput.svg
│   └── ResultDisplay/
│       ├── ResultDisplay.node.ts
│       ├── ResultDisplay.node.json
│       └── resultDisplay.svg
└── credentials/            # (empty for this feature)
```

**package.json n8n section**:
```json
{
  "n8n": {
    "n8nNodesApiVersion": 1,
    "nodes": [
      "dist/nodes/FileSelector/FileSelector.node.js",
      "dist/nodes/PromptInput/PromptInput.node.js",
      "dist/nodes/ResultDisplay/ResultDisplay.node.js"
    ],
    "credentials": []
  }
}
```

**Source**: [n8n Nodes Starter](https://github.com/n8n-io/n8n-nodes-starter)

---

### 4. How do we make custom nodes available to the embedded n8n?

**Decision**: Use `N8N_CUSTOM_EXTENSIONS` environment variable pointing to the built nodes directory.

**Rationale**: n8n supports loading custom nodes from:
1. Default location: `~/.n8n/custom/`
2. Custom location via `N8N_CUSTOM_EXTENSIONS` environment variable

For our embedded n8n, we'll:
1. Build custom nodes to `src/n8n_nodes/dist/`
2. Set `N8N_CUSTOM_EXTENSIONS` to point to this directory when spawning n8n
3. Nodes will be available immediately on n8n startup

**Implementation in n8n-manager.ts**:
```typescript
const env = {
  // ... existing env vars
  N8N_CUSTOM_EXTENSIONS: path.join(app.getAppPath(), 'src/n8n_nodes/dist'),
};
```

**Source**: [n8n Custom Nodes Location](https://docs.n8n.io/hosting/configuration/configuration-examples/custom-nodes-location/)

---

### 5. How do n8n nodes communicate with external services?

**Decision**: Custom nodes will communicate with Electron via localhost HTTP endpoint.

**Rationale**: n8n nodes can make HTTP requests during execution. Since our Electron app already has IPC handlers, we can:
1. Expose a localhost HTTP endpoint from Electron main process (or use existing IPC)
2. Custom nodes make HTTP requests to this endpoint during `execute()`
3. Endpoint handles file dialog, clipboard, etc.

**Alternative approach for Electron IPC**:
Since n8n runs as a child process of Electron, we can also use:
- Named pipes/Unix sockets for direct IPC
- Environment variables to pass socket paths

The HTTP approach is simpler and aligns with existing architecture patterns (see IPC_RECOMMENDATIONS.md).

**Source**: [n8n IPC Recommendations](../../documentation/design/IPC_RECOMMENDATIONS.md)

---

### 6. What markdown editor should we use for the Prompt Input node?

**Decision**: Use n8n's built-in `htmlEditor` typeOption with markdown-to-HTML conversion in the node.

**Rationale**: n8n's `htmlEditor` provides:
- Syntax highlighting
- Multi-line text support
- Expression support with `{{}}`

The node will:
1. Accept input via `htmlEditor` (which supports plain text/markdown)
2. Store raw markdown text
3. Output markdown string for downstream nodes

**Alternative**: Create a custom Code node variant - more complex, not needed.

**Source**: [n8n Html.node.ts](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Html/Html.node.ts)

---

### 7. How should the Result Display node render markdown?

**Decision**: Use n8n's node hint system for displaying formatted output, with full markdown rendering via downstream processing.

**Rationale**: n8n supports "node hints" - messages displayed in the node output panel. For full markdown rendering:
1. Node extracts specified property from input JSON
2. Node outputs the markdown content
3. Users can view rendered markdown in n8n's output panel (which supports basic formatting)
4. For rich rendering, content can be passed to Electron app via workflow output

**Source**: [n8n Node Hints](https://docs.n8n.io/integrations/creating-nodes/build/reference/ui-elements/)

---

### 8. What are the dependency version alignments needed?

**Decision**: Align with main project versions for TypeScript, ESLint, and React.

**From main package.json**:
```json
{
  "typescript": "^5.9.3",
  "eslint": "^9.39.1",
  "react": "^19.2.1",
  "react-dom": "^19.2.1",
  "@types/react": "^19.2.7",
  "@types/node": "^24.10.2"
}
```

**n8n-specific dependencies**:
```json
{
  "n8n-workflow": "^1.0.0",        // Required for INodeType
  "@n8n/node-cli": "^1.0.0"       // Build tooling (dev)
}
```

**Note**: React is not directly used in n8n nodes (they're backend TypeScript), but if we add any React-based UI components for Electron integration, we'll use the same versions.

---

### 9. How do we integrate with the build:all script?

**Decision**: Add npm script to build n8n_nodes and include in build:all.

**Implementation**:
```json
// package.json (root)
{
  "scripts": {
    "build:n8n-nodes": "cd src/n8n_nodes && npm run build",
    "setup:n8n-nodes": "cd src/n8n_nodes && npm install",
    "setup:all": "npm install && npm run setup:docling && npm run setup:n8n-nodes",
    "build:all": "npm run setup:all && npm run build:n8n-nodes && npm run build"
  }
}
```

The custom nodes build outputs to `src/n8n_nodes/dist/`, which is then referenced by `N8N_CUSTOM_EXTENSIONS`.

---

## Technical Architecture

### Node Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ELECTRON MAIN PROCESS                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    IPC Handlers                           │   │
│  │  dialog:selectFile  →  dialog.showOpenDialog()           │   │
│  │  storage:copyFile   →  fs.copyFile()                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ▲                                   │
│                              │ HTTP (localhost)                  │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    N8N SERVER PROCESS                     │   │
│  │                                                           │   │
│  │   ┌─────────────────┐  ┌─────────────────┐               │   │
│  │   │ FileSelector    │  │ PromptInput     │               │   │
│  │   │ Node            │  │ Node            │               │   │
│  │   │                 │  │                 │               │   │
│  │   │ execute() ──────┼──┼→ HTTP to Main   │               │   │
│  │   │ ← file refs     │  │ ← markdown text │               │   │
│  │   └─────────────────┘  └─────────────────┘               │   │
│  │                                                           │   │
│  │   ┌─────────────────┐                                    │   │
│  │   │ ResultDisplay   │                                    │   │
│  │   │ Node            │                                    │   │
│  │   │                 │                                    │   │
│  │   │ execute() ──────┼─→ Extract property                 │   │
│  │   │ ← formatted out │   → Output markdown                │   │
│  │   └─────────────────┘                                    │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Electron IPC Bridge for File Selection

Since n8n nodes execute in the n8n server process (separate from Electron), we need a bridge:

1. **Option A: HTTP Endpoint** (Recommended)
   - Electron main process exposes localhost HTTP server
   - Custom nodes make HTTP requests during execute()
   - Simple, uses existing patterns

2. **Option B: Environment Variable Socket**
   - Pass socket path via env var
   - More complex, platform-specific

We'll use Option A, adding a simple Express/http server to Electron main process.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| n8n API changes | Medium | High | Pin n8n version, monitor updates |
| File dialog blocks workflow | Low | Medium | Implement timeout, async handling |
| Custom nodes not loading | Medium | High | Thorough testing, clear error messages |
| Performance with large files | Medium | Medium | Stream files, show progress |

---

## Recommendations

1. **Start with PromptInput node** - Simplest, uses built-in editor
2. **Implement FileSelector second** - Requires IPC bridge
3. **ResultDisplay last** - Depends on understanding output patterns
4. **Add comprehensive logging** - For debugging IPC communication
5. **Create dev mode workflow** - For testing nodes without full build

---

## Sources

- [n8n Node UI Elements](https://docs.n8n.io/integrations/creating-nodes/build/reference/ui-elements/)
- [n8n Build a Node](https://docs.n8n.io/integrations/creating-nodes/build/)
- [n8n Nodes Starter](https://github.com/n8n-io/n8n-nodes-starter)
- [n8n Custom Nodes Location](https://docs.n8n.io/hosting/configuration/configuration-examples/custom-nodes-location/)
- [n8n Standard Parameters](https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/standard-parameters/)
- [File Picker Feature Request](https://community.n8n.io/t/file-picker-dialog-for-read-write-files-from-disk-node/73275)
- [n8n Binary Data](https://docs.n8n.io/data/binary-data/)
