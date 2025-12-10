import { atom } from 'nanostores';
import { loadWorkflows } from './workflows';

// Track whether the n8n editor WebContentsView is currently visible
export const $editorVisible = atom<boolean>(false);

// Flag to track if a local update is in progress (to avoid race conditions)
let localUpdateInProgress = false;

/**
 * Initialize subscription to editor visibility changes from main process
 */
export function initEditorVisibilitySubscription(): () => void {
  // Get initial visibility state - but only if no local update is in progress
  window.electron.editor.isVisible().then((visible) => {
    if (!localUpdateInProgress) {
      $editorVisible.set(visible);
    }
  });

  // Subscribe to visibility changes
  const unsubscribe = window.electron.editor.onVisibilityChange((visible) => {
    const wasVisible = $editorVisible.get();
    $editorVisible.set(visible);

    // Reload workflows when editor is closed to sync any changes made in the editor
    if (wasVisible && !visible) {
      loadWorkflows();
    }
  });

  // Poll for visibility state periodically to handle any missed events
  // This ensures the sidebar is always shown correctly even if an event was missed
  const pollInterval = setInterval(() => {
    // Skip polling if a local update is in progress
    if (localUpdateInProgress) {
      return;
    }
    window.electron.editor.isVisible().then((visible) => {
      if ($editorVisible.get() !== visible) {
        $editorVisible.set(visible);
      }
    });
  }, 100);

  return () => {
    unsubscribe();
    clearInterval(pollInterval);
  };
}

/**
 * Open the editor with optional workflow ID
 * This sets the visibility state immediately BEFORE the IPC call
 * to ensure the UI updates without any delay
 */
export async function openEditor(workflowId?: string): Promise<void> {
  // Set flag to prevent race conditions with async operations
  localUpdateInProgress = true;

  // Set visibility immediately BEFORE the IPC call to prevent any flash of wrong state
  $editorVisible.set(true);

  try {
    await window.electron.editor.open(workflowId);
  } catch (error) {
    // If the editor fails to open, revert the visibility state
    $editorVisible.set(false);
    throw error;
  } finally {
    // Clear the flag after a short delay to allow state to propagate
    setTimeout(() => {
      localUpdateInProgress = false;
    }, 500);
  }
}

/**
 * Close the editor and return to the dashboard
 */
export async function closeEditor(): Promise<void> {
  await window.electron.editor.close();
  // Set visibility immediately
  $editorVisible.set(false);
}
