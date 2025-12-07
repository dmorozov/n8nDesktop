# Data Model: Granite Docling OCR Integration

**Feature Branch**: `003-docling-integration`
**Date**: 2025-12-06

---

## Entities

### DoclingConfig

User configuration for the Docling service, persisted via electron-store.

```typescript
interface DoclingConfig {
  enabled: boolean;                              // Whether service auto-starts
  processingTier: 'lightweight' | 'standard' | 'advanced';
  tempFolder: string;                            // Path to temp processing directory
  maxConcurrentJobs: number;                     // 1-3 concurrent workers
  timeoutAction: 'cancel' | 'extend' | 'notify'; // Action when timeout exceeded
}
```

**Validation Rules**:
- `maxConcurrentJobs`: Must be 1, 2, or 3
- `tempFolder`: Must be writable path or empty (uses system default)
- `processingTier`: Must be one of the three defined tiers

**Storage**: Part of `AppConfig` in electron-store (`config.json`)

---

### DoclingStatus

Runtime status of the Docling service.

```typescript
interface DoclingStatus {
  status: 'starting' | 'running' | 'stopped' | 'error';
  port: number;                     // Dynamic port (8001-8099 range)
  version: string;                  // Service version
  uptime: number;                   // Seconds since start
  url: string;                      // Full API base URL
  error?: string;                   // Error message if status is 'error'
  restartAttempts: number;          // Current restart attempt count (0-3)
}
```

**State Transitions**:
```
stopped ─start()─> starting ─ready─> running
    ^                  │                │
    │                  │crash           │crash
    │                  ▼                ▼
    └───stop()─── error <──restart()───┘
```

**Storage**: In-memory only (runtime state)

---

### ProcessingJob

Represents a document processing request in the job queue.

```typescript
interface ProcessingJob {
  job_id: string;                   // UUID
  file_path: string;                // Absolute path to input document
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;                 // 0-100 percentage
  result?: ProcessingResult;        // Populated on completion
  error?: string;                   // Error message if failed
  created_at: string;               // ISO 8601 timestamp
  started_at?: string;              // When processing began
  completed_at?: string;            // When processing finished
  options?: ProcessingOptions;      // Override settings for this job
}
```

**State Transitions**:
```
queued ─worker─> processing ─success─> completed
                     │                     │
                     │error                │
                     ▼                     │
                   failed                  │
                                           │
         cancelled <──cancel()────────────┘
         (from queued only)
```

**Storage**: In-memory queue (Python asyncio.Queue + dict)

---

### ProcessingResult

Output of a successful document processing job.

```typescript
interface ProcessingResult {
  status: 'success' | 'error';
  markdown?: string;                // Page-annotated Markdown content
  metadata?: ProcessingMetadata;    // Processing statistics
  error?: string;                   // Error details if failed
}

interface ProcessingMetadata {
  page_count: number;               // Total pages in document
  file_path: string;                // Original file path
  processing_tier: string;          // Tier used for processing
  format: string;                   // Detected format (pdf, docx, xlsx)
  processing_time_ms?: number;      // Time to process
  ocr_engine?: string;              // OCR engine used (easyocr, tesseract)
}
```

**Storage**: Part of ProcessingJob (transient)

---

### ProcessingOptions

Optional per-job configuration overrides.

```typescript
interface ProcessingOptions {
  processing_tier?: 'lightweight' | 'standard' | 'advanced';
  languages?: string[];             // OCR language codes (e.g., ["en", "fr"])
  force_full_page_ocr?: boolean;    // Force OCR on all pages
  timeout_seconds?: number;         // Override calculated timeout
}
```

**Storage**: Part of ProcessingJob (transient)

---

### HealthResponse

API health check response.

```typescript
interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  processing_tier: string;
  queue_size: number;               // Jobs waiting
  active_jobs: number;              // Jobs currently processing
}
```

**Storage**: Generated on-demand (no persistence)

---

## API Request/Response Models

### ProcessRequest

```typescript
interface ProcessRequest {
  file_path: string;                // Absolute path to document
  options?: ProcessingOptions;      // Optional overrides
}
```

### ProcessResponse

```typescript
interface ProcessResponse {
  job_id: string;                   // UUID for tracking
  status: string;                   // Initial status ("queued")
  message: string;                  // Human-readable message
}
```

### BatchProcessRequest

```typescript
interface BatchProcessRequest {
  file_paths: string[];             // Array of document paths
  options?: ProcessingOptions;      // Applied to all documents
}
```

### BatchProcessResponse

```typescript
interface BatchProcessResponse {
  job_ids: string[];                // UUIDs for each document
  status: string;                   // "queued"
  total_documents: number;          // Count of documents submitted
}
```

---

## Entity Relationships

```
┌─────────────────┐
│  DoclingConfig  │  (electron-store)
│                 │
│  - enabled      │
│  - tier         │──────────┐
│  - tempFolder   │          │ configures
│  - maxConcurrent│          │
└─────────────────┘          │
                             ▼
┌─────────────────┐    ┌──────────────┐
│  DoclingStatus  │◄───│ DoclingMgr   │ (Electron main process)
│                 │    │              │
│  - status       │    │ manages      │
│  - port         │    │              │
│  - uptime       │    └──────────────┘
│  - restartAttempts│        │
└─────────────────┘          │ HTTP calls
                             ▼
                    ┌──────────────────┐
                    │  FastAPI Service │ (Python process)
                    │                  │
                    │  ┌────────────┐  │
                    │  │  JobQueue  │  │
                    │  │            │  │
                    │  │ ProcessingJob[]│
                    │  │            │  │
                    │  └────────────┘  │
                    │        │         │
                    │        ▼         │
                    │  ┌────────────┐  │
                    │  │ Converter  │  │
                    │  │            │  │
                    │  │ ProcessingResult│
                    │  └────────────┘  │
                    └──────────────────┘
```

---

## Validation Rules Summary

| Entity | Field | Rule |
|--------|-------|------|
| DoclingConfig | maxConcurrentJobs | 1 ≤ value ≤ 3 |
| DoclingConfig | tempFolder | Empty or valid writable path |
| DoclingConfig | processingTier | Enum: lightweight, standard, advanced |
| DoclingStatus | port | 8001 ≤ port < 8100 |
| DoclingStatus | restartAttempts | 0 ≤ value ≤ 3 |
| ProcessingJob | file_path | File must exist and be readable |
| ProcessingJob | progress | 0 ≤ value ≤ 100 |
| ProcessRequest | file_path | Absolute path, supported format |

---

## Storage Locations

| Data | Location | Format | Persistence |
|------|----------|--------|-------------|
| DoclingConfig | `~/.config/n8n AI Runner/config.json` | JSON | Persistent |
| DoclingStatus | Memory | TypeScript object | Runtime only |
| ProcessingJob | Memory | Python dict | Runtime only |
| Temp files | `{tempFolder}/<job_id>/` | Various | Cleaned after job |
| Logs | Memory | Array<string> | Runtime only |
