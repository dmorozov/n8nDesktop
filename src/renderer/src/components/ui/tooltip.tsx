import { forwardRef, useState, useRef } from 'react';
import { type HTMLAttributes, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProviderProps {
  children: ReactNode;
  delayDuration?: number;
}

function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>;
}

interface TooltipProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
}

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLElement>;
  delayDuration: number;
}

let tooltipContext: TooltipContextValue | null = null;

function Tooltip({ children, open: controlledOpen, onOpenChange, delayDuration = 200 }: TooltipProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);

  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  tooltipContext = { open, setOpen, triggerRef, delayDuration };

  return <div className="relative inline-block">{children}</div>;
}

interface TooltipTriggerProps extends HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

const TooltipTrigger = forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ className, children, asChild: _asChild, ...props }, ref) => {
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const handleMouseEnter = () => {
      if (tooltipContext) {
        timeoutRef.current = setTimeout(() => {
          tooltipContext?.setOpen(true);
        }, tooltipContext.delayDuration);
      }
    };

    const handleMouseLeave = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      tooltipContext?.setOpen(false);
    };

    return (
      <span
        ref={ref as RefObject<HTMLSpanElement>}
        className={cn('inline-block', className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => tooltipContext?.setOpen(true)}
        onBlur={() => tooltipContext?.setOpen(false)}
        {...props}
      >
        {children}
      </span>
    );
  }
);
TooltipTrigger.displayName = 'TooltipTrigger';

interface TooltipContentProps extends HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
}

const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = 'top', sideOffset = 4, children, ...props }, ref) => {
    if (!tooltipContext?.open) return null;

    const positionClasses = {
      top: 'bottom-full left-1/2 -translate-x-1/2 mb-1',
      right: 'left-full top-1/2 -translate-y-1/2 ml-1',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-1',
      left: 'right-full top-1/2 -translate-y-1/2 mr-1',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'absolute z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95',
          positionClasses[side],
          className
        )}
        style={{ marginTop: side === 'bottom' ? sideOffset : undefined, marginBottom: side === 'top' ? sideOffset : undefined }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
