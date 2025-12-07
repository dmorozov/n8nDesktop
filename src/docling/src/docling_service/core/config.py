"""Configuration management for Docling Service."""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with defaults and environment variable support."""

    model_config = SettingsConfigDict(
        env_prefix="DOCLING_",
        case_sensitive=False,
    )

    # Server configuration
    host: str = Field(default="127.0.0.1", description="Host to bind to")
    port: int = Field(default=8001, description="Port to listen on")

    # Authentication
    auth_token: str | None = Field(default=None, description="Shared secret for authentication")

    # Processing configuration
    processing_tier: Literal["lightweight", "standard", "advanced"] = Field(
        default="standard",
        description="Default processing tier",
    )
    max_concurrent_jobs: int = Field(
        default=1,
        ge=1,
        le=3,
        description="Maximum number of concurrent processing jobs",
    )

    # Directories
    temp_dir: str | None = Field(
        default=None,
        description="Temporary directory for processing files",
    )

    # Timeout configuration (formula: base + page_count * per_page * tier_multiplier)
    timeout_base_seconds: int = Field(default=60, description="Base timeout in seconds")
    timeout_per_page_seconds: int = Field(default=10, description="Additional timeout per page")

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")


# Global settings instance
settings = Settings()


def calculate_timeout(page_count: int, tier: str | None = None) -> int:
    """Calculate timeout based on page count and processing tier.

    Args:
        page_count: Number of pages in the document
        tier: Processing tier (lightweight, standard, advanced)

    Returns:
        Timeout in seconds
    """
    tier_multipliers = {
        "lightweight": 0.5,
        "standard": 1.0,
        "advanced": 2.0,
    }

    effective_tier = tier or settings.processing_tier
    multiplier = tier_multipliers.get(effective_tier, 1.0)

    return int(
        (settings.timeout_base_seconds + (page_count * settings.timeout_per_page_seconds)) * multiplier
    )
