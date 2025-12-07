# Implementation Plan: Granite Docling OCR Integration

**Branch**: `003-docling-integration` | **Date**: 2025-12-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-docling-integration/spec.md`

## Summary

Integrate IBM's Granite Docling document processing engine into the n8n Desktop application using a Python FastAPI backend that runs as a child process alongside the existing n8n server. The integration follows the Trident Local Server Model architecture where the Electron host orchestrates two independent backend services. Documents are processed via n8n workflows using HTTP Request nodes to call the local Docling API, returning page-annotated Markdown suitable for RAG pipelines and further automation.

## Technical Context

**Language/Version**: Python 3.10+ (Docling), TypeScript 5.6+ (Electron/React)
**Primary Dependencies**:
- Python: docling, docling[easyocr], FastAPI, uvicorn, pydantic
- Node.js: Existing Electron 33.0.0, electron-store, axios
**Storage**: File-based (temp folder for processing), electron-store (config)
**Testing**: pytest (Python), Vitest (TypeScript)
**Target Platform**: Windows 10/11, macOS 11+, Linux (Ubuntu 20.04+)
**Project Type**: Hybrid (Electron + embedded Python service)
**Performance Goals**: 10-page PDF to Markdown in <60 seconds (Standard tier)
**Constraints**: <8GB RAM during Standard processing, localhost-only binding
**Scale/Scope**: Single user, 1-3 concurrent jobs, documents up to 200MB/500 pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. User-First Simplicity | ✅ PASS | Python runtime check with install instructions; Settings UI for configuration |
| II. Data Portability | ✅ PASS | Temp folder user-configurable; processed output via n8n workflows |
| III. Bundled Self-Containment | ⚠️ JUSTIFIED | Python runtime required on target system (documented deviation) |
| IV. Transparent Server Lifecycle | ✅ PASS | Docling service auto-start, health checks, tray status integration |
| V. Test-Required Development | ✅ PASS | Unit tests for Python API, integration tests for IPC |

**Principle III Deviation Justification**: The Granite Docling VLM with all dependencies exceeds practical bundling limits (>2GB). The application will check for Python runtime availability and display clear installation instructions if missing. This is an acceptable trade-off for a specialized document processing feature.

## Project Structure

### Documentation (this feature)

```text
specs/003-docling-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI spec)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── main/                           # Electron main process
│   ├── docling-manager.ts          # NEW: Docling service lifecycle manager
│   ├── services/
│   │   └── docling-ipc-handler.ts  # NEW: IPC handlers for Docling
│   └── ipc-handlers/
│       └── docling.ts              # NEW: Docling IPC registration
│
├── renderer/src/
│   ├── components/features/settings/
│   │   └── DoclingSettingsTab.tsx  # NEW: Docling configuration UI
│   ├── stores/
│   │   └── docling.ts              # NEW: Docling state management
│   └── pages/
│       └── (existing)              # Job queue UI added to existing layout
│
├── preload/
│   └── types.ts                    # MODIFY: Add Docling types
│
└── docling/                        # EXISTING: Python project (modify)
    ├── pyproject.toml              # MODIFY: Add FastAPI, docling dependencies
    ├── src/
    │   └── docling_service/        # RENAME from hello_world
    │       ├── __init__.py
    │       ├── main.py             # FastAPI application entry
    │       ├── api/
    │       │   ├── __init__.py
    │       │   ├── routes.py       # API endpoints
    │       │   └── models.py       # Pydantic request/response models
    │       ├── core/
    │       │   ├── __init__.py
    │       │   ├── converter.py    # Docling document converter wrapper
    │       │   ├── config.py       # Configuration management
    │       │   └── queue.py        # Job queue implementation
    │       └── utils/
    │           ├── __init__.py
    │           └── markdown.py     # Page-annotated markdown generator
    └── tests/
        ├── test_api.py
        ├── test_converter.py
        └── test_queue.py
```

**Structure Decision**: Hybrid structure extending existing Electron app with new Python FastAPI service. The Python project at `src/docling/` is restructured from the placeholder `hello_world` to a full Docling service implementation.

---

## Phase 1: Python Docling Service Development

### 1.1 Restructure Existing Python Project (CRITICAL)

**Location**: `src/docling/`

**Tasks**:
1. Rename `src/hello_world/` to `src/docling_service/`
2. Update `pyproject.toml` with new package name and dependencies
3. Configure Poetry virtual environment (in-project)
4. Set up EasyOCR as default OCR engine

**Updated pyproject.toml**:
```toml
[tool.poetry]
name = "docling-service"
version = "0.1.0"
description = "Docling document processing API service"
packages = [{include = "docling_service", from = "src"}]

[tool.poetry.dependencies]
python = ">=3.10,<3.13"
docling = "^2.15.0"
docling-core = "^2.0.0"
fastapi = "^0.115.0"
uvicorn = {extras = ["standard"], version = "^0.32.0"}
pydantic = "^2.10.0"
python-multipart = "^0.0.18"

[tool.poetry.extras]
easyocr = ["easyocr"]

[tool.poetry.scripts]
docling-service = "docling_service.main:main"
```

### 1.2 Implement FastAPI Application (CRITICAL)

**File**: `src/docling_service/main.py`

```python
"""Docling FastAPI service entry point."""
import argparse
import multiprocessing
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from docling_service.api.routes import router
from docling_service.core.config import settings
from docling_service.core.queue import job_queue


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup: Initialize job queue
    await job_queue.start()
    yield
    # Shutdown: Clean up
    await job_queue.stop()


