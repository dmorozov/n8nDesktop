"""Unit tests for job queue batch handling (T053)."""

import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from docling_service.core.queue import Job, JobQueue, JobState, job_queue


class TestJobDataclass:
    """Tests for Job dataclass."""

    def test_job_creation_defaults(self):
        """Job should have correct defaults."""
        job = Job(id="test-123", file_path="/tmp/test.pdf", options={})

        assert job.id == "test-123"
        assert job.file_path == "/tmp/test.pdf"
        assert job.state == JobState.QUEUED
        assert job.progress == 0
        assert job.result is None
        assert job.error is None
        assert job.correlation_id is None
        assert job.memory_start_mb is None
        assert job.memory_end_mb is None

    def test_job_with_correlation_id(self):
        """Job should store correlation_id for batch jobs."""
        correlation_id = str(uuid.uuid4())
        job = Job(
            id="test-123",
            file_path="/tmp/test.pdf",
            options={},
            correlation_id=correlation_id,
        )

        assert job.correlation_id == correlation_id

    def test_job_to_dict(self):
        """Job.to_dict should return expected structure."""
        job = Job(
            id="test-123",
            file_path="/tmp/test.pdf",
            options={"processing_tier": "lightweight"},
            trace_id="trace-456",
        )

        data = job.to_dict()

        assert data["job_id"] == "test-123"
        assert data["file_path"] == "/tmp/test.pdf"
        assert data["status"] == "queued"
        assert data["progress"] == 0
        assert data["trace_id"] == "trace-456"
        assert "created_at" in data


class TestJobQueueBatchHandling:
    """Tests for batch job queue handling (T053)."""

    @pytest.fixture
    def queue(self):
        """Create a fresh job queue for testing."""
        return JobQueue()

    @pytest.mark.asyncio
    async def test_enqueue_with_correlation_id(self, queue):
        """Enqueue should store correlation_id for batch tracking."""
        correlation_id = str(uuid.uuid4())

        job_id = await queue.enqueue(
            file_path="/tmp/test.pdf",
            correlation_id=correlation_id,
        )

        job_data = queue.get_job(job_id)
        # Note: correlation_id is not in to_dict() output but stored in Job
        job = queue._jobs.get(job_id)
        assert job.correlation_id == correlation_id

    @pytest.mark.asyncio
    async def test_batch_enqueue_same_correlation(self, queue):
        """Multiple batch jobs should share the same correlation_id."""
        correlation_id = str(uuid.uuid4())
        file_paths = ["/tmp/test1.pdf", "/tmp/test2.pdf", "/tmp/test3.pdf"]

        job_ids = []
        for path in file_paths:
            job_id = await queue.enqueue(
                file_path=path,
                correlation_id=correlation_id,
            )
            job_ids.append(job_id)

        # Verify all jobs have same correlation_id
        for job_id in job_ids:
            job = queue._jobs.get(job_id)
            assert job.correlation_id == correlation_id

        # Verify we got 3 different job IDs
        assert len(set(job_ids)) == 3

    @pytest.mark.asyncio
    async def test_queue_size_increases_with_batch(self, queue):
        """Queue size should reflect batch job count."""
        correlation_id = str(uuid.uuid4())

        assert queue.size() == 0

        await queue.enqueue(file_path="/tmp/test1.pdf", correlation_id=correlation_id)
        assert queue.size() == 1

        await queue.enqueue(file_path="/tmp/test2.pdf", correlation_id=correlation_id)
        assert queue.size() == 2

        await queue.enqueue(file_path="/tmp/test3.pdf", correlation_id=correlation_id)
        assert queue.size() == 3

    @pytest.mark.asyncio
    async def test_list_jobs_includes_batch(self, queue):
        """List jobs should include all batch jobs."""
        correlation_id = str(uuid.uuid4())
        job_ids = []

        for i in range(3):
            job_id = await queue.enqueue(
                file_path=f"/tmp/test{i}.pdf",
                correlation_id=correlation_id,
            )
            job_ids.append(job_id)

        jobs = queue.list_jobs()

        assert len(jobs) == 3
        listed_ids = [job["job_id"] for job in jobs]
        for job_id in job_ids:
            assert job_id in listed_ids

    @pytest.mark.asyncio
    async def test_cancel_one_batch_job(self, queue):
        """Cancelling one batch job should not affect others."""
        correlation_id = str(uuid.uuid4())

        job1_id = await queue.enqueue(file_path="/tmp/test1.pdf", correlation_id=correlation_id)
        job2_id = await queue.enqueue(file_path="/tmp/test2.pdf", correlation_id=correlation_id)
        job3_id = await queue.enqueue(file_path="/tmp/test3.pdf", correlation_id=correlation_id)

        # Cancel job2
        cancelled = await queue.cancel(job2_id)
        assert cancelled is True

        # Check states
        job1 = queue._jobs.get(job1_id)
        job2 = queue._jobs.get(job2_id)
        job3 = queue._jobs.get(job3_id)

        assert job1.state == JobState.QUEUED
        assert job2.state == JobState.CANCELLED
        assert job3.state == JobState.QUEUED

    @pytest.mark.asyncio
    async def test_batch_jobs_different_trace_ids(self, queue):
        """Each batch job should get its own trace_id if not provided."""
        correlation_id = str(uuid.uuid4())

        job1_id = await queue.enqueue(file_path="/tmp/test1.pdf", correlation_id=correlation_id)
        job2_id = await queue.enqueue(file_path="/tmp/test2.pdf", correlation_id=correlation_id)

        job1 = queue._jobs.get(job1_id)
        job2 = queue._jobs.get(job2_id)

        # Each job should have a trace_id (auto-generated)
        assert job1.trace_id is not None
        assert job2.trace_id is not None
        # Trace IDs should be different since not provided
        assert job1.trace_id != job2.trace_id

    @pytest.mark.asyncio
    async def test_batch_jobs_shared_trace_id(self, queue):
        """Batch jobs can share trace_id when provided."""
        correlation_id = str(uuid.uuid4())
        trace_id = str(uuid.uuid4())

        job1_id = await queue.enqueue(
            file_path="/tmp/test1.pdf",
            correlation_id=correlation_id,
            trace_id=trace_id,
        )
        job2_id = await queue.enqueue(
            file_path="/tmp/test2.pdf",
            correlation_id=correlation_id,
            trace_id=trace_id,
        )

        job1 = queue._jobs.get(job1_id)
        job2 = queue._jobs.get(job2_id)

        assert job1.trace_id == trace_id
        assert job2.trace_id == trace_id

    @pytest.mark.asyncio
    async def test_batch_jobs_shared_options(self, queue):
        """Batch jobs should use shared options."""
        correlation_id = str(uuid.uuid4())
        options = {"processing_tier": "lightweight", "languages": ["en", "fr"]}

        job_ids = []
        for i in range(3):
            job_id = await queue.enqueue(
                file_path=f"/tmp/test{i}.pdf",
                options=options,
                correlation_id=correlation_id,
            )
            job_ids.append(job_id)

        for job_id in job_ids:
            job = queue._jobs.get(job_id)
            assert job.options["processing_tier"] == "lightweight"
            assert job.options["languages"] == ["en", "fr"]


