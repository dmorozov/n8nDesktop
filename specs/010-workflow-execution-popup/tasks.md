# Tasks: Workflow Execution Popup

**Input**: Design documents from `/specs/010-workflow-execution-popup/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/ipc-contracts.ts, research.md

**Tests**: Constitution Principle V requires tests before merge. Test tasks included per plan.md Phase 6.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US6)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization for popup feature

- [x] T001 Create directory structure `src/main/stores/` for popup config store
- [x] T002 Create directory structure `src/renderer/src/components/features/workflow-popup/` for popup components
- [x] T003 [P] Copy type definitions from `specs/010-workflow-execution-popup/contracts/ipc-contracts.ts` to `src/shared/types/workflow-popup.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Data Layer

- [x] T004 Create PopupConfigStore with electron-store in `src/main/stores/popup-config-store.ts`
  - Implement getPopupConfig(workflowId), setPopupConfig(config), deletePopupConfig(workflowId)
  - Use schema from data-model.md (WorkflowPopupConfig)
- [x] T005 [P] Create ExecutionState store with nanostores in `src/renderer/src/stores/workflow-execution.ts`
  - Implement $executionState atom (idle/running/completed/failed)
  - Implement $currentWorkflowId, $executionResults, $executionError

### IPC Infrastructure

- [x] T006 Create IPC handlers in `src/main/ipc-handlers/workflow-execution.ts`
  - Implement `workflow-popup:get-config` handler
  - Implement `workflow-popup:save-config` handler
  - Implement `workflow-popup:delete-config` handler
  - Implement `workflow-popup:select-files` handler
  - Implement `workflow-popup:save-file` handler
  - Implement `workflow-popup:copy-output-file` handler
- [x] T007 Extend preload API in `src/preload/index.ts`
  - Add workflowPopup object with all IPC methods per WorkflowPopupAPI interface
- [x] T008 Register IPC handlers in `src/main/ipc-handlers/index.ts`

### Electron Bridge Extensions

- [x] T009 Extend Electron bridge in `src/main/services/electron-bridge.ts`
  - Add `POST /api/electron-bridge/execution-config` endpoint
  - Add `GET /api/electron-bridge/execution-config/:executionId/:nodeId` endpoint
  - Add `DELETE /api/electron-bridge/execution-config/:executionId` endpoint
  - Add `POST /api/electron-bridge/execution-result` endpoint
  - Add `GET /api/electron-bridge/execution-results/:executionId` endpoint
  - Add in-memory store for execution configs and results

### Workflow Executor Service

- [x] T010 Create WorkflowExecutor service in `src/main/services/workflow-executor.ts`
  - Implement analyzeWorkflow(workflowId) - detect PromptInput, FileSelector, ResultDisplay nodes
  - Implement executeWorkflow(request) - call n8n API with inputs, return executionId
  - Implement pollExecution(executionId, timeout) - poll n8n API for completion (5 min timeout)
  - Implement extractResults(executionId) - get ResultDisplay outputs