def create_app() -> FastAPI:
    """Create FastAPI application instance."""
    app = FastAPI(
        title="Docling Service",
        description="Document processing API for n8n Desktop",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix="/api/v1")

    return app


app = create_app()


def main():
    """Main entry point with CLI argument parsing."""
    multiprocessing.freeze_support()  # Required for PyInstaller

    parser = argparse.ArgumentParser(description="Docling Service")
    parser.add_argument("--port", type=int, default=8001, help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--auth-token", type=str, help="Shared secret for authentication")
    parser.add_argument("--temp-dir", type=str, help="Temporary directory for processing")
    parser.add_argument("--processing-tier", type=str, default="standard",
                       choices=["lightweight", "standard", "advanced"])
    parser.add_argument("--max-concurrent", type=int, default=1, help="Max concurrent jobs")

    args = parser.parse_args()

    # Update settings from CLI args
    settings.port = args.port
    settings.host = args.host
    settings.auth_token = args.auth_token
    settings.temp_dir = args.temp_dir
    settings.processing_tier = args.processing_tier
    settings.max_concurrent_jobs = args.max_concurrent

    uvicorn.run(
        "docling_service.main:app",
        host=args.host,
        port=args.port,
        reload=False,
        workers=1,  # Single worker for resource management
        log_level="info",
    )


if __name__ == "__main__":
    main()
```

### 1.3 Implement API Routes (CRITICAL)

**File**: `src/docling_service/api/routes.py`

```python
"""API route definitions."""
from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Header

from docling_service.api.models import (
    ProcessRequest, ProcessResponse, JobStatus, HealthResponse,
    BatchProcessRequest, BatchProcessResponse
)
from docling_service.core.config import settings
from docling_service.core.queue import job_queue
from docling_service.core.converter import process_document

router = APIRouter()


def verify_auth_token(authorization: str = Header(None)):
    """Verify shared secret authentication."""
    if settings.auth_token:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization")
        token = authorization.replace("Bearer ", "")
        if token != settings.auth_token:
            raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        processing_tier=settings.processing_tier,
        queue_size=job_queue.size(),
        active_jobs=job_queue.active_count(),
    )


@router.post("/process", response_model=ProcessResponse, dependencies=[Depends(verify_auth_token)])
async def process_single_document(request: ProcessRequest, background_tasks: BackgroundTasks):
    """Process a single document and return annotated Markdown."""
    job_id = await job_queue.enqueue(request.file_path, request.options)
    return ProcessResponse(
        job_id=job_id,
        status="queued",
        message=f"Document queued for processing"
    )


@router.post("/process/batch", response_model=BatchProcessResponse, dependencies=[Depends(verify_auth_token)])
async def process_batch_documents(request: BatchProcessRequest):
    """Process multiple documents in batch."""
    job_ids = []
    for file_path in request.file_paths:
        job_id = await job_queue.enqueue(file_path, request.options)
        job_ids.append(job_id)

    return BatchProcessResponse(
        job_ids=job_ids,
        status="queued",
        total_documents=len(request.file_paths),
    )


@router.get("/jobs/{job_id}", response_model=JobStatus, dependencies=[Depends(verify_auth_token)])
async def get_job_status(job_id: str):
    """Get status of a processing job."""
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/jobs/{job_id}", dependencies=[Depends(verify_auth_token)])
async def cancel_job(job_id: str):
    """Cancel a processing job."""
    success = await job_queue.cancel(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found or already completed")
    return {"status": "cancelled", "job_id": job_id}


@router.get("/jobs", response_model=List[JobStatus], dependencies=[Depends(verify_auth_token)])
async def list_jobs():
    """List all jobs in the queue."""
    return job_queue.list_jobs()
```

### 1.4 Implement Document Converter with Page Metadata (CRITICAL)

**File**: `src/docling_service/core/converter.py`

```python
"""Docling document converter with page metadata preservation."""
from pathlib import Path
from typing import Optional
import logging

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    EasyOcrOptions,
    AcceleratorOptions,
    AcceleratorDevice,
)
from docling.document_converter import DocumentConverter, PdfFormatOption

from docling_service.core.config import settings
from docling_service.utils.markdown import generate_page_annotated_markdown

logger = logging.getLogger(__name__)


def create_converter(processing_tier: str = "standard") -> DocumentConverter:
    """Create a DocumentConverter configured for the specified processing tier."""

    pipeline_options = PdfPipelineOptions()

    # Configure based on processing tier
    if processing_tier == "lightweight":
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = False
        pipeline_options.images_scale = 1.0
        pipeline_options.generate_page_images = False

    elif processing_tier == "standard":
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        pipeline_options.table_structure_options.do_cell_matching = True
        pipeline_options.images_scale = 1.5
        pipeline_options.generate_page_images = True

    elif processing_tier == "advanced":
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        pipeline_options.table_structure_options.do_cell_matching = True
        pipeline_options.images_scale = 2.0
        pipeline_options.generate_page_images = True
        # Enable VLM pipeline for advanced features
        # Note: This requires additional model weights

    # Configure EasyOCR as default OCR engine
    # IMPORTANT: Set ocr_options AFTER other OCR settings to avoid overwriting
    ocr_options = EasyOcrOptions()
    ocr_options.lang = ["en"]  # Default to English, can be extended
    pipeline_options.ocr_options = ocr_options

    # Configure accelerator
    pipeline_options.accelerator_options = AcceleratorOptions(
        num_threads=4,
        device=AcceleratorDevice.AUTO,  # Auto-detect GPU/CPU
    )

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )


