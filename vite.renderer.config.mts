import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config
export default defineConfig({
  root: path.resolve(__dirname, './src/renderer'),
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer/src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    rollupOptions: {
      input: path.resolve(__dirname, './src/renderer/index.html'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
});
