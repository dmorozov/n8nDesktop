import { useEffect, useCallback } from 'react';

interface UseKeyboardNavigationOptions {
  /** Handler for Escape key press */
  onEscape?: () => void;
  /** Handler for Enter key press */
  onEnter?: () => void;
  /** Whether to attach the listener (default: true) */
  enabled?: boolean;
  /** Target element - defaults to document */
  targetRef?: React.RefObject<HTMLElement>;
}

/**
 * Hook for handling common keyboard navigation patterns (Tab/Enter/Escape)
 * - Escape: Close dialogs, cancel operations
 * - Enter: Confirm actions, submit forms
 * - Tab: Handled natively by browser
 */
export function useKeyboardNavigation({
  onEscape,
  onEnter,
  enabled = true,
  targetRef,
}: UseKeyboardNavigationOptions = {}) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      switch (event.key) {
        case 'Escape':
          if (onEscape) {
            event.preventDefault();
            onEscape();
          }
          break;
        case 'Enter':
          // Only trigger onEnter if not in an input (unless it's a button)
          if (onEnter && (!isInput || target.tagName === 'BUTTON')) {
            // Don't prevent default for form submissions
            onEnter();
          }
          break;
      }
    },
    [onEscape, onEnter]
  );

  useEffect(() => {
    if (!enabled) return;

    const target = targetRef?.current ?? document;
    target.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      target.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [enabled, handleKeyDown, targetRef]);
}

/**
 * Hook for making a container focusable and navigable with arrow keys
 */
export function useArrowNavigation(
  containerRef: React.RefObject<HTMLElement>,
  itemSelector: string = '[tabindex="0"], button, a, input'
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = Array.from(
        container.querySelectorAll<HTMLElement>(itemSelector)
      );
      const currentIndex = items.findIndex(
        (item) => item === document.activeElement
      );

      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          nextIndex = (currentIndex + 1) % items.length;
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          nextIndex = (currentIndex - 1 + items.length) % items.length;
          break;
        case 'Home':
          event.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }

      items[nextIndex]?.focus();
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, itemSelector]);
}
