/**
 * InputPanel Component
 *
 * Left panel of the popup showing input fields for workflow execution.
 * Displays PromptInput and FileSelector node inputs.
 *
 * Feature: 010-workflow-execution-popup
 * FR-006, FR-007, FR-008, FR-009, FR-010
 */

import { useCallback } from 'react';
import { FileText, Upload, X, File, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn, truncate } from '@/lib/utils';
import type {
  WorkflowPopupInputFieldConfig,
  WorkflowPopupFileReference,
} from '../../../../../preload/types';

interface InputPanelProps {
  inputs: Record<string, WorkflowPopupInputFieldConfig>;
  disabled?: boolean;
  onInputChange: (nodeId: string, value: string | WorkflowPopupFileReference[]) => void;
  onSelectFiles: (nodeId: string) => void;
  className?: string;
}

export function InputPanel({
  inputs,
  disabled = false,
  onInputChange,
  onSelectFiles,
  className,
}: InputPanelProps) {
  const inputList = Object.values(inputs);

  // Empty state (FR-007a)
  if (inputList.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-6 text-center', className)} data-testid="input-panel-empty">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          No input fields detected in this workflow.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Add PromptInput or FileSelector nodes to enable popup inputs.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4 p-4 overflow-y-auto', className)} data-testid="input-panel">
      <h3 className="text-sm font-medium text-foreground">Inputs</h3>

      {inputList.map((input) => (
        <InputField
          key={input.nodeId}
          input={input}
          disabled={disabled}
          onInputChange={onInputChange}
          onSelectFiles={onSelectFiles}
        />
      ))}
    </div>
  );
}

interface InputFieldProps {
  input: WorkflowPopupInputFieldConfig;
  disabled: boolean;
  onInputChange: (nodeId: string, value: string | WorkflowPopupFileReference[]) => void;
  onSelectFiles: (nodeId: string) => void;
}

function InputField({ input, disabled, onInputChange, onSelectFiles }: InputFieldProps) {
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onInputChange(input.nodeId, e.target.value);
    },
    [input.nodeId, onInputChange]
  );

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      if (Array.isArray(input.value)) {
        const newFiles = input.value.filter((f) => f.id !== fileId);
        onInputChange(input.nodeId, newFiles);
      }
    },
    [input.nodeId, input.value, onInputChange]
  );

  // Truncate long names (FR-006b)
  const displayName = input.nodeName.length > 30
    ? truncate(input.nodeName, 30)
    : input.nodeName;

  return (
    <div className="flex flex-col gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label
              htmlFor={input.nodeId}
              className={cn(
                'text-sm font-medium flex items-center gap-2',
                input.required && 'after:content-["*"] after:text-destructive'
              )}
            >
              {input.nodeType === 'promptInput' ? (
                <FileText className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {displayName}
            </Label>
          </TooltipTrigger>
          {input.nodeName.length > 30 && (
            <TooltipContent>
              <p>{input.nodeName}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {input.nodeType === 'promptInput' ? (
        <Textarea
          id={input.nodeId}
          value={typeof input.value === 'string' ? input.value : ''}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder="Enter your prompt..."
          className="min-h-[100px] resize-y"
          data-testid="prompt-input"
        />
      ) : (
        <FileSelector
          nodeId={input.nodeId}
          files={Array.isArray(input.value) ? input.value : []}
          disabled={disabled}
          onSelectFiles={onSelectFiles}
          onRemoveFile={handleRemoveFile}
        />
      )}
    </div>
  );
}

interface FileSelectorProps {
  nodeId: string;
  files: WorkflowPopupFileReference[];
  disabled: boolean;
  onSelectFiles: (nodeId: string) => void;
  onRemoveFile: (fileId: string) => void;
}

function FileSelector({
  nodeId,
  files,
  disabled,
  onSelectFiles,
  onRemoveFile,
}: FileSelectorProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onSelectFiles(nodeId)}
        className="w-full justify-start"
      >
        <Upload className="mr-2 h-4 w-4" />
        {files.length > 0 ? `Add more files (${files.length}/10)` : 'Select files'}
      </Button>

      {/* File limit warning (FR-010a) */}
      {files.length >= 10 && (
        <p className="text-xs text-amber-500">Maximum 10 files allowed</p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Truncate long file names (FR-010b) */}
                      <span className="truncate">
                        {file.name.length > 40
                          ? truncate(file.name, 40)
                          : file.name}
                      </span>
                    </TooltipTrigger>
                    {file.name.length > 40 && (
                      <TooltipContent>
                        <p>{file.name}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={() => onRemoveFile(file.id)}
                className="h-6 w-6 flex-shrink-0"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove file</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
