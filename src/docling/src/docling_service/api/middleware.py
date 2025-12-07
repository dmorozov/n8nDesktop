"""FastAPI middleware for trace context propagation (T068).

Extracts X-Trace-Id header from requests or generates UUID v4.
"""

import uuid
from typing import Awaitable, Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger(__name__)


class TraceContextMiddleware(BaseHTTPMiddleware):
    """Middleware for extracting and propagating trace context.

    Extracts X-Trace-Id header from incoming requests. If not present,
    generates a new UUID v4 trace ID. Binds the trace ID to structlog
    context for the duration of the request.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Process request with trace context.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/handler in chain

        Returns:
            HTTP response with X-Trace-Id header
        """
        # Extract or generate trace ID
        trace_id = request.headers.get("X-Trace-Id") or str(uuid.uuid4())

        # Store in request state for access in route handlers
        request.state.trace_id = trace_id

        # Bind to structlog context for automatic inclusion in logs
        structlog.contextvars.bind_contextvars(trace_id=trace_id)

        try:
            # Process request
            response = await call_next(request)

            # Add trace ID to response headers
            response.headers["X-Trace-Id"] = trace_id

            return response

        finally:
            # Clear context after request
            structlog.contextvars.unbind_contextvars("trace_id")


def get_trace_id_from_request(request: Request) -> str:
    """Get trace ID from request state.

    Args:
        request: FastAPI request object

    Returns:
        Trace ID from request state or generates new one
    """
    return getattr(request.state, "trace_id", None) or str(uuid.uuid4())
