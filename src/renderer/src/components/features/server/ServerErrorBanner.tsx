import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { N8nStatus } from '../../../../../preload/types';

interface ServerErrorBannerProps {
  status: N8nStatus;
  onRetry: () => void;
  onOpenSettings: () => void;
}

export function ServerErrorBanner({ status, onRetry, onOpenSettings }: ServerErrorBannerProps) {
  if (status.status !== 'error') {
    return null;
  }

  const isPortConflict = status.error?.includes('already in use');
  const errorTitle = isPortConflict ? 'Port Conflict' : 'Server Error';
  const errorDescription = isPortConflict
    ? `Port ${status.port} is already in use by another application.`
    : status.error || 'An unknown error occurred.';
  const suggestion = isPortConflict
    ? 'Change the port in settings or close the application using this port.'
    : 'Try restarting the server or check the logs for more details.';

  return (
    <div className="border-b border-red-500/20 bg-red-500/10">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{errorTitle}</p>
            <p className="text-xs text-muted-foreground">{errorDescription}</p>
            <p className="text-xs text-muted-foreground mt-1">{suggestion}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPortConflict ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              className="text-xs"
            >
              <Settings className="mr-1 h-3 w-3" />
              Change Port
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="text-xs"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
