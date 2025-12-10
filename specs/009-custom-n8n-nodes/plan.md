# Implementation Plan: Custom n8n Nodes with User-Friendly UI

**Branch**: `009-custom-n8n-nodes` | **Date**: 2025-12-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-custom-n8n-nodes/spec.md`

## Summary

This feature creates a new sub-project (`src/n8n_nodes`) containing custom n8n nodes specifically designed for the n8n Desktop application. The nodes provide user-friendly interfaces for:
1. **FileSelector** - Native file picker with automatic file import to n8n data folder
2. **PromptInput** - Markdown editor for entering formatted prompts
3. **ResultDisplay** - Formatted display of workflow execution results

The architecture uses n8n's standard node API with communication to Electron via a localhost HTTP bridge for native OS integrations (file dialogs).

## Technical Context

**Language/Version**: TypeScript 5.9+, Node.js 22+
**Primary Dependencies**: n8n-workflow, @n8n/node-cli (build), React 19 (if UI components needed)
**Storage**: File-based (n8n data folder), n8n workflow JSON
**Testing**: Vitest (unit tests), Playwright (e2e)
**Target Platform**: Electron desktop (Windows, macOS, Linux) with embedded n8n
**Project Type**: Sub-project within monorepo (src/n8n_nodes)
**Performance Goals**: Node execution <1s, file dialog response <100ms, file copy throughput >50MB/s
**Constraints**: Must work with embedded n8n, no external dependencies beyond n8n-workflow
**Scale/Scope**: 3 custom nodes, 1 HTTP bridge service, integration with build:all

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. User-First Simplicity | ✅ PASS | File picker replaces manual path entry; markdown editor improves prompt creation; result display eliminates JSON parsing |
| II. Data Portability | ✅ PASS | All imported files stored in user-selected data folder; portable with n8n data |
| III. Bundled Self-Containment | ✅ PASS | Custom nodes bundled with app; no external dependencies required at runtime |
| IV. Transparent Server Lifecycle | ✅ PASS | Nodes work within existing n8n server lifecycle; no additional processes |
| V. Test-Required Development | ✅ PASS | Unit tests for node logic; integration tests for Electron bridge |

## Project Structure

### Documentation (this feature)

```text
specs/009-custom-n8n-nodes/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research findings
├── data-model.md        # Entity definitions and state transitions
├── quickstart.md        # Developer setup guide
├── contracts/           # API contracts
│   ├── electron-bridge-api.yaml    # OpenAPI spec for bridge
│   └── n8n-node-interfaces.ts      # TypeScript interfaces
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── services/
│   │   └── electron-bridge.ts       # NEW: HTTP bridge for custom nodes
│   └── n8n-manager.ts               # MODIFIED: Add N8N_CUSTOM_EXTENSIONS
│
├── n8n_nodes/                       # NEW: Custom nodes sub-project
│   ├── package.json                 # n8n node package config
│   ├── tsconfig.json                # TypeScript config
│   ├── eslint.config.mjs            # ESLint flat config
│   ├── nodes/
│   │   ├── FileSelector/
│   │   │   ├── FileSelector.node.ts
│   │   │   ├── FileSelector.node.json
│   │   │   └── fileSelector.svg
│   │   ├── PromptInput/
│   │   │   ├── PromptInput.node.ts
│   │   │   ├── PromptInput.node.json
│   │   │   └── promptInput.svg
│   │   └── ResultDisplay/
│   │       ├── ResultDisplay.node.ts
│   │       ├── ResultDisplay.node.json
│   │       └── resultDisplay.svg
│   └── lib/
│       ├── bridge-client.ts         # HTTP client for Electron bridge
│       └── types.ts                 # Shared types
│
└── preload/
    └── types.ts                     # MODIFIED: Add bridge types

tests/
├── unit/
│   └── n8n-nodes/
│       ├── FileSelector.test.ts
│       ├── PromptInput.test.ts
│       └── ResultDisplay.test.ts
└── integration/
    └── electron-bridge.test.ts
