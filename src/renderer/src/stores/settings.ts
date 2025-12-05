import { atom, computed } from 'nanostores';
import type { AppConfig, AIServiceConfig } from '../../../preload/types';

// Default settings
const defaultSettings: AppConfig = {
  firstRunComplete: false,
  n8nPort: 5678,
  dataFolder: '',
  startWithSystem: false,
  minimizeToTray: true,
  runInBackground: true,
  maxConcurrentWorkflows: 3,
  aiServices: [],
  windowBounds: {
    width: 1200,
    height: 800,
  },
};

// Store for app settings
export const $settings = atom<AppConfig>(defaultSettings);

// Store for tracking if settings have been modified (unsaved changes)
export const $hasUnsavedChanges = atom<boolean>(false);

// Store for pending settings changes (before save)
export const $pendingSettings = atom<Partial<AppConfig>>({});

// Computed stores
export const $isFirstRun = computed($settings, (settings) => !settings.firstRunComplete);
export const $n8nPort = computed($settings, (settings) => settings.n8nPort);
export const $dataFolder = computed($settings, (settings) => settings.dataFolder);
export const $aiServices = computed($settings, (settings) => settings.aiServices);
export const $enabledAIServices = computed($settings, (settings) =>
  settings.aiServices.filter(s => s.isEnabled)
);

// Load settings from main process
export async function loadSettings(): Promise<void> {
  const settings = await window.electron.config.getAll();
  $settings.set(settings);
  $pendingSettings.set({});
  $hasUnsavedChanges.set(false);
}

// Update a pending setting (doesn't save immediately)
export function updatePendingSetting<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  $pendingSettings.set({
    ...$pendingSettings.get(),
    [key]: value,
  });
  $hasUnsavedChanges.set(true);
}

// Save all pending settings
export async function saveSettings(): Promise<void> {
  const pending = $pendingSettings.get();
  if (Object.keys(pending).length === 0) return;

  await window.electron.config.setMultiple(pending);

  // Update local state
  $settings.set({
    ...$settings.get(),
    ...pending,
  });
  $pendingSettings.set({});
  $hasUnsavedChanges.set(false);
}

// Discard pending changes
export function discardChanges(): void {
  $pendingSettings.set({});
  $hasUnsavedChanges.set(false);
}

// Get a setting value (either pending or saved)
export function getSetting<K extends keyof AppConfig>(key: K): AppConfig[K] {
  const pending = $pendingSettings.get();
  if (key in pending) {
    return pending[key] as AppConfig[K];
  }
  return $settings.get()[key];
}

// Direct save of a single setting (for immediate updates)
export async function saveSetting<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void> {
  await window.electron.config.set(key, value);
  $settings.set({
    ...$settings.get(),
    [key]: value,
  });
}

// Mark first run as complete
export async function completeFirstRun(): Promise<void> {
  await saveSetting('firstRunComplete', true);
}

// AI Service management
export async function addAIService(service: Omit<AIServiceConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIServiceConfig> {
  const newService = await window.electron.config.addAIService(service);
  await loadSettings(); // Refresh settings
  return newService;
}

export async function updateAIService(
  id: string,
  updates: Partial<Omit<AIServiceConfig, 'id' | 'createdAt'>>
): Promise<AIServiceConfig | null> {
  const result = await window.electron.config.updateAIService(id, updates);
  await loadSettings(); // Refresh settings
  return result;
}

export async function deleteAIService(id: string): Promise<boolean> {
  const result = await window.electron.config.deleteAIService(id);
  await loadSettings(); // Refresh settings
  return result;
}

// Toggle AI service enabled state
export async function toggleAIService(id: string): Promise<void> {
  const services = $settings.get().aiServices;
  const service = services.find(s => s.id === id);
  if (service) {
    await updateAIService(id, { isEnabled: !service.isEnabled });
  }
}
