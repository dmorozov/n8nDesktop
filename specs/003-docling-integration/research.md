# Research: Granite Docling OCR Integration

**Feature Branch**: `003-docling-integration`
**Date**: 2025-12-06

## Summary

This document captures research findings for integrating IBM's Granite Docling document processing engine into the n8n Desktop Electron application.

---

## Decision 1: IPC Communication Pattern

**Decision**: HTTP REST API via FastAPI + Uvicorn

**Rationale**:
- Native compatibility with n8n HTTP Request nodes (no custom nodes required)
- Language-agnostic approach allows Python backend and TypeScript frontend
- Familiar pattern for web developers; well-documented
- Supports async processing with job queuing
- Health check endpoints align with existing n8n health monitoring

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Unix Domain Sockets | Not cross-platform (Windows uses named pipes); complex path management |
| ZeroMQ | Requires additional dependency; steeper learning curve |
| gRPC | Overkill for local IPC; adds Protocol Buffer complexity |
| stdin/stdout JSON-RPC | Limited to synchronous request/response; no streaming progress |

---

## Decision 2: OCR Engine Selection

**Decision**: EasyOCR as default, with Tesseract as optional fallback

**Rationale**:
- EasyOCR provides better accuracy for mixed content (text + tables + formulas)
- Pure Python implementation (easier to bundle than Tesseract system libraries)
- GPU acceleration available out of the box
- Active development aligned with Docling project

**Alternatives Considered**:
| Alternative | Why Not Default |
|-------------|-----------------|
| Tesseract | Requires system installation and TESSDATA_PREFIX configuration |
| OcrMac | macOS only; not cross-platform |
| RapidOCR | Less mature integration with Docling |

---

## Decision 3: Page Metadata Preservation

**Decision**: Custom post-processing of DoclingDocument to inject page markers

**Rationale**:
- Default `export_to_markdown()` strips page provenance information
- Custom iteration through `document.iterate_items()` provides access to `prov.page_no`
- Injecting HTML comments (`<!-- PAGE: N -->`) and data attributes allows downstream RAG systems to extract page references

**Implementation Details**:
```python
for element, _level in document.iterate_items():
    if hasattr(element, 'prov') and element.prov:
        page_no = element.prov[0].page_no
        # Insert page marker when page changes
```

---

## Decision 4: Processing Tier Configuration

**Decision**: Three-tier system (Lightweight, Standard, Advanced)

**Rationale**:
- Clear user communication about resource trade-offs
- Maps to Docling pipeline options (`do_table_structure`, `ocr_options`, VLM settings)
- Allows users with limited hardware to use basic functionality

**Tier Mapping**:
| Tier | do_ocr | do_table_structure | VLM | Estimated RAM |
|------|--------|-------------------|-----|---------------|
| Lightweight | Yes | No | No | 2-4 GB |
| Standard | Yes | Yes | No | 4-8 GB |
| Advanced | Yes | Yes | Yes | 8-16 GB |

---

## Decision 5: Job Queue Architecture

**Decision**: Async job queue with configurable worker count (1-3)

**Rationale**:
- Prevents memory exhaustion from concurrent VLM processing
- Allows long-running jobs without blocking API responses
- n8n workflows can poll for completion status
- Queue state can be persisted for crash recovery (future enhancement)

**Implementation**:
- asyncio.Queue for job storage
- Worker coroutines process jobs sequentially
- Job state machine: QUEUED → PROCESSING → COMPLETED/FAILED/CANCELLED

---

## Decision 6: Authentication Between Services

**Decision**: Shared secret token (Bearer authentication)

**Rationale**:
- Simple to implement and verify
- Generated at runtime (unique per session)
- Passed via CLI argument to Python service
- Electron main process holds the token; n8n receives via environment variable

**Security Considerations**:
- Token not persisted to disk
- Service binds to localhost only (127.0.0.1)
- No external network access possible

---

## Decision 7: Python Runtime Strategy

**Decision**: Require Python 3.10+ on target system; check at startup with installation guidance

**Rationale**:
- Full bundling of Python + PyTorch + Docling exceeds 2GB (impractical)
- Python is commonly installed on developer machines
- Clear error message with installation URL provides acceptable UX
- Alternative: PyInstaller standalone executable (increases complexity significantly)

**Future Enhancement**: Consider PyInstaller for production releases with selective dependency bundling.

---

## Technical Findings

### Docling Pipeline Configuration Order

**Critical Finding**: The order of setting pipeline options matters!

```python
# WRONG - force_full_page_ocr gets overwritten
pipeline_options.ocr_options.force_full_page_ocr = True
pipeline_options.ocr_options = EasyOcrOptions()  # Overwrites!

# CORRECT - set EasyOcrOptions first, then configure
pipeline_options.ocr_options = EasyOcrOptions()
pipeline_options.ocr_options.force_full_page_ocr = True
```

### PyInstaller Hidden Imports for FastAPI/Uvicorn

Required hidden imports for bundling:
```python
hiddenimports = [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.loops.asyncio',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
]
```

### Batch Conversion Performance

- Use `DocumentConverter.convert_all()` instead of loop with `convert()`
- Set `raises_on_error=False` for graceful individual document failure handling
- GPU acceleration: `AcceleratorDevice.CUDA` provides ~3x speedup

---

## Sources

- [Docling Installation Guide](https://docling-project.github.io/docling/getting_started/installation/)
- [Docling Batch Conversion](https://docling-project.github.io/docling/examples/batch_convert/)
- [Docling Pipeline Options](https://docling-project.github.io/docling/reference/pipeline_options/)
- [EasyOCR Configuration Discussion](https://github.com/docling-project/docling/discussions/792)
- [PyInstaller FastAPI Example](https://github.com/iancleary/pyinstaller-fastapi)
- [FastAPI + Uvicorn Hidden Imports](https://stackoverflow.com/questions/65438069/uvicorn-and-fastapi-with-pyinstaller-problem-when-uvicorn-workers1)
- [IBM Granite-Docling-258M](https://huggingface.co/ibm-granite/granite-docling-258M)
