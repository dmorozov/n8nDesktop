import { useState } from 'react';
import { FolderOpen, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WelcomePageProps {
  onComplete: () => void;
}

export function WelcomePage({ onComplete }: WelcomePageProps) {
  const [dataFolder, setDataFolder] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get default data folder on mount
  useState(() => {
    window.electron.config.get('dataFolder').then((folder) => {
      setDataFolder(folder);
    });
  });

  const handleBrowse = async () => {
    try {
      const result = await window.electron.dialog.selectFolder({
        title: 'Select Data Folder',
        defaultPath: dataFolder,
      });

      if (result.success && result.path) {
        setDataFolder(result.path);
        setError(null);
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
    }
  };

  const handleContinue = async () => {
    if (!dataFolder) {
      setError('Please select a data folder');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Save the data folder
      await window.electron.config.set('dataFolder', dataFolder);

      // Mark first run as complete
      await window.electron.config.set('firstRunComplete', true);

      // Notify parent to proceed to main app
      onComplete();
    } catch (err) {
      console.error('Error completing setup:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          {/* Logo */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary">
            <span className="text-2xl font-bold text-primary-foreground">n8n</span>
          </div>
          <CardTitle className="text-2xl">Welcome to n8n AI Runner</CardTitle>
          <CardDescription>
            Your local workflow automation platform with AI capabilities.
            Let&apos;s get you set up in just a few steps.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Data Folder Selection */}
          <div className="space-y-2">
            <Label htmlFor="dataFolder">Data Folder</Label>
            <p className="text-sm text-muted-foreground">
              Choose where to store your workflows, credentials, and settings.
              This folder will contain all your n8n data.
            </p>
            <div className="flex gap-2">
              <Input
                id="dataFolder"
                value={dataFolder}
                onChange={(e) => setDataFolder(e.target.value)}
                placeholder="Select a folder..."
                className="flex-1"
                readOnly
              />
              <Button variant="outline" onClick={handleBrowse}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Info Section */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="mb-2 text-sm font-medium">What happens next?</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• The n8n server will start automatically</li>
              <li>• Your workflows will be stored in the selected folder</li>
              <li>• You can change this location later in Settings</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            className="w-full"
            onClick={handleContinue}
            disabled={isLoading || !dataFolder}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
