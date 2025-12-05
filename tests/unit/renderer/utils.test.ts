/**
 * Unit tests for renderer utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock clsx and tailwind-merge
vi.mock('clsx', () => ({
  clsx: (...args: unknown[]) => args.filter(Boolean).flat().join(' '),
}));

vi.mock('tailwind-merge', () => ({
  twMerge: (classes: string) => classes,
}));

// Import utils - using relative import since @/ alias may not work in test env
import {
  cn,
  formatRelativeTime,
  formatDuration,
  truncate,
  generateId,
  debounce,
  isDefined,
} from '@/lib/utils';

describe('Utility Functions', () => {
  describe('cn (class names)', () => {
    it('should merge class names', () => {
      const result = cn('class1', 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', false && 'hidden', true && 'visible');
      expect(result).toContain('base');
      expect(result).toContain('visible');
      expect(result).not.toContain('hidden');
    });

    it('should handle undefined values', () => {
      const result = cn('base', undefined, null, 'end');
      expect(result).toContain('base');
      expect(result).toContain('end');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      // Mock current time
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "Just now" for times less than 1 minute ago', () => {
      const date = new Date('2024-01-15T11:59:30Z');
      expect(formatRelativeTime(date)).toBe('Just now');
    });

    it('should return "1 minute ago" for exactly 1 minute', () => {
      const date = new Date('2024-01-15T11:59:00Z');
      expect(formatRelativeTime(date)).toBe('1 minute ago');
    });

    it('should return "X minutes ago" for times less than 1 hour', () => {
      const date = new Date('2024-01-15T11:30:00Z');
      expect(formatRelativeTime(date)).toBe('30 minutes ago');
    });

    it('should return "1 hour ago" for exactly 1 hour', () => {
      const date = new Date('2024-01-15T11:00:00Z');
      expect(formatRelativeTime(date)).toBe('1 hour ago');
    });

    it('should return "X hours ago" for times less than 24 hours', () => {
      const date = new Date('2024-01-15T06:00:00Z');
      expect(formatRelativeTime(date)).toBe('6 hours ago');
    });

    it('should return "Yesterday" for times 1 day ago', () => {
      const date = new Date('2024-01-14T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('Yesterday');
    });

    it('should return "X days ago" for times 2-6 days ago', () => {
      const date = new Date('2024-01-12T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('3 days ago');
    });

    it('should return formatted date for times 7+ days ago', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const result = formatRelativeTime(date);
      expect(result).toMatch(/Jan 1/);
    });

    it('should handle string date input', () => {
      const result = formatRelativeTime('2024-01-15T11:59:30Z');
      expect(result).toBe('Just now');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(1)).toBe('1s');
      expect(formatDuration(59)).toBe('59s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(125)).toBe('2m 5s');
    });

    it('should format minutes only when seconds are 0', () => {
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(120)).toBe('2m');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3660)).toBe('1h 1m');
      expect(formatDuration(7200)).toBe('2h');
    });

    it('should format hours only when minutes are 0', () => {
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(10800)).toBe('3h');
    });

    it('should handle 0 seconds', () => {
      expect(formatDuration(0)).toBe('0s');
    });
  });

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
      expect(truncate('Hi', 5)).toBe('Hi');
    });

    it('should truncate long strings with ellipsis', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    it('should handle exact length', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });

    it('should handle empty strings', () => {
      expect(truncate('', 10)).toBe('');
    });

    it('should handle very short max length', () => {
      expect(truncate('Hello', 3)).toBe('...');
    });
  });

  describe('generateId', () => {
    it('should generate a string ID', () => {
      // Mock crypto.randomUUID
      const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
      vi.stubGlobal('crypto', {
        randomUUID: vi.fn(() => mockUUID),
      });

      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id).toBe(mockUUID);
    });

    it('should generate unique IDs', () => {
      let counter = 0;
      vi.stubGlobal('crypto', {
        randomUUID: vi.fn(() => `uuid-${++counter}`),
      });

      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce function calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should reset timer on subsequent calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);
      debouncedFn(); // Reset timer
      vi.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use the last arguments', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('third');
    });
  });

  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined('string')).toBe(true);
      expect(isDefined(0)).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined([])).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    it('should return false for null', () => {
      expect(isDefined(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDefined(undefined)).toBe(false);
    });

    it('should work as type guard', () => {
      const value: string | null | undefined = 'test';

      if (isDefined(value)) {
        // TypeScript should know value is string here
        expect(value.length).toBe(4);
      }
    });
  });
});
