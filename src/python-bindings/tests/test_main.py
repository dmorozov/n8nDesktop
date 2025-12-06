"""Tests for the main module."""

import pytest

from hello_world.main import greet


class TestGreet:
    """Test cases for the greet function."""

    def test_greet_default(self):
        """Test greeting with default name."""
        result = greet()
        assert result == "Hello, World!"

    def test_greet_with_name(self):
        """Test greeting with specific name."""
        result = greet("Alice")
        assert result == "Hello, Alice!"

    def test_greet_with_empty_string(self):
        """Test greeting with empty string."""
        result = greet("")
        assert result == "Hello, !"

    @pytest.mark.parametrize(
        "name,expected",
        [
            ("Bob", "Hello, Bob!"),
            ("Charlie", "Hello, Charlie!"),
            ("123", "Hello, 123!"),
            ("Test User", "Hello, Test User!"),
        ],
    )
    def test_greet_parametrized(self, name, expected):
        """Test greeting with various names."""
        result = greet(name)
        assert result == expected
