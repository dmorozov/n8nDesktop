import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Download, RefreshCw, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LogViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogViewerDialog({ open, onOpenChange }: LogViewerDialogProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const result = await window.electron.n8n.getLogs(500);
      setLogs(result);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, []);

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
    await window.electron.n8n.clearLogs();
    setLogs([]);
  };

  const handleExportLogs = async () => {
    const logsContent = logs.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `n8n-logs-${timestamp}.txt`;

    const result = await window.electron.dialog.saveFile({
      title: 'Export Logs',
      defaultPath: filename,
      filters: [{ name: 'Text Files', extensions: ['txt', 'log'] }],
    });

    if (result.success && result.path) {
      // We need to write the file - using a simple approach via dialog
      // In a full implementation, we'd have an IPC handler for this
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
    }
  };

  const handleOpenLogFolder = async () => {
    const dataFolder = await window.electron.config.get('dataFolder');
    if (dataFolder) {
      await window.electron.shell.openPath(dataFolder);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Server Logs
          </DialogTitle>
          <DialogDescription>
            View n8n server logs and output.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
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
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenLogFolder}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              disabled={logs.length === 0}
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        {/* Logs Content */}
        <div className="h-[50vh] overflow-auto rounded-md border bg-muted/30 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {isLoading ? 'Loading logs...' : 'No logs available'}
            </div>
          ) : (
            <div className="p-4">
              {logs.map((line, index) => (
                <div
                  key={index}
                  className={`whitespace-pre-wrap break-all py-0.5 ${
                    line.includes('[ERROR]')
                      ? 'text-red-500'
                      : line.includes('[WARN]')
                      ? 'text-yellow-500'
                      : 'text-foreground'
                  }`}
                >
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{logs.length} log entries</span>
          {autoRefresh && <span>Auto-refreshing every 3 seconds</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
