# Test Fixtures

This directory contains sample documents for testing the Docling service.

## Required Files

Place the following files in this directory for tests to pass:

### sample.pdf
A simple PDF document with 1-3 pages containing:
- Plain text paragraphs
- At least one heading
- Optionally: a simple table

Recommended: Create from any text document using "Print to PDF".

### sample_text.pdf (optional)
A text-based PDF (digital, not scanned) for testing fast path processing.

### sample_scanned.pdf (optional)
A scanned document PDF for testing OCR capabilities.

## Creating Test PDFs

You can create simple test PDFs using:

1. **LibreOffice**: Create a document, export as PDF
2. **Python**: Use reportlab or fpdf library
3. **Online**: Use any text-to-PDF converter

Example using Python (if fpdf is available):
```python
from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)
pdf.cell(200, 10, txt="Sample Document for Testing", ln=True, align="C")
pdf.cell(200, 10, txt="This is a test paragraph.", ln=True)
pdf.output("sample.pdf")
```

## Note

Tests that require these fixtures will skip if the files are not present.
