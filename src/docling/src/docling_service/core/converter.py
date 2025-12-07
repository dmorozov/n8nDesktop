"""Docling document converter with page metadata preservation.

IMPORTANT: EasyOCR configuration order sensitivity - set ocr_options LAST
in pipeline configuration to avoid overwriting other OCR settings.
"""

import logging
import time
from pathlib import Path
from typing import Any

import structlog

from docling_service.core.config import settings
from docling_service.utils.markdown import generate_page_annotated_markdown

logger = structlog.get_logger(__name__)


def create_converter(processing_tier: str = "standard") -> Any:
    """Create a DocumentConverter configured for the specified processing tier.

    Args:
        processing_tier: One of 'lightweight', 'standard', 'advanced'

    Returns:
        Configured DocumentConverter instance
    """
    # Import docling modules (deferred to avoid import issues if not installed)
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import (
        AcceleratorDevice,
        AcceleratorOptions,
        EasyOcrOptions,
        PdfPipelineOptions,
    )
    from docling.document_converter import DocumentConverter, PdfFormatOption

    pipeline_options = PdfPipelineOptions()

    # Configure based on processing tier
    if processing_tier == "lightweight":
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = False
        pipeline_options.images_scale = 1.0
        pipeline_options.generate_page_images = False
        logger.info(
            "converter_configured",
            tier="lightweight",
            do_ocr=True,
            do_table_structure=False,
        )

    elif processing_tier == "standard":
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        pipeline_options.table_structure_options.do_cell_matching = True
        pipeline_options.images_scale = 1.5
        pipeline_options.generate_page_images = True
        logger.info(
            "converter_configured",
            tier="standard",
            do_ocr=True,
            do_table_structure=True,
        )

    elif processing_tier == "advanced":
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        pipeline_options.table_structure_options.do_cell_matching = True
        pipeline_options.images_scale = 2.0
        pipeline_options.generate_page_images = True
        # Note: VLM pipeline requires additional model weights
        logger.info(
            "converter_configured",
            tier="advanced",
            do_ocr=True,
            do_table_structure=True,
            vlm_enabled=False,  # Not yet implemented
        )

    # Configure accelerator
    pipeline_options.accelerator_options = AcceleratorOptions(
        num_threads=4,
        device=AcceleratorDevice.AUTO,  # Auto-detect GPU/CPU
    )

    # IMPORTANT: Set EasyOcrOptions LAST to avoid overwriting other OCR settings
    # See research.md for details on this configuration order sensitivity
    ocr_options = EasyOcrOptions()
    ocr_options.lang = ["en"]  # Default to English, can be extended
    pipeline_options.ocr_options = ocr_options

    logger.info(
        "ocr_engine_configured",
        engine="easyocr",
        languages=["en"],
    )

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )


async def process_document(
    file_path: str,
    processing_tier: str | None = None,
    languages: list[str] | None = None,
    force_full_page_ocr: bool = False,
    trace_id: str | None = None,
) -> dict:
    """Process a document and return page-annotated Markdown.

    Args:
        file_path: Path to the document file
        processing_tier: Override default processing tier
        languages: OCR language codes
        force_full_page_ocr: Force OCR on all pages
        trace_id: Trace ID for log correlation

    Returns:
        Dictionary containing:
        - status: 'success' or 'error'
        - markdown: Page-annotated Markdown content
        - metadata: Processing metadata (page_count, processing_time, etc.)
        - error: Error message if failed
    """
    tier = processing_tier or settings.processing_tier
    start_time = time.time()

    log = logger.bind(
        trace_id=trace_id,
        file_path=file_path,
        processing_tier=tier,
    )

    log.info("processing_started")

    try:
        # Create converter with specified tier
        converter = create_converter(tier)

        # Configure OCR languages if specified
        if languages:
            # Note: Would need to recreate converter with different language settings
            log.info("ocr_languages_override", languages=languages)

        # Convert document
        log.info("conversion_starting")
        result = converter.convert(file_path)

        if result.status.name != "SUCCESS":
            log.error(
                "conversion_failed",
                status=result.status.name,
            )
            return {
                "status": "error",
                "error": f"Conversion failed: {result.status.name}",
                "markdown": None,
                "metadata": None,
            }

        log.info("conversion_completed", status="SUCCESS")

        # Generate page-annotated Markdown
        log.info("markdown_generation_starting")
        markdown = generate_page_annotated_markdown(result.document)
        log.info("markdown_generation_completed", length=len(markdown))

        # Extract metadata
        page_count = len(result.document.pages) if hasattr(result.document, "pages") else 0
        processing_time_ms = int((time.time() - start_time) * 1000)

        metadata = {
            "page_count": page_count,
            "file_path": file_path,
            "processing_tier": tier,
            "format": Path(file_path).suffix.lower().lstrip("."),
            "processing_time_ms": processing_time_ms,
            "ocr_engine": "easyocr",
        }

        log.info(
            "processing_completed",
            page_count=page_count,
            processing_time_ms=processing_time_ms,
        )

        return {
            "status": "success",
            "markdown": markdown,
            "metadata": metadata,
            "error": None,
        }

    except FileNotFoundError:
        log.error("file_not_found", file_path=file_path)
        return {
            "status": "error",
            "error": f"File not found: {file_path}",
            "markdown": None,
            "metadata": None,
        }
    except PermissionError:
        log.error("permission_denied", file_path=file_path)
        return {
            "status": "error",
            "error": f"Permission denied: {file_path}",
            "markdown": None,
            "metadata": None,
        }
    except Exception as e:
        log.exception("processing_error", error=str(e))
        return {
            "status": "error",
            "error": str(e),
            "markdown": None,
            "metadata": None,
        }
