# AI Debugging Requirements Checklist

**Feature**: Granite Docling OCR Integration
**Scope**: AI Self-Verification Capabilities
**Date**: 2025-12-06
**Updated**: 2025-12-06 (all requirements specified)

This checklist validates that requirements for AI-powered debugging and verification are complete, unambiguous, and implementable.

---

## 1. Structured Logging Requirements

### 1.1 Python Service Logging

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| LOG-PY-01 | All log entries use structured JSON format | [x] | Use `structlog` with JSON renderer |
| LOG-PY-02 | Every log includes `trace_id` field for correlation | [x] | UUID v4 passed via `X-Trace-Id` header, stored in context |
| LOG-PY-03 | Every log includes `timestamp` in ISO 8601 format | [x] | `structlog` adds timestamp automatically |
| LOG-PY-04 | Log levels defined: DEBUG, INFO, WARNING, ERROR, CRITICAL | [x] | Standard Python logging levels via structlog |
| LOG-PY-05 | Functional output to stdout, diagnostics to stderr | [x] | Configure structlog processor chain per stream |
| LOG-PY-06 | Request/response bodies logged at DEBUG level | [x] | FastAPI middleware logs sanitized bodies |
| LOG-PY-07 | Processing milestones logged (start, progress, complete) | [x] | Emit at INFO level with job_id context |
| LOG-PY-08 | Exception stack traces captured in structured format | [x] | Use `structlog.processors.format_exc_info` |
| LOG-PY-09 | OCR engine selection and configuration logged | [x] | Log at INFO on converter initialization |
| LOG-PY-10 | Memory usage logged for each processing job | [x] | Use `psutil.Process().memory_info()` at job start/end |

**Clarifications Resolved**:
- [x] Maximum log entry size before truncation? → **10KB per entry; truncate large payloads with `[TRUNCATED]` marker**
- [x] Log rotation policy for long-running service? → **Memory-only during runtime; no file persistence (logs retrieved via API)**
- [x] Sensitive data (file paths) redaction requirements? → **File paths logged as-is (local machine only); no PII in documents assumed**

### 1.2 Electron Main Process Logging

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| LOG-EL-01 | Child process spawn events logged with PID | [x] | Log on spawn with `{event: 'spawn', pid: number}` |
| LOG-EL-02 | Service health check results logged | [x] | Log at DEBUG level every 5s; ERROR on failure |
| LOG-EL-03 | Port allocation attempts logged | [x] | Log each port tried until success |
| LOG-EL-04 | Restart attempts logged with attempt count | [x] | Log `{event: 'restart', attempt: N, maxAttempts: 3}` |
| LOG-EL-05 | IPC message flow logged at DEBUG level | [x] | Log channel name and sanitized payload |
| LOG-EL-06 | Token generation logged (without exposing token) | [x] | Log `{event: 'token_generated', length: 64}` |
| LOG-EL-07 | Configuration changes logged | [x] | Log old/new values for changed fields |
| LOG-EL-08 | Graceful shutdown sequence logged | [x] | Log each shutdown step with timing |

**Clarifications Resolved**:
- [x] Log persistence location for Electron logs? → **In-memory ring buffer (1000 entries); accessible via IPC `docling:getLogs`**
- [x] Integration with existing n8n logging framework? → **Separate log stream; no integration (Docling is isolated service)**

### 1.3 Trace Context Propagation

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| TRC-01 | `trace_id` generated for each document processing request | [x] | Generate UUID v4 if not provided in request |
| TRC-02 | `trace_id` passed from n8n workflow to Docling API | [x] | Via `X-Trace-Id` HTTP header |
| TRC-03 | `trace_id` included in all Python service logs | [x] | Bound to structlog context per request |
| TRC-04 | `trace_id` returned in API responses | [x] | Include in all JSON responses |
| TRC-05 | `trace_id` queryable via log aggregation | [x] | Filter logs by trace_id via `docling:getLogs` IPC |
| TRC-06 | `correlation_id` links batch job items | [x] | Batch jobs share correlation_id; each item has unique trace_id |

