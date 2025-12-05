import { useState } from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ImportedWorkflowData {
  name: string;
  description?: string;
  nodes?: unknown[];
  fileName: string;
  filePath: string;
}

interface ImportConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowData: ImportedWorkflowData | null;
  existingWorkflow?: { id: string; name: string } | null;
  onConfirm: (overrideExisting: boolean) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ImportConfirmDialog({
  open,
  onOpenChange,
  workflowData,
  existingWorkflow,
  onConfirm,
  onCancel,
  isLoading = false,
}: ImportConfirmDialogProps) {
  const [overrideExisting, setOverrideExisting] = useState(false);

  if (!workflowData) return null;

  const nodeCount = workflowData.nodes?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Import Workflow
          </DialogTitle>
          <DialogDescription>
            Review the workflow details before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Workflow Info */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{workflowData.name}</span>
            </div>
            {workflowData.description && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Description</span>
                <span className="text-sm text-right max-w-[200px] truncate">
                  {workflowData.description}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nodes</span>
              <span className="text-sm font-medium">{nodeCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">File</span>
              <span className="text-sm text-right max-w-[200px] truncate text-muted-foreground">
                {workflowData.fileName}
              </span>
            </div>
          </div>

          {/* Existing Workflow Warning */}
          {existingWorkflow && (
            <div className="rounded-lg border border-status-warning/50 bg-status-warning/10 p-4 space-y-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-status-warning">
                    Existing workflow found
                  </p>
                  <p className="text-muted-foreground mt-1">
                    A workflow named "{existingWorkflow.name}" already exists.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="override-existing" className="text-sm">
                  Override existing workflow
                </Label>
                <Switch
                  id="override-existing"
                  checked={overrideExisting}
                  onCheckedChange={setOverrideExisting}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(overrideExisting)} disabled={isLoading}>
            {isLoading ? 'Importing...' : 'Import Workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
