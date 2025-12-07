"""Contract tests for Docling API endpoints.

These tests validate the API contract as defined in openapi.yaml.
They test endpoint structure, request/response schemas, and error handling.
"""

import os
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status

# Skip all tests if required dependencies not available
pytest.importorskip("fastapi")
pytest.importorskip("httpx")


class TestHealthEndpoint:
    """Tests for GET /api/v1/health endpoint (T026)."""

    def test_health_returns_200(self, api_client, auth_headers):
        """Health endpoint should return 200 with expected schema."""
        response = api_client.get("/api/v1/health")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Validate required fields per OpenAPI schema
        assert "status" in data
        assert data["status"] in ["healthy", "unhealthy"]
        assert "version" in data
        assert "processing_tier" in data
        assert "queue_size" in data
        assert isinstance(data["queue_size"], int)
        assert "active_jobs" in data
        assert isinstance(data["active_jobs"], int)

    def test_health_no_auth_required(self, api_client):
        """Health endpoint should not require authentication."""
        response = api_client.get("/api/v1/health")
        assert response.status_code == status.HTTP_200_OK

    def test_health_includes_trace_id(self, api_client, trace_headers):
        """Health endpoint should return trace_id if provided."""
        response = api_client.get("/api/v1/health", headers=trace_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "trace_id" in data
        assert data["trace_id"] == trace_headers["X-Trace-Id"]


class TestProcessEndpoint:
    """Tests for POST /api/v1/process endpoint (T027)."""

    def test_process_requires_auth(self, api_client):
        """Process endpoint should require Bearer token authentication."""
        response = api_client.post(
            "/api/v1/process",
            json={"file_path": "/tmp/test.pdf"},
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_process_invalid_token(self, api_client):
        """Process endpoint should reject invalid tokens."""
        response = api_client.post(
            "/api/v1/process",
            json={"file_path": "/tmp/test.pdf"},
            headers={"Authorization": "Bearer invalid-token"},
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_process_accepts_valid_request(self, api_client, auth_headers):
        """Process endpoint should accept valid request and return job_id."""
        response = api_client.post(
            "/api/v1/process",
            json={"file_path": "/tmp/test.pdf"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Validate response schema
        assert "job_id" in data
        assert "status" in data
        assert data["status"] == "queued"
        assert "message" in data

        # job_id should be valid UUID
        try:
            uuid.UUID(data["job_id"])
        except ValueError:
            pytest.fail("job_id is not a valid UUID")

    def test_process_with_options(self, api_client, auth_headers, processing_options):
        """Process endpoint should accept processing options."""
        response = api_client.post(
            "/api/v1/process",
            json={
                "file_path": "/tmp/test.pdf",
                "options": processing_options,
            },
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "job_id" in data

    def test_process_returns_trace_id(self, api_client, auth_headers, trace_headers):
        """Process endpoint should return trace_id in response."""
        headers = {**auth_headers, **trace_headers}
        response = api_client.post(
            "/api/v1/process",
            json={"file_path": "/tmp/test.pdf"},
            headers=headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "trace_id" in data
        assert data["trace_id"] == trace_headers["X-Trace-Id"]

    def test_process_missing_file_path(self, api_client, auth_headers):
        """Process endpoint should reject request without file_path."""
        response = api_client.post(
            "/api/v1/process",
            json={},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_process_invalid_tier(self, api_client, auth_headers):
        """Process endpoint should reject invalid processing_tier."""
        response = api_client.post(
            "/api/v1/process",
            json={
                "file_path": "/tmp/test.pdf",
                "options": {"processing_tier": "invalid"},
            },
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestJobStatusEndpoint:
    """Tests for GET /api/v1/jobs/{job_id} endpoint (T028)."""

    def test_get_job_requires_auth(self, api_client):
        """Job status endpoint should require authentication."""
        job_id = str(uuid.uuid4())
        response = api_client.get(f"/api/v1/jobs/{job_id}")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_job_not_found(self, api_client, auth_headers):
        """Job status endpoint should return 404 for unknown job."""
        job_id = str(uuid.uuid4())
        response = api_client.get(
            f"/api/v1/jobs/{job_id}",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "detail" in data

    def test_get_job_after_submit(self, api_client, auth_headers):
        """Job status should be retrievable after submission."""
        # Submit a job
        submit_response = api_client.post(
            "/api/v1/process",
            json={"file_path": "/tmp/test.pdf"},
            headers=auth_headers,
        )
        job_id = submit_response.json()["job_id"]

        # Get job status
        response = api_client.get(
            f"/api/v1/jobs/{job_id}",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Validate JobStatus schema
        assert "job_id" in data
        assert data["job_id"] == job_id
        assert "file_path" in data
        assert "status" in data
        assert data["status"] in ["queued", "processing", "completed", "failed", "cancelled"]
        assert "progress" in data
        assert 0 <= data["progress"] <= 100
        assert "created_at" in data


class TestListJobsEndpoint:
    """Tests for GET /api/v1/jobs endpoint."""

    def test_list_jobs_requires_auth(self, api_client):
        """List jobs endpoint should require authentication."""
        response = api_client.get("/api/v1/jobs")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_jobs_returns_array(self, api_client, auth_headers):
        """List jobs endpoint should return array of jobs."""
        response = api_client.get("/api/v1/jobs", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    def test_list_jobs_includes_submitted(self, api_client, auth_headers):
        """List jobs should include submitted jobs."""
        # Submit a job
        submit_response = api_client.post(
            "/api/v1/process",
            json={"file_path": "/tmp/test.pdf"},
            headers=auth_headers,
        )
        job_id = submit_response.json()["job_id"]

        # List jobs
        response = api_client.get("/api/v1/jobs", headers=auth_headers)
        data = response.json()

        job_ids = [job["job_id"] for job in data]
        assert job_id in job_ids


class TestCancelJobEndpoint:
    """Tests for DELETE /api/v1/jobs/{job_id} endpoint."""

    def test_cancel_job_requires_auth(self, api_client):
        """Cancel job endpoint should require authentication."""
        job_id = str(uuid.uuid4())
        response = api_client.delete(f"/api/v1/jobs/{job_id}")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cancel_job_not_found(self, api_client, auth_headers):
        """Cancel job should return 404 for unknown job."""
        job_id = str(uuid.uuid4())
        response = api_client.delete(
            f"/api/v1/jobs/{job_id}",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cancel_queued_job(self, api_client, auth_headers):
        """Should be able to cancel a queued job."""
        # Submit a job
        submit_response = api_client.post(
            "/api/v1/process",
            json={"file_path": "/tmp/test.pdf"},
            headers=auth_headers,
        )
        job_id = submit_response.json()["job_id"]

        # Cancel the job
        response = api_client.delete(
            f"/api/v1/jobs/{job_id}",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "cancelled"
        assert data["job_id"] == job_id


class TestBatchProcessEndpoint:
    """Tests for POST /api/v1/process/batch endpoint."""

    def test_batch_requires_auth(self, api_client):
        """Batch process endpoint should require authentication."""
        response = api_client.post(
            "/api/v1/process/batch",
            json={"file_paths": ["/tmp/test1.pdf", "/tmp/test2.pdf"]},
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_batch_accepts_valid_request(self, api_client, auth_headers):
        """Batch process should accept array of file paths."""
        response = api_client.post(
            "/api/v1/process/batch",
            json={"file_paths": ["/tmp/test1.pdf", "/tmp/test2.pdf"]},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Validate BatchProcessResponse schema
        assert "job_ids" in data
        assert isinstance(data["job_ids"], list)
        assert len(data["job_ids"]) == 2
        assert "status" in data
        assert data["status"] == "queued"
        assert "total_documents" in data
        assert data["total_documents"] == 2

    def test_batch_includes_correlation_id(self, api_client, auth_headers):
        """Batch process should return correlation_id for linking jobs."""
        response = api_client.post(
            "/api/v1/process/batch",
            json={"file_paths": ["/tmp/test1.pdf", "/tmp/test2.pdf"]},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "correlation_id" in data

    def test_batch_missing_file_paths(self, api_client, auth_headers):
        """Batch process should reject request without file_paths."""
        response = api_client.post(
            "/api/v1/process/batch",
            json={},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_batch_empty_file_paths(self, api_client, auth_headers):
        """Batch process should handle empty file_paths array."""
        response = api_client.post(
            "/api/v1/process/batch",
            json={"file_paths": []},
            headers=auth_headers,
        )

        # Could be 200 with empty job_ids or 422 - depends on implementation
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_422_UNPROCESSABLE_ENTITY]
