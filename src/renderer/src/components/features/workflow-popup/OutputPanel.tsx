/**
 * OutputPanel Component
 *
 * Right panel of the popup showing execution results.
 * Displays markdown content and file download buttons.
 *
 * Feature: 010-workflow-execution-popup
 * FR-011, FR-012, FR-013, FR-014
 */

import { useCallback, useMemo } from 'react';
import { Download, FileText, AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkflowPopupOutputResult } from '../../../../../preload/types';

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

function OutputResultItem({ result, onDownload, testId }: OutputResultItemProps) {
  // Simple markdown to HTML conversion (FR-011)
  // Note: For production, use a proper markdown library with XSS sanitization (FR-011a)
  const renderedContent = useMemo(() => {
    if (result.contentType === 'file') {
      return null;
    }

    // Basic markdown conversion (safe subset)
    let html = result.content
      // Escape HTML first to prevent XSS (FR-011a)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Then apply markdown
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$2</li>')
      .replace(/\n\n/g, '</p><p class="my-2">')
      .replace(/\n/g, '<br />');

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<h') && !html.startsWith('<li')) {
      html = `<p class="my-2">${html}</p>`;
    }

    return html;
  }, [result.content, result.contentType]);

  if (result.contentType === 'file' && result.fileReference) {
    return (
      <div className="flex items-center justify-between gap-2 p-3 rounded-md border bg-card" data-testid={testId}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{result.fileReference.name}</p>
            <p className="text-xs text-muted-foreground">{result.nodeName}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onDownload(result)}
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-md border bg-card" data-testid={testId}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3 w-3" />
        {result.nodeName}
      </div>
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        // Safe because we escaped HTML first
        dangerouslySetInnerHTML={{ __html: renderedContent || '' }}
      />
    </div>
  );
}
