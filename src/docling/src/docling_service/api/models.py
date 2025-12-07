"""Pydantic request/response models for Docling API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ProcessingOptions(BaseModel):
    """Optional per-job configuration overrides."""

    processing_tier: Literal["lightweight", "standard", "advanced"] | None = Field(
        default=None,
        description="Override the default processing tier",
    )
    languages: list[str] | None = Field(
        default=None,
        description="OCR language codes (e.g., ['en', 'fr'])",
    )
    force_full_page_ocr: bool = Field(
        default=False,
        description="Force OCR on all pages (slower but more accurate for scanned documents)",
    )
    timeout_seconds: int | None = Field(
        default=None,
        description="Override calculated timeout",
    )


class ProcessRequest(BaseModel):
    """Request to process a single document."""

    file_path: str = Field(
        ...,
        description="Absolute path to the document file",
    )
    options: ProcessingOptions | None = Field(
        default=None,
        description="Optional processing options",
    )


class BatchProcessRequest(BaseModel):
    """Request to process multiple documents."""

    file_paths: list[str] = Field(
        ...,
        description="Array of absolute paths to document files",
    )
    options: ProcessingOptions | None = Field(
        default=None,
        description="Optional processing options applied to all documents",
    )


class ProcessResponse(BaseModel):
    """Response after queuing a document for processing."""

    job_id: str = Field(..., description="Unique identifier for tracking the job")
    status: str = Field(default="queued", description="Initial job status")
    message: str = Field(default="Document queued for processing")
    trace_id: str | None = Field(default=None, description="Trace ID for log correlation")


class BatchProcessResponse(BaseModel):
    """Response after queuing multiple documents for processing."""

    job_ids: list[str] = Field(..., description="UUIDs for each submitted document")
    status: str = Field(default="queued", description="Initial status")
    total_documents: int = Field(..., description="Number of documents submitted")
    correlation_id: str | None = Field(default=None, description="Correlation ID linking batch items")
    trace_id: str | None = Field(default=None, description="Trace ID for log correlation")


class ProcessingMetadata(BaseModel):
    """Metadata about a processing job."""

    page_count: int | None = Field(default=None, description="Total pages in document")
    file_path: str | None = Field(default=None, description="Original file path")
    processing_tier: str | None = Field(default=None, description="Tier used for processing")
    format: str | None = Field(default=None, description="Detected format (pdf, docx, xlsx)")
    processing_time_ms: int | None = Field(default=None, description="Time to process")
    ocr_engine: str | None = Field(default=None, description="OCR engine used (easyocr, tesseract)")


class ProcessingResult(BaseModel):
    """Result of a successful document processing job."""

    status: Literal["success", "error"] = Field(..., description="Processing status")
    markdown: str | None = Field(default=None, description="Page-annotated Markdown content")
    metadata: ProcessingMetadata | None = Field(default=None, description="Processing statistics")
    error: str | None = Field(default=None, description="Error details if failed")


class JobStatus(BaseModel):
    """Status of a processing job."""

    job_id: str = Field(..., description="Job identifier")
    file_path: str = Field(..., description="Path to the input document")
    status: Literal["queued", "processing", "completed", "failed", "cancelled"] = Field(
        ..., description="Current job status"
    )
    progress: int = Field(default=0, ge=0, le=100, description="Progress percentage")
    result: ProcessingResult | None = Field(default=None, description="Processing result if completed")
    error: str | None = Field(default=None, description="Error message if failed")
    error_type: str | None = Field(default=None, description="Error type (timeout, processing_error)")
    created_at: datetime = Field(..., description="When job was created")
    started_at: datetime | None = Field(default=None, description="When processing began")
    completed_at: datetime | None = Field(default=None, description="When processing finished")
    trace_id: str | None = Field(default=None, description="Trace ID for log correlation")


class HealthResponse(BaseModel):
    """API health check response."""

    status: Literal["healthy", "unhealthy"] = Field(..., description="Service health status")
    version: str = Field(..., description="Service version")
    processing_tier: str = Field(..., description="Default processing tier")
    queue_size: int = Field(..., description="Number of jobs waiting in queue")
    active_jobs: int = Field(..., description="Number of jobs currently processing")
    trace_id: str | None = Field(default=None, description="Trace ID for log correlation")


class ErrorResponse(BaseModel):
    """Error response model."""

    detail: str = Field(..., description="Error message")
    trace_id: str | None = Field(default=None, description="Trace ID for log correlation")
