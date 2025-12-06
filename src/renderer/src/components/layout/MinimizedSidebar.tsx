import { useStore } from '@nanostores/react';
import { Home, Clock, Cpu, Settings, ArrowLeft, Plus } from 'lucide-react';
import { $n8nStatus } from '@/stores/n8n';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MinimizedSidebarProps {
  onNavigate: (path: string) => void;
  onOpenSettings: () => void;
  onNewWorkflow: () => void;
  onCloseEditor: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Workflows', icon: Home },
  { path: '/recent', label: 'Recent', icon: Clock },
  { path: '/ai-services', label: 'AI Services', icon: Cpu },
];

export function MinimizedSidebar({
  onNavigate,
  onOpenSettings,
  onNewWorkflow,
  onCloseEditor,
}: MinimizedSidebarProps) {
  const status = useStore($n8nStatus);

  const getStatusColor = () => {
    switch (status.status) {
      case 'running':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'starting':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'running':
        return 'Server Running';
      case 'error':
        return 'Server Error';
      case 'starting':
        return 'Starting...';
      default:
        return 'Server Stopped';
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-full w-16 flex-col border-r border-sidebar-border bg-sidebar">
        {/* Logo/Brand */}
        <div className="flex items-center justify-center border-b border-sidebar-border py-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCloseEditor}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary transition-transform hover:scale-105"
              >
                <span className="text-xs font-bold text-primary-foreground">n8n</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Back to Dashboard</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Back Button */}
        <div className="flex justify-center py-3 border-b border-sidebar-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCloseEditor}
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Close Editor</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* New Workflow Button */}
        <div className="flex justify-center py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onNewWorkflow}
                className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>New Workflow</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation Icons */}
        <nav className="flex-1 space-y-1 px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      onCloseEditor();
                      onNavigate(item.path);
                    }}
                    className={cn(
                      'flex w-full items-center justify-center rounded-md p-2 text-muted-foreground transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer - Settings & Status */}
        <div className="border-t border-sidebar-border py-3">
          {/* Settings Button */}
          <div className="flex justify-center pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenSettings}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Server Status Indicator */}
          <div className="flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-8 w-8 items-center justify-center">
                  <span className={cn('h-3 w-3 rounded-full', getStatusColor())} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{getStatusText()}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