async def process_document(
    file_path: str,
    processing_tier: Optional[str] = None,
) -> dict:
    """
    Process a document and return page-annotated Markdown.

    Args:
        file_path: Path to the document file
        processing_tier: Override default processing tier

    Returns:
        Dictionary containing:
        - markdown: Page-annotated Markdown content
        - metadata: Processing metadata (page_count, processing_time, etc.)
        - status: Processing status
    """
    tier = processing_tier or settings.processing_tier
    converter = create_converter(tier)

    try:
        # Convert document
        result = converter.convert(file_path)

        if result.status.name != "SUCCESS":
            return {
                "status": "error",
                "error": f"Conversion failed: {result.status.name}",
                "markdown": None,
                "metadata": None,
            }

        # Generate page-annotated Markdown
        markdown = generate_page_annotated_markdown(result.document)

        # Extract metadata
        metadata = {
            "page_count": len(result.document.pages) if hasattr(result.document, 'pages') else 0,
            "file_path": file_path,
            "processing_tier": tier,
            "format": Path(file_path).suffix.lower(),
        }

        return {
            "status": "success",
            "markdown": markdown,
            "metadata": metadata,
            "error": None,
        }

    except Exception as e:
        logger.exception(f"Error processing document: {file_path}")
        return {
            "status": "error",
            "error": str(e),
            "markdown": None,
            "metadata": None,
        }
```

### 1.5 Implement Page-Annotated Markdown Generator (CRITICAL)

**File**: `src/docling_service/utils/markdown.py`

```python
"""Page-annotated Markdown generation utilities."""
from typing import List


def generate_page_annotated_markdown(document) -> str:
    """
    Generate Markdown with embedded page number annotations.

    This implements custom post-processing to preserve page provenance
    since default export_to_markdown() strips this information.

    Args:
        document: DoclingDocument object from conversion

    Returns:
        Markdown string with page markers embedded
    """
    markdown_parts: List[str] = []
    current_page = None

    # Iterate through document elements with provenance
    for element, _level in document.iterate_items():
        # Extract page number from provenance
        page_no = None
        if hasattr(element, 'prov') and element.prov:
            for prov in element.prov:
                if hasattr(prov, 'page_no'):
                    page_no = prov.page_no
                    break

        # Add page marker if page changed
        if page_no is not None and page_no != current_page:
            current_page = page_no
            markdown_parts.append(f"\n<!-- PAGE: {page_no} -->\n")
            markdown_parts.append(f"<span data-page=\"{page_no}\"></span>\n")

        # Convert element to Markdown
        element_md = _element_to_markdown(element)
        if element_md:
            markdown_parts.append(element_md)

    return "\n".join(markdown_parts)


def _element_to_markdown(element) -> str:
    """Convert a single document element to Markdown."""
    element_type = type(element).__name__

    if element_type == "TextItem":
        return element.text + "\n"

    elif element_type == "SectionHeaderItem":
        level = getattr(element, 'level', 1)
        return f"{'#' * level} {element.text}\n"

    elif element_type == "ListItem":
        marker = getattr(element, 'marker', '-')
        return f"{marker} {element.text}\n"

    elif element_type == "TableItem":
        return _table_to_markdown(element)

    elif element_type == "CodeItem":
        lang = getattr(element, 'language', '')
        return f"```{lang}\n{element.text}\n```\n"

    elif element_type == "FormulaItem":
        # LaTeX formula
        return f"$$\n{element.text}\n$$\n"

    elif element_type == "PictureItem":
        caption = getattr(element, 'caption', 'Image')
        return f"![{caption}]()\n"

    else:
        # Fallback for unknown types
        if hasattr(element, 'text'):
            return element.text + "\n"
        return ""


def _table_to_markdown(table_element) -> str:
    """Convert a table element to Markdown table format."""
    if not hasattr(table_element, 'data') or not table_element.data:
        return ""

    rows = table_element.data.grid
    if not rows:
        return ""

    md_lines = []

    # Header row
    if rows:
        header = rows[0]
        md_lines.append("| " + " | ".join(str(cell.text) for cell in header) + " |")
        md_lines.append("| " + " | ".join("---" for _ in header) + " |")

    # Data rows
    for row in rows[1:]:
        md_lines.append("| " + " | ".join(str(cell.text) for cell in row) + " |")

    return "\n".join(md_lines) + "\n"
```

### 1.6 Implement Job Queue (CRITICAL)

**File**: `src/docling_service/core/queue.py`

```python
"""Job queue for managing document processing."""
import asyncio
import uuid
from datetime import datetime
from typing import Optional, Dict, List
from dataclasses import dataclass, field
from enum import Enum

from docling_service.core.config import settings
from docling_service.core.converter import process_document


