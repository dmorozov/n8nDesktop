"""Job queue for managing document processing with configurable concurrency."""

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import psutil
import structlog

from docling_service.core.config import calculate_timeout, settings
from docling_service.core.converter import process_document

logger = structlog.get_logger(__name__)


class JobState(str, Enum):
    """Job processing states."""

    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    """Represents a document processing job."""

    id: str
    file_path: str
    options: dict
    state: JobState = JobState.QUEUED
    progress: int = 0
    result: dict | None = None
    error: str | None = None
    error_type: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    completed_at: datetime | None = None
    trace_id: str | None = None
    correlation_id: str | None = None
    memory_start_mb: float | None = None
    memory_end_mb: float | None = None

    def to_dict(self) -> dict:
        """Convert job to dictionary for API response."""
        return {
            "job_id": self.id,
            "file_path": self.file_path,
            "status": self.state.value,
            "progress": self.progress,
            "result": self.result,
            "error": self.error,
            "error_type": self.error_type,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "trace_id": self.trace_id,
        }


class JobQueue:
    """Manages document processing jobs with configurable concurrency."""

    def __init__(self) -> None:
        """Initialize the job queue."""
        self._jobs: dict[str, Job] = {}
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._workers: list[asyncio.Task[None]] = []
        self._running = False

    async def start(self) -> None:
        """Start the job queue workers."""
        self._running = True
        num_workers = settings.max_concurrent_jobs

        logger.info(
            "queue_starting",
            num_workers=num_workers,
        )

        for i in range(num_workers):
            worker = asyncio.create_task(self._worker(i))
            self._workers.append(worker)

        logger.info("queue_started", num_workers=len(self._workers))

    async def stop(self) -> None:
        """Stop all workers and clear the queue."""
        logger.info("queue_stopping")
        self._running = False

        for worker in self._workers:
            worker.cancel()

        # Wait for workers to finish
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)

        self._workers.clear()
        logger.info("queue_stopped")

    async def enqueue(
        self,
        file_path: str,
        options: dict | None = None,
        trace_id: str | None = None,
        correlation_id: str | None = None,
    ) -> str:
        """Add a document to the processing queue.

        Args:
            file_path: Path to the document
            options: Processing options
            trace_id: Trace ID for log correlation
            correlation_id: Correlation ID for batch jobs

        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())
        job = Job(
            id=job_id,
            file_path=file_path,
            options=options or {},
            trace_id=trace_id or str(uuid.uuid4()),
            correlation_id=correlation_id,
        )
        self._jobs[job_id] = job
        await self._queue.put(job_id)

        logger.info(
            "job_enqueued",
            job_id=job_id,
            file_path=file_path,
            trace_id=job.trace_id,
            correlation_id=correlation_id,
            queue_size=self._queue.qsize(),
        )

        return job_id

    async def cancel(self, job_id: str) -> bool:
        """Cancel a queued job.

        Args:
            job_id: ID of job to cancel

        Returns:
            True if cancelled, False if not found or already completed
        """
        job = self._jobs.get(job_id)
        if not job:
            logger.warning("cancel_failed_not_found", job_id=job_id)
            return False

        if job.state == JobState.QUEUED:
            job.state = JobState.CANCELLED
            job.completed_at = datetime.now(timezone.utc)
            logger.info(
                "job_cancelled",
                job_id=job_id,
                trace_id=job.trace_id,
            )
            return True

        logger.warning(
            "cancel_failed_not_queued",
            job_id=job_id,
            current_state=job.state.value,
        )
        return False

    def get_job(self, job_id: str) -> dict | None:
        """Get job status by ID.

        Args:
            job_id: Job identifier

        Returns:
            Job dict or None if not found
        """
        job = self._jobs.get(job_id)
        return job.to_dict() if job else None

    def list_jobs(self) -> list[dict]:
        """List all jobs.

        Returns:
            List of job dictionaries
        """
        return [job.to_dict() for job in self._jobs.values()]

    def size(self) -> int:
        """Get number of jobs waiting in queue.

        Returns:
            Queue size
        """
        return self._queue.qsize()

    def active_count(self) -> int:
        """Get number of active (processing) jobs.

        Returns:
            Number of processing jobs
        """
        return sum(1 for job in self._jobs.values() if job.state == JobState.PROCESSING)

    async def _worker(self, worker_id: int) -> None:
        """Worker coroutine for processing jobs.

        Args:
            worker_id: Worker identifier for logging
        """
        log = logger.bind(worker_id=worker_id)
        log.info("worker_started")

        while self._running:
            try:
                # Wait for a job with timeout
                try:
                    job_id = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue

                job = self._jobs.get(job_id)
                if not job or job.state == JobState.CANCELLED:
                    continue

                await self._process_job(job, log)

            except asyncio.CancelledError:
                log.info("worker_cancelled")
                break
            except Exception as e:
                log.exception("worker_error", error=str(e))

        log.info("worker_stopped")

    async def _process_job(self, job: Job, log: Any) -> None:
        """Process a single job.

        Args:
            job: Job to process
            log: Bound logger
        """
        job_log = log.bind(
            job_id=job.id,
            trace_id=job.trace_id,
            file_path=job.file_path,
        )

        # Update state to processing
        job.state = JobState.PROCESSING
        job.started_at = datetime.now(timezone.utc)
        job.progress = 10

        # Log memory at start
        process = psutil.Process()
        job.memory_start_mb = process.memory_info().rss / (1024 * 1024)

        job_log.info(
            "job_processing_started",
            memory_mb=job.memory_start_mb,
        )

        try:
            # Calculate timeout
            # TODO: Estimate page count before processing for accurate timeout
            timeout_seconds = job.options.get("timeout_seconds") or calculate_timeout(
                page_count=100,  # Assume max for timeout
                tier=job.options.get("processing_tier"),
            )

            job.progress = 20

            # Process document with timeout
            result = await asyncio.wait_for(
                process_document(
                    file_path=job.file_path,
                    processing_tier=job.options.get("processing_tier"),
                    languages=job.options.get("languages"),
                    force_full_page_ocr=job.options.get("force_full_page_ocr", False),
                    trace_id=job.trace_id,
                ),
                timeout=timeout_seconds,
            )

            job.progress = 90

            if result["status"] == "success":
                job.state = JobState.COMPLETED
                job.result = result
                job_log.info(
                    "job_completed",
                    page_count=result.get("metadata", {}).get("page_count"),
                    processing_time_ms=result.get("metadata", {}).get("processing_time_ms"),
                )
            else:
                job.state = JobState.FAILED
                job.error = result.get("error", "Unknown error")
                job.error_type = "processing_error"
                job_log.error(
                    "job_failed",
                    error=job.error,
                    error_type=job.error_type,
                )

        except asyncio.TimeoutError:
            job.state = JobState.FAILED
            job.error = f"Processing timeout after {timeout_seconds} seconds"
            job.error_type = "timeout"
            job_log.error(
                "job_timeout",
                timeout_seconds=timeout_seconds,
                error_type=job.error_type,
            )

        except Exception as e:
            job.state = JobState.FAILED
            job.error = str(e)
            job.error_type = "processing_error"
            job_log.exception(
                "job_exception",
                error=str(e),
                error_type=job.error_type,
            )

        finally:
            job.completed_at = datetime.now(timezone.utc)
            job.progress = 100

            # Log memory at end
            job.memory_end_mb = process.memory_info().rss / (1024 * 1024)
            job_log.info(
                "job_finished",
                state=job.state.value,
                memory_start_mb=job.memory_start_mb,
                memory_end_mb=job.memory_end_mb,
                memory_delta_mb=job.memory_end_mb - (job.memory_start_mb or 0),
            )


# Global job queue instance
job_queue = JobQueue()
