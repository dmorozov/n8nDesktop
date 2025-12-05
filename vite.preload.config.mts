import { defineConfig } from 'vite';
import { builtinModules } from 'module';

// https://vitejs.dev/config
// Preload scripts must be CommonJS format for Electron
// Use .cjs extension since package.json has "type": "module"
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        format: 'cjs',
        entryFileNames: '[name].cjs',
      },
    },
    minify: false,
  },
});