class TestJobQueuePartialFailureHandling:
    """Tests for partial batch failure handling (T058)."""

    @pytest.fixture
    def queue(self):
        """Create a fresh job queue for testing."""
        return JobQueue()

    @pytest.mark.asyncio
    async def test_partial_batch_failure_others_still_queued(self, queue):
        """If one batch job fails immediately, others should remain queued."""
        correlation_id = str(uuid.uuid4())

        # Queue multiple jobs
        job1_id = await queue.enqueue(file_path="/tmp/test1.pdf", correlation_id=correlation_id)
        job2_id = await queue.enqueue(file_path="/tmp/test2.pdf", correlation_id=correlation_id)
        job3_id = await queue.enqueue(file_path="/tmp/test3.pdf", correlation_id=correlation_id)

        # Simulate failure of job1
        job1 = queue._jobs.get(job1_id)
        job1.state = JobState.FAILED
        job1.error = "File not found"
        job1.error_type = "processing_error"

        # Others should still be queued
        job2 = queue._jobs.get(job2_id)
        job3 = queue._jobs.get(job3_id)

        assert job2.state == JobState.QUEUED
        assert job3.state == JobState.QUEUED

    @pytest.mark.asyncio
    async def test_batch_mixed_success_failure_states(self, queue):
        """Batch jobs can have mixed success/failure states."""
        correlation_id = str(uuid.uuid4())

        job1_id = await queue.enqueue(file_path="/tmp/test1.pdf", correlation_id=correlation_id)
        job2_id = await queue.enqueue(file_path="/tmp/test2.pdf", correlation_id=correlation_id)
        job3_id = await queue.enqueue(file_path="/tmp/test3.pdf", correlation_id=correlation_id)

        # Simulate different outcomes
        job1 = queue._jobs.get(job1_id)
        job1.state = JobState.COMPLETED
        job1.result = {"status": "success", "markdown": "# Test"}

        job2 = queue._jobs.get(job2_id)
        job2.state = JobState.FAILED
        job2.error = "Processing timeout"
        job2.error_type = "timeout"

        job3 = queue._jobs.get(job3_id)
        job3.state = JobState.CANCELLED

        # Verify each job has independent state
        jobs = queue.list_jobs()
        states = {job["job_id"]: job["status"] for job in jobs}

        assert states[job1_id] == "completed"
        assert states[job2_id] == "failed"
        assert states[job3_id] == "cancelled"

    @pytest.mark.asyncio
    async def test_get_batch_jobs_by_correlation_id(self, queue):
        """Should be able to filter jobs by correlation_id."""
        correlation_id_1 = str(uuid.uuid4())
        correlation_id_2 = str(uuid.uuid4())

        # Batch 1
        await queue.enqueue(file_path="/tmp/batch1_1.pdf", correlation_id=correlation_id_1)
        await queue.enqueue(file_path="/tmp/batch1_2.pdf", correlation_id=correlation_id_1)

        # Batch 2
        await queue.enqueue(file_path="/tmp/batch2_1.pdf", correlation_id=correlation_id_2)

        # Filter by correlation_id (done by iterating jobs)
        batch1_jobs = [
            job for job in queue._jobs.values()
            if job.correlation_id == correlation_id_1
        ]
        batch2_jobs = [
            job for job in queue._jobs.values()
            if job.correlation_id == correlation_id_2
        ]

        assert len(batch1_jobs) == 2
        assert len(batch2_jobs) == 1
