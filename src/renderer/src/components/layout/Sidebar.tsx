import { useStore } from '@nanostores/react';
import { Home, Clock, Cpu, Settings, Plus, ChevronDown } from 'lucide-react';
import { $n8nStatus } from '@/stores/n8n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenSettings: () => void;
  onOpenServerSettings?: () => void;
  onNewWorkflow: () => void;
  onImportWorkflow: () => void;
  onSelectTemplate?: (templateId: string) => void;
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

export function Sidebar({
  currentPath,
  onNavigate,
  onOpenSettings,
  onOpenServerSettings,
  onNewWorkflow,
  onImportWorkflow,
  onSelectTemplate: _onSelectTemplate,
}: SidebarProps) {
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
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar-bg">
      {/* Branding */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">n8n</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">n8n AI Runner</h1>
          <p className="text-xs text-muted-foreground">Workflow Automation</p>
        </div>
      </div>

      {/* New Workflow Button */}
      <div className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full justify-between" variant="default">
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Workflow
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={onNewWorkflow}>
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImportWorkflow}>
              <Home className="mr-2 h-4 w-4" />
              Open from Disk
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer - Settings & Status */}
      <div className="border-t border-sidebar-border p-3">
        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>

        {/* Server Status */}
        <button
          onClick={onOpenServerSettings ?? onOpenSettings}
          className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg"
          aria-label={`Server status: ${getStatusText()}. Click to open server settings.`}
        >
          <span className={cn('h-2 w-2 rounded-full', getStatusColor())} aria-hidden="true" />
          <span className="text-muted-foreground">{getStatusText()}</span>
        </button>
      </div>
    </aside>
  );
}
