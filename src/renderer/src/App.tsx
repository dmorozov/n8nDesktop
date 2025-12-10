import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { initN8nStatusSubscription } from './stores/n8n';
import { $settings, loadSettings } from './stores/settings';
import { $editorVisible, initEditorVisibilitySubscription, closeEditor } from './stores/editor';
import { ThemeProvider } from './components/theme-provider';
import { MainLayout } from './components/layout/MainLayout';
import { MinimizedSidebar } from './components/layout/MinimizedSidebar';
import { HomePage } from './pages/HomePage';
import { RecentPage } from './pages/RecentPage';
import { AIServicesPage } from './pages/AIServicesPage';
import { WelcomePage } from './pages/WelcomePage';
import { ToastContainer } from './components/ui/toast';
import { openEditor } from './stores/editor';

type Route = '/' | '/recent' | '/ai-services';

// Check if we're in sidebar-only mode (loaded in a separate WebContentsView)
const isSidebarOnlyMode = window.location.hash === '#/sidebar-only';

export function App() {
  const [currentPath, setCurrentPath] = useState<Route>('/');
  const [isLoading, setIsLoading] = useState(true);
  const settings = useStore($settings);
  const editorVisible = useStore($editorVisible);


  // If in sidebar-only mode, render just the MinimizedSidebar
  // This is used when the editor is open - the sidebar is in a separate WebContentsView
  if (isSidebarOnlyMode) {
    const handleNavigate = (_path: string) => {
      // Close editor and navigate - send message to main window
      closeEditor();
      // Navigation will happen in main window
    };

    const handleOpenSettings = () => {
      // Close editor first, then settings will be opened in main window
      closeEditor();
    };

    const handleNewWorkflow = async () => {
      // Create new workflow in the editor
      await openEditor();
    };

    const handleCloseEditor = () => {
      closeEditor();
    };

    return (
      <ThemeProvider defaultTheme="dark" storageKey="n8n-desktop-theme">
        <div className="h-screen w-16 overflow-hidden">
          <MinimizedSidebar
            onNavigate={handleNavigate}
            onOpenSettings={handleOpenSettings}
            onNewWorkflow={handleNewWorkflow}
            onCloseEditor={handleCloseEditor}
          />
        </div>
      </ThemeProvider>
    );
  }

  // Initialize subscriptions and load data
  useEffect(() => {
    // Subscribe to n8n status changes
    const unsubscribeN8n = initN8nStatusSubscription();

    // Subscribe to editor visibility changes
    const unsubscribeEditor = initEditorVisibilitySubscription();

    // Load settings
    loadSettings().then(() => {
      setIsLoading(false);
    });

    return () => {
      unsubscribeN8n();
      unsubscribeEditor();
    };
  }, []);

  const handleNavigate = (path: string) => {
    setCurrentPath(path as Route);
  };

  const handleFirstRunComplete = () => {
    // Reload settings to get updated firstRunComplete value
    loadSettings();
  };

  // Show loading state while settings are being loaded
  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="n8n-desktop-theme">
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary">
              <span className="text-2xl font-bold text-primary-foreground">n8n</span>
            </div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Show welcome page for first-time users
  if (!settings.firstRunComplete) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="n8n-desktop-theme">
        <WelcomePage onComplete={handleFirstRunComplete} />
      </ThemeProvider>
    );
  }

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <HomePage />;
      case '/recent':
        return <RecentPage />;
      case '/ai-services':
        return <AIServicesPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="n8n-desktop-theme">
      <MainLayout currentPath={currentPath} onNavigate={handleNavigate} editorVisible={editorVisible}>
        {renderPage()}
      </MainLayout>
      <ToastContainer />
    </ThemeProvider>
  );
}
