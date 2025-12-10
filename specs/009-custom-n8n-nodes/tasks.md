# Tasks: Custom n8n Nodes with User-Friendly UI

**Input**: Design documents from `/specs/009-custom-n8n-nodes/`
**Prerequisites**: plan.md (✓), spec.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓)

**Tests**: Tests are included as requested in the constitution (Test-Required Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Main project**: `src/main/` for Electron main process
- **Custom nodes sub-project**: `src/n8n_nodes/` for n8n nodes
- **Tests**: `tests/unit/n8n-nodes/`, `tests/integration/`

---

## Phase 1: Setup (Project Scaffolding)

**Purpose**: Initialize the n8n_nodes sub-project with proper build infrastructure

- [ ] T001 Create directory structure: `src/n8n_nodes/`, `src/n8n_nodes/nodes/`, `src/n8n_nodes/lib/`
- [ ] T002 Create package.json with n8n configuration in `src/n8n_nodes/package.json`
- [ ] T003 [P] Create TypeScript config in `src/n8n_nodes/tsconfig.json`
- [ ] T004 [P] Create ESLint flat config in `src/n8n_nodes/eslint.config.mjs`
- [ ] T005 [P] Copy shared type interfaces from contracts to `src/n8n_nodes/lib/types.ts`
- [ ] T006 Add n8n_nodes scripts to root `package.json` (setup:n8n-nodes, build:n8n-nodes)
- [ ] T007 Verify sub-project builds successfully with `npm run build:n8n-nodes`

---

## Phase 2: Foundational (Electron Bridge Infrastructure)

**Purpose**: Core HTTP bridge that MUST be complete before FileSelector node can work

**⚠️ CRITICAL**: FileSelector (US1) cannot work without this bridge

- [ ] T008 Create Electron bridge server module in `src/main/services/electron-bridge.ts`
- [ ] T009 [P] Implement health check endpoint `/api/electron-bridge/health` in `src/main/services/electron-bridge.ts`
- [ ] T010 Implement file selection endpoint `/api/electron-bridge/files/select` in `src/main/services/electron-bridge.ts`
- [ ] T011 Implement file copy endpoint `/api/electron-bridge/files/copy` in `src/main/services/electron-bridge.ts`
- [ ] T012 [P] Implement data folder endpoint `/api/electron-bridge/config/data-folder` in `src/main/services/electron-bridge.ts`
- [ ] T013 Add bridge startup to Electron app initialization in `src/main/index.ts`
- [ ] T014 Create bridge client library in `src/n8n_nodes/lib/bridge-client.ts`
- [ ] T015 Add ELECTRON_BRIDGE_URL environment variable to n8n spawn config in `src/main/n8n-manager.ts`

**Checkpoint**: Bridge running - FileSelector can now communicate with Electron

---

## Phase 3: User Story 4 - Integrate Custom Nodes Sub-project (Priority: P1) 🎯 MVP

**Goal**: Custom nodes are recognized by embedded n8n when application starts

**Independent Test**: Run build:all, start app, verify custom nodes appear in n8n palette

### Tests for User Story 4

- [ ] T016 [P] [US4] Create integration test for build process in `tests/integration/n8n-nodes-build.test.ts`
- [ ] T017 [P] [US4] Create integration test for node loading in `tests/integration/n8n-nodes-loading.test.ts`

### Implementation for User Story 4

- [ ] T018 [US4] Modify n8n-manager.ts to set N8N_CUSTOM_EXTENSIONS environment variable in `src/main/n8n-manager.ts`
- [ ] T019 [US4] Handle development vs production paths for custom nodes in `src/main/n8n-manager.ts`
- [ ] T020 [US4] Update build:all script to include n8n_nodes build in root `package.json`
- [ ] T021 [US4] Update setup:all script to include n8n_nodes setup in root `package.json`
- [ ] T022 [US4] Verify clean build from scratch works with `npm run build:all`
- [ ] T023 [US4] Test that placeholder node appears in n8n palette after startup

**Checkpoint**: Build integration complete - custom nodes sub-project is part of main build

---

## Phase 4: User Story 2 - Enter Formatted Prompt Text (Priority: P2)

**Goal**: Users can enter formatted prompts using a markdown editor within n8n workflows

**Independent Test**: Add PromptInput node to workflow, enter markdown text, execute, verify output contains text with metadata

### Tests for User Story 2

- [ ] T024 [P] [US2] Create unit test for PromptInput execute logic in `tests/unit/n8n-nodes/PromptInput.test.ts`

### Implementation for User Story 2

- [ ] T025 [P] [US2] Create node directory structure `src/n8n_nodes/nodes/PromptInput/`
- [ ] T026 [US2] Implement PromptInput.node.ts with htmlEditor parameter in `src/n8n_nodes/nodes/PromptInput/PromptInput.node.ts`
- [ ] T027 [P] [US2] Create codex file in `src/n8n_nodes/nodes/PromptInput/PromptInput.node.json`
- [ ] T028 [P] [US2] Create node icon SVG in `src/n8n_nodes/nodes/PromptInput/promptInput.svg`
- [ ] T029 [US2] Add validation for minLength/maxLength in `src/n8n_nodes/nodes/PromptInput/PromptInput.node.ts`
- [ ] T030 [US2] Add word count and line count to output in `src/n8n_nodes/nodes/PromptInput/PromptInput.node.ts`
- [ ] T031 [US2] Register PromptInput in package.json n8n.nodes array in `src/n8n_nodes/package.json`
- [ ] T032 [US2] Test PromptInput node in n8n workflow editor

**Checkpoint**: PromptInput node fully functional - users can enter prompts in workflows

---

## Phase 5: User Story 1 - Select and Import Local Files (Priority: P1)

**Goal**: Users can select files via native dialog and have them automatically copied to n8n data folder

**Independent Test**: Add FileSelector node to workflow, execute, select files in dialog, verify files copied and references output

### Tests for User Story 1

- [ ] T033 [P] [US1] Create unit test for FileSelector execute logic in `tests/unit/n8n-nodes/FileSelector.test.ts`
- [ ] T034 [P] [US1] Create integration test for bridge communication in `tests/integration/electron-bridge.test.ts`

### Implementation for User Story 1

- [ ] T035 [P] [US1] Create node directory structure `src/n8n_nodes/nodes/FileSelector/`
- [ ] T036 [US1] Implement FileSelector.node.ts with bridge client in `src/n8n_nodes/nodes/FileSelector/FileSelector.node.ts`
- [ ] T037 [P] [US1] Create codex file in `src/n8n_nodes/nodes/FileSelector/FileSelector.node.json`
- [ ] T038 [P] [US1] Create node icon SVG in `src/n8n_nodes/nodes/FileSelector/fileSelector.svg`
- [ ] T039 [US1] Implement file type filtering parameter in `src/n8n_nodes/nodes/FileSelector/FileSelector.node.ts`
- [ ] T040 [US1] Implement multiple file selection parameter in `src/n8n_nodes/nodes/FileSelector/FileSelector.node.ts`
- [ ] T041 [US1] Implement duplicate handling (rename/skip/overwrite) in `src/n8n_nodes/nodes/FileSelector/FileSelector.node.ts`
- [ ] T042 [US1] Implement file metadata extraction (size, MIME type, hash) in `src/n8n_nodes/nodes/FileSelector/FileSelector.node.ts`
- [ ] T043 [US1] Handle dialog cancellation gracefully in `src/n8n_nodes/nodes/FileSelector/FileSelector.node.ts`
- [ ] T044 [US1] Register FileSelector in package.json n8n.nodes array in `src/n8n_nodes/package.json`
- [ ] T045 [US1] Test FileSelector node end-to-end in n8n workflow

**Checkpoint**: FileSelector node fully functional - users can import files into workflows

---

## Phase 6: User Story 3 - Display Formatted Workflow Results (Priority: P3)

**Goal**: Users can view workflow results as formatted markdown instead of raw JSON

**Independent Test**: Connect ResultDisplay to workflow output, configure property path, execute, verify formatted display

### Tests for User Story 3

- [ ] T046 [P] [US3] Create unit test for ResultDisplay execute logic in `tests/unit/n8n-nodes/ResultDisplay.test.ts`

### Implementation for User Story 3

- [ ] T047 [P] [US3] Create node directory structure `src/n8n_nodes/nodes/ResultDisplay/`
- [ ] T048 [US3] Implement ResultDisplay.node.ts with property path extraction in `src/n8n_nodes/nodes/ResultDisplay/ResultDisplay.node.ts`
- [ ] T049 [P] [US3] Create codex file in `src/n8n_nodes/nodes/ResultDisplay/ResultDisplay.node.json`
- [ ] T050 [P] [US3] Create node icon SVG in `src/n8n_nodes/nodes/ResultDisplay/resultDisplay.svg`
- [ ] T051 [US3] Implement JSON path extraction logic in `src/n8n_nodes/nodes/ResultDisplay/ResultDisplay.node.ts`
- [ ] T052 [US3] Add fallback text when property not found in `src/n8n_nodes/nodes/ResultDisplay/ResultDisplay.node.ts`
- [ ] T053 [US3] Implement content truncation for large results in `src/n8n_nodes/nodes/ResultDisplay/ResultDisplay.node.ts`
- [ ] T054 [US3] Add HTML sanitization for security in `src/n8n_nodes/nodes/ResultDisplay/ResultDisplay.node.ts`
- [ ] T055 [US3] Register ResultDisplay in package.json n8n.nodes array in `src/n8n_nodes/package.json`
- [ ] T056 [US3] Test ResultDisplay node with various input formats

**Checkpoint**: ResultDisplay node fully functional - users can view formatted results

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T057 [P] Add error handling and user-friendly error messages across all nodes
- [ ] T058 [P] Add logging for debugging bridge communication in `src/n8n_nodes/lib/bridge-client.ts`
- [ ] T059 [P] Add logging for Electron bridge operations in `src/main/services/electron-bridge.ts`
- [ ] T060 Code cleanup and consistent formatting across `src/n8n_nodes/`
- [ ] T061 [P] Create README.md for custom nodes sub-project in `src/n8n_nodes/README.md`
- [ ] T062 Run all tests and fix any failures
- [ ] T063 Verify quickstart.md scenarios work end-to-end
- [ ] T064 Performance testing: file operations with 100MB+ files
- [ ] T065 Cross-platform testing: Windows, macOS, Linux

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS FileSelector (US1)
- **User Story 4 (Phase 3)**: Depends on Setup - can run parallel with Phase 2
- **User Story 2 (Phase 4)**: Depends on Setup - can start after Phase 1, no bridge needed
- **User Story 1 (Phase 5)**: Depends on Foundational (Phase 2) - needs bridge
- **User Story 3 (Phase 6)**: Depends on Setup - can start after Phase 1, no bridge needed
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 4 (P1)**: Build integration - No story dependencies, enables all other stories to be loaded
- **User Story 2 (P2)**: PromptInput - No dependencies on other stories, simple standalone node
- **User Story 1 (P1)**: FileSelector - Depends on Foundational phase (bridge), standalone otherwise
- **User Story 3 (P3)**: ResultDisplay - No dependencies on other stories, standalone node

### Recommended Execution Order

1. Phase 1 (Setup) ✓
2. Phase 3 (US4 - Build Integration) - immediately after setup
3. Phase 4 (US2 - PromptInput) - parallel with Phase 2, no bridge needed
4. Phase 2 (Foundational - Bridge)
5. Phase 5 (US1 - FileSelector) - after bridge ready
6. Phase 6 (US3 - ResultDisplay) - can be parallel with US1
7. Phase 7 (Polish)

### Within Each User Story

- Tests written first (TDD)
- Directory structure before implementation
- Node implementation before codex/icon
- Core logic before edge cases
- Registration in package.json after implementation
- End-to-end testing after registration

### Parallel Opportunities

**Phase 1 (Setup)**:
```
T003 (tsconfig) || T004 (eslint) || T005 (types)
```

**Phase 2 (Foundational)**:
```
T009 (health) || T012 (data-folder)
```

**Phase 4 (US2) - Can run entirely parallel with Phase 2**:
```
T025 (dir) || T027 (codex) || T028 (icon)
```

**Phase 5 & 6 can run in parallel after Phase 2 completes**:
```
Developer A: Phase 5 (US1 - FileSelector)
Developer B: Phase 6 (US3 - ResultDisplay)
```

---

## Parallel Example: User Story 2 (PromptInput)

```bash
# Launch all parallelizable tasks for User Story 2 together:
Task: "Create unit test in tests/unit/n8n-nodes/PromptInput.test.ts"

# After tests, launch directory + assets in parallel:
Task: "Create node directory structure src/n8n_nodes/nodes/PromptInput/"
Task: "Create codex file in src/n8n_nodes/nodes/PromptInput/PromptInput.node.json"
Task: "Create node icon SVG in src/n8n_nodes/nodes/PromptInput/promptInput.svg"
```

---

## Implementation Strategy

### MVP First (Build Integration + PromptInput)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 4 (Build Integration)
3. Complete Phase 4: User Story 2 (PromptInput)
4. **STOP and VALIDATE**: Test that a simple node works in n8n
5. Demo: Show workflow with PromptInput node working

### Add File Selection Capability

1. Complete Phase 2: Foundational (Bridge)
2. Complete Phase 5: User Story 1 (FileSelector)
3. **VALIDATE**: Test file import workflow end-to-end
4. Demo: Show file selection and import working

### Complete Feature

1. Complete Phase 6: User Story 3 (ResultDisplay)
2. Complete Phase 7: Polish
3. **FINAL VALIDATION**: All three nodes working together in a workflow
4. Demo: Complete document processing workflow

### Parallel Team Strategy

With 2 developers:
1. Both complete Setup together
2. Developer A: US4 (Build) → US1 (FileSelector)
3. Developer B: US2 (PromptInput) → US3 (ResultDisplay)
4. Both complete Polish together

---

## Task Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Phase 1: Setup | 7 | 3 |
| Phase 2: Foundational | 8 | 2 |
| Phase 3: US4 (Build) | 8 | 2 |
| Phase 4: US2 (PromptInput) | 9 | 4 |
| Phase 5: US1 (FileSelector) | 13 | 4 |
| Phase 6: US3 (ResultDisplay) | 11 | 4 |
| Phase 7: Polish | 9 | 4 |
| **Total** | **65** | **23** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests written first following TDD approach
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Node icons should be simple, clear SVGs (64x64 recommended)
