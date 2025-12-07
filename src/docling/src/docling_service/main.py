"""FastAPI application entry point for Docling Service.

Usage:
    python -m docling_service.main [options]

Options:
    --host HOST         Host to bind (default: 127.0.0.1)
    --port PORT         Port to bind (default: 8765)
    --auth-token TOKEN  Authentication token for API access
    --processing-tier   Default processing tier (lightweight/standard/advanced)
    --temp-folder PATH  Temporary folder for processing files
    --max-concurrent    Maximum concurrent processing jobs (1-3)
"""

import argparse
import logging
import os
import signal
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from docling_service.api.routes import router
from docling_service.core.config import settings
from docling_service.core.queue import job_queue


def _get_log_level_int(level_str: str) -> int:
    """Convert log level string to integer."""
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return level_map.get(level_str.upper(), logging.INFO)


# Configure structlog for JSON output
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(_get_log_level_int(settings.log_level)),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup/shutdown."""
    # Startup
    logger.info(
        "service_starting",
        host=settings.host,
        port=settings.port,
        processing_tier=settings.processing_tier,
        max_concurrent_jobs=settings.max_concurrent_jobs,
    )

    # Start job queue workers
    await job_queue.start()

    logger.info("service_started")

    yield

    # Shutdown
    logger.info("service_stopping")

    # Stop job queue workers
    await job_queue.stop()

    logger.info("service_stopped")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Docling Service",
        description="Document processing service using IBM Docling for OCR and conversion",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS middleware - localhost only for security
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:*", "http://127.0.0.1:*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routes
    app.include_router(router, prefix="/api/v1")

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle uncaught exceptions."""
        logger.exception("unhandled_exception", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "trace_id": None},
        )

    return app


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Docling Service - Document processing with OCR",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--host",
        type=str,
        default=os.environ.get("DOCLING_HOST", "127.0.0.1"),
        help="Host to bind the server",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("DOCLING_PORT", "8765")),
        help="Port to bind the server",
    )
    parser.add_argument(
        "--auth-token",
        type=str,
        default=os.environ.get("DOCLING_AUTH_TOKEN", ""),
        help="Authentication token for API access",
    )
    parser.add_argument(
        "--processing-tier",
        type=str,
        choices=["lightweight", "standard", "advanced"],
        default=os.environ.get("DOCLING_PROCESSING_TIER", "standard"),
        help="Default processing tier",
    )
    parser.add_argument(
        "--temp-folder",
        type=str,
        default=os.environ.get("DOCLING_TEMP_FOLDER", ""),
        help="Temporary folder for processing files",
    )
    parser.add_argument(
        "--max-concurrent",
        type=int,
        default=int(os.environ.get("DOCLING_MAX_CONCURRENT_JOBS", "1")),
        choices=[1, 2, 3],
        help="Maximum concurrent processing jobs",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default=os.environ.get("DOCLING_LOG_LEVEL", "INFO"),
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level",
    )

    return parser.parse_args()


def configure_settings(args: argparse.Namespace) -> None:
    """Update settings from command line arguments."""
    # Note: In production, you'd use a proper settings override mechanism
    # For now, we set environment variables that Settings will read
    if args.host:
        os.environ["DOCLING_HOST"] = args.host
    if args.port:
        os.environ["DOCLING_PORT"] = str(args.port)
    if args.auth_token:
        os.environ["DOCLING_AUTH_TOKEN"] = args.auth_token
    if args.processing_tier:
        os.environ["DOCLING_PROCESSING_TIER"] = args.processing_tier
    if args.temp_folder:
        os.environ["DOCLING_TEMP_FOLDER"] = args.temp_folder
    if args.max_concurrent:
        os.environ["DOCLING_MAX_CONCURRENT_JOBS"] = str(args.max_concurrent)
    if args.log_level:
        os.environ["DOCLING_LOG_LEVEL"] = args.log_level

    # Reload settings to pick up new values
    settings.__init__()  # type: ignore[misc]


def setup_signal_handlers() -> None:
    """Setup graceful shutdown signal handlers."""

    def signal_handler(signum: int, frame: object) -> None:
        logger.info("shutdown_signal_received", signal=signum)
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)


def main() -> None:
    """Main entry point."""
    args = parse_args()
    configure_settings(args)
    setup_signal_handlers()

    # Create app
    app = create_app()

    # Print startup message to stdout for Electron to detect
    print(f"DOCLING_READY|{settings.host}|{settings.port}", flush=True)

    # Run with uvicorn
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        access_log=False,  # We use structured logging
    )


if __name__ == "__main__":
    main()
