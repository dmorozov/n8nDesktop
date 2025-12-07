"""Temporary file management for Docling Service (T084, T085).

Provides utilities for:
- Cleaning up temp files after job completion (T084)
- Cleaning up orphaned temp files on service startup (T085)
"""

import os
import shutil
import tempfile
import time
from pathlib import Path

import structlog

from docling_service.core.config import settings

logger = structlog.get_logger(__name__)

# Maximum age for temp files before considered orphaned (in seconds)
ORPHAN_AGE_SECONDS = 3600  # 1 hour


def get_temp_dir() -> Path:
    """Get the configured temporary directory.

    Returns:
        Path to the temp directory (uses system temp if not configured)
    """
    if settings.temp_dir:
        path = Path(settings.temp_dir)
    else:
        path = Path(tempfile.gettempdir()) / "docling"

    # Ensure directory exists
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_job_temp_dir(job_id: str) -> Path:
    """Get the temporary directory for a specific job.

    Args:
        job_id: Job identifier

    Returns:
        Path to job-specific temp directory
    """
    job_dir = get_temp_dir() / f"job_{job_id}"
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def cleanup_job_temp_files(job_id: str, trace_id: str | None = None) -> bool:
    """Clean up temporary files for a completed job (T084).

    Args:
        job_id: Job identifier
        trace_id: Trace ID for logging

    Returns:
        True if cleanup successful, False otherwise
    """
    log = logger.bind(job_id=job_id, trace_id=trace_id)
    job_dir = get_temp_dir() / f"job_{job_id}"

    if not job_dir.exists():
        log.debug("job_temp_dir_not_found", path=str(job_dir))
        return True

    try:
        shutil.rmtree(job_dir)
        log.info("job_temp_files_cleaned", path=str(job_dir))
        return True
    except Exception as e:
        log.error("job_temp_cleanup_failed", path=str(job_dir), error=str(e))
        return False


def cleanup_orphaned_temp_files(max_age_seconds: int = ORPHAN_AGE_SECONDS) -> int:
    """Clean up orphaned temp files on service startup (T085).

    Removes temp directories older than max_age_seconds.

    Args:
        max_age_seconds: Maximum age in seconds before a file is considered orphaned

    Returns:
        Number of directories cleaned up
    """
    temp_dir = get_temp_dir()
    cleaned_count = 0
    current_time = time.time()

    logger.info(
        "orphan_cleanup_starting",
        temp_dir=str(temp_dir),
        max_age_seconds=max_age_seconds,
    )

    if not temp_dir.exists():
        logger.debug("temp_dir_not_found", path=str(temp_dir))
        return 0

    try:
        for item in temp_dir.iterdir():
            if not item.is_dir():
                continue

            # Check if it's a job directory (starts with "job_")
            if not item.name.startswith("job_"):
                continue

            # Check age
            try:
                mtime = item.stat().st_mtime
                age = current_time - mtime

                if age > max_age_seconds:
                    logger.info(
                        "orphan_temp_dir_found",
                        path=str(item),
                        age_seconds=int(age),
                    )
                    shutil.rmtree(item)
                    cleaned_count += 1
                    logger.info("orphan_temp_dir_cleaned", path=str(item))
            except Exception as e:
                logger.error(
                    "orphan_cleanup_item_failed",
                    path=str(item),
                    error=str(e),
                )

    except Exception as e:
        logger.error(
            "orphan_cleanup_failed",
            temp_dir=str(temp_dir),
            error=str(e),
        )

    logger.info(
        "orphan_cleanup_completed",
        cleaned_count=cleaned_count,
    )

    return cleaned_count


def get_temp_dir_size() -> int:
    """Get the total size of the temp directory in bytes.

    Returns:
        Total size in bytes
    """
    temp_dir = get_temp_dir()
    total_size = 0

    if not temp_dir.exists():
        return 0

    try:
        for dirpath, _dirnames, filenames in os.walk(temp_dir):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                try:
                    total_size += os.path.getsize(filepath)
                except (OSError, FileNotFoundError):
                    pass
    except Exception:
        pass

    return total_size


def get_temp_dir_stats() -> dict:
    """Get statistics about the temp directory.

    Returns:
        Dictionary with temp directory statistics
    """
    temp_dir = get_temp_dir()
    stats = {
        "path": str(temp_dir),
        "exists": temp_dir.exists(),
        "size_bytes": 0,
        "job_count": 0,
    }

    if not temp_dir.exists():
        return stats

    try:
        stats["size_bytes"] = get_temp_dir_size()
        stats["job_count"] = sum(
            1 for item in temp_dir.iterdir() if item.is_dir() and item.name.startswith("job_")
        )
    except Exception:
        pass

    return stats