```

**Structure Decision**: Sub-project pattern chosen to maintain separation between Electron app code and n8n node code, while enabling unified build process.

## Implementation Phases

### Phase 1: Project Scaffolding

**Objective**: Set up the n8n_nodes sub-project with build infrastructure.

**Tasks**:
1. Create `src/n8n_nodes/` directory structure
2. Initialize package.json with n8n configuration
3. Configure TypeScript (tsconfig.json)
4. Configure ESLint (eslint.config.mjs) aligned with root project
5. Add scripts to root package.json (build:n8n-nodes, setup:n8n-nodes)
6. Verify build pipeline produces correct output

**Dependencies**: None
**Estimated Complexity**: Low

---

### Phase 2: Electron Bridge Service

**Objective**: Create HTTP bridge for custom nodes to communicate with Electron.

**Tasks**:
1. Create `src/main/services/electron-bridge.ts`
2. Implement health check endpoint (`/health`)
3. Implement file selection endpoint (`/files/select`)
4. Implement file copy endpoint (`/files/copy`)
5. Implement data folder endpoint (`/config/data-folder`)
6. Start bridge on app ready
7. Pass bridge URL to n8n via environment variable

**Dependencies**: Phase 1
**Estimated Complexity**: Medium

---

### Phase 3: PromptInput Node

**Objective**: Implement the simplest node first as a foundation.

**Tasks**:
1. Create node directory structure
2. Implement PromptInput.node.ts with htmlEditor
3. Create codex file (PromptInput.node.json)
4. Create node icon
5. Add validation for min/max length
6. Add word count and line count output
7. Write unit tests

**Dependencies**: Phase 1
**Estimated Complexity**: Low

---

### Phase 4: FileSelector Node

**Objective**: Implement file selection with Electron integration.

**Tasks**:
1. Create node directory structure
2. Implement bridge client library (`lib/bridge-client.ts`)
3. Implement FileSelector.node.ts with execute method
4. Create codex file and icon
5. Implement file type filtering
6. Implement duplicate handling (rename/skip/overwrite)
7. Output file references with metadata
8. Write unit and integration tests

**Dependencies**: Phase 2, Phase 3
**Estimated Complexity**: High

---

### Phase 5: ResultDisplay Node

**Objective**: Implement result display with markdown rendering.

**Tasks**:
1. Create node directory structure
2. Implement ResultDisplay.node.ts
3. Implement JSON path extraction
4. Add fallback text handling
5. Implement content truncation
6. Create codex file and icon
7. Write unit tests

**Dependencies**: Phase 3
**Estimated Complexity**: Medium

---

### Phase 6: n8n Integration

**Objective**: Make custom nodes available to embedded n8n.

**Tasks**:
1. Modify `src/main/n8n-manager.ts` to set N8N_CUSTOM_EXTENSIONS
2. Handle development vs production paths
3. Verify nodes appear in n8n palette
4. Test node persistence in workflows
5. Document node usage

**Dependencies**: Phase 4, Phase 5
**Estimated Complexity**: Medium

---

### Phase 7: Build Integration & Testing

**Objective**: Integrate with main build process and add comprehensive tests.

**Tasks**:
1. Update build:all script to include n8n_nodes build
2. Ensure clean build from scratch works
3. Add e2e tests for complete workflow
4. Test on all platforms (Windows, macOS, Linux)
5. Performance testing for file operations

**Dependencies**: Phase 6
**Estimated Complexity**: Medium

---

## Key Technical Decisions

### 1. Communication Pattern: HTTP Bridge

**Decision**: Use localhost HTTP server instead of direct IPC.

**Rationale**:
- n8n nodes run in separate process from Electron
- HTTP is language-agnostic and well-supported
- Aligns with existing IPC patterns (see IPC_RECOMMENDATIONS.md)
- Simpler debugging (can test with curl/Postman)

### 2. Node UI Approach: Built-in Editors

**Decision**: Use n8n's built-in `htmlEditor` and standard UI elements.

**Rationale**:
- n8n doesn't support custom React components in nodes
- Built-in editors provide good UX for text entry
- File selection handled via execute() method, not UI button

### 3. File Handling: Copy to Data Folder

**Decision**: Always copy files to n8n data folder instead of referencing originals.

**Rationale**:
- Ensures data portability (Constitution Principle II)
- Protects against deleted/moved source files
- Enables file deduplication via hash

### 4. Package Structure: Sub-project

**Decision**: Create `src/n8n_nodes` as semi-independent sub-project.

**Rationale**:
- n8n nodes have specific package.json requirements
- Separates concerns between Electron and n8n code
- Enables future publishing as community nodes if desired

---

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| n8n API changes break nodes | Pin n8n-workflow version, monitor n8n releases |
| Bridge port conflict | Make port configurable, use port-finder utility |
| Large file handling issues | Implement streaming, progress reporting, size limits |
| Cross-platform path issues | Use path.join(), test on all platforms |

---

## Dependencies Version Alignment

Aligned with root `package.json`:

```json
{
  "typescript": "^5.9.3",
  "eslint": "^9.39.1",
  "@types/node": "^24.10.2",
  "vitest": "^4.0.15"
}
```

n8n-specific (latest compatible):
```json
{
  "n8n-workflow": "^1.0.0",
  "@n8n/node-cli": "^1.0.0"
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| File selection time | <10s | Timer from click to selection complete |
| File copy throughput | >50MB/s | Benchmark with 100MB file |
| Node load time | <100ms | Measure n8n startup |
| Build time (n8n_nodes) | <30s | CI pipeline measurement |
| Test coverage | >80% | Vitest coverage report |

---

## Generated Artifacts

- [x] research.md - Research findings and decisions
- [x] data-model.md - Entity definitions and state transitions
- [x] contracts/electron-bridge-api.yaml - OpenAPI specification
- [x] contracts/n8n-node-interfaces.ts - TypeScript interfaces
- [x] quickstart.md - Developer setup guide
- [x] tasks.md - Generated by /speckit.tasks

---

## Next Steps

Run `/speckit.tasks` to generate the detailed task list for implementation.
