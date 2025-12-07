import { atom } from 'nanostores';

// Track whether the n8n editor BrowserView is currently visible
export const $editorVisible = atom<boolean>(false);

/**
 * Initialize subscription to editor visibility changes from main process
 */
export function initEditorVisibilitySubscription(): () => void {
  console.log('Initializing editor visibility subscription');

  // Get initial visibility state immediately
  window.electron.editor.isVisible().then((visible) => {
    console.log('Initial editor visibility:', visible);
    $editorVisible.set(visible);
  });

  // Subscribe to visibility changes
  const unsubscribe = window.electron.editor.onVisibilityChange((visible) => {
    console.log('Editor visibility changed:', visible);
    $editorVisible.set(visible);
  });

  // Poll for visibility state periodically to handle any missed events
  // This ensures the sidebar is always shown correctly even if an event was missed
  const pollInterval = setInterval(() => {
    window.electron.editor.isVisible().then((visible) => {
      if ($editorVisible.get() !== visible) {
        console.log('Editor visibility corrected via polling:', visible);
        $editorVisible.set(visible);
      }
    });
  }, 1000);

  return () => {
    unsubscribe();
    clearInterval(pollInterval);
  };
}

/**
 * Open the editor with optional workflow ID
 * This sets the visibility state immediately after the IPC call completes
 * to avoid timing issues with event-based state updates
 */
export async function openEditor(workflowId?: string): Promise<void> {
  await window.electron.editor.open(workflowId);
  // Set visibility immediately - the main process has already shown the BrowserView
  // by the time the IPC call returns
  $editorVisible.set(true);
}

/**
 * Close the editor and return to the dashboard
 */
export async function closeEditor(): Promise<void> {
  await window.electron.editor.close();
  // Set visibility immediately
  $editorVisible.set(false);
}
