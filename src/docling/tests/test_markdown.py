"""Unit tests for page-annotated markdown generator (T029).

These tests validate the markdown generation logic that preserves
page provenance information from Docling document processing.
"""

from unittest.mock import MagicMock, PropertyMock

import pytest


class MockProv:
    """Mock provenance data for document elements."""

    def __init__(self, page_no: int):
        self.page_no = page_no


def create_mock_element(
    element_type: str,
    text: str,
    page_no: int | None = None,
    level: int = 1,
    marker: str = "-",
    caption: str | None = None,
):
    """Factory function to create mock elements with proper class names.

    This creates actual classes with the correct __name__ attribute,
    which is how the markdown generator identifies element types.
    """
    # Create a dynamic class with the correct name
    element_class = type(element_type, (), {})

    # Create instance
    element = element_class()
    element.text = text
    element.prov = [MockProv(page_no)] if page_no is not None else []
    element.level = level
    element.marker = marker
    if caption is not None:
        element.caption = caption

    return element


# For backwards compatibility with existing tests
class MockElement:
    """Mock document element for testing (legacy - prefer create_mock_element)."""

    def __init__(
        self,
        element_type: str,
        text: str,
        page_no: int | None = None,
        level: int = 1,
        marker: str = "-",
    ):
        self._type = element_type
        self.text = text
        self.prov = [MockProv(page_no)] if page_no is not None else []
        self.level = level
        self.marker = marker


class MockDocument:
    """Mock DoclingDocument for testing."""

    def __init__(self, elements: list):
        self._elements = elements

    def iterate_items(self):
        """Yield elements with level (mimics DoclingDocument API)."""
        for element in self._elements:
            yield element, 0


class TestExtractPageNumber:
    """Tests for _extract_page_number function."""

    def test_extract_from_prov(self):
        """Should extract page number from element provenance."""
        from docling_service.utils.markdown import _extract_page_number

        element = create_mock_element("TextItem", "test", page_no=5)
        assert _extract_page_number(element) == 5

    def test_no_prov(self):
        """Should return None when element has no provenance."""
        from docling_service.utils.markdown import _extract_page_number

        element = create_mock_element("TextItem", "test", page_no=None)
        assert _extract_page_number(element) is None

    def test_empty_prov_list(self):
        """Should return None for empty provenance list."""
        from docling_service.utils.markdown import _extract_page_number

        element = create_mock_element("TextItem", "test")
        element.prov = []
        assert _extract_page_number(element) is None


class TestElementToMarkdown:
    """Tests for _element_to_markdown function."""

    def test_text_item(self):
        """TextItem should convert to plain text with newline."""
        from docling_service.utils.markdown import _element_to_markdown

        element = create_mock_element("TextItem", "Hello world", page_no=1)
        result = _element_to_markdown(element)
        assert result == "Hello world\n"

    def test_section_header_level_1(self):
        """SectionHeaderItem should convert to heading with correct level."""
        from docling_service.utils.markdown import _element_to_markdown

        element = create_mock_element("SectionHeaderItem", "Chapter 1", page_no=1, level=1)
        result = _element_to_markdown(element)
        assert result == "# Chapter 1\n"

    def test_section_header_level_3(self):
        """SectionHeaderItem with level 3 should have ### prefix."""
        from docling_service.utils.markdown import _element_to_markdown

        element = create_mock_element("SectionHeaderItem", "Subsection", page_no=1, level=3)
        result = _element_to_markdown(element)
        assert result == "### Subsection\n"

    def test_list_item(self):
        """ListItem should preserve marker."""
        from docling_service.utils.markdown import _element_to_markdown

        element = create_mock_element("ListItem", "First item", page_no=1, marker="1.")
        result = _element_to_markdown(element)
        assert result == "1. First item\n"

    def test_code_item(self):
        """CodeItem should wrap in code block."""
        from docling_service.utils.markdown import _element_to_markdown

        element = create_mock_element("CodeItem", "print('hello')", page_no=1)
        result = _element_to_markdown(element)
        assert "```" in result
        assert "print('hello')" in result

    def test_formula_item(self):
        """FormulaItem should wrap in $$ delimiters."""
        from docling_service.utils.markdown import _element_to_markdown

        element = create_mock_element("FormulaItem", "E = mc^2", page_no=1)
        result = _element_to_markdown(element)
        assert "$$" in result
        assert "E = mc^2" in result

    def test_picture_item(self):
        """PictureItem should generate image markdown."""
        from docling_service.utils.markdown import _element_to_markdown

        element = create_mock_element("PictureItem", "", page_no=1, caption="Figure 1")
        result = _element_to_markdown(element)
        assert "![Figure 1]" in result

    def test_unknown_item_with_text(self):
        """Unknown element types with text should output the text."""
        from docling_service.utils.markdown import _element_to_markdown

        element = create_mock_element("UnknownItem", "Some text", page_no=1)
        result = _element_to_markdown(element)
        assert result == "Some text\n"

    def test_unknown_item_without_text(self):
        """Unknown element types without text should return empty string."""
        from docling_service.utils.markdown import _element_to_markdown

        # Create element without text attribute
        element_class = type("UnknownItem", (), {})
        element = element_class()
        result = _element_to_markdown(element)
        assert result == ""


