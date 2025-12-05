import { useState, useCallback, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WorkflowGrid } from '@/components/features/workflows/WorkflowGrid';
import { DeleteConfirmDialog } from '@/components/features/workflows/DeleteConfirmDialog';
import {
  $workflows,
  $runningExecutions,
  addWorkflow,
  removeWorkflow,
  startExecution,
  stopExecution,
  type Workflow,
} from '@/stores/workflows';

export function RecentPage() {
  // For now, show all workflows sorted by updatedAt
  // In a full implementation, this would use a separate recent workflows list
  const workflows = useStore($workflows);
  const runningExecutions = useStore($runningExecutions);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const recentWorkflows = [...workflows].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  }).slice(0, 10);

  // Compute running workflow IDs
  const runningWorkflowIds = useMemo(() => {
    return new Set(
      runningExecutions
        .filter((e) => e.status === 'running')
        .map((e) => e.workflowId)
    );
  }, [runningExecutions]);

  const handleRun = useCallback(async (workflow: Workflow) => {
    // Check if already running
    if (runningWorkflowIds.has(workflow.id)) {
      // Stop the execution
      const execution = runningExecutions.find(
        (e) => e.workflowId === workflow.id && e.status === 'running'
      );
      if (execution) {
        try {
          await window.electron.workflows.stopExecution(execution.id);
          stopExecution(execution.id);
        } catch (error) {
          console.error('Error stopping execution:', error);
        }
      }
      return;
    }

    // Start execution
    try {
      const result = await window.electron.workflows.execute(workflow.id);
      if (result.success && result.executionId) {
        startExecution(workflow.id, result.executionId);
        await window.electron.workflows.addRecent(workflow.id);
      } else {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Execution Error',
          message: 'Failed to start workflow execution',
          detail: result.error,
        });
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      await window.electron.dialog.showMessage({
        type: 'error',
        title: 'Execution Error',
        message: 'Failed to execute workflow',
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [runningWorkflowIds, runningExecutions]);

  const handleEdit = useCallback(async (workflow: Workflow) => {
    try {
      await window.electron.editor.open(workflow.id);
      await window.electron.workflows.addRecent(workflow.id);
    } catch (error) {
      console.error('Error opening editor:', error);
    }
  }, []);

  const handleDuplicate = useCallback(async (workflow: Workflow) => {
    try {
      const result = await window.electron.workflows.duplicate(workflow.id);
      if (result.success && result.data) {
        addWorkflow(result.data as Workflow);
        await window.electron.editor.open(result.data.id);
      } else {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Duplicate Error',
          message: 'Failed to duplicate workflow',
          detail: result.error,
        });
      }
    } catch (error) {
      console.error('Error duplicating workflow:', error);
    }
  }, []);

  const handleDelete = useCallback((workflow: Workflow) => {
    setWorkflowToDelete(workflow);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!workflowToDelete) return;

    setIsDeleting(true);
    try {
      const result = await window.electron.workflows.delete(workflowToDelete.id);
      if (result.success) {
        removeWorkflow(workflowToDelete.id);
        setDeleteDialogOpen(false);
        setWorkflowToDelete(null);
      } else {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Delete Error',
          message: 'Failed to delete workflow',
          detail: result.error,
        });
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [workflowToDelete]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setWorkflowToDelete(null);
  }, []);

  const handleExport = useCallback(async (workflow: Workflow) => {
    try {
      const workflowResult = await window.electron.workflows.get(workflow.id);
      if (!workflowResult.success || !workflowResult.data) {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Export Error',
          message: 'Failed to get workflow data',
          detail: workflowResult.error,
        });
        return;
      }

      const result = await window.electron.workflows.export(
        workflowResult.data,
        workflow.name
      );

      if (result.success && result.path) {
        await window.electron.dialog.showMessage({
          type: 'info',
          title: 'Export Successful',
          message: 'Workflow exported successfully',
          detail: `Saved to: ${result.path}`,
        });
      } else if (!result.canceled) {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Export Error',
          message: 'Failed to export workflow',
          detail: result.error,
        });
      }
    } catch (error) {
      console.error('Error exporting workflow:', error);
    }
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Clock className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Recent Workflows</h1>
        <Badge variant="secondary">{recentWorkflows.length}</Badge>
      </div>

      {/* Content */}
      {recentWorkflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No recently opened workflows</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Workflows you open will appear here for quick access
          </p>
        </div>
      ) : (
        <WorkflowGrid
          workflows={recentWorkflows}
          runningWorkflowIds={runningWorkflowIds}
          onRun={handleRun}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onExport={handleExport}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        workflowName={workflowToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