- [x] T011 Add `workflow-popup:analyze` and `workflow-popup:execute` handlers to `src/main/ipc-handlers/workflow-execution.ts`
- [x] T012 Add `workflow-popup:status` and `workflow-popup:cancel` handlers to `src/main/ipc-handlers/workflow-execution.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Execute Workflow via Simplified Popup (Priority: P1) 🎯 MVP

**Goal**: Users can click workflow card, see popup with inputs, click Execute, and workflow runs

**Independent Test**: Click workflow card → popup opens → fill inputs → click Execute → workflow executes successfully

### Implementation for User Story 1

- [x] T013 [P] [US1] Create Modal component in `src/renderer/src/components/ui/modal.tsx`
  - 80% viewport width/height, centered overlay using Radix Dialog
  - Backdrop click to close, Escape key support
  - Close confirmation if execution in progress
- [x] T014 [P] [US1] Create CenterIndicator component in `src/renderer/src/components/features/workflow-popup/CenterIndicator.tsx`
  - n8n workflow icon
  - Animated pulse during execution
  - Click handler to open n8n editor
- [x] T015 [US1] Create InputPanel component in `src/renderer/src/components/features/workflow-popup/InputPanel.tsx`
  - Render inputs dynamically based on detected nodes
  - Support multiple inputs with node name labels
  - Empty state message when no input nodes
- [x] T016 [US1] Create WorkflowExecutionPopup main component in `src/renderer/src/components/features/workflow-popup/WorkflowExecutionPopup.tsx`
  - Three-panel layout (flex: left 40%, center 100px, right flex-1)
  - Execute button at bottom
  - Loading/disabled state during execution
  - Integrate with execution store
- [x] T017 [US1] Create useWorkflowExecution hook in `src/renderer/src/hooks/useWorkflowExecution.ts`
  - analyzeWorkflow() - call IPC to detect nodes
  - loadConfig() - get stored config
  - execute(inputs) - trigger execution with timeout handling
  - Poll for status and update store
- [x] T018 [US1] Modify WorkflowCard in `src/renderer/src/components/features/workflows/WorkflowCard.tsx`
  - Change onClick to open WorkflowExecutionPopup
  - Keep Run button with existing behavior
  - Add onOpenPopup callback prop
- [x] T019 [US1] Integrate popup into parent component (WorkflowGrid or HomePage)
  - Add selectedWorkflow state
  - Render WorkflowExecutionPopup when workflow selected
  - Handle close callback

**Checkpoint**: User Story 1 complete - can click card, see popup, execute workflow

---

## Phase 4: User Story 2 - View Formatted Results in Output Panel (Priority: P1)

**Goal**: After execution, users see formatted markdown output and can download files

**Independent Test**: Run workflow with ResultDisplay node → output appears in right panel as markdown → file outputs have download buttons

### Implementation for User Story 2

- [x] T020 [P] [US2] Create MarkdownOutput component in `src/renderer/src/components/features/workflow-popup/MarkdownOutput.tsx`
  - Render markdown content with sanitized HTML
  - Scrollable container for long content
  - Basic styling for markdown elements
- [x] T021 [P] [US2] Create FileDownload component in `src/renderer/src/components/features/workflow-popup/FileDownload.tsx`
  - Display filename and size
  - Download button triggers save dialog via IPC
  - Copy file to user-selected location
- [x] T022 [US2] Create OutputPanel component in `src/renderer/src/components/features/workflow-popup/OutputPanel.tsx`
  - Scrollable container for multiple outputs
  - Placeholder content before first execution
  - Error display for failed workflows
  - Render MarkdownOutput or FileDownload based on contentType
- [x] T023 [US2] Integrate OutputPanel into WorkflowExecutionPopup in `src/renderer/src/components/features/workflow-popup/WorkflowExecutionPopup.tsx`
  - Pass execution results to OutputPanel
  - Update on execution completion
- [x] T024 [US2] Update WorkflowExecutor to extract ResultDisplay outputs in `src/main/services/workflow-executor.ts`
  - Parse execution result for ResultDisplay node data
  - Build OutputResult[] from node outputs

**Checkpoint**: User Stories 1 & 2 complete - can execute and see results

---

## Phase 5: User Story 3 - Select Files via Popup Input Panel (Priority: P2)

**Goal**: Users can browse and select files in the popup, see file list, remove files

**Independent Test**: Open popup → click browse → select files → files appear in list → remove one → selection updated

### Implementation for User Story 3

- [x] T025 [US3] Create FileSelector popup component in `src/renderer/src/components/features/workflow-popup/FileSelector.tsx`
  - Browse button triggering native file picker via IPC
  - Display selected files with name, size, mimeType
  - Remove button for each file
  - Max 10 files validation with warning
  - Persist selections to config
- [x] T026 [US3] Integrate FileSelector into InputPanel in `src/renderer/src/components/features/workflow-popup/InputPanel.tsx`
  - Render FileSelector for fileSelector nodeType
  - Pass onChange handler for config updates
- [x] T027 [US3] Validate file existence before execution in `src/main/services/workflow-executor.ts`
  - Check each selected file exists on filesystem
  - Return error with missing file list if validation fails

**Checkpoint**: User Story 3 complete - file selection working

---

## Phase 6: User Story 4 - Enter Prompt Text via Popup Input Panel (Priority: P2)

**Goal**: Users can enter prompt text in the popup, text persists between sessions

**Independent Test**: Open popup → type prompt → close/reopen → text preserved → execute → prompt received by workflow

### Implementation for User Story 4

- [x] T028 [US4] Create PromptInput popup component in `src/renderer/src/components/features/workflow-popup/PromptInput.tsx`
  - Textarea with basic styling
  - Character count display
  - Persist value on change via config
- [x] T029 [US4] Integrate PromptInput into InputPanel in `src/renderer/src/components/features/workflow-popup/InputPanel.tsx`
  - Render PromptInput for promptInput nodeType
  - Pass onChange handler for config updates
- [x] T030 [US4] Add required field validation to InputPanel in `src/renderer/src/components/features/workflow-popup/InputPanel.tsx`
  - Disable Execute button if required inputs empty (FR-009)
  - Show validation hints on required fields

**Checkpoint**: User Story 4 complete - prompt input working

---

## Phase 7: User Story 5 - Store and Retrieve Popup Configuration (Priority: P3)

**Goal**: Popup configuration persists across sessions per workflow ID

**Independent Test**: Configure inputs → close app → reopen → open same workflow popup → config preserved

### Implementation for User Story 5

- [x] T031 [US5] Implement auto-save on config change in `src/renderer/src/hooks/useWorkflowExecution.ts`
  - Debounced save on input value changes
  - Save on popup close
- [x] T032 [US5] Implement config loading on popup open in `src/renderer/src/hooks/useWorkflowExecution.ts`
  - Load stored config by workflow ID
  - Merge with detected nodes (handle workflow changes)
  - Create default config if none exists
- [x] T033 [US5] Store last execution result in config in `src/main/stores/popup-config-store.ts`
  - Save ExecutionResult after completion
  - Clear on new execution start (FR-020)

**Checkpoint**: User Story 5 complete - persistence working

---

## Phase 8: User Story 6 - Access n8n Editor from Popup (Priority: P3)

**Goal**: Power users can open n8n editor from the popup

**Independent Test**: Open popup → click edit button/icon → n8n editor opens → return to popup

### Implementation for User Story 6

- [x] T034 [US6] Add "Edit Workflow" action to CenterIndicator in `src/renderer/src/components/features/workflow-popup/CenterIndicator.tsx`
  - Click n8n icon opens editor (existing onEdit behavior)
  - Tooltip indicating action
- [x] T035 [US6] Handle editor navigation in WorkflowExecutionPopup in `src/renderer/src/components/features/workflow-popup/WorkflowExecutionPopup.tsx`
  - Close popup when opening editor
  - Save current config before closing

**Checkpoint**: User Story 6 complete - editor access working

---

## Phase 9: Node Modifications (FR-021 to FR-024)

**Purpose**: Modify custom n8n nodes to support external configuration from popup

### FileSelector Node

- [x] T036 [P] Modify FileSelector node in `src/n8n_nodes/nodes/FileSelector/FileSelector.node.ts`
  - Check for external config via Electron bridge endpoint
  - Use `GET /api/electron-bridge/execution-config/:executionId/:nodeId`
  - Fall back to internal state if no external config
  - Maintain backward compatibility with direct n8n usage

### PromptInput Node

- [x] T037 [P] Modify PromptInput node in `src/n8n_nodes/nodes/PromptInput/PromptInput.node.ts`
  - Check for external prompt via Electron bridge endpoint
  - Use `GET /api/electron-bridge/execution-config/:executionId/:nodeId`
  - Fall back to node parameter if no external config
  - Maintain backward compatibility

### ResultDisplay Node

- [x] T038 [P] Modify ResultDisplay node in `src/n8n_nodes/nodes/ResultDisplay/ResultDisplay.node.ts`
  - Emit output to Electron bridge endpoint
  - Use `POST /api/electron-bridge/execution-result`
  - Include contentType and fileReference in output
  - Maintain backward compatibility

- [x] T039 Rebuild n8n nodes after modifications
  - Run `npm run build:n8n-nodes` in `src/n8n_nodes/`

**Checkpoint**: Node modifications complete - popup can communicate with nodes

---

## Phase 10: Testing

**Purpose**: Unit and E2E tests per Constitution Principle V

### Unit Tests

- [x] T040 [P] Create PopupConfigStore tests in `tests/unit/workflow-execution/popup-config-store.test.ts`
  - Test get/set/delete operations
  - Test schema validation
- [x] T041 [P] Create WorkflowExecutor tests in `tests/unit/workflow-execution/workflow-executor.test.ts`
  - Test node detection (analyzeWorkflow)
  - Test payload building
  - Test timeout handling
- [x] T042 [P] Create component tests for popup in `tests/unit/workflow-execution/popup-components.test.ts`
  - Test InputPanel rendering
  - Test OutputPanel rendering
  - Test execution state transitions

### E2E Tests

- [x] T043 Create E2E test for popup workflow in `tests/e2e/workflow-popup.spec.ts`
  - Open popup from workflow card
  - Enter prompt text
  - Select files
  - Execute workflow
  - Verify results displayed
  - Close popup

**Checkpoint**: Testing complete - all tests pass

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T044 [P] Add error boundary to WorkflowExecutionPopup in `src/renderer/src/components/features/workflow-popup/WorkflowExecutionPopup.tsx`
- [x] T045 [P] Add loading skeletons to InputPanel and OutputPanel
- [x] T046 Implement timeout error display with user-friendly message in OutputPanel
- [x] T047 Add keyboard navigation (Tab through inputs, Enter to execute)
- [x] T048 [P] Export popup components index in `src/renderer/src/components/features/workflow-popup/index.ts`
- [x] T049 Update type declarations in `src/preload/types.ts` for workflowPopup API
- [x] T050 Run quickstart.md validation - verify implementation matches guide

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - MVP delivery point
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs popup container)
- **User Stories 3-6 (Phases 5-8)**: Depend on Phase 3, can proceed in parallel
- **Node Mods (Phase 9)**: Can start after Foundational, parallel to UI work
- **Testing (Phase 10)**: After all implementation phases
- **Polish (Phase 11)**: After all user stories complete

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (Execute) | Foundational | - |
| US2 (Results) | US1 | US3, US4, US5, US6 |
| US3 (Files) | US1 | US2, US4, US5, US6 |
| US4 (Prompt) | US1 | US2, US3, US5, US6 |
| US5 (Persist) | US1 | US2, US3, US4, US6 |
| US6 (Editor) | US1 | US2, US3, US4, US5 |

### Parallel Opportunities

Phase 2 parallel group:
- T004 (config store) || T005 (execution store)
- T006, T007, T008 (IPC) - sequential within group
- T009 (bridge) || T010, T011, T012 (executor)

Phase 3+ parallel group (after Foundational):
- T013 (Modal) || T014 (CenterIndicator) - then T015, T016 depend on these
- After US1 complete: US2, US3, US4, US5, US6 can all proceed in parallel
- Node mods (T036, T037, T038) can run parallel to UI work

Testing parallel:
- T040 || T041 || T042 (all unit tests parallel)

---

## Parallel Example: Foundational Phase

```bash
# Parallel group 1 (stores):
Task: "T004 Create PopupConfigStore in src/main/stores/popup-config-store.ts"
Task: "T005 Create ExecutionState store in src/renderer/src/stores/workflow-execution.ts"

