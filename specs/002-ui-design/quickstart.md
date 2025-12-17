# Quickstart: n8n Desktop Development

## Prerequisites

- **Node.js**: v20.19+ (LTS recommended)
- **npm**: v10+ or **pnpm**: v8+
- **Git**: For version control
- **OS**: Windows 10+, macOS 11+, or Linux (Ubuntu 20.04+)

## Initial Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd n8nDesktop
npm install
```

### 2. Development Mode

```bash
npm run dev
```

This starts:
- Vite dev server with HMR for the renderer process
- Electron in development mode
- n8n server (spawned as child process)

### 3. Build for Production

```bash
# Build all platforms (requires platform-specific environment)
npm run make

# Build specific platform
npm run make -- --platform=win32
npm run make -- --platform=darwin
npm run make -- --platform=linux
```

## Project Structure

```
n8nDesktop/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry point
│   │   ├── n8n-manager.ts       # n8n lifecycle management
│   │   ├── config-manager.ts    # Configuration storage
│   │   └── ipc-handlers.ts      # IPC handlers
│   ├── preload/                 # Context bridge
│   │   └── index.ts
│   └── renderer/                # Preact UI
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── components/      # UI components
│           │   ├── ui/          # shadcn-preact components
│           │   ├── layout/      # Layout components
│           │   └── features/    # Feature-specific components
│           ├── pages/           # Page components
│           ├── stores/          # nanostores
│           ├── hooks/           # Custom hooks
│           ├── lib/             # Utilities
│           └── styles/          # CSS
├── specs/                       # Feature specifications
├── documentation/               # Documentation
│   └── design/                  # UI design mockups
├── resources/                   # App icons and assets
├── forge.config.ts              # Electron Forge config
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
└── package.json
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development with hot reload |
| `npm run build` | Build without packaging |
| `npm run make` | Build and create installers |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run tests |

## Adding UI Components

This project uses shadcn-preact. To add components:

```bash
# Components are copied, not installed as dependencies
# Copy from: https://github.com/LiasCode/shadcn-preact

# Example: Add button component
# 1. Create src/renderer/src/components/ui/button.tsx
# 2. Copy component code from shadcn-preact
# 3. Adjust imports if needed
```

## Configuration

### Vite Renderer Config (Preact + Tailwind)

```typescript
// vite.renderer.config.ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer/src'),
    },
  },
});
```

### TypeScript Config

```json
// tsconfig.json (renderer)
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment",
    "paths": {
      "@/*": ["./src/renderer/src/*"]
    }
  }
}
```

## IPC Communication

### Adding a New IPC Handler

1. **Define types** in `specs/002-ui-design/contracts/ipc-api.ts`

2. **Implement handler** in `src/main/ipc-handlers.ts`:
```typescript
ipcMain.handle('my-feature:action', async (event, arg1, arg2) => {
  // Validate sender
  // Perform action
  return result;
});
```

3. **Expose in preload** `src/preload/index.ts`:
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  myFeature: {
    action: (arg1, arg2) => ipcRenderer.invoke('my-feature:action', arg1, arg2),
  },
});
```

4. **Use in renderer**:
```typescript
const result = await window.electronAPI.myFeature.action(arg1, arg2);
```

## State Management

Using nanostores with @tanstack/react-query:

```typescript
// stores/n8n.ts
import { atom, computed } from 'nanostores';

export const $n8nStatus = atom<N8nStatus>({ status: 'stopped', ... });

// In component
import { useStore } from '@nanostores/preact';
import { $n8nStatus } from '@/stores/n8n';

function StatusIndicator() {
  const status = useStore($n8nStatus);
  return <Badge>{status.status}</Badge>;
}
```

## Testing

```bash
# Unit tests
npm run test:unit

# Integration tests (requires built app)
npm run test:integration

# E2E tests
npm run test:e2e
```

## Debugging

### Main Process
```bash
# Start with inspector
npm run dev -- --inspect
# Attach debugger to port 9229
```

### Renderer Process
- Use Chrome DevTools (Ctrl+Shift+I / Cmd+Option+I)

### n8n Server Logs
- Access via Settings > Server > View Logs
- Or check `[dataFolder]/logs/n8n.log`

## Common Issues

### n8n won't start
- Check port availability: `lsof -i :5678`
- Check Node.js version: `node --version`
- View logs for errors

### Preact/React compatibility
- Ensure @preact/preset-vite is properly configured
- Check for React-specific code that needs Preact adjustments

### Build failures
- Clear node_modules and reinstall
- Check Electron Forge logs
- Ensure native dependencies are rebuilt: `npm run rebuild`

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Preact Documentation](https://preactjs.com/guide)
- [shadcn-preact](https://github.com/LiasCode/shadcn-preact)
- [n8n REST API](https://docs.n8n.io/api/)
- [TailwindCSS v4](https://tailwindcss.com/docs)
- [nanostores](https://github.com/nanostores/nanostores)
