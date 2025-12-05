import { atom } from 'nanostores';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
}

// Store for active notifications
export const $notifications = atom<Notification[]>([]);

let notificationIdCounter = 0;

// Add a notification
export function addNotification(
  type: NotificationType,
  title: string,
  message?: string,
  duration: number = 5000
): string {
  const id = `notification-${++notificationIdCounter}`;
  const notification: Notification = { id, type, title, message, duration };

  $notifications.set([...$notifications.get(), notification]);

  // Auto-remove after duration (unless duration is 0)
  if (duration > 0) {
    setTimeout(() => {
      removeNotification(id);
    }, duration);
  }

  return id;
}

// Remove a notification
export function removeNotification(id: string): void {
  $notifications.set($notifications.get().filter((n) => n.id !== id));
}

// Convenience methods
export function notifySuccess(title: string, message?: string, duration?: number): string {
  return addNotification('success', title, message, duration);
}

export function notifyError(title: string, message?: string, duration?: number): string {
  return addNotification('error', title, message, duration ?? 8000); // Errors show longer
}

export function notifyWarning(title: string, message?: string, duration?: number): string {
  return addNotification('warning', title, message, duration);
}

export function notifyInfo(title: string, message?: string, duration?: number): string {
  return addNotification('info', title, message, duration);
}

// Clear all notifications
export function clearNotifications(): void {
  $notifications.set([]);
}
