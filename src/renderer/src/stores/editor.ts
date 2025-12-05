import { atom } from 'nanostores';

// Track whether the n8n editor BrowserView is currently visible
export const $editorVisible = atom<boolean>(false);

/**
 * Initialize subscription to editor visibility changes from main process
 */
export function initEditorVisibilitySubscription(): () => void {
  console.log('Initializing editor visibility subscription');

  // Get initial visibility state
  window.electron.editor.isVisible().then((visible) => {
    console.log('Initial editor visibility:', visible);
    $editorVisible.set(visible);
  });

  // Subscribe to visibility changes
  return window.electron.editor.onVisibilityChange((visible) => {
    console.log('Editor visibility changed:', visible);
    $editorVisible.set(visible);
  });
}

/**
 * Close the editor and return to the dashboard
 */
export async function closeEditor(): Promise<void> {
  await window.electron.editor.close();
}
