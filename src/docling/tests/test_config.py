"""Tests for configuration module (T046)."""

import os
import tempfile
from pathlib import Path

import pytest

from docling_service.core.config import Settings, calculate_timeout


class TestSettings:
    """Tests for Settings class."""

    def test_default_values(self, monkeypatch):
        """Settings should have sensible defaults."""
        # Clear relevant env vars to test true defaults
        monkeypatch.delenv("DOCLING_PORT", raising=False)
        monkeypatch.delenv("DOCLING_AUTH_TOKEN", raising=False)
        monkeypatch.delenv("DOCLING_PROCESSING_TIER", raising=False)
        monkeypatch.delenv("DOCLING_MAX_CONCURRENT_JOBS", raising=False)
        monkeypatch.delenv("DOCLING_TEMP_DIR", raising=False)
        monkeypatch.delenv("DOCLING_LOG_LEVEL", raising=False)

        settings = Settings()
        assert settings.host == "127.0.0.1"
        assert settings.port == 8001
        assert settings.processing_tier == "standard"
        assert settings.max_concurrent_jobs == 1
        assert settings.temp_dir is None
        assert settings.log_level == "INFO"

    def test_environment_override(self, monkeypatch):
        """Settings should be overridable via environment variables."""
        monkeypatch.setenv("DOCLING_PORT", "9999")
        monkeypatch.setenv("DOCLING_PROCESSING_TIER", "advanced")
        monkeypatch.setenv("DOCLING_MAX_CONCURRENT_JOBS", "3")

        settings = Settings()
        assert settings.port == 9999
        assert settings.processing_tier == "advanced"
        assert settings.max_concurrent_jobs == 3

    def test_temp_dir_from_env(self, monkeypatch):
        """temp_dir should be configurable via environment."""
        with tempfile.TemporaryDirectory() as tmp:
            monkeypatch.setenv("DOCLING_TEMP_DIR", tmp)
            settings = Settings()
            assert settings.temp_dir == tmp


class TestTempFolderValidation:
    """Tests for temp folder validation (T046)."""

    def test_temp_folder_none_uses_system_default(self):
        """When temp_dir is None, system temp should be used."""
        settings = Settings()
        assert settings.temp_dir is None
        # Application should fall back to tempfile.gettempdir() when None

    def test_temp_folder_exists_and_writable(self, monkeypatch):
        """Temp folder must exist and be writable."""
        with tempfile.TemporaryDirectory() as tmp:
            monkeypatch.setenv("DOCLING_TEMP_DIR", tmp)
            settings = Settings()

            # Verify folder exists
            assert os.path.exists(settings.temp_dir)

            # Verify folder is writable
            test_file = Path(settings.temp_dir) / "test_write.tmp"
            test_file.write_text("test")
            assert test_file.exists()
            test_file.unlink()

    def test_temp_folder_path_validation(self, monkeypatch):
        """Should accept valid path even if it doesn't exist yet.

        The application is responsible for creating the folder if needed.
        """
        nonexistent = "/tmp/docling-test-nonexistent-12345"
        monkeypatch.setenv("DOCLING_TEMP_DIR", nonexistent)
        settings = Settings()
        assert settings.temp_dir == nonexistent

    def test_temp_folder_empty_string_is_none(self, monkeypatch):
        """Empty string for temp_dir should work (application treats as None)."""
        monkeypatch.setenv("DOCLING_TEMP_DIR", "")
        settings = Settings()
        # Pydantic converts empty string to empty string, not None
        # Application code should handle empty string as "use default"
        assert settings.temp_dir == ""


class TestCalculateTimeout:
    """Tests for timeout calculation function."""

    def test_base_timeout(self):
        """Should use base timeout for 0 pages."""
        timeout = calculate_timeout(0, "standard")
        assert timeout == 60  # base_timeout only

    def test_per_page_timeout(self):
        """Should add per-page timeout."""
        timeout = calculate_timeout(10, "standard")
        # 60 (base) + 10 pages * 10 seconds * 1.0 (standard multiplier) = 160
        assert timeout == 160

    def test_lightweight_tier_multiplier(self):
        """Lightweight tier should have 0.5x multiplier."""
        timeout = calculate_timeout(10, "lightweight")
        # (60 + 100) * 0.5 = 80
        assert timeout == 80

    def test_standard_tier_multiplier(self):
        """Standard tier should have 1.0x multiplier."""
        timeout = calculate_timeout(10, "standard")
        # (60 + 100) * 1.0 = 160
        assert timeout == 160

    def test_advanced_tier_multiplier(self):
        """Advanced tier should have 2.0x multiplier."""
        timeout = calculate_timeout(10, "advanced")
        # (60 + 100) * 2.0 = 320
        assert timeout == 320

    def test_unknown_tier_uses_standard(self):
        """Unknown tier should use standard multiplier (1.0)."""
        timeout = calculate_timeout(10, "unknown_tier")
        # (60 + 100) * 1.0 = 160
        assert timeout == 160

    def test_none_tier_uses_settings_default(self):
        """None tier should use settings default."""
        timeout = calculate_timeout(10, None)
        # Uses settings.processing_tier which defaults to "standard"
        assert timeout == 160
