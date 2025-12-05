# Research: n8n Desktop Application

**Date**: 2025-12-04
**Branch**: `002-ui-design`
**Specs**: `001-n8n-desktop-app`, `002-ui-design`

## Executive Summary

This document consolidates research findings for implementing an Electron-based n8n desktop application. Key decisions and their rationale are documented below.

---

## 1. n8n Embedding Strategy

### Decision: Spawn n8n as Child Process

**Rationale**: n8n is not designed as an embeddable library. The official (now archived) n8n Desktop app and community implementations both spawn n8n as a child process.

**Implementation Pattern**:
```typescript
import { spawn, ChildProcess } from 'child_process';
import waitOn from 'wait-on';

let n8nProcess: ChildProcess | null = null;

async function startN8n(userDataPath: string, port: number): Promise<void> {
  n8nProcess = spawn('npx', ['n8n'], {
    env: {
      ...process.env,
      N8N_PORT: port.toString(),
      N8N_HOST: 'localhost',
      N8N_LISTEN_ADDRESS: '127.0.0.1',
      N8N_USER_FOLDER: `${userDataPath}/.n8n`,
      DB_TYPE: 'sqlite',
      N8N_ENCRYPTION_KEY: getEncryptionKey(),
      N8N_DIAGNOSTICS_ENABLED: 'false',
    }
  });

  await waitOn({
    resources: [`http://localhost:${port}`],
    timeout: 60000,
  });
}
```

**Alternatives Considered**:
- Docker container: Rejected due to dependency on Docker installation
- Direct import of n8n modules: Not supported by n8n architecture
- n8n Cloud API: Rejected to maintain offline-first principle

### n8n Configuration Requirements

| Variable | Value | Purpose |
|----------|-------|---------|
| `N8N_PORT` | Dynamic (default 5678) | Server port |
| `N8N_HOST` | `localhost` | Bind to localhost only |
| `N8N_USER_FOLDER` | User-selected data folder | All n8n data storage |
| `DB_TYPE` | `sqlite` | Local database (no external DB needed) |
| `N8N_ENCRYPTION_KEY` | 32-byte random string | Credential encryption |
| `N8N_DIAGNOSTICS_ENABLED` | `false` | Disable telemetry |

### Node.js Version Requirements

- **Required**: Node.js 20.19 to 24.x
- **Electron Bundle**: Will use Node.js 20 LTS (matches n8n requirements)

---

## 2. Electron + Vite + Preact Architecture

### Decision: Electron Forge with Vite Plugin

**Rationale**: Official Electron tooling with Vite integration, active maintenance, and good TypeScript support.

**Project Structure**:
```
n8nDesktop/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry, window creation
│   │   ├── n8n-manager.ts       # n8n process lifecycle
│   │   ├── config-manager.ts    # Configuration storage
│   │   └── ipc-handlers.ts      # IPC communication
│   ├── preload/                 # Context bridge
│   │   └── index.ts             # Expose APIs to renderer
│   └── renderer/                # Preact UI
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── components/
│           ├── pages/
│           ├── stores/          # nanostores
│           └── lib/
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
├── forge.config.ts
└── package.json
```

**Alternatives Considered**:
- electron-vite: Good alternative but Electron Forge is more mature
- Manual Vite + Electron: More setup work, less community support

### IPC Communication Pattern

Using `ipcRenderer.invoke` / `ipcMain.handle` for type-safe async communication:

**Preload (context bridge)**:
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  n8n: {
    start: () => ipcRenderer.invoke('n8n:start'),
    stop: () => ipcRenderer.invoke('n8n:stop'),
    getStatus: () => ipcRenderer.invoke('n8n:status'),
  },
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
  },
  workflows: {
    list: () => ipcRenderer.invoke('workflows:list'),
    import: () => ipcRenderer.invoke('workflows:import'),
    export: (id: string) => ipcRenderer.invoke('workflows:export', id),
  },
  // ... more APIs
});
```

---

## 3. UI Framework: Preact + shadcn-preact

### Decision: Use shadcn-preact (Community Port)

**Rationale**: Official shadcn/ui is incompatible with Preact due to Radix UI Portal issues. The shadcn-preact community port provides native Preact components.

**Repository**: https://github.com/LiasCode/shadcn-preact

**Setup Requirements**:
```bash
npm install preact @preact/signals tailwindcss
npm install class-variance-authority clsx tailwind-merge
npm install lucide-preact  # Icons
npm install @bosh-code/preact-slot  # Radix Slot replacement
```

**Compatibility Notes**:
- Avoid Radix UI Portal-based components (Select, Dialog) - use shadcn-preact alternatives
- Use `@bosh-code/preact-slot` for Slot component compatibility
- Configure tsconfig paths for React → Preact aliasing

### TailwindCSS v4 Configuration

**vite.renderer.config.ts**:
```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [preact(), tailwindcss()],
});
```

**src/renderer/src/index.css**:
```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark theme variables */
  }
}
```

**Alternatives Considered**:
- Official shadcn/ui with Preact compat: Too many Portal issues
- DaisyUI: Less sophisticated, different design language
- Custom components: More development effort

---

## 4. State Management: nanostores

### Decision: nanostores with @tanstack/react-query

**Rationale**: Lightweight, framework-agnostic state management that works well with Preact.

**Store Structure**:
```typescript
// stores/n8n.ts
import { atom, computed } from 'nanostores';

export const $n8nStatus = atom<'starting' | 'running' | 'stopped' | 'error'>('stopped');
export const $n8nPort = atom<number>(5678);
export const $n8nUrl = computed($n8nPort, port => `http://localhost:${port}`);

