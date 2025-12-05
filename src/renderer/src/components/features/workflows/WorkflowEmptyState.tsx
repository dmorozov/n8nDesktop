import { FileText, Plus, Upload, Sparkles, Database, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface WorkflowEmptyStateProps {
  onCreateNew?: () => void;
  onImport?: () => void;
  onSelectTemplate?: (templateId: string) => void;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  icon: typeof Sparkles;
}

const templates: TemplateOption[] = [
  {
    id: 'ai-chat',
    name: 'AI Chat Assistant',
    description: 'Build a chatbot with OpenAI or Anthropic',
    icon: MessageSquare,
  },
  {
    id: 'automation',
    name: 'General Automation',
    description: 'Connect apps and automate tasks',
    icon: Sparkles,
  },
  {
    id: 'pdf-processing',
    name: 'PDF Processing',
    description: 'Extract and transform document data',
    icon: Database,
  },
];

export function WorkflowEmptyState({
  onCreateNew,
  onImport,
  onSelectTemplate,
}: WorkflowEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      {/* Icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Message */}
      <h2 className="mb-2 text-xl font-semibold text-foreground">No workflows yet</h2>
      <p className="mb-8 max-w-md text-center text-muted-foreground">
        Create your first workflow to start automating tasks with n8n. You can start from scratch
        or use one of our templates.
      </p>

      {/* Primary Actions */}
      <div className="mb-8 flex gap-3">
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
      <div className="w-full max-w-2xl">
        <h3 className="mb-4 text-center text-sm font-medium text-muted-foreground">
          Or start from a template
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
    </div>
  );
}
