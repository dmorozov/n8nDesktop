/**
 * OutputPanel Component
 *
 * Right panel of the popup showing execution results.
 * Displays markdown content and file download buttons.
 *
 * Feature: 010-workflow-execution-popup
 * FR-011, FR-012, FR-013, FR-014
 */

import { useCallback } from 'react';
import { Download, FileText, AlertCircle, Play, File, FileType, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkflowPopupOutputResult } from '../../../../../preload/types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface OutputPanelProps {
  results: WorkflowPopupOutputResult[];
  error: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'timeout';
  className?: string;
}

export function OutputPanel({ results, error, status, className }: OutputPanelProps) {
  // Handle file download
  const handleDownload = useCallback(async (result: WorkflowPopupOutputResult) => {
    if (!result.fileReference) return;

    try {
      const saveResult = await window.electron.workflowPopup.saveFile({
        title: 'Save File',
        defaultPath: result.fileReference.name,
      });

      if (!saveResult.cancelled && saveResult.filePath) {
        await window.electron.workflowPopup.copyOutputFile(
          result.fileReference.path,
          saveResult.filePath
        );
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  }, []);

  // Placeholder state (FR-014)
  if (status === 'idle' && results.length === 0 && !error) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-6 text-center', className)}>
        <Play className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          Run workflow to see results
        </p>
      </div>
    );
  }

  // Running state
  if (status === 'running') {
    return (
      <div className={cn('flex flex-col items-center justify-center p-6 text-center', className)}>
        <div className="animate-pulse">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        </div>
        <p className="text-sm text-muted-foreground">
          Processing workflow...
        </p>
      </div>
    );
  }

  // Error state (FR-014a, FR-014b)
  if (error) {
    const isUserError = error.includes('not found') || error.includes('not exist');
    const errorType = isUserError ? 'user' : 'system';

    return (
      <div className={cn('flex flex-col p-6', className)}>
        <div className="flex items-start gap-3 p-4 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-destructive">
              {errorType === 'user' ? 'Input Error' : 'Execution Failed'}
            </span>
            <p className="text-sm text-destructive/90">{error}</p>
            {errorType === 'system' && (
              <p className="text-xs text-muted-foreground mt-2">
                If this error persists, try restarting the n8n server.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Results display (FR-011, FR-012, FR-013)
  return (
    <div className={cn('flex flex-col gap-4 p-4 overflow-y-auto', className)} data-testid="output-panel">
      <h3 className="text-sm font-medium text-foreground">Results</h3>

      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Workflow completed but no output was generated.
        </p>
      ) : (
        results.map((result, index) => (
          <OutputResultItem
            key={`${result.nodeId}-${index}`}
            result={result}
            onDownload={handleDownload}
            testId={`output-result-${index}`}
          />
        ))
      )}
    </div>
  );
}

interface OutputResultItemProps {
  result: WorkflowPopupOutputResult;
  onDownload: (result: WorkflowPopupOutputResult) => void;
  testId?: string;
}

/**
 * Get icon for file type based on mime type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return Image;
  }
  if (mimeType === 'application/pdf') {
    return FileType;
  }
  return File;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function OutputResultItem({ result, onDownload, testId }: OutputResultItemProps) {
  // File output
  if (result.contentType === 'file' && result.fileReference) {
    const FileIcon = getFileIcon(result.fileReference.mimeType);

    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-card" data-testid={testId}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" title={result.fileReference.name}>
              {result.fileReference.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(result.fileReference.size)} • {result.nodeName}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onDownload(result)}
          className="flex-shrink-0"
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
    );
  }

  // Text/Markdown output - use react-markdown for proper rendering
  return (
    <div className="flex flex-col gap-2 p-3 rounded-md border bg-card" data-testid={testId}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3 w-3" />
        {result.nodeName}
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-pre:bg-muted prose-pre:p-3 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none">
        <Markdown remarkPlugins={[remarkGfm]}>
          {result.content}
        </Markdown>
      </div>
    </div>
  );
}