// stores/workflows.ts
import { atom, map } from 'nanostores';

export const $workflows = atom<Workflow[]>([]);
export const $activeWorkflows = computed($workflows,
  workflows => workflows.filter(w => w.status === 'active')
);
export const $recentWorkflows = atom<RecentWorkflow[]>([]);

// stores/settings.ts
export const $dataFolder = atom<string>('');
export const $aiServices = map<Record<string, AIServiceConfig>>({});
```

**API Data Fetching with @tanstack/react-query**:
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => axios.get(`${$n8nUrl.get()}/api/v1/workflows`),
  });
}

export function useExecuteWorkflow() {
  return useMutation({
    mutationFn: (workflowId: string) =>
      axios.post(`${$n8nUrl.get()}/api/v1/workflows/${workflowId}/run`),
  });
}
```

---

## 5. Configuration Storage

### Decision: electron-store + Electron safeStorage

**Rationale**:
- electron-store for general configuration (theme, paths, preferences)
- Electron's safeStorage API for API keys (OS-native encryption)

**Implementation**:
```typescript
import Store from 'electron-store';
import { safeStorage } from 'electron';

// General config
const configStore = new Store({
  schema: {
    theme: { type: 'string', default: 'dark' },
    dataFolder: { type: 'string' },
    minimizeToTray: { type: 'boolean', default: true },
    n8nPort: { type: 'number', default: 5678 },
  },
});

// Secure credential storage
function setApiKey(service: string, apiKey: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage not available');
  }
  const encrypted = safeStorage.encryptString(apiKey);
  configStore.set(`credentials.${service}`, encrypted.toString('latin1'));
}

function getApiKey(service: string): string | null {
  const encrypted = configStore.get(`credentials.${service}`);
  if (!encrypted) return null;
  return safeStorage.decryptString(Buffer.from(encrypted, 'latin1'));
}
```

**Platform Security**:
- macOS: Uses Keychain
- Windows: Uses DPAPI
- Linux: Uses kwallet/gnome-libsecret

**Alternatives Considered**:
- electron-store encryption: Not secure (only obfuscation)
- node-keytar: Deprecated, replaced by safeStorage
- Manual JSON files: No encryption support

---

## 6. Build and Distribution

### Decision: electron-builder via Electron Forge

**Build Outputs**:
| Platform | Format | Notes |
|----------|--------|-------|
| Windows | NSIS installer (.exe) | Auto desktop shortcut, per-user install |
| macOS | DMG (universal) | Intel + Apple Silicon, notarized |
| Linux | AppImage | Portable, no installation needed |

**forge.config.ts key settings**:
```typescript
module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'resources/icon',
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',  // Windows
      config: { name: 'n8n-desktop' },
    },
    {
      name: '@electron-forge/maker-dmg',  // macOS
      config: { format: 'ULFO' },
    },
    {
      name: '@electron-forge/maker-deb',  // Linux
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
          { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' },
        ],
        renderer: [
          { name: 'main_window', config: 'vite.renderer.config.ts' },
        ],
      },
    },
  ],
};
```

**n8n Bundling**: Bundle n8n as extraResources:
```json
{
  "build": {
    "extraResources": [
      {
        "from": "node_modules/n8n",
        "to": "n8n",
        "filter": ["**/*"]
      }
    ]
  }
}
```

---

## 7. ESLint + Prettier Configuration

### Recommended Packages

```json
{
  "devDependencies": {
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint-plugin-preact": "^0.1.0",
    "eslint-config-prettier": "^9.0.0",
    "prettier": "^3.0.0",
    "prettier-plugin-tailwindcss": "^0.6.0"
  }
}
```

### ESLint Flat Config (eslint.config.js)

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import preact from 'eslint-plugin-preact';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { preact },
    rules: {
      'preact/no-unused-components': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  prettier,
);
```

### Prettier Configuration (.prettierrc)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

---

## 8. Key Dependencies Summary

### Production Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `electron` | Desktop framework | ^28.0.0 |
| `preact` | UI framework | ^10.24.0 |
| `@preact/signals` | Reactive state | ^1.3.0 |
| `nanostores` | State management | ^0.11.0 |
| `@tanstack/react-query` | API data fetching | ^5.0.0 |
| `axios` | HTTP client | ^1.7.0 |
| `electron-store` | Configuration storage | ^10.0.0 |
| `tailwindcss` | CSS framework | ^4.0.0 |
| `n8n` | Workflow automation | locked to app version |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `@electron-forge/cli` | Build tooling |
| `@electron-forge/plugin-vite` | Vite integration |
| `@preact/preset-vite` | Preact + Vite setup |
| `@tailwindcss/vite` | Tailwind v4 plugin |
| `typescript` | Type checking |
| `vite` | Build tool |

---

## 9. Licensing Considerations

### n8n License: Sustainable Use License (Fair-Code)

**Allowed for this project**:
- ✅ Internal/personal use
- ✅ Desktop application for individual users
- ✅ Local workflow automation

**Restrictions to be aware of**:
- ❌ Cannot resell as SaaS
- ❌ Cannot collect external user credentials for commercial use

This desktop application for personal/internal use is fully compliant with the license.

---

## Sources

- [n8n Desktop App (Archived)](https://github.com/n8n-io/n8n-desktop-app)
- [n8n Documentation](https://docs.n8n.io/)
- [Electron Forge Vite Plugin](https://www.electronforge.io/config/plugins/vite)
- [shadcn-preact](https://github.com/LiasCode/shadcn-preact)
- [Preact Preset Vite](https://github.com/preactjs/preset-vite)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [TailwindCSS v4](https://tailwindcss.com/blog/tailwindcss-v4)
