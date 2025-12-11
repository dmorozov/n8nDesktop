import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkflowCard } from './WorkflowCard';
import type { Workflow } from '@/stores/workflows';

interface WorkflowHorizontalListProps {
  workflows: Workflow[];
  runningWorkflowIds?: Set<string>;
  onRun?: (workflow: Workflow) => void;
  onEdit?: (workflow: Workflow) => void;
  onOpenPopup?: (workflow: Workflow) => void;
  onDuplicate?: (workflow: Workflow) => void;
  onDelete?: (workflow: Workflow) => void;
  onExport?: (workflow: Workflow) => void;
  viewMode?: 'grid' | 'list';
}

export function WorkflowHorizontalList({
  workflows,
  runningWorkflowIds = new Set(),
  onRun,
  onEdit,
  onOpenPopup,
  onDuplicate,
  onDelete,
  onExport,
  viewMode = 'grid',
}: WorkflowHorizontalListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (workflows.length === 0) {
    return null;
  }

  if (viewMode === 'list') {
    // Compact list view - show as horizontal scrollable table row
    return (
      <div className="relative group">
        {/* Scroll buttons */}
        {workflows.length > 2 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hidden"
        >
          {workflows.map((workflow, index) => (
            <div
              key={workflow.id || `workflow-list-${index}`}
              className="flex-shrink-0 w-[280px] border rounded-lg p-3 bg-card hover:border-primary/50 cursor-pointer transition-colors"
              onClick={() => onEdit?.(workflow)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium truncate">{workflow.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {workflow.active ? 'Active' : 'Inactive'} · {workflow.nodes?.length ?? 0} nodes
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2 h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRun?.(workflow);
                  }}
                  disabled={runningWorkflowIds.has(workflow.id)}
                >
                  {runningWorkflowIds.has(workflow.id) ? 'Running' : 'Run'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Card view - horizontal scrollable cards
  return (
    <div className="relative group">
      {/* Scroll buttons */}
      {workflows.length > 3 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hidden"
      >
        {workflows.map((workflow, index) => (
          <div key={workflow.id || `workflow-${index}`} className="flex-shrink-0 w-[280px]">
            <WorkflowCard
              workflow={workflow}
              isRunning={runningWorkflowIds.has(workflow.id)}
              onRun={onRun}
              onEdit={onEdit}
              onOpenPopup={onOpenPopup}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onExport={onExport}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
