"""Main module for the Hello World application."""

from typing import Optional


def greet(name: Optional[str] = None) -> str:
    """Generate a greeting message.

    Args:
        name: The name to greet. If None, uses 'World'.

    Returns:
        A greeting message string.
    """
    if name is None:
        name = "World"
    return f"Hello, {name}!"


def main() -> None:
    """Main entry point for the application."""
    message = greet()
    print(message)


if __name__ == "__main__":
    main()
