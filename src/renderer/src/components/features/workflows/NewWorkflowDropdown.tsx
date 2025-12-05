import { useState } from 'react';
import { Plus, FolderOpen, ChevronDown, FileText, Bot, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: 'bot' | 'cog' | 'file';
}

interface NewWorkflowDropdownProps {
  onCreateNew: () => void;
  onImportFromDisk: () => void;
  onSelectTemplate?: (templateId: string) => void;
  templates?: WorkflowTemplate[];
  disabled?: boolean;
  className?: string;
}

export function NewWorkflowDropdown({
  onCreateNew,
  onImportFromDisk,
  onSelectTemplate,
  templates = [],
  disabled = false,
  className,
}: NewWorkflowDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getTemplateIcon = (icon: WorkflowTemplate['icon']) => {
    switch (icon) {
      case 'bot':
        return <Bot className="mr-2 h-4 w-4" />;
      case 'cog':
        return <Cog className="mr-2 h-4 w-4" />;
      case 'file':
      default:
        return <FileText className="mr-2 h-4 w-4" />;
    }
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    onCreateNew();
  };

  const handleImportFromDisk = () => {
    setIsOpen(false);
    onImportFromDisk();
  };

  const handleSelectTemplate = (templateId: string) => {
    setIsOpen(false);
    onSelectTemplate?.(templateId);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button className={className} variant="default" disabled={disabled}>
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Workflow
          </span>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>Create New</span>
            <span className="text-xs text-muted-foreground">Start with a blank workflow</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleImportFromDisk}>
          <FolderOpen className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>Open from Disk</span>
            <span className="text-xs text-muted-foreground">Import a JSON workflow file</span>
          </div>
        </DropdownMenuItem>

        {templates.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Start from Template
            </div>
            {templates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleSelectTemplate(template.id)}
              >
                {getTemplateIcon(template.icon)}
                <div className="flex flex-col">
                  <span>{template.name}</span>
                  <span className="text-xs text-muted-foreground">{template.description}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
