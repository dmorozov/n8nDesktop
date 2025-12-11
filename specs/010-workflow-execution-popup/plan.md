# Implementation Plan: Workflow Execution Popup

**Branch**: `010-workflow-execution-popup` | **Date**: 2025-12-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-workflow-execution-popup/spec.md`

## Summary

Transform the workflow interaction model from "edit-first" to "execute-first" by replacing the workflow card click behavior. Instead of opening the n8n editor, clicking a workflow card opens a simplified three-panel execution popup: input panel (left) for prompts/files, visual indicator (middle) with n8n icon that links to editor, and output panel (right) for results/downloads. The popup communicates with n8n via the existing Electron bridge (Direct IPC) to trigger workflow execution and retrieve results. Configuration is persisted per workflow ID using electron-store.

## Technical Context

**Language/Version**: TypeScript 5.6+
**Primary Dependencies**: React 19, Electron 39, electron-store, Radix UI, TailwindCSS 4, n8n-workflow (for node detection)
**Storage**: electron-store (popup configs), n8n SQLite (workflows)
**Testing**: Vitest (unit), Playwright (e2e)
**Target Platform**: Windows 10/11, macOS 11+, Linux (Ubuntu 20.04+)
**Project Type**: Electron desktop app with React renderer
**Performance Goals**: Popup opens <500ms, results display <2s after completion
**Constraints**: 5-minute execution timeout, single execution at a time, 80% modal sizing
**Scale/Scope**: Single-user desktop app, 10 files max per execution

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. User-First Simplicity | ✅ PASS | Popup simplifies workflow execution for non-technical users; eliminates need to navigate n8n editor |
| II. Data Portability | ✅ PASS | Popup configs stored in electron-store within user data folder; portable with data folder |
| III. Bundled Self-Containment | ✅ PASS | No new external dependencies; uses existing bundled n8n and Electron |
| IV. Transparent Server Lifecycle | ✅ PASS | Execution status shown in popup; respects existing n8n server lifecycle |
| V. Test-Required Development | ⚠️ PENDING | Tests required before merge; plan includes test tasks |

## Project Structure

### Documentation (this feature)

```text
specs/010-workflow-execution-popup/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ipc-contracts.ts # IPC type definitions
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── services/
│   │   ├── electron-bridge.ts        # Extend with workflow execution endpoints
│   │   └── workflow-executor.ts      # NEW: Workflow execution orchestration
│   ├── ipc-handlers/
│   │   └── workflow-execution.ts     # NEW: IPC handlers for popup
│   └── stores/
│       └── popup-config-store.ts     # NEW: electron-store for popup configs
├── renderer/src/
│   ├── components/
│   │   ├── features/
│   │   │   └── workflow-popup/       # NEW: Popup components
│   │   │       ├── WorkflowExecutionPopup.tsx
│   │   │       ├── InputPanel.tsx
│   │   │       ├── OutputPanel.tsx
│   │   │       ├── CenterIndicator.tsx
│   │   │       ├── PromptInput.tsx
│   │   │       ├── FileSelector.tsx
│   │   │       ├── MarkdownOutput.tsx
│   │   │       └── FileDownload.tsx
│   │   └── ui/
│   │       └── modal.tsx             # NEW: Responsive modal wrapper
│   ├── stores/
│   │   └── workflow-execution.ts     # NEW: Execution state store
│   └── hooks/
│       └── useWorkflowExecution.ts   # NEW: Execution hook
├── preload/
│   └── index.ts                      # Extend with execution IPC
└── n8n_nodes/nodes/
    ├── FileSelector/
    │   └── FileSelector.node.ts      # Modify: Support external file config
    ├── PromptInput/
    │   └── PromptInput.node.ts       # Modify: Support external prompt config
    └── ResultDisplay/
        └── ResultDisplay.node.ts     # Modify: Emit output for external use

tests/
├── unit/
│   └── workflow-execution/           # NEW: Unit tests
└── e2e/
    └── workflow-popup.spec.ts        # NEW: E2E tests
