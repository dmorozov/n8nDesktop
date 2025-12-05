import { Play, MoreVertical, Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface WorkflowListViewProps {
  workflows: Workflow[];
  runningWorkflowIds?: Set<string>;
  onRun?: (workflow: Workflow) => void;
  onEdit?: (workflow: Workflow) => void;
  onDuplicate?: (workflow: Workflow) => void;
  onDelete?: (workflow: Workflow) => void;
  onExport?: (workflow: Workflow) => void;
}

export function WorkflowListView({
  workflows,
  runningWorkflowIds = new Set(),
  onRun,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
}: WorkflowListViewProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Description
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              AI Service
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Last Modified
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {workflows.map((workflow) => {
            const isRunning = runningWorkflowIds.has(workflow.id);
            const hasAINodes = checkForAINodes(workflow);
            const displayName = workflow.name || 'Untitled Workflow';
            const displayDescription = workflow.description || 'No description';

            return (
              <tr
                key={workflow.id}
                className="group transition-colors hover:bg-muted/30"
              >
                {/* Name */}
                <td className="px-4 py-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium text-foreground">
                          {truncate(displayName, 25)}
                        </span>
                      </TooltipTrigger>
                      {displayName.length > 25 && (
                        <TooltipContent>
                          <p>{displayName}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </td>

                {/* Description */}
                <td className="px-4 py-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm text-muted-foreground">
                          {truncate(displayDescription, 40)}
                        </span>
                      </TooltipTrigger>
                      {displayDescription.length > 40 && (
                        <TooltipContent>
                          <p className="max-w-xs">{displayDescription}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <Badge variant={workflow.active ? 'success' : 'secondary'}>
                    {workflow.active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>

                {/* AI Service */}
                <td className="px-4 py-3">
                  {hasAINodes ? (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Cpu className="h-3 w-3" />
                      AI Enabled
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>

                {/* Last Modified */}
                <td className="px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    {formatRelativeTime(workflow.updatedAt)}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant={isRunning ? 'secondary' : 'default'}
                      onClick={() => onRun?.(workflow)}
                      disabled={isRunning}
                      className="h-7 px-3"
                    >
                      <Play className={cn('mr-1 h-3 w-3', isRunning && 'animate-pulse')} />
                      {isRunning ? 'Running' : 'Run'}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit?.(workflow)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate?.(workflow)}>
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExport?.(workflow)}>
                          Export
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete?.(workflow)}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function checkForAINodes(workflow: Workflow): boolean {
  const aiNodeTypes = [
    'n8n-nodes-base.openAi',
    'n8n-nodes-base.anthropic',
    '@n8n/n8n-nodes-langchain',
    'openAi',
    'anthropic',
    'langchain',
  ];

  return workflow.nodes?.some((node: { type?: string }) =>
    node.type && aiNodeTypes.some((aiType) => node.type?.toLowerCase().includes(aiType.toLowerCase()))
  ) ?? false;
}
