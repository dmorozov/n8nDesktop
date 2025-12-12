/**
 * WorkflowExecutionPopup Component
 *
 * Main popup component for workflow execution.
 * Three-panel layout: Input (left), Indicator (center), Output (right).
 *
 * Feature: 010-workflow-execution-popup
 * FR-001, FR-002, FR-003, FR-004, FR-005
 */

import { useCallback, useEffect, useRef } from 'react';
import { X, ExternalLink, Play, Square, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';
import { InputPanel } from './InputPanel';
import { OutputPanel } from './OutputPanel';
import { CenterIndicator, type ExecutionStatus } from './CenterIndicator';
import { PopupErrorBoundary } from './ErrorBoundary';

interface WorkflowExecutionPopupProps {
  workflowId: string | null;
  workflowName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditWorkflow?: (workflowId: string) => void;
}

export function WorkflowExecutionPopup({
  workflowId,
  workflowName,
  open,
  onOpenChange,
  onEditWorkflow,
}: WorkflowExecutionPopupProps) {
  const firstInputRef = useRef<HTMLTextAreaElement>(null);

  const {
    isLoading,
    isExecuting,
    canExecute,
    analysis,
    inputs,
    results,
    error,
    executionProgress,
    updateInput,
    execute,
    cancel,
    saveConfig,
    selectFiles,
    cleanup,
  } = useWorkflowExecution(open ? workflowId : null);

  // Debug logging
  console.log(`[WorkflowExecutionPopup] ========== RENDER ==========`);
  console.log(`[WorkflowExecutionPopup] workflowId: ${workflowId}, open: ${open}`);
  console.log(`[WorkflowExecutionPopup] isLoading: ${isLoading}`);
  console.log(`[WorkflowExecutionPopup] inputs keys:`, Object.keys(inputs));
  console.log(`[WorkflowExecutionPopup] inputs count: ${Object.keys(inputs).length}`);
  console.log(`[WorkflowExecutionPopup] analysis:`, analysis);

  // Focus first input when popup opens (FR-001e)
  useEffect(() => {
    if (open && !isLoading) {
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [open, isLoading]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      cleanup();
    }
  }, [open, cleanup]);

  // Handle close with confirmation if executing (FR-001b, FR-001c)
  const handleClose = useCallback(async () => {
    if (isExecuting) {
      const result = await window.electron.dialog.showMessage({
        type: 'question',
        title: 'Execution in Progress',
        message: 'Workflow is still running. Do you want to close anyway?',
        detail: 'The execution will continue in the background.',
        buttons: ['Close', 'Cancel'],
      });

      if (result.response === 1) {
        return; // User cancelled
      }
    }

    // Save config before closing
    await saveConfig();
    onOpenChange(false);
  }, [isExecuting, saveConfig, onOpenChange]);

  // Handle Edit Workflow (FR-005)
  const handleEditWorkflow = useCallback(async () => {
    if (workflowId && onEditWorkflow) {
      await handleClose();
      onEditWorkflow(workflowId);
    }
  }, [workflowId, onEditWorkflow, handleClose]);

  // Handle Execute button click
  const handleExecute = useCallback(() => {
    if (canExecute) {
      execute();
    }
  }, [canExecute, execute]);

  // Handle Cancel button click (FR-003a)
  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  // Handle keyboard navigation (T047)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Enter to execute (FR-001e)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canExecute && !isExecuting) {
        e.preventDefault();
        execute();
      }
    },
    [canExecute, isExecuting, execute]
  );

  // Reset error boundary handler
  const handleErrorReset = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Map execution state to status
  const getStatus = (): ExecutionStatus => {
    if (isLoading) return 'idle';
    if (isExecuting) return 'running';
    if (error) {
      if (error.includes('timed out')) return 'timeout';
      return 'failed';
    }
    if (results.length > 0) return 'completed';
    return 'idle';
  };

  const status = getStatus();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          // Responsive sizing (FR-001a)
          'w-[80vw] h-[80vh]',
          'min-w-[600px] min-h-[400px]',
          'max-w-[1400px] max-h-[900px]',
          'flex flex-col p-0 gap-0'
        )}
        onKeyDown={handleKeyDown}
        data-testid="workflow-popup"
      >
        <PopupErrorBoundary onReset={handleErrorReset}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              {workflowName || analysis?.workflowName || 'Workflow Execution'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit Workflow Button (FR-005) */}
            {onEditWorkflow && workflowId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleEditWorkflow}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Edit Workflow
              </Button>
            )}

            {/* Close Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Main Content - Three Panel Layout (FR-002) */}
        <main className="flex flex-1 min-h-0 overflow-hidden">
          {/* Loading Skeleton (FR-004c) */}
          {isLoading ? (
            <div className="flex items-center justify-center w-full">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading workflow...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Input Panel - Left ~40% */}
              <InputPanel
                inputs={inputs}
                disabled={isExecuting}
                onInputChange={updateInput}
                onSelectFiles={selectFiles}
                className="w-[40%] min-w-[200px]"
              />

              {/* Center Indicator - Fixed 100px (FR-015, FR-016) */}
              <CenterIndicator
                status={status}
                progress={executionProgress}
              />

              {/* Output Panel - Right flex */}
              <OutputPanel
                results={results}
                error={error}
                status={status}
                className="flex-1 min-w-[200px]"
              />
            </>
          )}
        </main>

        {/* Footer with Execute/Cancel Button (FR-003, FR-003a) */}
        <footer className="flex items-center justify-end gap-3 px-4 py-3 border-t">
          {isExecuting ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
            >
              <Square className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleExecute}
              disabled={!canExecute || isLoading}
              title="Ctrl+Enter to execute"
            >
              <Play className="mr-2 h-4 w-4" />
              Execute
            </Button>
          )}
        </footer>
        </PopupErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
