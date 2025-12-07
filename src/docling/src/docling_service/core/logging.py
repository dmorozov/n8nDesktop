"""Structured logging configuration for Docling Service (T067).

Configures structlog for JSON output with trace context support.
"""

import logging
import sys
from typing import Any

import structlog

from docling_service.core.config import settings


def get_log_level_int(level_str: str) -> int:
    """Convert log level string to integer.

    Args:
        level_str: Log level string (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    Returns:
        Corresponding logging integer level
    """
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return level_map.get(level_str.upper(), logging.INFO)


def configure_logging(log_level: str | None = None) -> None:
    """Configure structlog for JSON output.

    Args:
        log_level: Override log level (uses settings.log_level if not provided)

    Configuration:
    - JSON renderer for structured output
    - Timestamps in ISO format
    - Stack trace rendering for exceptions
    - Context variables for trace_id propagation
    - Logs to stderr for diagnostics (stdout reserved for functional output)
    """
    level = log_level or settings.log_level

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(get_log_level_int(level)),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> Any:
    """Get a bound logger for a module.

    Args:
        name: Module name (typically __name__)

    Returns:
        Bound structlog logger
    """
    return structlog.get_logger(name)


def bind_trace_context(trace_id: str, correlation_id: str | None = None) -> None:
    """Bind trace context to the current async context.

    Args:
        trace_id: Trace ID for request correlation
        correlation_id: Optional correlation ID for batch jobs
    """
    structlog.contextvars.bind_contextvars(
        trace_id=trace_id,
        **({"correlation_id": correlation_id} if correlation_id else {}),
    )


def clear_trace_context() -> None:
    """Clear trace context from the current async context."""
    structlog.contextvars.unbind_contextvars("trace_id", "correlation_id")