**Clarifications Resolved**:
- [x] UUID v4 or alternative trace ID format? → **UUID v4 (36 characters with hyphens)**
- [x] Header name for trace propagation (X-Trace-Id)? → **`X-Trace-Id` (standard header)**

---

## 2. Visual Verification Requirements

### 2.1 Screenshot Capture

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| VIS-01 | Screenshot capture available on verification failure | [x] | Playwright MCP `playwright_screenshot` tool |
| VIS-02 | Screenshots saved with `trace_id` in filename | [x] | Format: `{trace_id}_{timestamp}.png` |
| VIS-03 | Screenshot format: PNG with timestamp metadata | [x] | PNG format; timestamp in filename |
| VIS-04 | Screenshot storage location configurable | [x] | Default: `{tempFolder}/screenshots/` |
| VIS-05 | Screenshots auto-cleanup after 24 hours | [x] | Cleanup runs on service startup |
| VIS-06 | Full viewport capture supported | [x] | Playwright `fullPage: true` option |
| VIS-07 | Element-specific capture supported | [x] | Playwright element selector screenshot |

**Clarifications Resolved**:
- [x] Maximum screenshot storage quota? → **100MB total; oldest files deleted when exceeded**
- [x] Screenshot compression level? → **PNG with default compression (lossless)**
- [x] Capture trigger conditions (error only vs. always)? → **On-demand via test harness; not automatic**

### 2.2 UI State Extraction

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| UIE-01 | Settings panel state extractable as JSON | [x] | Via `docling:getStatus` IPC returns full config |
| UIE-02 | Job queue list extractable as structured data | [x] | Via `docling:listJobs` IPC returns job array |
| UIE-03 | Error messages extractable from UI | [x] | Error text in accessible DOM; queryable via Playwright |
| UIE-04 | Service status indicator state queryable | [x] | Status in nanostores; accessible via data-testid |
| UIE-05 | Form field values readable via accessibility tree | [x] | All inputs have accessible names and labels |

**Clarifications Resolved**:
- [x] Accessibility labels required for all UI elements? → **Yes, all interactive elements have ARIA labels**
- [x] Test ID attributes (data-testid) strategy? → **Pattern: `docling-{component}-{element}` (e.g., `docling-settings-tier-select`)**

---

## 3. Playwright MCP Integration

### 3.1 MCP Server Setup

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| MCP-01 | Playwright MCP server configuration documented | [x] | See `specs/003-docling-integration/testing/playwright-mcp.md` |
| MCP-02 | Browser launch configuration for Electron WebView | [x] | Connect to Electron's DevTools WebSocket |
| MCP-03 | MCP server starts with test environment | [x] | Spawned by test runner; not bundled |
| MCP-04 | Headless mode support for CI environments | [x] | `PLAYWRIGHT_HEADLESS=true` env var |
| MCP-05 | Browser context isolation per test | [x] | Fresh context per test; no state sharing |

**Clarifications Resolved**:
- [x] MCP server port allocation strategy? → **Dynamic port (0); returned in server output**
- [x] Authentication between test harness and MCP? → **None required (localhost only)**

### 3.2 AI-Accessible Actions

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| ACT-01 | Navigate to Settings > Docling tab | [x] | `playwright_click` on settings icon, then Docling tab |
| ACT-02 | Toggle Docling enabled/disabled | [x] | `playwright_click` on enable switch |
| ACT-03 | Select processing tier dropdown | [x] | `playwright_click` dropdown, then option |
| ACT-04 | View job queue list | [x] | Job queue visible in Docling settings tab |
| ACT-05 | Cancel processing job | [x] | `playwright_click` cancel button per job |
| ACT-06 | View service logs | [x] | Logs panel in settings tab (expandable) |
| ACT-07 | Trigger document processing | [x] | Via n8n workflow or IPC `docling:process` |
| ACT-08 | Verify processing result | [x] | Poll `docling:getJob` until completed; check markdown |

**Clarifications Resolved**:
- [x] Action timeout defaults? → **30 seconds per action; configurable per call**
- [x] Retry strategy for flaky interactions? → **3 retries with exponential backoff (100ms, 200ms, 400ms)**

