/**
 * CenterIndicator Component
 *
 * Visual indicator in the center of the popup showing workflow status.
 * Displays n8n logo and animates during execution.
 *
 * Feature: 010-workflow-execution-popup
 * FR-015, FR-016
 */

import { Loader2, Workflow, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'timeout';

interface CenterIndicatorProps {
  status: ExecutionStatus;
  progress?: number;
  className?: string;
}

export function CenterIndicator({ status, progress = 0, className }: CenterIndicatorProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center w-[100px] min-w-[100px] border-x border-border bg-muted/30',
        status === 'running' && 'animate-pulse',
        className
      )}
      data-testid="center-indicator"
    >
      {/* Status Icon */}
      <div className="relative">
        {status === 'idle' && (
          <Workflow className="h-12 w-12 text-muted-foreground" />
        )}

        {status === 'running' && (
          <div className="relative">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            {progress > 0 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary">
                {Math.round(progress)}%
              </span>
            )}
          </div>
        )}

        {status === 'completed' && (
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        )}

        {status === 'failed' && (
          <XCircle className="h-12 w-12 text-destructive" />
        )}

        {status === 'timeout' && (
          <Clock className="h-12 w-12 text-amber-500" />
        )}
      </div>

      {/* Status Label */}
      <span className="mt-2 text-xs text-muted-foreground text-center">
        {status === 'idle' && 'Ready'}
        {status === 'running' && 'Running...'}
        {status === 'completed' && 'Complete'}
        {status === 'failed' && 'Failed'}
        {status === 'timeout' && 'Timeout'}
      </span>
    </div>
  );
}