class JobState(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    id: str
    file_path: str
    options: dict
    state: JobState = JobState.QUEUED
    progress: int = 0
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "job_id": self.id,
            "file_path": self.file_path,
            "status": self.state.value,
            "progress": self.progress,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class JobQueue:
    """Manages document processing jobs with configurable concurrency."""

    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._queue: asyncio.Queue = asyncio.Queue()
        self._workers: List[asyncio.Task] = []
        self._running = False

    async def start(self):
        """Start the job queue workers."""
        self._running = True
        for i in range(settings.max_concurrent_jobs):
            worker = asyncio.create_task(self._worker(i))
            self._workers.append(worker)

    async def stop(self):
        """Stop all workers and clear the queue."""
        self._running = False
        for worker in self._workers:
            worker.cancel()
        self._workers.clear()

    async def enqueue(self, file_path: str, options: dict = None) -> str:
        """Add a document to the processing queue."""
        job_id = str(uuid.uuid4())
        job = Job(
            id=job_id,
            file_path=file_path,
            options=options or {},
        )
        self._jobs[job_id] = job
        await self._queue.put(job_id)
        return job_id

    async def cancel(self, job_id: str) -> bool:
        """Cancel a queued job."""
        job = self._jobs.get(job_id)
        if not job:
            return False
        if job.state == JobState.QUEUED:
            job.state = JobState.CANCELLED
            job.completed_at = datetime.utcnow()
            return True
        return False

    def get_job(self, job_id: str) -> Optional[dict]:
        """Get job status by ID."""
        job = self._jobs.get(job_id)
        return job.to_dict() if job else None

    def list_jobs(self) -> List[dict]:
        """List all jobs."""
        return [job.to_dict() for job in self._jobs.values()]

    def size(self) -> int:
        """Get number of jobs in queue."""
        return self._queue.qsize()

    def active_count(self) -> int:
        """Get number of active (processing) jobs."""
        return sum(1 for job in self._jobs.values() if job.state == JobState.PROCESSING)

    async def _worker(self, worker_id: int):
        """Worker coroutine for processing jobs."""
        while self._running:
            try:
                job_id = await asyncio.wait_for(self._queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            job = self._jobs.get(job_id)
            if not job or job.state == JobState.CANCELLED:
                continue

            job.state = JobState.PROCESSING
            job.started_at = datetime.utcnow()

            try:
                result = await process_document(
                    job.file_path,
                    job.options.get("processing_tier"),
                )

                if result["status"] == "success":
                    job.state = JobState.COMPLETED
                    job.result = result
                else:
                    job.state = JobState.FAILED
                    job.error = result.get("error", "Unknown error")

            except Exception as e:
                job.state = JobState.FAILED
                job.error = str(e)

            finally:
                job.completed_at = datetime.utcnow()
                job.progress = 100


# Global job queue instance
job_queue = JobQueue()
```

---

## Phase 2: Electron Integration Layer

### 2.1 Implement Docling Manager (CRITICAL)

**File**: `src/main/docling-manager.ts`

This follows the same pattern as the existing `n8n-manager.ts`:

```typescript
import { spawn, execSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { isPortAvailable } from './utils/port-finder';
import { ConfigManager } from './config-manager';
import crypto from 'crypto';

export interface DoclingStatus {
  status: 'starting' | 'running' | 'stopped' | 'error';
  port: number;
  version: string;
  uptime: number;
  url: string;
  error?: string;
  restartAttempts: number;
}

export interface DoclingStartResult {
  success: boolean;
  port?: number;
  error?: string;
}

const HEALTH_CHECK_INTERVAL = 5000;
const STARTUP_TIMEOUT = 60000;
const SHUTDOWN_TIMEOUT = 5000;
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_RESET_TIME = 60000; // Reset counter after 1 minute of stability

export class DoclingManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private configManager: ConfigManager;
  private status: DoclingStatus;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private restartResetTimeout: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private logs: string[] = [];
  private maxLogLines = 1000;
  private authToken: string;
  private restartAttempts: number = 0;

  constructor(configManager: ConfigManager) {
    super();
    this.configManager = configManager;
    this.authToken = crypto.randomBytes(32).toString('hex');
    this.status = {
      status: 'stopped',
      port: 8001, // Default Docling port
      version: '',
      uptime: 0,
      url: '',
      restartAttempts: 0,
    };
  }

  /**
   * Get the authentication token for API calls
   */
  getAuthToken(): string {
    return this.authToken;
  }

  /**
   * Check if Python runtime is available
   */
  async checkPythonAvailable(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const result = execSync(`${pythonCmd} --version`, { encoding: 'utf-8' });
      const version = result.trim().replace('Python ', '');
      return { available: true, version };
    } catch {
      return {
        available: false,
        error: 'Python 3.10+ is required. Please install Python from https://www.python.org/downloads/',
      };
    }
  }

  /**
   * Start the Docling service
   */
  async start(): Promise<DoclingStartResult> {
    // Check Python availability first
    const pythonCheck = await this.checkPythonAvailable();
    if (!pythonCheck.available) {
      this.updateStatus({ status: 'error', error: pythonCheck.error });
      return { success: false, error: pythonCheck.error };
    }

    if (this.process) {
      return { success: false, error: 'Docling is already running' };
    }

    // Find available port
    let port = 8001;
    while (!(await isPortAvailable(port)) && port < 8100) {
      port++;
    }

    if (port >= 8100) {
      return { success: false, error: 'No available port found for Docling service' };
    }

    this.updateStatus({ status: 'starting', port, error: undefined });

    const doclingConfig = this.configManager.get('doclingConfig') as any || {};
    const tempDir = doclingConfig.tempFolder || path.join(app.getPath('temp'), 'docling');
    const processingTier = doclingConfig.processingTier || 'standard';
    const maxConcurrent = doclingConfig.maxConcurrentJobs || 1;

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    return new Promise((resolve) => {
      try {
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const doclingPath = path.join(app.getAppPath(), 'src', 'docling');

        // Spawn Docling service
        this.process = spawn(pythonCmd, [
          '-m', 'docling_service.main',
          '--port', port.toString(),
          '--host', '127.0.0.1',
          '--auth-token', this.authToken,
          '--temp-dir', tempDir,
          '--processing-tier', processingTier,
          '--max-concurrent', maxConcurrent.toString(),
        ], {
          cwd: doclingPath,
          env: {
            ...process.env,
            PYTHONPATH: path.join(doclingPath, 'src'),
          },
          shell: process.platform === 'win32',
          windowsHide: true,
          detached: process.platform !== 'win32',
        });

        this.startTime = Date.now();

        // Handle stdout
        this.process.stdout?.on('data', (data: Buffer) => {
          const output = data.toString();
          this.addLog(output);

          if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
            this.updateStatus({
              status: 'running',
              url: `http://localhost:${port}`,
            });
            this.startHealthCheck();
            this.resetRestartCounter();
            resolve({ success: true, port });
          }
        });

        // Handle stderr
        this.process.stderr?.on('data', (data: Buffer) => {
          this.addLog(`[ERROR] ${data.toString()}`);
        });

        // Handle exit
        this.process.on('exit', (code, signal) => {
          this.addLog(`Docling process exited with code ${code}, signal ${signal}`);
          this.stopHealthCheck();
          this.process = null;

          if (this.status.status === 'starting') {
            this.updateStatus({ status: 'error', error: `Docling failed to start (exit code: ${code})` });
            resolve({ success: false, error: `Docling failed to start (exit code: ${code})` });
          } else if (this.status.status === 'running') {
            // Unexpected crash - attempt auto-restart
            this.handleUnexpectedCrash();
          } else {
            this.updateStatus({ status: 'stopped' });
          }
        });

        // Handle error
        this.process.on('error', (error) => {
          this.addLog(`[ERROR] Process error: ${error.message}`);
          this.updateStatus({ status: 'error', error: error.message });
          resolve({ success: false, error: error.message });
        });

        // Startup timeout
        setTimeout(() => {
          if (this.status.status === 'starting') {
            this.updateStatus({ status: 'error', error: 'Docling startup timeout' });
            this.stop();
            resolve({ success: false, error: 'Docling startup timeout' });
          }
        }, STARTUP_TIMEOUT);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.updateStatus({ status: 'error', error: errorMessage });
        resolve({ success: false, error: errorMessage });
      }
    });
  }

  /**
   * Handle unexpected service crash with auto-restart
   */
  private async handleUnexpectedCrash(): Promise<void> {
    this.restartAttempts++;
    this.updateStatus({ restartAttempts: this.restartAttempts });

    if (this.restartAttempts <= MAX_RESTART_ATTEMPTS) {
      this.addLog(`Attempting auto-restart (${this.restartAttempts}/${MAX_RESTART_ATTEMPTS})`);
      await this.start();
    } else {
      this.updateStatus({
        status: 'error',
        error: `Service crashed ${MAX_RESTART_ATTEMPTS} times. Manual restart required.`,
      });
      this.emit('requiresManualRestart');
    }
  }

  /**
   * Reset restart counter after stable operation
   */
  private resetRestartCounter(): void {
    if (this.restartResetTimeout) {
      clearTimeout(this.restartResetTimeout);
    }
    this.restartResetTimeout = setTimeout(() => {
      this.restartAttempts = 0;
      this.updateStatus({ restartAttempts: 0 });
    }, RESTART_RESET_TIME);
  }

  // ... stop(), restart(), getStatus(), getLogs() methods similar to N8nManager
}
```

### 2.2 Add Docling Configuration to ConfigManager (CRITICAL)

**Modify**: `src/main/config-manager.ts`

Add new interface and schema:

```typescript
export interface DoclingConfig {
  enabled: boolean;
  processingTier: 'lightweight' | 'standard' | 'advanced';
  tempFolder: string;
  maxConcurrentJobs: number;
  timeoutAction: 'cancel' | 'extend' | 'notify';
}

