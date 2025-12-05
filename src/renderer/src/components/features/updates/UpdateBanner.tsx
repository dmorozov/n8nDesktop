import { useState, useEffect } from 'react';
import { Download, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  mandatory: boolean;
}

interface UpdateBannerProps {
  updateInfo: UpdateInfo | null;
  onDismiss: () => void;
  onDownload: () => void;
}

export function UpdateBanner({ updateInfo, onDismiss, onDownload }: UpdateBannerProps) {
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset state when update info changes
  useEffect(() => {
    setShowReleaseNotes(false);
    setIsDownloading(false);
  }, [updateInfo?.version]);

  if (!updateInfo) {
    return null;
  }

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="border-b border-blue-500/20 bg-blue-500/10">
      {/* Main Banner */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
            <Download className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              A new version is available: v{updateInfo.version}
            </p>
            <p className="text-xs text-muted-foreground">
              Released on {formatDate(updateInfo.releaseDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReleaseNotes(!showReleaseNotes)}
            className="text-xs"
          >
            {showReleaseNotes ? (
              <>
                <ChevronUp className="mr-1 h-3 w-3" />
                Hide Notes
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3 w-3" />
                Release Notes
              </>
            )}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isDownloading ? 'Opening...' : 'Download'}
          </Button>
          {!updateInfo.mandatory && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>

      {/* Release Notes Expansion */}
      {showReleaseNotes && (
        <div className="border-t border-blue-500/20 px-4 py-3">
          <h4 className="mb-2 text-sm font-medium text-foreground">
            What&apos;s New in v{updateInfo.version}
          </h4>
          <div className="prose prose-sm prose-invert max-h-40 overflow-y-auto text-sm text-muted-foreground">
            <pre className="whitespace-pre-wrap font-sans">
              {updateInfo.releaseNotes || 'No release notes available.'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
