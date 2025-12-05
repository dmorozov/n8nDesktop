import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteAIServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeleteAIServiceDialog({
  open,
  onOpenChange,
  serviceName,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteAIServiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            Delete AI Service
          </DialogTitle>
          <DialogDescription className="pt-2">
            Are you sure you want to delete <strong>"{serviceName}"</strong>? This action cannot be
            undone. Workflows using this service may stop working.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Delete Service'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
