"""Page-annotated Markdown generation utilities.

This module implements custom post-processing to preserve page provenance
since default export_to_markdown() strips this information.
"""

from typing import Any


def generate_page_annotated_markdown(document: Any) -> str:
    """Generate Markdown with embedded page number annotations.

    This implements custom post-processing to preserve page provenance
    since default export_to_markdown() strips this information.

    Args:
        document: DoclingDocument object from conversion

    Returns:
        Markdown string with page markers embedded
    """
    markdown_parts: list[str] = []
    current_page: int | None = None

    # Iterate through document elements with provenance
    for element, _level in document.iterate_items():
        # Extract page number from provenance
        page_no = _extract_page_number(element)

        # Add page marker if page changed
        if page_no is not None and page_no != current_page:
            current_page = page_no
            markdown_parts.append(f"\n<!-- PAGE: {page_no} -->\n")
            markdown_parts.append(f'<span data-page="{page_no}"></span>\n')

        # Convert element to Markdown
        element_md = _element_to_markdown(element)
        if element_md:
            markdown_parts.append(element_md)

    return "\n".join(markdown_parts)


def _extract_page_number(element: Any) -> int | None:
    """Extract page number from element provenance.

    Args:
        element: Document element with potential provenance data

    Returns:
        Page number or None if not available
    """
    if not hasattr(element, "prov") or not element.prov:
        return None

    for prov in element.prov:
        if hasattr(prov, "page_no"):
            return prov.page_no

    return None


def _element_to_markdown(element: Any) -> str:
    """Convert a single document element to Markdown.

    Args:
        element: Document element to convert

    Returns:
        Markdown string representation
    """
    element_type = type(element).__name__

    if element_type == "TextItem":
        return element.text + "\n"

    elif element_type == "SectionHeaderItem":
        level = getattr(element, "level", 1)
        return f"{'#' * level} {element.text}\n"

    elif element_type == "ListItem":
        marker = getattr(element, "marker", "-")
        return f"{marker} {element.text}\n"

    elif element_type == "TableItem":
        return _table_to_markdown(element)

    elif element_type == "CodeItem":
        lang = getattr(element, "language", "")
        return f"```{lang}\n{element.text}\n```\n"

    elif element_type == "FormulaItem":
        # LaTeX formula
        return f"$$\n{element.text}\n$$\n"

    elif element_type == "PictureItem":
        caption = getattr(element, "caption", "Image")
        return f"![{caption}]()\n"

    else:
        # Fallback for unknown types
        if hasattr(element, "text"):
            return element.text + "\n"
        return ""


def _table_to_markdown(table_element: Any) -> str:
    """Convert a table element to Markdown table format.

    Args:
        table_element: Table element to convert

    Returns:
        Markdown table string
    """
    if not hasattr(table_element, "data") or not table_element.data:
        return ""

    grid = getattr(table_element.data, "grid", None)
    if not grid:
        return ""

    rows = grid
    if not rows:
        return ""

    md_lines = []

    # Header row
    if rows:
        header = rows[0]
        header_cells = [_get_cell_text(cell) for cell in header]
        md_lines.append("| " + " | ".join(header_cells) + " |")
        md_lines.append("| " + " | ".join("---" for _ in header) + " |")

    # Data rows
    for row in rows[1:]:
        row_cells = [_get_cell_text(cell) for cell in row]
        md_lines.append("| " + " | ".join(row_cells) + " |")

    return "\n".join(md_lines) + "\n"


def _get_cell_text(cell: Any) -> str:
    """Extract text from a table cell.

    Args:
        cell: Table cell object

    Returns:
        Cell text as string
    """
    if hasattr(cell, "text"):
        return str(cell.text)
    return str(cell)
