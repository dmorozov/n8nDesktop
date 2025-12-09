import { useState, useEffect } from 'react';
import { FileText, Plus, Upload, MessageSquare, Sparkles, File, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { WorkflowTemplate } from '../../../../../preload/types';

interface EmptyWorkflowsStateProps {
  onCreateNew?: () => void;
  onImport?: () => void;
  onSelectTemplate?: (templateId: string) => void;
}

// Map icon names from API to Lucide icons
const iconMap: Record<WorkflowTemplate['icon'], LucideIcon> = {
  bot: MessageSquare,
  cog: Sparkles,
  file: File,
};

export function EmptyWorkflowsState({
  onCreateNew,
  onImport,
  onSelectTemplate,
}: EmptyWorkflowsStateProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const loadedTemplates = await window.electron.workflows.getTemplates();
        setTemplates(loadedTemplates);
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, []);

  let idx = 10000;

  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6">
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileText className="h-10 w-10 text-muted-foreground" />
      </div>

      {/* Title */}
      <h1 className="mb-2 text-2xl font-semibold text-foreground">No workflows yet</h1>

      {/* Description */}
      <p className="mb-8 text-center text-muted-foreground max-w-md">
        Create your first workflow to start automating tasks with n8n.
        <br />
        You can start from scratch or use one of our templates.
      </p>

      {/* Primary Actions */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        <Button onClick={onCreateNew} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Create New Workflow
        </Button>
        <Button onClick={onImport} variant="outline" size="lg">
          <Upload className="mr-2 h-4 w-4" />
          Import from File
        </Button>
      </div>

      {/* Template Options */}
      {!loading && templates.length > 0 && (
        <div className="w-full max-w-3xl">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Or start from a template
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {templates.map((template) => {
              const Icon = iconMap[template.icon] || File;
              return (
                <Card
                  key={template.id || idx++}
                  className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                  onClick={() => onSelectTemplate?.(template.id)}
                >
                  <CardContent className="p-4">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="mb-1 text-sm font-medium text-foreground">
                      {template.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
