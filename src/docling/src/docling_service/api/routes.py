"""API routes with authentication middleware for Docling Service."""

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from docling_service.api.models import (
    BatchProcessRequest,
    BatchProcessResponse,
    ErrorResponse,
    HealthResponse,
    JobStatus,
    ProcessingMetadata,
    ProcessingResult,
    ProcessRequest,
    ProcessResponse,
)
from docling_service.core.config import settings
from docling_service.core.queue import job_queue

logger = structlog.get_logger(__name__)

# Router for API endpoints
router = APIRouter()

# Bearer token authentication
security = HTTPBearer(auto_error=False)


async def verify_auth_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> str:
    """Verify Bearer token authentication.

    Args:
        credentials: HTTP Bearer credentials from Authorization header

    Returns:
        The validated token

    Raises:
        HTTPException: If authentication fails
    """
    if not settings.auth_token:
        # No auth token configured - skip authentication
        return ""

    if not credentials:
        logger.warning("auth_missing_credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.credentials != settings.auth_token:
        logger.warning("auth_invalid_token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return credentials.credentials


def get_trace_id(
    x_trace_id: Annotated[str | None, Header(alias="X-Trace-Id")] = None,
) -> str:
    """Extract or generate trace ID for request correlation.

    Args:
        x_trace_id: Trace ID from X-Trace-Id header

    Returns:
        Trace ID (from header or newly generated UUID v4)
    """
    return x_trace_id or str(uuid.uuid4())


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check endpoint",
    description="Check service health status, queue size, and active jobs",
)
async def health_check(
    trace_id: Annotated[str, Depends(get_trace_id)],
) -> HealthResponse:
    """Return service health status."""
    log = logger.bind(trace_id=trace_id)
    log.debug("health_check_requested")

    return HealthResponse(
        status="healthy",
        version="0.1.0",
        processing_tier=settings.processing_tier,
        queue_size=job_queue.size(),
        active_jobs=job_queue.active_count(),
        trace_id=trace_id,
    )


@router.post(
    "/process",
    response_model=ProcessResponse,
    responses={401: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Process a single document",
    description="Queue a document for processing and return job ID",
    dependencies=[Depends(verify_auth_token)],
)
async def process_document(
    request: ProcessRequest,
    trace_id: Annotated[str, Depends(get_trace_id)],
) -> ProcessResponse:
    """Queue a document for processing.

    Args:
        request: Processing request with file path and options
        trace_id: Trace ID for log correlation

    Returns:
        Response with job ID for status polling
    """
    log = logger.bind(trace_id=trace_id, file_path=request.file_path)
    log.info("process_request_received")

    # Prepare options dict
    options = {}
    if request.options:
        options = {
            "processing_tier": request.options.processing_tier,
            "languages": request.options.languages,
            "force_full_page_ocr": request.options.force_full_page_ocr,
            "include_page_markers": request.options.include_page_markers,
            "timeout_seconds": request.options.timeout_seconds,
        }

    # Enqueue job
    job_id = await job_queue.enqueue(
        file_path=request.file_path,
        options=options,
        trace_id=trace_id,
    )

    log.info("process_request_queued", job_id=job_id)

    return ProcessResponse(
        job_id=job_id,
        status="queued",
        message="Document queued for processing",
        trace_id=trace_id,
    )


@router.post(
    "/process/batch",
    response_model=BatchProcessResponse,
    responses={401: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Process multiple documents",
    description="Queue multiple documents for batch processing",
    dependencies=[Depends(verify_auth_token)],
)
async def process_batch(
    request: BatchProcessRequest,
    trace_id: Annotated[str, Depends(get_trace_id)],
) -> BatchProcessResponse:
    """Queue multiple documents for batch processing.

    Args:
        request: Batch request with file paths and shared options
        trace_id: Trace ID for log correlation

    Returns:
        Response with job IDs for each document
    """
    log = logger.bind(trace_id=trace_id, file_count=len(request.file_paths))
    log.info("batch_request_received")

    # Generate correlation ID for batch
    correlation_id = str(uuid.uuid4())

    # Prepare options dict
    options = {}
    if request.options:
        options = {
            "processing_tier": request.options.processing_tier,
            "languages": request.options.languages,
            "force_full_page_ocr": request.options.force_full_page_ocr,
            "include_page_markers": request.options.include_page_markers,
            "timeout_seconds": request.options.timeout_seconds,
        }

    # Enqueue all jobs
    job_ids = []
    for file_path in request.file_paths:
        job_id = await job_queue.enqueue(
            file_path=file_path,
            options=options,
            trace_id=trace_id,
            correlation_id=correlation_id,
        )
        job_ids.append(job_id)

    log.info(
        "batch_request_queued",
        job_count=len(job_ids),
        correlation_id=correlation_id,
    )

    return BatchProcessResponse(
        job_ids=job_ids,
        status="queued",
        total_documents=len(job_ids),
        correlation_id=correlation_id,
        trace_id=trace_id,
    )


@router.get(
    "/jobs/{job_id}",
    response_model=JobStatus,
    responses={404: {"model": ErrorResponse}},
    summary="Get job status",
    description="Get the current status of a processing job",
    dependencies=[Depends(verify_auth_token)],
)
async def get_job_status(
    job_id: str,
    trace_id: Annotated[str, Depends(get_trace_id)],
) -> JobStatus:
    """Get status of a specific job.

    Args:
        job_id: Job identifier
        trace_id: Trace ID for log correlation

    Returns:
        Job status including progress and result

    Raises:
        HTTPException: If job not found
    """
    log = logger.bind(trace_id=trace_id, job_id=job_id)
    log.debug("job_status_requested")

    job_data = job_queue.get_job(job_id)
    if not job_data:
        log.warning("job_not_found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}",
        )

    # Convert job data to JobStatus response
    result = None
    if job_data.get("result"):
        result = ProcessingResult(
            status=job_data["result"].get("status", "error"),
            markdown=job_data["result"].get("markdown"),
            metadata=ProcessingMetadata(**job_data["result"].get("metadata", {}))
            if job_data["result"].get("metadata")
            else None,
            error=job_data["result"].get("error"),
        )

    return JobStatus(
        job_id=job_data["job_id"],
        file_path=job_data["file_path"],
        status=job_data["status"],
        progress=job_data["progress"],
        result=result,
        error=job_data["error"],
        error_type=job_data["error_type"],
        created_at=job_data["created_at"],
        started_at=job_data["started_at"],
        completed_at=job_data["completed_at"],
        trace_id=job_data["trace_id"],
    )


@router.get(
    "/jobs",
    response_model=list[JobStatus],
    summary="List all jobs",
    description="Get status of all processing jobs",
    dependencies=[Depends(verify_auth_token)],
)
async def list_jobs(
    trace_id: Annotated[str, Depends(get_trace_id)],
) -> list[JobStatus]:
    """List all jobs.

    Args:
        trace_id: Trace ID for log correlation

    Returns:
        List of job statuses
    """
    log = logger.bind(trace_id=trace_id)
    log.debug("jobs_list_requested")

    jobs_data = job_queue.list_jobs()
    result = []

    for job_data in jobs_data:
        job_result = None
        if job_data.get("result"):
            job_result = ProcessingResult(
                status=job_data["result"].get("status", "error"),
                markdown=job_data["result"].get("markdown"),
                metadata=ProcessingMetadata(**job_data["result"].get("metadata", {}))
                if job_data["result"].get("metadata")
                else None,
                error=job_data["result"].get("error"),
            )

        result.append(
            JobStatus(
                job_id=job_data["job_id"],
                file_path=job_data["file_path"],
                status=job_data["status"],
                progress=job_data["progress"],
                result=job_result,
                error=job_data["error"],
                error_type=job_data["error_type"],
                created_at=job_data["created_at"],
                started_at=job_data["started_at"],
                completed_at=job_data["completed_at"],
                trace_id=job_data["trace_id"],
            )
        )

    return result


@router.delete(
    "/jobs/{job_id}",
    response_model=dict,
    responses={404: {"model": ErrorResponse}},
    summary="Cancel a job",
    description="Cancel a queued job (cannot cancel in-progress jobs)",
    dependencies=[Depends(verify_auth_token)],
)
async def cancel_job(
    job_id: str,
    trace_id: Annotated[str, Depends(get_trace_id)],
) -> dict:
    """Cancel a queued job.

    Args:
        job_id: Job identifier
        trace_id: Trace ID for log correlation

    Returns:
        Cancellation result

    Raises:
        HTTPException: If job not found or cannot be cancelled
    """
    log = logger.bind(trace_id=trace_id, job_id=job_id)
    log.info("job_cancel_requested")

    cancelled = await job_queue.cancel(job_id)
    if not cancelled:
        job_data = job_queue.get_job(job_id)
        if not job_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job not found: {job_id}",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job in state: {job_data['status']}",
        )

    log.info("job_cancelled")
    return {"status": "cancelled", "job_id": job_id, "trace_id": trace_id}