### 3.3 Accessibility Tree Queries

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| A11Y-01 | `playwright_get_visible_text` returns all visible text | [x] | Extracts text from accessibility tree |
| A11Y-02 | `playwright_snapshot` provides accessibility tree | [x] | Full tree structure in JSON format |
| A11Y-03 | Form elements have accessible names | [x] | All inputs have `aria-label` or associated `<label>` |
| A11Y-04 | Status indicators have ARIA live regions | [x] | Service status has `aria-live="polite"` |
| A11Y-05 | Error messages announced to screen readers | [x] | Errors use `role="alert"` with `aria-live="assertive"` |

---

## 4. End-to-End Verification

### 4.1 Python API Verification

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| E2E-PY-01 | Health endpoint returns expected schema | [x] | Validated against OpenAPI spec in tests |
| E2E-PY-02 | Process endpoint accepts valid request | [x] | Returns job_id on valid POST |
| E2E-PY-03 | Job status polling returns progress updates | [x] | Progress 0-100 during processing |
| E2E-PY-04 | Completed job returns markdown result | [x] | `result.markdown` populated on success |
| E2E-PY-05 | Error response includes structured error details | [x] | `{detail: string, trace_id: string}` |
| E2E-PY-06 | Authentication rejection returns 401 | [x] | Missing/invalid Bearer token → 401 |
| E2E-PY-07 | Invalid request returns 422 with validation errors | [x] | Pydantic validation errors in response |

**Verification Method**: HTTP client assertions against OpenAPI schema

### 4.2 UI Visual Verification

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| E2E-UI-01 | Settings tab renders without errors | [x] | No console errors; tab content visible |
| E2E-UI-02 | Service status indicator shows correct state | [x] | Green=running, Gray=stopped, Red=error |
| E2E-UI-03 | Job queue displays processing jobs | [x] | Jobs appear in list with progress |
| E2E-UI-04 | Error states display user-friendly messages | [x] | Plain language; no stack traces in UI |
| E2E-UI-05 | Configuration changes persist after restart | [x] | Values restored from electron-store |

**Verification Method**: Playwright MCP screenshot + accessibility tree

### 4.3 Workflow Integration Verification

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| E2E-WF-01 | n8n HTTP Request node reaches Docling API | [x] | URL uses `DOCLING_API_URL` env var |
| E2E-WF-02 | Workflow receives job_id from process endpoint | [x] | Response body contains `job_id` |
| E2E-WF-03 | Workflow can poll job status until completion | [x] | Loop with Wait node until status=completed |
| E2E-WF-04 | Workflow receives markdown in final response | [x] | `result.markdown` in completed job |
| E2E-WF-05 | Workflow handles processing timeout gracefully | [x] | Error output for timeout; workflow continues |
| E2E-WF-06 | Batch workflow processes multiple documents | [x] | Loop over file paths; aggregate results |

**Verification Method**: n8n workflow execution + log correlation

---

## 5. AI Debugging Workflow

### 5.1 Failure Detection

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| DBG-01 | Exit codes non-zero on failure | [x] | Python service exits with code 1 on fatal error |
| DBG-02 | Error logs contain actionable information | [x] | Include file path, operation, and suggestion |
| DBG-03 | Screenshot captured on UI assertion failure | [x] | Playwright captures on test failure |
| DBG-04 | Stack traces include file and line numbers | [x] | Full Python traceback in structured log |
| DBG-05 | Timeout failures distinguished from errors | [x] | `error_type: "timeout"` vs `error_type: "processing_error"` |

### 5.2 Root Cause Analysis Support

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| RCA-01 | Logs queryable by trace_id | [x] | `docling:getLogs` accepts `traceId` filter |
| RCA-02 | Timeline reconstruction from timestamps | [x] | ISO 8601 timestamps enable sorting |
| RCA-03 | Service state at failure point captured | [x] | State snapshot in error log entry |
| RCA-04 | Memory/resource metrics at failure available | [x] | Memory usage logged with each job |
| RCA-05 | Configuration state logged at startup | [x] | Full config logged at INFO on service start |

