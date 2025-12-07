"""Pytest configuration and fixtures for Docling service tests."""

import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

# Fixtures directory path
FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_pdf_path() -> Path:
    """Return path to sample PDF for testing.

    Note: For actual testing, place a sample PDF at:
    src/docling/tests/fixtures/sample.pdf

    This fixture provides the expected path.
    """
    return FIXTURES_DIR / "sample.pdf"


@pytest.fixture
def sample_text_pdf_path() -> Path:
    """Return path to text-based PDF (no OCR needed)."""
    return FIXTURES_DIR / "sample_text.pdf"


@pytest.fixture
def sample_scanned_pdf_path() -> Path:
    """Return path to scanned PDF (requires OCR)."""
    return FIXTURES_DIR / "sample_scanned.pdf"


@pytest.fixture
def temp_folder() -> Generator[Path, None, None]:
    """Create a temporary folder for test processing."""
    with tempfile.TemporaryDirectory(prefix="docling_test_") as tmp:
        yield Path(tmp)


@pytest.fixture
def auth_token() -> str:
    """Return test authentication token."""
    return "test-auth-token-12345"


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """Return authentication headers for API requests."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def trace_id() -> str:
    """Return a sample trace ID for testing."""
    return "550e8400-e29b-41d4-a716-446655440000"


@pytest.fixture
def trace_headers(trace_id: str) -> dict:
    """Return trace context headers."""
    return {"X-Trace-Id": trace_id}


def create_test_app(auth_token: str) -> FastAPI:
    """Create a test-friendly FastAPI app without async lifespan issues."""
    from docling_service.api.routes import router

    # Create app without the problematic lifespan that starts workers
    @asynccontextmanager
    async def test_lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        """Minimal lifespan for testing - no background workers."""
        yield

    app = FastAPI(
        title="Docling Service Test",
        lifespan=test_lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:*", "http://127.0.0.1:*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routes
    app.include_router(router, prefix="/api/v1")

    return app


@pytest.fixture
def api_client(auth_token: str) -> Generator[TestClient, None, None]:
    """Create a test client for the FastAPI application."""
    # Set environment variables before importing the app
    os.environ["DOCLING_AUTH_TOKEN"] = auth_token
    os.environ["DOCLING_HOST"] = "127.0.0.1"
    os.environ["DOCLING_PORT"] = "8765"
    os.environ["DOCLING_PROCESSING_TIER"] = "standard"

    # Reload settings to pick up env vars
    from docling_service.core import config
    config.settings = config.Settings()

    app = create_test_app(auth_token)

    with TestClient(app) as client:
        yield client


@pytest.fixture
def processing_options() -> dict:
    """Return sample processing options."""
    return {
        "processing_tier": "standard",
        "languages": ["en"],
        "force_full_page_ocr": False,
        "timeout_seconds": 120,
    }