```

**Structure Decision**: Extends existing Electron architecture. New popup components in `renderer/src/components/features/workflow-popup/`. Main process extensions in `main/services/` and `main/ipc-handlers/`. Custom n8n nodes modified in-place in `n8n_nodes/nodes/`.

## Complexity Tracking

No constitution violations requiring justification.

## Implementation Phases

### Phase 1: Core Infrastructure (P1 - Execute Workflow)

1. **Popup Config Store** - Create `src/main/stores/popup-config-store.ts`
   - Use electron-store to persist configs keyed by workflow ID
   - Define WorkflowPopupConfig, InputFieldConfig, OutputResult types
   - Implement get/set/delete operations

2. **Workflow Executor Service** - Create `src/main/services/workflow-executor.ts`
   - Parse workflow JSON to detect PromptInput, FileSelector, ResultDisplay nodes
   - Build input payload from popup configuration
   - Call n8n API to trigger workflow execution with input data
   - Poll for execution completion (5-minute timeout)
   - Extract ResultDisplay outputs from execution results

3. **Electron Bridge Extensions** - Extend `src/main/services/electron-bridge.ts`
   - `/api/electron-bridge/workflow/analyze` - Detect input/output nodes
   - `/api/electron-bridge/workflow/execute` - Execute workflow with inputs
   - `/api/electron-bridge/workflow/status/:executionId` - Check execution status
   - `/api/electron-bridge/workflow/results/:executionId` - Get execution results

4. **IPC Handlers** - Create `src/main/ipc-handlers/workflow-execution.ts`
   - `workflow-popup:analyze` - Analyze workflow for popup config
   - `workflow-popup:execute` - Execute workflow
   - `workflow-popup:get-config` - Get stored popup config
   - `workflow-popup:save-config` - Save popup config

5. **Preload Extensions** - Extend `src/preload/index.ts`
   - Expose workflow execution IPC methods

### Phase 2: UI Components (P1 - Popup + P2 - Inputs)

6. **Modal Component** - Create `src/renderer/src/components/ui/modal.tsx`
   - Responsive 80% width/height centered overlay
   - Backdrop click to close (with confirmation if executing)
   - Keyboard navigation (Escape to close)

7. **WorkflowExecutionPopup** - Create `src/renderer/src/components/features/workflow-popup/WorkflowExecutionPopup.tsx`
   - Three-panel layout (flex with left/center/right)
   - Execute button at bottom
   - Loading state during execution
   - Integration with execution store

8. **InputPanel** - Create `src/renderer/src/components/features/workflow-popup/InputPanel.tsx`
   - Dynamically render inputs based on detected nodes
   - Support multiple PromptInput and FileSelector instances
   - Label each input with node display name

9. **PromptInput Component** - Create `src/renderer/src/components/features/workflow-popup/PromptInput.tsx`
   - Markdown text area with basic formatting
   - Character/word count display
   - Persist value to popup config

10. **FileSelector Component** - Create `src/renderer/src/components/features/workflow-popup/FileSelector.tsx`
    - Browse button to open native file picker
    - List selected files with name, size, remove button
    - Max 10 files validation
    - Persist selections to popup config

11. **CenterIndicator** - Create `src/renderer/src/components/features/workflow-popup/CenterIndicator.tsx`
    - n8n workflow icon
    - Click to open n8n editor
    - Animated state during execution

### Phase 3: Output & Results (P1 - View Results)

12. **OutputPanel** - Create `src/renderer/src/components/features/workflow-popup/OutputPanel.tsx`
    - Scrollable container for multiple outputs
    - Placeholder before first execution
    - Error display for failed workflows

13. **MarkdownOutput** - Create `src/renderer/src/components/features/workflow-popup/MarkdownOutput.tsx`
    - Render markdown from ResultDisplay node
    - Sanitized HTML output
    - Scrollable for long content

14. **FileDownload** - Create `src/renderer/src/components/features/workflow-popup/FileDownload.tsx`
    - Download button for file outputs
    - Save to local filesystem via Electron dialog
    - Display filename and size

### Phase 4: State Management & Integration

15. **Execution Store** - Create `src/renderer/src/stores/workflow-execution.ts`
    - Nanostores for execution state (idle/running/completed/failed)
    - Current workflow ID
    - Execution results
    - Error messages

16. **useWorkflowExecution Hook** - Create `src/renderer/src/hooks/useWorkflowExecution.ts`
    - Abstract IPC calls for execution
    - Handle timeout logic
    - Update execution store

17. **WorkflowCard Integration** - Modify `src/renderer/src/components/features/workflows/WorkflowCard.tsx`
    - Change onClick to open popup instead of n8n editor
    - Keep Run button behavior separate

### Phase 5: Node Modifications (FR-021 to FR-024)

18. **FileSelector Node Update** - Modify `src/n8n_nodes/nodes/FileSelector/FileSelector.node.ts`
    - Check for external file config in environment/workflow variables
    - Fallback to internal state if no external config
    - Maintain backward compatibility

19. **PromptInput Node Update** - Modify `src/n8n_nodes/nodes/PromptInput/PromptInput.node.ts`
    - Check for external prompt config in environment/workflow variables
    - Fallback to node parameter if no external config
    - Maintain backward compatibility

20. **ResultDisplay Node Update** - Modify `src/n8n_nodes/nodes/ResultDisplay/ResultDisplay.node.ts`
    - Emit output in structured format for external consumption
    - Include content type and file references
    - Maintain backward compatibility

### Phase 6: Testing

21. **Unit Tests** - Create `tests/unit/workflow-execution/`
    - PopupConfigStore tests
    - WorkflowExecutor tests (node detection, payload building)
    - Component tests for popup

22. **E2E Tests** - Create `tests/e2e/workflow-popup.spec.ts`
    - Open popup from workflow card
    - Enter prompt, select files
    - Execute workflow
    - View results

## Dependencies

- **Spec 009 (Custom n8n Nodes)**: FileSelector, PromptInput, ResultDisplay nodes must be functional
- **Electron Bridge**: Existing HTTP bridge infrastructure (port 5680)
- **electron-store**: Already installed in package.json
- **n8n API**: Requires understanding of n8n execution API for triggering workflows

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| n8n API changes between versions | High | Abstract API calls, version check |
| Large file handling performance | Medium | Validate file count, warn on large files |
| Execution timeout not detected | Medium | Client-side timeout with abort |
| Node detection fails for complex workflows | Low | Graceful fallback to empty inputs |

## Open Questions (Resolved in Clarifications)

- ✅ Execution mechanism: Direct IPC via Electron bridge
- ✅ Concurrent executions: Disabled (one at a time)
- ✅ Timeout: 5 minutes
- ✅ Popup sizing: 80% responsive modal
- ✅ Config storage: electron-store keyed by workflow ID
