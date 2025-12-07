# Tasks: Granite Docling OCR Integration

**Input**: Design documents from `/specs/003-docling-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Tests are included based on the Test-Required Development principle in the constitution (Principle V).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Python service**: `src/docling/src/docling_service/`
- **Electron main process**: `src/main/`
- **Renderer UI**: `src/renderer/src/`
- **Tests (Python)**: `src/docling/tests/`
- **Tests (TypeScript)**: `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, Python service restructuring, and basic structure

- [x] T001 Rename `src/docling/src/hello_world/` to `src/docling/src/docling_service/`
- [x] T002 Update `src/docling/pyproject.toml` with docling-service name and dependencies (fastapi, uvicorn, docling, pydantic)
- [x] T003 [P] Create `src/docling/src/docling_service/__init__.py` with version info
- [x] T004 [P] Create `src/docling/src/docling_service/api/__init__.py` package structure
- [x] T005 [P] Create `src/docling/src/docling_service/core/__init__.py` package structure
- [x] T006 [P] Create `src/docling/src/docling_service/utils/__init__.py` package structure
- [x] T007 Configure Poetry virtual environment in `src/docling/` with `poetry config virtualenvs.in-project true`
- [x] T008 Run `poetry install` to set up Python dependencies in `src/docling/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Python Service Core

- [x] T009 Implement configuration module in `src/docling/src/docling_service/core/config.py` with Settings class
- [x] T010 [P] Implement Pydantic request/response models in `src/docling/src/docling_service/api/models.py` per OpenAPI spec
- [x] T011 Implement page-annotated markdown generator in `src/docling/src/docling_service/utils/markdown.py`
- [x] T012 Implement document converter wrapper in `src/docling/src/docling_service/core/converter.py` with EasyOCR configuration
- [x] T013 Implement job queue with configurable concurrency in `src/docling/src/docling_service/core/queue.py`
- [x] T014 Implement authentication middleware with Bearer token verification in `src/docling/src/docling_service/api/routes.py`
- [x] T015 Implement FastAPI application entry point in `src/docling/src/docling_service/main.py` with CLI args

### Electron Integration Core

- [x] T016 Add DoclingConfig interface to `src/main/config-manager.ts` with defaults (enabled, tier, tempFolder, maxConcurrentJobs, timeoutAction)
- [x] T017 Implement DoclingManager class in `src/main/docling-manager.ts` with start/stop/restart/health-check methods
- [x] T018 Add Python availability check to DoclingManager in `src/main/docling-manager.ts`
- [x] T019 Implement auto-restart logic with 3-attempt limit in `src/main/docling-manager.ts`
- [x] T020 [P] Add Docling types to preload types in `src/preload/types.ts`

### IPC Layer

- [x] T021 Implement Docling IPC handlers in `src/main/ipc-handlers/docling.ts` for service management
- [x] T022 Implement Docling IPC handlers in `src/main/ipc-handlers/docling.ts` for document processing API calls
- [x] T023 Register Docling IPC handlers in `src/main/index.ts` (or main entry point)

### Environment Bridge

- [x] T024 Modify n8n-manager.ts to pass DOCLING_API_URL, DOCLING_API_PORT, DOCLING_AUTH_TOKEN env vars to n8n process

**Checkpoint**: Foundation ready - Python service can start, Electron can manage it, IPC works

---

## Phase 3: User Story 1 - Basic Document Processing via n8n Workflow (Priority: P1)

**Goal**: Users can convert PDF documents to page-annotated Markdown via n8n HTTP Request node

**Independent Test**: Create n8n workflow with HTTP Request node calling Docling API, verify JSON response contains Markdown with page markers

### Tests for User Story 1

- [x] T025 [P] [US1] Create pytest fixture with sample PDF in `src/docling/tests/fixtures/`
- [x] T026 [P] [US1] Contract test for /health endpoint in `src/docling/tests/test_api.py`
- [x] T027 [P] [US1] Contract test for /process endpoint in `src/docling/tests/test_api.py`
- [x] T028 [P] [US1] Contract test for /jobs/{id} endpoint in `src/docling/tests/test_api.py`
- [x] T029 [US1] Unit test for markdown generator in `src/docling/tests/test_markdown.py`
- [x] T030 [US1] Unit test for document converter in `src/docling/tests/test_converter.py`
- [x] T031 [US1] Integration test for Docling service startup in `tests/integration/docling-service.test.ts`

### Implementation for User Story 1

- [x] T032 [US1] Implement API routes for /health, /process, /jobs/{id}, /jobs in `src/docling/src/docling_service/api/routes.py` *(completed in Phase 2)*
- [x] T033 [US1] Add progress tracking to job queue in `src/docling/src/docling_service/core/queue.py` *(completed in Phase 2)*
- [x] T034 [US1] Add processing metadata (page_count, processing_time_ms, format) to converter output in `src/docling/src/docling_service/core/converter.py` *(completed in Phase 2)*
- [x] T035 [US1] Create sample n8n workflow JSON in `resources/workflows/docling-single-document.json`
- [x] T036 [US1] Add structured logging to Python service for debugging in `src/docling/src/docling_service/core/converter.py` *(completed in Phase 2)*

**Checkpoint**: User Story 1 complete - Single document processing works via n8n workflow

---

## Phase 4: User Story 2 - Configure Processing Levels (Priority: P2)

**Goal**: Users can select processing tier (Lightweight, Standard, Advanced) to balance quality vs speed

**Independent Test**: Change processing tier in settings, process same document at each tier, verify different processing times and output detail

### Tests for User Story 2

- [x] T037 [P] [US2] Unit test for tier-based pipeline configuration in `src/docling/tests/test_converter.py`
- [ ] T038 [P] [US2] Component test for DoclingSettingsTab tier selection (manual verification or snapshot)

### Implementation for User Story 2

- [x] T039 [US2] Create Docling nanostores state in `src/renderer/src/stores/docling.ts` for status and actions
- [x] T040 [US2] Create DoclingSettingsTab component in `src/renderer/src/components/features/settings/DoclingSettingsTab.tsx`
- [x] T041 [US2] Add processing tier dropdown with descriptions to DoclingSettingsTab
- [x] T042 [US2] Add max concurrent jobs selector (1-3) to DoclingSettingsTab
- [x] T043 [US2] Add timeout action dropdown (cancel/extend/notify) to DoclingSettingsTab
- [x] T044 [US2] Register DoclingSettingsTab in SettingsDialog.tsx with Docling tab
- [x] T045 [US2] Wire tier selection to ConfigManager persistence via IPC
- [x] T045a [US2] Implement resource check warning when user selects Advanced tier with insufficient RAM (<16GB) in DoclingSettingsTab

**Checkpoint**: User Story 2 complete - Processing tier configuration works, persists between sessions

---

## Phase 5: User Story 3 - Configure Temporary Folder Location (Priority: P2)

**Goal**: Users can configure custom temporary folder location for processing files

**Independent Test**: Set custom temp folder path, process document, verify temp files created in specified location

### Tests for User Story 3

- [x] T046 [P] [US3] Unit test for temp folder validation in `src/docling/tests/test_config.py`

### Implementation for User Story 3

- [x] T047 [US3] Add temp folder input with Browse button to DoclingSettingsTab *(completed in Phase 4)*
- [x] T048 [US3] Implement folder browser dialog via IPC in `src/main/ipc-handlers/docling.ts`
- [x] T049 [US3] Add temp folder validation (exists, writable) in DoclingManager *(via isDoclingTempFolderValid in ConfigManager + validateTempFolder IPC)*
- [x] T050 [US3] Pass temp folder to Python service via CLI arg in DoclingManager start() *(completed in Phase 2)*
- [x] T051 [US3] Display disk space usage for temp folder in DoclingSettingsTab

**Checkpoint**: User Story 3 complete - Temp folder configuration works

---

## Phase 6: User Story 4 - Process Multiple Documents via Workflow (Priority: P3)

**Goal**: Users can process batch of documents via n8n workflow iteration

**Independent Test**: Create n8n workflow that iterates over 3+ document paths, calls Docling API for each, aggregates results

### Tests for User Story 4

- [ ] T052 [P] [US4] Contract test for /process/batch endpoint in `src/docling/tests/test_api.py`
- [ ] T053 [P] [US4] Unit test for batch job queue handling in `src/docling/tests/test_queue.py`

### Implementation for User Story 4

- [ ] T054 [US4] Implement /process/batch endpoint in `src/docling/src/docling_service/api/routes.py`
- [ ] T055 [US4] Add batch job ID tracking to queue in `src/docling/src/docling_service/core/queue.py`
- [ ] T056 [US4] Implement docling:processBatch IPC handler in `src/main/ipc-handlers/docling.ts`
- [ ] T057 [US4] Create sample batch workflow JSON in `resources/workflows/docling-batch-summarize.json`
- [ ] T058 [US4] Add error handling for partial batch failures (continue processing remaining docs)

**Checkpoint**: User Story 4 complete - Batch processing works via n8n workflow

---

## Phase 7: User Story 5 - Monitor Docling Service Health (Priority: P3)

**Goal**: Users can view Docling service status and restart if needed

**Independent Test**: View service status indicator, stop/start service, verify status updates correctly

### Tests for User Story 5

- [ ] T059 [P] [US5] Integration test for service start/stop/restart in `tests/integration/docling-manager.test.ts`

### Implementation for User Story 5

- [ ] T060 [US5] Add service status indicator to DoclingSettingsTab (Running/Stopped/Error with port)
- [ ] T061 [US5] Add Start/Stop/Restart buttons to DoclingSettingsTab
- [ ] T062 [US5] Wire status indicator to docling nanostores state updates via IPC events
- [ ] T063 [US5] Add Python not found warning with install instructions to DoclingSettingsTab
- [ ] T064 [US5] Implement job queue UI showing current/pending jobs with progress in DoclingSettingsTab
- [ ] T065 [US5] Add manual job cancel button to job queue UI
- [ ] T066 [US5] Display restart attempt count when service is recovering

**Checkpoint**: User Story 5 complete - Service health monitoring works

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, AI debugging infrastructure

### AI Debugging Infrastructure (from ai-debugging.md checklist)

#### Structured Logging - Python Service

- [ ] T067 [P] Add `structlog` dependency to pyproject.toml and configure JSON renderer in `src/docling/src/docling_service/core/logging.py`
- [ ] T068 [P] Implement trace_id middleware for FastAPI that extracts `X-Trace-Id` header or generates UUID v4 in `src/docling/src/docling_service/api/middleware.py`
- [ ] T069 [P] Configure stdout for functional output, stderr for diagnostics in structlog processor chain
- [ ] T070 [P] Add memory profiling with `psutil` at job start/end in `src/docling/src/docling_service/core/queue.py`
- [ ] T071 [P] Add processing milestone logging (start, progress, complete) at INFO level in converter.py
- [ ] T072 [P] Add `psutil` dependency to pyproject.toml for memory monitoring

#### Structured Logging - Electron

- [ ] T073 [P] Create structured logging utility in `src/main/utils/logger.ts` with JSON output format
- [ ] T074 [P] Add in-memory ring buffer (1000 entries) for log storage in DoclingManager
- [ ] T075 [P] Implement `docling:getLogs` IPC handler with trace_id filtering in `src/main/ipc-handlers/docling.ts`
- [ ] T076 [P] Add spawn/health-check/restart event logging to DoclingManager

#### Trace Context Propagation

- [ ] T077 Add trace_id to all API response schemas in `src/docling/src/docling_service/api/models.py`
- [ ] T078 Pass trace_id from Electron to Python service via `X-Trace-Id` header in IPC handlers
- [ ] T079 Add correlation_id for batch job linking in queue.py

#### UI Accessibility & Testing Support

- [ ] T080 [P] Add `data-testid` attributes to DoclingSettingsTab (pattern: `docling-{component}-{element}`)
- [ ] T081 [P] Add ARIA labels to service status indicator (`aria-live="polite"`, `role="status"`)
- [ ] T082 [P] Add `role="alert"` and `aria-live="assertive"` to error messages in UI
- [ ] T083 [P] Add log viewer component with trace_id filter to DoclingSettingsTab

### Cleanup and Documentation

- [ ] T084 [P] Implement temp file cleanup on job completion in queue.py
- [ ] T085 [P] Implement orphaned temp file cleanup on service startup in main.py
- [ ] T086 Update quickstart.md with verified installation and testing steps
- [ ] T087 Run full pytest suite in `src/docling/` and fix any failures
- [ ] T088 Run full Vitest suite in `tests/` and fix any failures
- [ ] T089 Security review: verify localhost-only binding and token authentication
- [ ] T090 Create Playwright MCP configuration documentation in `specs/003-docling-integration/testing/playwright-mcp.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    └── No dependencies - can start immediately

