import { useStore } from '@nanostores/react';
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { $notifications, removeNotification, type Notification, type NotificationType } from '@/stores/notifications';
import { cn } from '@/lib/utils';

const iconMap: Record<NotificationType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<NotificationType, string> = {
  success: 'bg-green-500/10 border-green-500/20 text-green-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-400',
  warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

interface ToastItemProps {
  notification: Notification;
}

function ToastItem({ notification }: ToastItemProps) {
  const Icon = iconMap[notification.type];
  const colorClass = colorMap[notification.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm',
        'animate-in slide-in-from-right-full duration-300',
        colorClass
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{notification.title}</p>
        {notification.message && (
          <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
        )}
      </div>
      <button
        onClick={() => removeNotification(notification.id)}
        className="flex-shrink-0 rounded-md p-1 hover:bg-accent"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const notifications = useStore($notifications);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((notification) => (
        <ToastItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
