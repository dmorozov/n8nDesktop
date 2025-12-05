import { useStore } from '@nanostores/react';
import { $n8nStatus } from '@/stores/n8n';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  onClick?: () => void;
}

export function StatusBar({ onClick }: StatusBarProps) {
  const status = useStore($n8nStatus);

  const getStatusColor = () => {
    switch (status.status) {
      case 'running':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'starting':
        return 'bg-yellow-500 animate-pulse';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'running':
        return `Running on port ${status.port}`;
      case 'error':
        return status.error ?? 'Server Error';
      case 'starting':
        return 'Starting server...';
      default:
        return 'Server Stopped';
    }
  };

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
    >
      <span className={cn('h-2 w-2 rounded-full', getStatusColor())} />
      <span className="text-muted-foreground">{getStatusText()}</span>
    </button>
  );
}