# After stores complete, parallel group 2:
Task: "T009 Extend Electron bridge in src/main/services/electron-bridge.ts"
Task: "T010 Create WorkflowExecutor in src/main/services/workflow-executor.ts"
```

## Parallel Example: After Foundational

```bash
# All user stories can start in parallel with different developers:
Developer A: User Story 1 (T013-T019) - MVP
Developer B: User Story 3 (T025-T027) - File selection
Developer C: Node Modifications (T036-T039) - Backend support
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Execute)
4. Complete Phase 4: User Story 2 (Results)
5. **STOP and VALIDATE**: Test popup end-to-end
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US2 → Test → **MVP Complete!**
3. Add US3 (Files) + US4 (Prompt) → Enhanced inputs
4. Add US5 (Persist) + US6 (Editor) → Full feature
5. Add Testing + Polish → Production ready

---

## Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|----------------------|
| 1. Setup | T001-T003 | T003 parallel |
| 2. Foundational | T004-T012 | Multiple groups |
| 3. US1 Execute | T013-T019 | T013, T014 parallel |
| 4. US2 Results | T020-T024 | T020, T021 parallel |
| 5. US3 Files | T025-T027 | - |
| 6. US4 Prompt | T028-T030 | - |
| 7. US5 Persist | T031-T033 | - |
| 8. US6 Editor | T034-T035 | - |
| 9. Node Mods | T036-T039 | T036, T037, T038 parallel |
| 10. Testing | T040-T043 | T040, T041, T042 parallel |
| 11. Polish | T044-T050 | Multiple parallel |

**Total Tasks**: 50
**MVP Scope**: Phases 1-4 (User Stories 1 + 2) = 24 tasks
