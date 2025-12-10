import { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { Search, LayoutGrid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { WorkflowHorizontalList } from '@/components/features/workflows/WorkflowHorizontalList';
import { CreateWorkflowSection } from '@/components/features/workflows/CreateWorkflowSection';
import { EmptyWorkflowsState } from '@/components/features/workflows/EmptyWorkflowsState';
import { DeleteConfirmDialog } from '@/components/features/workflows/DeleteConfirmDialog';
import { WorkflowCardSkeleton } from '@/components/ui/loading-spinner';
import {
  $workflows,
  $workflowFilter,
  $workflowSearch,
  $workflowCounts,
  $runningExecutions,
  $isLoadingWorkflows,
  setWorkflowFilter,
  setWorkflowSearch,
  removeWorkflow,
  addWorkflow,
  startExecution,
  stopExecution,
  loadWorkflows,
  type Workflow,
  type WorkflowStatusFilter,
} from '@/stores/workflows';
import { $n8nReady } from '@/stores/n8n';
import { openEditor } from '@/stores/editor';

type ViewMode = 'grid' | 'list';

export function HomePage() {
  const workflows = useStore($workflows);
  const filter = useStore($workflowFilter);
  const search = useStore($workflowSearch);
  const counts = useStore($workflowCounts);
  const runningExecutions = useStore($runningExecutions);
  const isLoading = useStore($isLoadingWorkflows);
  const n8nReady = useStore($n8nReady);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load workflows when n8n is ready or on mount if already ready
  useEffect(() => {
    if (n8nReady) {
      loadWorkflows();
    }
  }, [n8nReady]);

  // Compute running workflow IDs
  const runningWorkflowIds = useMemo(() => {
    return new Set(
      runningExecutions
        .filter((e) => e.status === 'running')
        .map((e) => e.workflowId)
    );
  }, [runningExecutions]);

  // Filter workflows based on search and status filter
  const filteredWorkflows = useMemo(() => {
    let result = workflows;

    // Apply status filter
    if (filter === 'active') {
      result = result.filter((w) => w.active);
    } else if (filter === 'inactive') {
      result = result.filter((w) => !w.active);
    }

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(searchLower) ||
          (w.description?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    return result;
  }, [workflows, filter, search]);

  // Get count for current filter
  const getFilteredCount = () => {
    if (filter === 'all') return counts.total;
    if (filter === 'active') return counts.active;
    return counts.inactive;
  };

  // Handlers
  const handleSearchChange = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    setWorkflowSearch(target.value);
  };

  const handleFilterChange = (value: string) => {
    setWorkflowFilter(value as WorkflowStatusFilter);
  };

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
        // Add to recent
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
      await openEditor(workflow.id);
      await window.electron.workflows.addRecent(workflow.id);
    } catch (error) {
      console.error('Error opening editor:', error);
    }
  }, []);

  const handleDuplicate = useCallback(async (workflow: Workflow) => {
    try {
      const result = await window.electron.workflows.duplicate(workflow.id);
      if (result.success && result.data) {
        // Add duplicated workflow to store
        addWorkflow(result.data as Workflow);
        // Open the editor with the duplicated workflow
        await openEditor(result.data.id);
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
      // Get the full workflow data
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

      // Export the workflow
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

  const handleCreateNew = useCallback(async () => {
    try {
      const result = await window.electron.workflows.create({
        name: 'New Workflow',
        nodes: [],
        connections: {},
      });

      if (result.success && result.data) {
        addWorkflow(result.data as Workflow);
        await openEditor(result.data.id);
        await window.electron.workflows.addRecent(result.data.id);
      } else {
        // Show error message to user
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Create Workflow Error',
          message: 'Failed to create new workflow',
          detail: result.error || 'Make sure the n8n server is running.',
        });
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
      await window.electron.dialog.showMessage({
        type: 'error',
        title: 'Create Workflow Error',
        message: 'Failed to create new workflow',
        detail: error instanceof Error ? error.message : 'Make sure the n8n server is running.',
      });
    }
  }, []);

  const handleImport = useCallback(async () => {
    try {
      const result = await window.electron.workflows.import();

      if (result.canceled) {
        return;
      }

      if (result.success && result.data) {
        // Create workflow from imported data
        const createResult = await window.electron.workflows.create({
          name: result.data.name,
          description: result.data.description,
          nodes: result.data.nodes || [],
          connections: result.data.connections || {},
        });

        if (createResult.success && createResult.data) {
          addWorkflow(createResult.data as Workflow);
          await openEditor(createResult.data.id);
        }
      } else {
        await window.electron.dialog.showMessage({
          type: 'error',
          title: 'Import Error',
          message: 'Failed to import workflow',
          detail: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      console.error('Error importing workflow:', error);
    }
  }, []);

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    console.log('handleSelectTemplate called with templateId:', templateId);
    try {
      console.log('Getting templates...');
      const templates = await window.electron.workflows.getTemplates();
      console.log('Templates received:', templates?.length);
      const template = templates.find((t) => t.id === templateId);

      if (!template) {
        console.error('Template not found:', templateId);
        return;
      }

      console.log('Creating workflow from template:', template.name);
      const result = await window.electron.workflows.create({
        name: template.workflow.name || template.name,
        nodes: template.workflow.nodes || [],
        connections: template.workflow.connections || {},
        settings: template.workflow.settings || {},
      });

      console.log('Workflow create result:', result);
      if (result.success && result.data) {
        console.log('Adding workflow to store...');
        addWorkflow(result.data as Workflow);
        console.log('Opening editor...');
        try {
          await openEditor(result.data.id);
          console.log('Editor opened successfully');
        } catch (editorError) {
          console.error('Error opening editor:', editorError);
        }
        console.log('Adding to recent...');
        try {
          await window.electron.workflows.addRecent(result.data.id);
          console.log('Added to recent');
        } catch (recentError) {
          console.error('Error adding to recent:', recentError);
        }
      }
    } catch (error) {
      console.error('Error creating workflow from template:', error);
    }
  }, []);

  // Show loading skeleton while loading
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">Workflows</h1>
          </div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[280px]">
              <WorkflowCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show empty state when there are no workflows
  if (workflows.length === 0) {
    return (
      <>
        <EmptyWorkflowsState
          onCreateNew={handleCreateNew}
          onImport={handleImport}
          onSelectTemplate={handleSelectTemplate}
        />
        {/* Delete Confirmation Dialog - keep it mounted for consistency */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          workflowName={workflowToDelete?.name || ''}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          isLoading={isDeleting}
        />
      </>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Existing Workflows Section */}
      <div>
        {/* Header with toolbar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Your Workflows</h2>
            <Badge variant="secondary">{getFilteredCount()}</Badge>
          </div>
        </div>

        {/* Toolbar: Search, Filter, View Toggle */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search workflows..."
              value={search}
              onInput={handleSearchChange}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <Select value={filter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({counts.total})</SelectItem>
              <SelectItem value="active">Active ({counts.active})</SelectItem>
              <SelectItem value="inactive">Inactive ({counts.inactive})</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex items-center rounded-md border border-input">
            <Toggle
              pressed={viewMode === 'grid'}
              onPressedChange={() => setViewMode('grid')}
              size="sm"
              className="rounded-r-none border-0"
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Toggle>
            <Toggle
              pressed={viewMode === 'list'}
              onPressedChange={() => setViewMode('list')}
              size="sm"
              className="rounded-l-none border-0"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Toggle>
          </div>
        </div>

        {/* Workflow Display - Horizontal scrollable */}
        {filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">
              No workflows match your search or filter criteria.
            </p>
            <Button
              variant="link"
              onClick={() => {
                setWorkflowSearch('');
                setWorkflowFilter('all');
              }}
              className="mt-2"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <WorkflowHorizontalList
            workflows={filteredWorkflows}
            runningWorkflowIds={runningWorkflowIds}
            onRun={handleRun}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onExport={handleExport}
            viewMode={viewMode}
          />
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-border" />

      {/* Create New Workflow Section */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Create New</h2>
        <CreateWorkflowSection
          onCreateNew={handleCreateNew}
          onImport={handleImport}
          onSelectTemplate={handleSelectTemplate}
        />
      </div>

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