Phase 2: Foundational
    └── Depends on Phase 1 completion
    └── BLOCKS all user stories

Phase 3-7: User Stories (P1 → P3)
    └── All depend on Phase 2 completion
    └── Can proceed in parallel OR sequentially by priority

Phase 8: Polish
    └── Depends on desired user stories being complete
```

### User Story Dependencies

| Story | Depends On | Can Run In Parallel With |
|-------|------------|--------------------------|
| US1 (P1) | Phase 2 | None initially (MVP) |
| US2 (P2) | Phase 2, US1 (for testing) | US3 |
| US3 (P2) | Phase 2 | US2 |
| US4 (P3) | Phase 2, US1 | US5 |
| US5 (P3) | Phase 2 | US4 |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Models/Config before Services
3. Backend before Frontend
4. Core implementation before integration
5. Story complete before moving to next priority

### Parallel Opportunities by Phase

**Phase 1 (Setup)**:
- T003, T004, T005, T006 can run in parallel (package __init__.py files)

**Phase 2 (Foundational)**:
- T010, T011 can run in parallel (models, markdown util)
- T020 can run parallel with Python work (preload types)

**Phase 3 (US1)**:
- T025-T030 tests can run in parallel
- Implementation sequential due to dependencies

**Phase 4-7 (US2-US5)**:
- US2 and US3 can run fully in parallel
- US4 and US5 can run fully in parallel
- Tests within each story can run in parallel

---

## Parallel Example: Phase 2 Foundational

```bash
# After T009 (config) completes, launch in parallel:
Task: "Implement Pydantic request/response models in src/docling/src/docling_service/api/models.py"
Task: "Implement page-annotated markdown generator in src/docling/src/docling_service/utils/markdown.py"
Task: "Add Docling types to preload types in src/preload/types.ts"