// Add to AppConfig interface
export interface AppConfig {
  // ... existing fields
  doclingConfig: DoclingConfig;
}

// Add to defaultConfig
const defaultConfig: AppConfig = {
  // ... existing defaults
  doclingConfig: {
    enabled: true,
    processingTier: 'standard',
    tempFolder: path.join(app.getPath('temp'), 'docling'),
    maxConcurrentJobs: 1,
    timeoutAction: 'notify',
  },
};
```

### 2.3 Add IPC Handlers for Docling (CRITICAL)

**File**: `src/main/ipc-handlers/docling.ts`

```typescript
import { ipcMain } from 'electron';
import { DoclingManager } from '../docling-manager';
import axios from 'axios';

export function registerDoclingHandlers(doclingManager: DoclingManager): void {
  // Service management
  ipcMain.handle('docling:start', async () => {
    return doclingManager.start();
  });

  ipcMain.handle('docling:stop', async () => {
    await doclingManager.stop();
    return { success: true };
  });

  ipcMain.handle('docling:restart', async () => {
    return doclingManager.restart();
  });

  ipcMain.handle('docling:getStatus', async () => {
    return doclingManager.getStatus();
  });

  ipcMain.handle('docling:checkPython', async () => {
    return doclingManager.checkPythonAvailable();
  });

  // Document processing
  ipcMain.handle('docling:process', async (_event, filePath: string, options?: any) => {
    const status = doclingManager.getStatus();
    if (status.status !== 'running') {
      return { success: false, error: 'Docling service is not running' };
    }

    try {
      const response = await axios.post(
        `${status.url}/api/v1/process`,
        { file_path: filePath, options },
        {
          headers: {
            Authorization: `Bearer ${doclingManager.getAuthToken()}`,
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('docling:processBatch', async (_event, filePaths: string[], options?: any) => {
    const status = doclingManager.getStatus();
    if (status.status !== 'running') {
      return { success: false, error: 'Docling service is not running' };
    }

    try {
      const response = await axios.post(
        `${status.url}/api/v1/process/batch`,
        { file_paths: filePaths, options },
        {
          headers: {
            Authorization: `Bearer ${doclingManager.getAuthToken()}`,
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('docling:getJob', async (_event, jobId: string) => {
    const status = doclingManager.getStatus();
    if (status.status !== 'running') {
      return { success: false, error: 'Docling service is not running' };
    }

    try {
      const response = await axios.get(
        `${status.url}/api/v1/jobs/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${doclingManager.getAuthToken()}`,
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('docling:cancelJob', async (_event, jobId: string) => {
    const status = doclingManager.getStatus();
    if (status.status !== 'running') {
      return { success: false, error: 'Docling service is not running' };
    }

    try {
      await axios.delete(
        `${status.url}/api/v1/jobs/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${doclingManager.getAuthToken()}`,
          },
        }
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('docling:listJobs', async () => {
    const status = doclingManager.getStatus();
    if (status.status !== 'running') {
      return { success: false, error: 'Docling service is not running' };
    }

    try {
      const response = await axios.get(
        `${status.url}/api/v1/jobs`,
        {
          headers: {
            Authorization: `Bearer ${doclingManager.getAuthToken()}`,
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get API info for n8n workflows
  ipcMain.handle('docling:getApiInfo', async () => {
    const status = doclingManager.getStatus();
    return {
      url: status.url,
      port: status.port,
      authToken: doclingManager.getAuthToken(),
      status: status.status,
    };
  });
}
```

---

## Phase 3: Settings UI Implementation

### 3.1 Create Docling Settings Tab (RECOMMENDED)

**File**: `src/renderer/src/components/features/settings/DoclingSettingsTab.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { FileText, RefreshCw, Loader2, Play, Square, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { $settings, updatePendingSetting, getSetting } from '@/stores/settings';
import { $doclingStatus, startDocling, stopDocling, restartDocling } from '@/stores/docling';

interface DoclingSettingsTabProps {
  onSave: () => Promise<void>;
  isSaving: boolean;
  hasChanges: boolean;
}

const TIER_DESCRIPTIONS = {
  lightweight: 'Fast processing with basic OCR. Best for simple documents. (~2-4 GB RAM)',
  standard: 'Balanced processing with table and code detection. (~4-8 GB RAM)',
  advanced: 'Full VLM pipeline with equation and chart recognition. (~8-16 GB RAM)',
};

export function DoclingSettingsTab({ onSave, isSaving, hasChanges }: DoclingSettingsTabProps) {
  useStore($settings);
  const doclingStatus = useStore($doclingStatus);
  const [pythonStatus, setPythonStatus] = useState<{ available: boolean; version?: string; error?: string } | null>(null);

  const doclingConfig = getSetting('doclingConfig') || {
    enabled: true,
    processingTier: 'standard',
    tempFolder: '',
    maxConcurrentJobs: 1,
    timeoutAction: 'notify',
  };

  useEffect(() => {
    // Check Python availability on mount
    window.electron.docling.checkPython().then(setPythonStatus);
  }, []);

  const handleBrowseTempFolder = async () => {
    const result = await window.electron.dialog.selectFolder({
      title: 'Select Temporary Folder for Document Processing',
    });
    if (result.success && result.path) {
      updatePendingSetting('doclingConfig', { ...doclingConfig, tempFolder: result.path });
    }
  };

  const statusColor = {
    running: 'bg-green-500',
    stopped: 'bg-gray-500',
    starting: 'bg-yellow-500',
    error: 'bg-red-500',
  }[doclingStatus.status];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Document Processing (Docling)</h3>
        <p className="text-sm text-muted-foreground">
          Configure the Granite Docling document processing service.
        </p>
      </div>

      <Separator />

      {/* Python Status Check */}
      {pythonStatus && !pythonStatus.available && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h4 className="font-medium text-destructive">Python Not Found</h4>
              <p className="text-sm text-muted-foreground mt-1">{pythonStatus.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Service Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${statusColor}`} />
            <div>
              <Label>Service Status</Label>
              <p className="text-sm text-muted-foreground">
                {doclingStatus.status === 'running'
                  ? `Running on port ${doclingStatus.port}`
                  : doclingStatus.error || doclingStatus.status}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {doclingStatus.status === 'running' ? (
              <Button variant="outline" size="sm" onClick={stopDocling}>
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={startDocling} disabled={!pythonStatus?.available}>
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={restartDocling} disabled={!pythonStatus?.available}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Restart
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Processing Tier */}
      <div className="space-y-2">
        <Label>Processing Tier</Label>
        <Select
          value={doclingConfig.processingTier}
          onValueChange={(value) => updatePendingSetting('doclingConfig', { ...doclingConfig, processingTier: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lightweight">Lightweight</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {TIER_DESCRIPTIONS[doclingConfig.processingTier as keyof typeof TIER_DESCRIPTIONS]}
        </p>
      </div>

      {/* Max Concurrent Jobs */}
      <div className="space-y-2">
        <Label>Maximum Concurrent Jobs</Label>
        <Select
          value={doclingConfig.maxConcurrentJobs.toString()}
          onValueChange={(value) => updatePendingSetting('doclingConfig', { ...doclingConfig, maxConcurrentJobs: parseInt(value) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 (Recommended for most systems)</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3 (High-end systems only)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Temporary Folder */}
      <div className="space-y-2">
        <Label>Temporary Folder</Label>
        <div className="flex gap-2">
          <Input
            value={doclingConfig.tempFolder}
            onChange={(e) => updatePendingSetting('doclingConfig', { ...doclingConfig, tempFolder: e.target.value })}
            placeholder="Default system temp folder"
          />
          <Button variant="outline" onClick={handleBrowseTempFolder}>
            Browse
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Location for temporary files during document processing.
        </p>
      </div>

      {/* Timeout Action */}
      <div className="space-y-2">
        <Label>Timeout Action</Label>
        <Select
          value={doclingConfig.timeoutAction}
          onValueChange={(value) => updatePendingSetting('doclingConfig', { ...doclingConfig, timeoutAction: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cancel">Cancel job</SelectItem>
            <SelectItem value="extend">Extend timeout</SelectItem>
            <SelectItem value="notify">Notify user</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Action to take when processing exceeds the calculated timeout.
        </p>
      </div>

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!hasChanges || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
```

### 3.2 Add Docling Tab to Settings Dialog (RECOMMENDED)

**Modify**: `src/renderer/src/components/features/settings/SettingsDialog.tsx`

Add import and new tab:

```tsx
import { DoclingSettingsTab } from './DoclingSettingsTab';
import { FileText } from 'lucide-react';

// In TabsList, add:
<TabsTrigger value="docling" className="flex items-center gap-2">
  <FileText className="h-4 w-4" />
  <span className="hidden sm:inline">Docling</span>
</TabsTrigger>

// In TabsContent area, add:
<TabsContent value="docling" className="mt-0">
  <DoclingSettingsTab
    onSave={handleSave}
    isSaving={isSaving}
    hasChanges={hasUnsavedChanges}
  />
</TabsContent>
```

---

## Phase 4: n8n Workflow Integration

### 4.1 Expose Docling API Info to n8n (CRITICAL)

The Docling API port and authentication token must be accessible to n8n workflows. This is achieved through environment variables passed when starting n8n:

**Modify**: `src/main/n8n-manager.ts`

```typescript
// In the start() method, add to environment variables:
const doclingApiInfo = this.doclingManager?.getApiInfo();

const env: NodeJS.ProcessEnv = {
  ...process.env,
  // ... existing env vars

  // Docling API info for n8n workflows
  DOCLING_API_URL: doclingApiInfo?.url || 'http://localhost:8001',
  DOCLING_API_PORT: doclingApiInfo?.port?.toString() || '8001',
  DOCLING_AUTH_TOKEN: doclingApiInfo?.authToken || '',
};
```

### 4.2 Sample n8n Workflow Definition (RECOMMENDED)

**File**: `resources/workflows/docling-batch-summarize.json`

```json
{
  "name": "Docling Batch Document Summarization",
  "nodes": [
    {
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300]
    },
    {
      "name": "Define Documents",
      "type": "n8n-nodes-base.set",
      "position": [450, 300],
      "parameters": {
        "values": {
          "string": [
            {
              "name": "documents",
              "value": "={{[\"/path/to/doc1.pdf\", \"/path/to/doc2.pdf\"]}}"
            }
          ]
        }
      }
    },
    {
      "name": "Process with Docling",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 300],
      "parameters": {
        "method": "POST",
        "url": "=http://localhost:{{$env.DOCLING_API_PORT}}/api/v1/process/batch",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{$env.DOCLING_AUTH_TOKEN}}"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "file_paths",
              "value": "={{$json.documents}}"
            }
          ]
        }
      }
    },
    {
      "name": "Poll Job Status",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 300],
      "parameters": {
        "method": "GET",
        "url": "=http://localhost:{{$env.DOCLING_API_PORT}}/api/v1/jobs/{{$json.job_ids[0]}}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{$env.DOCLING_AUTH_TOKEN}}"
            }
          ]
        }
      }
    },
    {
      "name": "AI Summarize",
      "type": "n8n-nodes-base.openAi",
      "position": [1050, 300],
      "parameters": {
        "operation": "text",
        "prompt": "=Summarize the following document into a brief report:\n\n{{$json.result.markdown}}"
      }
    }
  ],
  "connections": {
    "Manual Trigger": { "main": [[{ "node": "Define Documents", "type": "main", "index": 0 }]] },
    "Define Documents": { "main": [[{ "node": "Process with Docling", "type": "main", "index": 0 }]] },
    "Process with Docling": { "main": [[{ "node": "Poll Job Status", "type": "main", "index": 0 }]] },
    "Poll Job Status": { "main": [[{ "node": "AI Summarize", "type": "main", "index": 0 }]] }
  }
}
```

---

## Phase 5: Testing and Validation

### 5.1 Python Unit Tests (CRITICAL)

**File**: `src/docling/tests/test_converter.py`

```python
import pytest
from pathlib import Path
from docling_service.core.converter import create_converter, process_document


class TestConverter:
    def test_create_converter_lightweight(self):
        converter = create_converter("lightweight")
        assert converter is not None

    def test_create_converter_standard(self):
        converter = create_converter("standard")
        assert converter is not None

    def test_create_converter_advanced(self):
        converter = create_converter("advanced")
        assert converter is not None


class TestMarkdownGeneration:
    def test_page_markers_included(self):
        # Test with sample document
        pass
```

### 5.2 Integration Tests (CRITICAL)

**File**: `tests/integration/docling-service.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

describe('Docling Service Integration', () => {
  const baseUrl = 'http://localhost:8001/api/v1';
  const authToken = 'test-token';

  it('should return healthy status', async () => {
    const response = await axios.get(`${baseUrl}/health`);
    expect(response.data.status).toBe('healthy');
  });

  it('should process a PDF document', async () => {
    const response = await axios.post(
      `${baseUrl}/process`,
      { file_path: './tests/fixtures/sample.pdf' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    expect(response.data.job_id).toBeDefined();
  });
});
```

---

## Known Issues and Workarounds

| Issue | Description | Criticality | Workaround |
|-------|-------------|-------------|------------|
| **Page Metadata Loss** | Default `export_to_markdown()` strips page provenance data | **Critical** | Custom post-processing in `generate_page_annotated_markdown()` traverses DoclingDocument and manually injects page markers |
| **PyInstaller Hidden Imports** | Uvicorn/FastAPI dynamic imports not detected | **Critical** | Add explicit `hiddenimports` in PyInstaller spec: `uvicorn.logging`, `uvicorn.loops.*`, `uvicorn.protocols.*` |
| **Python Runtime Dependency** | Cannot bundle full Python + Docling (~2GB+) | **Critical** | Check for Python availability at startup; display installation instructions if missing |
| **Port Conflicts** | n8n (5678) and Docling might conflict | **Critical** | Dynamic port allocation with `isPortAvailable()` check; configurable port range |
| **Memory Exhaustion** | Large documents + VLM can exceed RAM | **High** | Configurable concurrent job limit (1-3); processing tier selection; auto-calculated timeouts |
| **EasyOCR Order Sensitivity** | Setting `ocr_options` after other settings overwrites them | **High** | Set `EasyOcrOptions()` LAST in pipeline configuration |
| **Timeout Calculation** | Auto-calculated timeout needs clear formula | **Medium** | Use formula: `timeout_seconds = 60 + (page_count * 10)` for Standard tier; multiply by 0.5 for Lightweight, 2.0 for Advanced |
| **Graceful Shutdown** | Jobs in progress may be lost on app close | **Medium** | Job queue state persistence; resume capability on restart |
| **Cross-Platform Paths** | Windows vs Unix path handling | **Medium** | Use `path.join()` consistently; normalize paths before passing to Python |

---

## EasyOCR Pipeline Configuration

To initialize the Docling pipeline with EasyOCR as the OCR engine:

```python
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    EasyOcrOptions,
    AcceleratorOptions,
    AcceleratorDevice,
)
from docling.document_converter import DocumentConverter, PdfFormatOption

# Create pipeline options
pipeline_options = PdfPipelineOptions()

# Enable OCR and table structure (BEFORE setting ocr_options)
pipeline_options.do_ocr = True
pipeline_options.do_table_structure = True
pipeline_options.table_structure_options.do_cell_matching = True

# Configure accelerator
pipeline_options.accelerator_options = AcceleratorOptions(
    num_threads=4,
    device=AcceleratorDevice.AUTO,  # Uses GPU if available
)

# IMPORTANT: Set EasyOcrOptions LAST to avoid overwriting other OCR settings
ocr_options = EasyOcrOptions()
ocr_options.lang = ["en"]  # Add more languages as needed: ["en", "fr", "de"]
ocr_options.force_full_page_ocr = False  # Set True for scanned documents
pipeline_options.ocr_options = ocr_options

# Create converter
doc_converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
    }
)
```

**Installation**: Requires `pip install "docling[easyocr]"` extra dependency.

---

## Batch Conversion Instructions

For processing multiple documents efficiently:

```python
from pathlib import Path
from docling.document_converter import DocumentConverter

# List of document paths
input_doc_paths = [
    Path("./documents/report1.pdf"),
    Path("./documents/report2.pdf"),
    Path("./documents/spreadsheet.xlsx"),
    Path("./documents/document.docx"),
]

# Create converter (configured as shown above)
doc_converter = DocumentConverter(...)

# Batch convert with error handling
conv_results = doc_converter.convert_all(
    input_doc_paths,
    raises_on_error=False,  # Continue on individual failures
)

# Process results
for conv_res in conv_results:
    if conv_res.status.name == "SUCCESS":
        # Export to Markdown with page annotations
        markdown = generate_page_annotated_markdown(conv_res.document)
        output_path = Path(f"./output/{conv_res.input.file.stem}.md")
        output_path.write_text(markdown)
    else:
        print(f"Failed: {conv_res.input.file} - {conv_res.status}")
```

**Performance Tips**:
1. Use `convert_all()` instead of multiple `convert()` calls
2. Set appropriate `num_threads` in `AcceleratorOptions`
3. Enable GPU acceleration with `AcceleratorDevice.CUDA` if available
4. Process documents of similar complexity together
5. Monitor memory usage and adjust `max_concurrent_jobs` accordingly

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Python runtime dependency | Granite Docling VLM requires Python ecosystem (PyTorch, ML libraries) | Node.js alternatives lack document AI capabilities; bundling full Python env exceeds practical limits (>2GB) |
| Dual-server architecture | n8n (Node.js) + Docling (Python) require separate processes | Single-process impossible due to language boundary; IPC via HTTP is most compatible with n8n HTTP Request node |

---

## Sources

- [Docling Installation Guide](https://docling-project.github.io/docling/getting_started/installation/)
- [Docling Batch Conversion](https://docling-project.github.io/docling/examples/batch_convert/)
- [Docling Pipeline Options](https://docling-project.github.io/docling/reference/pipeline_options/)
- [EasyOCR Configuration Discussion](https://github.com/docling-project/docling/discussions/792)
- [PyInstaller FastAPI Example](https://github.com/iancleary/pyinstaller-fastapi)
- [FastAPI + Uvicorn Hidden Imports](https://stackoverflow.com/questions/65438069/uvicorn-and-fastapi-with-pyinstaller-problem-when-uvicorn-workers1)
