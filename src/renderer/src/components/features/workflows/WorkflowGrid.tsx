import { WorkflowCard } from './WorkflowCard';
import type { Workflow } from '@/stores/workflows';

interface WorkflowGridProps {
  workflows: Workflow[];
  runningWorkflowIds?: Set<string>;
  onRun?: (workflow: Workflow) => void;
  onEdit?: (workflow: Workflow) => void;
  onDuplicate?: (workflow: Workflow) => void;
  onDelete?: (workflow: Workflow) => void;
  onExport?: (workflow: Workflow) => void;
}

export function WorkflowGrid({
  workflows,
  runningWorkflowIds = new Set(),
  onRun,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
}: WorkflowGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {workflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          isRunning={runningWorkflowIds.has(workflow.id)}
          onRun={onRun}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onExport={onExport}
        />
      ))}
    </div>
  );
}
