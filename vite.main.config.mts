import { defineConfig } from 'vite';
import { builtinModules } from 'module';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-store',
        'electron-squirrel-startup',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    minify: false,
    sourcemap: true,
  },
  resolve: {
    // Load the Node.js entry.
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
});
