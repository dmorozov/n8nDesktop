import { forwardRef, useState, useRef, useEffect } from 'react';
import { type HTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}

interface SelectContextValue {
  value: string | undefined;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

let selectContext: SelectContextValue | null = null;

function Select({ value, onValueChange, children, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);

  selectContext = {
    value,
    onValueChange: onValueChange ?? (() => {}),
    open,
    setOpen: disabled ? () => {} : setOpen,
  };

  return <div className="relative">{children}</div>;
}

type SelectTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const triggerRef = useRef<HTMLButtonElement>(null);

    return (
      <button
        ref={ref || triggerRef}
        type="button"
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
          className
        )}
        onClick={() => selectContext?.setOpen(!selectContext.open)}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

interface SelectValueProps {
  placeholder?: string;
}

function SelectValue({ placeholder }: SelectValueProps) {
  return <span>{selectContext?.value || placeholder}</span>;
}

type SelectContentProps = HTMLAttributes<HTMLDivElement>;

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, _ref) => {
    const contentRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (selectContext?.open && contentRef.current && !contentRef.current.contains(e.target as Node)) {
          selectContext.setOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!selectContext?.open) return null;

    return (
      <div
        ref={contentRef}
        className={cn(
          'absolute z-50 mt-1 max-h-96 min-w-[8rem] w-full overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SelectContent.displayName = 'SelectContent';

interface SelectItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, ...props }, ref) => {
    const isSelected = selectContext?.value === value;

    const handleClick = () => {
      selectContext?.onValueChange(value);
      selectContext?.setOpen(false);
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          isSelected && 'bg-accent',
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {isSelected && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <Check className="h-4 w-4" />
          </span>
        )}
        {children}
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';

const SelectLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-2 py-1.5 text-sm font-semibold', className)} {...props} />
  )
);
SelectLabel.displayName = 'SelectLabel';

const SelectSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
  )
);
SelectSeparator.displayName = 'SelectSeparator';

function SelectGroup({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
