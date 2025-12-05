import { useCallback, type KeyboardEvent } from 'react';
import { Cpu, Settings, Trash2, Power, PowerOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { AIServiceConfig } from '@/preload/types';

interface AIServiceCardProps {
  service: AIServiceConfig;
  onConfigure: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

const getServiceIcon = (_type: AIServiceConfig['type']) => {
  // For now, use the same icon for all services
  // Could be enhanced with specific icons per service type
  return Cpu;
};

const getServiceColor = (type: AIServiceConfig['type']) => {
  switch (type) {
    case 'openai':
      return 'bg-emerald-500/10 text-emerald-500';
    case 'anthropic':
      return 'bg-orange-500/10 text-orange-500';
    case 'ollama':
      return 'bg-blue-500/10 text-blue-500';
    default:
      return 'bg-purple-500/10 text-purple-500';
  }
};

const getServiceLabel = (type: AIServiceConfig['type']) => {
  switch (type) {
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'ollama':
      return 'Ollama';
    case 'custom':
      return 'Custom';
    default:
      return type;
  }
};

export function AIServiceCard({ service, onConfigure, onDelete, onToggle }: AIServiceCardProps) {
  const Icon = getServiceIcon(service.type);
  const colorClass = getServiceColor(service.type);

  // Handle keyboard interaction - Enter to configure
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          onConfigure(service.id);
          break;
        case ' ':
          event.preventDefault();
          onToggle(service.id);
          break;
      }
    },
    [service.id, onConfigure, onToggle]
  );

  return (
    <Card
      className="transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
      tabIndex={0}
      role="article"
      aria-label={`AI Service: ${service.name}. ${getServiceLabel(service.type)}. ${service.isEnabled ? 'Enabled' : 'Disabled'}. Press Enter to configure, Space to toggle.`}
      onKeyDown={handleKeyDown}
      onClick={() => onConfigure(service.id)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">{service.name}</h3>
              <Badge variant="secondary" className="mt-1 text-xs">
                {getServiceLabel(service.type)}
              </Badge>
            </div>
          </div>

          {/* Toggle Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(service.id);
                  }}
                  className={service.isEnabled ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground'}
                  aria-label={service.isEnabled ? 'Disable service' : 'Enable service'}
                >
                  {service.isEnabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {service.isEnabled ? 'Disable service' : 'Enable service'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Status */}
        <div className="mb-4">
          <Badge variant={service.isEnabled ? 'success' : 'secondary'}>
            {service.isEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
          {service.endpoint && (
            <p className="mt-2 truncate text-xs text-muted-foreground" title={service.endpoint}>
              {service.endpoint}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConfigure(service.id);
            }}
            className="flex-1"
          >
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(service.id);
            }}
            className="text-destructive hover:text-destructive"
            aria-label="Delete service"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