### 5.3 Verification Guardrails

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| GRD-01 | Maximum verification time cap (prevent infinite loops) | [x] | 5 minute global timeout per test |
| GRD-02 | Token/cost limits for LLM verification calls | [x] | N/A - no LLM calls in verification |
| GRD-03 | Checkpoint assertions prevent false negatives | [x] | Explicit assertions at each verification step |
| GRD-04 | Retry limits prevent infinite retry loops | [x] | Max 3 retries per operation |

---

## 6. Implementation Checklist

### 6.1 Python Service Implementation

- [x] Add `structlog` for structured JSON logging
- [x] Implement `trace_id` middleware for FastAPI
- [x] Configure stderr for diagnostics, stdout for results
- [x] Add memory profiling hooks for processing jobs
- [x] Document log schema in OpenAPI specification

**Implementation Notes**:
- Use `structlog` (not `loguru`) for better JSON output control
- Middleware extracts `X-Trace-Id` header or generates UUID v4
- Memory profiling via `psutil` library

### 6.2 Electron Implementation

- [x] Add structured logging to DoclingManager
- [x] Implement trace context propagation to child process
- [x] Add screenshot capture utility for verification
- [x] Configure log aggregation for debugging

**Implementation Notes**:
- Structured logs as JSON objects with consistent schema
- Pass trace_id via CLI arg `--trace-context` to child process
- Screenshot utility wraps Playwright MCP calls
- In-memory ring buffer for logs (1000 entries max)

### 6.3 UI Implementation

- [x] Add `data-testid` attributes to all interactive elements
- [x] Ensure ARIA labels on status indicators
- [x] Implement accessible error message display
- [x] Add log viewer component with filtering

**Implementation Notes**:
- Pattern: `data-testid="docling-{component}-{element}"`
- Status indicator: `aria-live="polite"`, `role="status"`
- Errors: `role="alert"`, `aria-live="assertive"`
- Log viewer: collapsible panel with trace_id filter

### 6.4 Test Infrastructure

- [x] Configure Playwright MCP server for AI testing
- [x] Create verification workflows for each user story
- [x] Implement log correlation in test assertions
- [x] Add visual regression baseline captures

**Implementation Notes**:
- Playwright MCP runs as separate process during tests
- Each user story has dedicated test workflow
- Assertions include trace_id for log correlation
- Baseline screenshots stored in `tests/fixtures/baselines/`

---

## 7. Open Questions

| ID | Question | Owner | Resolution |
|----|----------|-------|------------|
| OQ-01 | Should logs be persisted to disk or memory-only? | Resolved | **Memory-only** - in-memory ring buffer, retrievable via IPC |
| OQ-02 | What is the log retention period for debugging? | Resolved | **1000 entries** - oldest entries discarded when buffer full |
| OQ-03 | Should screenshots include sensitive document content? | Resolved | **Yes** - local machine only; user responsible for content |
| OQ-04 | How to handle verification in air-gapped environments? | Resolved | **Fully supported** - no external dependencies for verification |
| OQ-05 | Integration with existing n8n telemetry? | Resolved | **No integration** - Docling logs are separate stream |

---

## 8. Acceptance Criteria Summary

For AI self-verification to be considered complete:

1. **Logging**: All components emit structured JSON logs with trace correlation
2. **Visual**: Screenshots capturable on demand with trace linkage
3. **Automation**: Playwright MCP can navigate and verify all Docling UI states
4. **End-to-End**: Full workflow from n8n to Docling verifiable with log correlation
5. **Debugging**: Any failure produces sufficient context for AI root cause analysis

**Status**: All acceptance criteria specified and ready for implementation.

---

## References

- [AI Debugging Design Document](../../../documentation/design/AI_DEBUGGING.md)
- [Playwright MCP Server](https://github.com/microsoft/playwright-mcp)
- [OpenAPI Contract](../contracts/openapi.yaml)
- [Data Model](../data-model.md)