class TestGeneratePageAnnotatedMarkdown:
    """Tests for generate_page_annotated_markdown function."""

    def test_single_page_document(self):
        """Should add page marker for single page document."""
        from docling_service.utils.markdown import generate_page_annotated_markdown

        elements = [
            create_mock_element("SectionHeaderItem", "Title", page_no=1, level=1),
            create_mock_element("TextItem", "Paragraph text", page_no=1),
        ]
        doc = MockDocument(elements)

        result = generate_page_annotated_markdown(doc)

        assert "<!-- PAGE: 1 -->" in result
        assert '<span data-page="1"></span>' in result
        assert "# Title" in result
        assert "Paragraph text" in result

    def test_multi_page_document(self):
        """Should add page markers when page changes."""
        from docling_service.utils.markdown import generate_page_annotated_markdown

        elements = [
            create_mock_element("TextItem", "Page 1 content", page_no=1),
            create_mock_element("TextItem", "Still page 1", page_no=1),
            create_mock_element("TextItem", "Page 2 content", page_no=2),
            create_mock_element("TextItem", "Page 3 content", page_no=3),
        ]
        doc = MockDocument(elements)

        result = generate_page_annotated_markdown(doc)

        assert result.count("<!-- PAGE:") == 3
        assert "<!-- PAGE: 1 -->" in result
        assert "<!-- PAGE: 2 -->" in result
        assert "<!-- PAGE: 3 -->" in result

    def test_page_markers_include_data_attribute(self):
        """Page markers should include data-page attribute for CSS targeting."""
        from docling_service.utils.markdown import generate_page_annotated_markdown

        elements = [create_mock_element("TextItem", "Content", page_no=5)]
        doc = MockDocument(elements)

        result = generate_page_annotated_markdown(doc)

        assert '<span data-page="5"></span>' in result

    def test_empty_document(self):
        """Should handle empty document gracefully."""
        from docling_service.utils.markdown import generate_page_annotated_markdown

        doc = MockDocument([])
        result = generate_page_annotated_markdown(doc)
        assert result == ""

    def test_elements_without_page_info(self):
        """Should handle elements without page provenance."""
        from docling_service.utils.markdown import generate_page_annotated_markdown

        elements = [
            create_mock_element("TextItem", "No page info", page_no=None),
        ]
        doc = MockDocument(elements)

        result = generate_page_annotated_markdown(doc)

        # Should still include the content
        assert "No page info" in result
        # But no page marker
        assert "<!-- PAGE:" not in result


class TestTableToMarkdown:
    """Tests for _table_to_markdown function."""

    def test_simple_table(self):
        """Should convert simple table to markdown format."""
        from docling_service.utils.markdown import _table_to_markdown

        # Create mock table element
        table = MagicMock()
        table.data = MagicMock()
        table.data.grid = [
            [MagicMock(text="Header 1"), MagicMock(text="Header 2")],
            [MagicMock(text="Cell 1"), MagicMock(text="Cell 2")],
        ]

        result = _table_to_markdown(table)

        assert "| Header 1 | Header 2 |" in result
        assert "| --- | --- |" in result
        assert "| Cell 1 | Cell 2 |" in result

    def test_empty_table(self):
        """Should handle table with no data."""
        from docling_service.utils.markdown import _table_to_markdown

        table = MagicMock()
        table.data = None

        result = _table_to_markdown(table)
        assert result == ""

    def test_table_no_grid(self):
        """Should handle table without grid attribute."""
        from docling_service.utils.markdown import _table_to_markdown

        table = MagicMock()
        table.data = MagicMock()
        table.data.grid = None

        result = _table_to_markdown(table)
        assert result == ""
