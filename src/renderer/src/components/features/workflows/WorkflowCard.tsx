import { useCallback, type KeyboardEvent } from 'react';
import { Play, MoreVertical, Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import type { Workflow } from '@/stores/workflows';

interface WorkflowCardProps {
  workflow: Workflow;
  onRun?: (workflow: Workflow) => void;
  onEdit?: (workflow: Workflow) => void;
  onDuplicate?: (workflow: Workflow) => void;
  onDelete?: (workflow: Workflow) => void;
  onExport?: (workflow: Workflow) => void;
  isRunning?: boolean;
}

export function WorkflowCard({
  workflow,
  onRun,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
  isRunning = false,
}: WorkflowCardProps) {
  const nodeCount = workflow.nodes?.length ?? 0;
  const hasAINodes = checkForAINodes(workflow);
  const displayName = workflow.name || 'Untitled Workflow';
  const displayDescription = workflow.description || 'No description';

  // Handle keyboard interaction - Enter to edit, Space to run
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          onEdit?.(workflow);
          break;
        case ' ':
          event.preventDefault();
          if (!isRunning) {
            onRun?.(workflow);
          }
          break;
      }
    },
    [workflow, onEdit, onRun, isRunning]
  );

  return (
    <Card
      className="group relative overflow-hidden transition-all hover:border-primary/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
      tabIndex={0}
      role="article"
      aria-label={`Workflow: ${displayName}. ${workflow.active ? 'Active' : 'Inactive'}. ${nodeCount} nodes. Press Enter to edit, Space to run.`}
      onKeyDown={handleKeyDown}
      onClick={() => onEdit?.(workflow)}
    >
      <CardContent className="p-4">
        {/* Header: Name and Menu */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="truncate text-sm font-medium text-foreground">
                    {truncate(displayName, 30)}
                  </h3>
                </TooltipTrigger>
                {displayName.length > 30 && (
                  <TooltipContent>
                    <p>{displayName}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {truncate(displayDescription, 50)}
                  </p>
                </TooltipTrigger>
                {displayDescription.length > 50 && (
                  <TooltipContent>
                    <p className="max-w-xs">{displayDescription}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Context Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                onClick={(e) => e.stopPropagation()}
                aria-label="Workflow options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(workflow); }}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate?.(workflow); }}>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExport?.(workflow); }}>
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete?.(workflow); }}
                className="text-destructive focus:text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status and Info Row */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={workflow.active ? 'success' : 'secondary'}>
            {workflow.active ? 'Active' : 'Inactive'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {nodeCount} node{nodeCount !== 1 ? 's' : ''}
          </span>
          {hasAINodes && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Cpu className="h-3 w-3" />
              AI
            </span>
          )}
        </div>

        {/* Footer: Last Modified and Run Button */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(workflow.updatedAt)}
          </span>
          <Button
            size="sm"
            variant={isRunning ? 'secondary' : 'default'}
            onClick={(e) => {
              e.stopPropagation();
              onRun?.(workflow);
            }}
            disabled={isRunning}
            className="h-7 px-3"
            aria-label={isRunning ? 'Workflow is running' : 'Run workflow'}
          >
            <Play className={cn('mr-1 h-3 w-3', isRunning && 'animate-pulse')} />
            {isRunning ? 'Running...' : 'Run'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Check if a workflow contains AI-related nodes
 */
function checkForAINodes(workflow: Workflow): boolean {
  const aiNodeTypes = [
    'n8n-nodes-base.openAi',
    'n8n-nodes-base.anthropic',
    '@n8n/n8n-nodes-langchain',
    'openAi',
    'anthropic',
    'langchain',
  ];

  return (workflow.nodes as Array<{ type?: string }> | undefined)?.some((node) =>
    node.type && aiNodeTypes.some((aiType) => node.type?.toLowerCase().includes(aiType.toLowerCase()))
  ) ?? false;
}
