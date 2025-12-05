import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: 'resources/icon',
    name: 'n8n AI Runner',
    executableName: 'n8n-desktop',
    appBundleId: 'com.n8n.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    // Extra resources to include in the package
    extraResource: ['resources'],
    // Note: Don't set 'ignore' here - the Vite plugin automatically sets it
    // to only include the '.vite' folder for optimal package size
    // macOS signing (requires proper certificates in CI)
    osxSign: {},
    // Windows signing (requires proper certificates in CI)
    // win32metadata is handled by MakerSquirrel
  },
  rebuildConfig: {},
  makers: [
    // Windows: Creates .exe installer with auto-update support
    new MakerSquirrel({
      name: 'n8n-desktop',
      setupIcon: 'resources/icon.ico',
      // Installer UI customization
      title: 'n8n AI Runner',
      authors: 'n8n Desktop Team',
      description: 'Desktop application for n8n workflow automation with AI services',
      // Create desktop and start menu shortcuts
      setupExe: 'n8n-desktop-setup.exe',
      noMsi: true,
    }),
    // macOS: Creates .dmg installer
    new MakerDMG({
      format: 'ULFO',
      icon: 'resources/icon.icns',
      background: 'resources/dmg-background.png',
      contents: [
        { x: 130, y: 220, type: 'file', path: '' }, // Application
        { x: 410, y: 220, type: 'link', path: '/Applications' }, // Applications folder
      ],
    }),
    // Linux/macOS: Creates .zip archive
    new MakerZIP({}, ['darwin', 'linux']),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/index.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
  ],
};

export default config;
