import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import * as fs from 'fs';
import * as path from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // Unpack n8n and its dependencies so they can be spawned as child processes
      // The n8n binary needs to be directly executable, not inside an ASAR archive
      unpack: '**/node_modules/{n8n,n8n-*,@n8n}/**/*',
    },
    icon: 'resources/icon',
    name: 'n8n AI Runner',
    executableName: 'n8n-desktop',
    appBundleId: 'com.n8n.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    // Extra resources to include in the package
    // - resources: icons and other static assets
    // - src/n8n_nodes: custom n8n nodes package (built separately)
    extraResource: ['resources', 'src/n8n_nodes'],
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
  hooks: {
    // Clean up unnecessary files from n8n_nodes after packaging
    postPackage: async (_config, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        // Find n8n_nodes in resources folder
        const resourcesPath = path.join(outputPath, 'resources');
        const n8nNodesPath = path.join(resourcesPath, 'n8n_nodes');

        if (fs.existsSync(n8nNodesPath)) {
          console.log('Cleaning up n8n_nodes folder:', n8nNodesPath);

          // Remove unnecessary files/folders
          const toRemove = [
            'node_modules',
            'nodes', // TypeScript source files
            'lib', // TypeScript source files (we keep dist/lib)
            'eslint.config.mjs',
            'tsconfig.json',
            'package-lock.json',
          ];

          for (const item of toRemove) {
            const itemPath = path.join(n8nNodesPath, item);
            if (fs.existsSync(itemPath)) {
              fs.rmSync(itemPath, { recursive: true, force: true });
              console.log(`  Removed: ${item}`);
            }
          }
        }
      }
    },
  },
};

export default config;
