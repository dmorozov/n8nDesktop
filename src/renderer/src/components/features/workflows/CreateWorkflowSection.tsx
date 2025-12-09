import { Plus, Upload, MessageSquare, Sparkles, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { WorkflowTemplate } from './NewWorkflowDropdown';

interface CreateWorkflowSectionProps {
  onCreateNew?: () => void;
  onImport?: () => void;
  onSelectTemplate?: (templateId: string) => void;
}

export function CreateWorkflowSection({
  onCreateNew,
  onImport,
  onSelectTemplate,
}: CreateWorkflowSectionProps) {
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

  return (
    <div className="space-y-6">
      {/* Primary Actions */}
      <div className="flex flex-wrap gap-3">
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
      <div>
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Or start from a template
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <Card
                key={template.id}
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
