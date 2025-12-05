import { AlertTriangle, FolderOpen, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataFolderWarningBannerProps {
  dataFolder: string;
  errorType: 'not_found' | 'not_writable' | 'permission_denied';
  onOpenSettings: () => void;
  onSelectFolder: () => void;
}

export function DataFolderWarningBanner({
  dataFolder,
  errorType,
  onOpenSettings,
  onSelectFolder,
}: DataFolderWarningBannerProps) {
  const getErrorDetails = () => {
    switch (errorType) {
      case 'not_found':
        return {
          title: 'Data Folder Not Found',
          message: `The configured data folder "${dataFolder}" does not exist or has been removed.`,
          suggestion: 'Select a new data folder location or create the folder manually.',
        };
      case 'not_writable':
        return {
          title: 'Data Folder Not Writable',
          message: `Cannot write to the data folder "${dataFolder}".`,
          suggestion: 'Check folder permissions or select a different folder.',
        };
      case 'permission_denied':
        return {
          title: 'Permission Denied',
          message: `Access denied to the data folder "${dataFolder}".`,
          suggestion: 'Run the application with appropriate permissions or select a different folder.',
        };
      default:
        return {
          title: 'Data Folder Issue',
          message: `There is a problem with the data folder "${dataFolder}".`,
          suggestion: 'Select a different folder in settings.',
        };
    }
  };

  const { title, message, suggestion } = getErrorDetails();

  return (
    <div className="border-b border-yellow-500/20 bg-yellow-500/10">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground mt-1">{suggestion}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectFolder}
            className="text-xs"
          >
            <FolderOpen className="mr-1 h-3 w-3" />
            Select Folder
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            className="text-xs"
          >
            <Settings className="mr-1 h-3 w-3" />
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
