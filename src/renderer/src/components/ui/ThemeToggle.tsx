/**
 * Theme toggle button component
 * Floating button in top-right corner to switch between light/dark themes
 * Based on: https://ui.shadcn.com/docs/dark-mode/vite
 */

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { Button } from './button';
import { useState, useRef, useEffect } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowMenu(!showMenu)}
        className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-sm hover:bg-accent"
        aria-label="Toggle theme"
      >
        {getIcon()}
      </Button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-36 rounded-md border border-border bg-popover p-1 shadow-lg z-50">
          <button
            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent ${
              theme === 'light' ? 'bg-accent' : ''
            }`}
            onClick={() => {
              setTheme('light');
              setShowMenu(false);
            }}
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
          <button
            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent ${
              theme === 'dark' ? 'bg-accent' : ''
            }`}
            onClick={() => {
              setTheme('dark');
              setShowMenu(false);
            }}
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
          <button
            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent ${
              theme === 'system' ? 'bg-accent' : ''
            }`}
            onClick={() => {
              setTheme('system');
              setShowMenu(false);
            }}
          >
            <Monitor className="h-4 w-4" />
            System
          </button>
        </div>
      )}
    </div>
  );
}