# After T012 (converter) completes:
Task: "Implement job queue with configurable concurrency in src/docling/src/docling_service/core/queue.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (8 tasks)
2. Complete Phase 2: Foundational (16 tasks)
3. Complete Phase 3: User Story 1 (12 tasks)
4. **STOP and VALIDATE**: Test single document processing via n8n workflow
5. Deploy/demo if ready - MVP delivers core value!

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 = Basic document processing works
2. **+US2**: Add processing tier configuration = Users can optimize for their hardware
3. **+US3**: Add temp folder configuration = Users can manage disk space
4. **+US4**: Add batch processing = Efficiency for multiple documents
5. **+US5**: Add health monitoring = Better troubleshooting
6. **Polish**: Cleanup, logging, security hardening

### Task Count Summary

| Phase | Task Count | Parallel Opportunities |
|-------|------------|------------------------|
| Phase 1: Setup | 8 | 4 |
| Phase 2: Foundational | 16 | 4 |
| Phase 3: US1 (P1) | 12 | 7 |
| Phase 4: US2 (P2) | 10 | 2 |
| Phase 5: US3 (P2) | 6 | 1 |
| Phase 6: US4 (P3) | 7 | 2 |
| Phase 7: US5 (P3) | 8 | 1 |
| Phase 8: Polish (AI Debugging) | 24 | 18 |
| **TOTAL** | **91** | **39** |

---

## Notes

- [P] tasks = different files, no dependencies - can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- EasyOCR configuration order is CRITICAL - set ocr_options LAST (see plan.md Known Issues)
- Python runtime dependency requires clear error messaging (see FR-034 through FR-036)
- All tests should fail before implementation to verify test validity
- Commit after each task or logical group
- AI debugging requirements defined in `checklists/ai-debugging.md` - Phase 8 tasks implement these
- Use `structlog` for Python logging, not `loguru`
- Trace context uses `X-Trace-Id` HTTP header (UUID v4 format)
- UI testing uses `data-testid` pattern: `docling-{component}-{element}`
