/**
 * Docling Log Viewer Dialog (T083)
 *
 * Provides UI for viewing Docling service logs with trace_id filtering.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  FileText,
  Download,
  RefreshCw,
  Loader2,
  X,
  Search,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  $doclingLogs,
  refreshDoclingLogs,
  clearDoclingLogs,
} from '@/stores/docling';

interface DoclingLogViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTraceId?: string;
}

export function DoclingLogViewerDialog({
  open,
  onOpenChange,
  initialTraceId,
}: DoclingLogViewerDialogProps) {
  const logs = useStore($doclingLogs);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [traceIdFilter, setTraceIdFilter] = useState(initialTraceId || '');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      await refreshDoclingLogs(500, traceIdFilter || undefined);
    } catch (error) {
      console.error('Failed to fetch Docling logs:', error);
    }
  }, [traceIdFilter]);

  // Fetch logs when dialog opens and set up auto-refresh
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      fetchLogs().finally(() => setIsLoading(false));

      if (autoRefresh) {
        intervalRef.current = setInterval(fetchLogs, 3000);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [open, autoRefresh, fetchLogs]);

  // Update initial trace ID when prop changes
  useEffect(() => {
    if (initialTraceId) {
      setTraceIdFilter(initialTraceId);
    }
  }, [initialTraceId]);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchLogs();
    setIsLoading(false);
  };

  const handleClearLogs = async () => {
    await clearDoclingLogs();
  };

  const handleExportLogs = async () => {
    const logsContent = logs.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `docling-logs-${timestamp}.txt`;

    try {
      const blob = new Blob([logsContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => {
      const newValue = !prev;
      if (!newValue && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return newValue;
    });
  };

  const handleTraceIdFilterChange = (value: string) => {
    setTraceIdFilter(value);
  };

  const handleTraceIdFilterApply = () => {
    fetchLogs();
  };

  const handleClearFilter = () => {
    setTraceIdFilter('');
    // Will trigger re-fetch through useEffect dependency
  };

  // Parse log line to extract trace_id for highlighting
  const getLogLineClass = (line: string): string => {
    const baseClass = 'whitespace-pre-wrap break-all py-0.5';

    if (line.includes('"level":"error"') || line.includes('[ERROR]')) {
      return `${baseClass} text-red-500`;
    }
    if (line.includes('"level":"warn"') || line.includes('[WARN]')) {
      return `${baseClass} text-yellow-500`;
    }
    if (line.includes('"level":"debug"') || line.includes('[DEBUG]')) {
      return `${baseClass} text-muted-foreground`;
    }
    return `${baseClass} text-foreground`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-4xl"
        data-testid="docling-log-viewer-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Docling Service Logs
          </DialogTitle>
          <DialogDescription>
            View document processing logs. Filter by Trace ID to debug specific
            requests.
          </DialogDescription>
        </DialogHeader>

        {/* Trace ID Filter (T083) */}
        <div
          className="flex items-end gap-2"
          data-testid="docling-log-trace-filter"
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="traceIdFilter" className="text-sm">
              <Filter className="inline-block h-3 w-3 mr-1" />
              Filter by Trace ID
            </Label>
            <Input
              id="traceIdFilter"
              value={traceIdFilter}
              onChange={(e) => handleTraceIdFilterChange(e.target.value)}
              placeholder="Enter trace ID (e.g., abc123-def456)"
              className="font-mono text-sm"
              data-testid="docling-log-trace-input"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTraceIdFilterApply}
            data-testid="docling-log-trace-apply"
          >
            <Search className="mr-2 h-4 w-4" />
            Filter
          </Button>
          {traceIdFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilter}
              data-testid="docling-log-trace-clear"
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              data-testid="docling-log-refresh"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={toggleAutoRefresh}
              data-testid="docling-log-autorefresh"
            >
              {autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: OFF'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLogs}
              disabled={logs.length === 0}
              data-testid="docling-log-export"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              data-testid="docling-log-clear"
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        {/* Logs Content */}
        <div
          className="h-[50vh] overflow-auto rounded-md border bg-muted/30 font-mono text-xs"
          role="log"
          aria-live="polite"
          aria-label="Docling service logs"
          data-testid="docling-log-content"
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {isLoading
                ? 'Loading logs...'
                : traceIdFilter
                ? `No logs found for trace ID: ${traceIdFilter}`
                : 'No logs available'}
            </div>
          ) : (
            <div className="p-4">
              {logs.map((line, index) => (
                <div key={index} className={getLogLineClass(line)}>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {logs.length} log entries
            {traceIdFilter && ` (filtered by: ${traceIdFilter})`}
          </span>
          {autoRefresh && <span>Auto-refreshing every 3 seconds</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
