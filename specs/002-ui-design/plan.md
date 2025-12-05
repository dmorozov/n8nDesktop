# Implementation Plan: n8n Desktop Application

**Branch**: `002-ui-design` | **Date**: 2025-12-04 | **Specs**: [001-n8n-desktop-app](../001-n8n-desktop-app/spec.md), [002-ui-design](./spec.md)
**Input**: Combined feature specifications for desktop application core functionality and UI design

## Summary

Build a cross-platform Electron desktop application that wraps the n8n workflow automation server, providing a native installer experience for non-technical users. The application features a custom launcher UI (Preact + shadcn-preact) for workflow management, AI service configuration, and settings, with n8n's web editor embedded via BrowserView for workflow editing and execution.

**Key Technical Decisions**:
- Spawn n8n as a child process (not embedded as library)
- Use Electron Forge with Vite plugin for build tooling
- Use shadcn-preact (community port) for UI components due to Radix UI compatibility issues
- Store configuration in electron-store with safeStorage for API key encryption
- Bundle Node.js with application for consistent n8n runtime

---

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 20.x LTS
**Primary Dependencies**: Electron 28+, Preact 10.24+, Vite 5+, TailwindCSS 4+, n8n (bundled)
**Storage**: electron-store (JSON), Electron safeStorage (API keys), n8n SQLite (workflows)
**Testing**: Vitest (unit), Playwright (E2E), Electron testing utilities
**Target Platforms**: Windows 10/11 (x64), macOS 11+ (Universal), Linux (x64/arm64)
**Project Type**: Desktop application (Electron with main + renderer processes)
**Performance Goals**: <10s startup, <500MB idle memory, <300MB installer size
**Constraints**: Offline-capable (core functionality), single-user, bundled runtime
**Scale/Scope**: Single user, ~50 workflows typical, 4 AI service integrations

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. User-First Simplicity** | ✅ Pass | Platform-native installers, auto desktop shortcut, no CLI required, transparent auth |
| **II. Data Portability** | ✅ Pass | User-selected data folder, backup/restore via UI, portable data structure |
| **III. Bundled Self-Containment** | ✅ Pass | Node.js + n8n bundled, SQLite database, offline-capable |
| **IV. Transparent Server Lifecycle** | ✅ Pass | Auto-start, tray icon status, graceful shutdown, logs accessible |
| **V. Test-Required Development** | ✅ Pass | Unit tests for logic, integration tests for IPC, E2E for user journeys |

**Technical Constraints Compliance**:
- ✅ Electron for cross-platform desktop shell
- ✅ Bundled Node.js LTS (20.x matches n8n requirements)
- ✅ SQLite for n8n database
- ✅ Target platforms: Windows 10/11, macOS 11+, Linux
- ✅ Resource budget: <500MB RAM, <10s startup, <300MB installer

---

## Project Structure

### Documentation (this feature)

```text
specs/002-ui-design/
├── plan.md              # This file
├── research.md          # Technology research and decisions
├── data-model.md        # Data entities and relationships
├── quickstart.md        # Developer setup guide
├── contracts/           # API type definitions
│   └── ipc-api.ts       # IPC contract types
└── tasks.md             # Implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/                           # Electron main process
│   ├── index.ts                    # App entry, window creation
│   ├── n8n-manager.ts              # n8n process lifecycle
│   ├── config-manager.ts           # Configuration with safeStorage
│   ├── ipc-handlers/               # IPC handlers by domain
│   │   ├── index.ts                # Handler registration
│   │   ├── n8n.ts                  # n8n control handlers
│   │   ├── config.ts               # Config handlers
│   │   ├── workflows.ts            # Workflow handlers
│   │   ├── ai-services.ts          # AI service handlers
│   │   └── storage.ts              # Storage/backup handlers
│   ├── services/                   # Business logic
│   │   ├── ai-service-tester.ts    # AI connection testing
│   │   └── backup-manager.ts       # Backup/restore
│   └── utils/                      # Utilities
│       └── port-finder.ts          # Available port detection
├── preload/                        # Context bridge
│   ├── index.ts                    # API exposure
│   └── types.ts                    # Type exports
└── renderer/                       # Preact UI
    ├── index.html                  # Entry HTML
    └── src/
        ├── main.tsx                # Preact entry
        ├── App.tsx                 # Root component with router
        ├── components/
        │   ├── ui/                 # shadcn-preact components
        │   │   ├── button.tsx
        │   │   ├── card.tsx
        │   │   ├── dialog.tsx
        │   │   ├── dropdown-menu.tsx
        │   │   ├── input.tsx
        │   │   ├── badge.tsx
        │   │   ├── toggle.tsx
        │   │   └── ...
        │   ├── layout/
        │   │   ├── Sidebar.tsx
        │   │   ├── MainLayout.tsx
        │   │   └── StatusBar.tsx
        │   └── features/
        │       ├── workflows/
        │       │   ├── WorkflowCard.tsx
        │       │   ├── WorkflowGrid.tsx
        │       │   ├── WorkflowContextMenu.tsx
        │       │   └── NewWorkflowDropdown.tsx
        │       ├── ai-services/
        │       │   ├── AIServiceCard.tsx
        │       │   └── AIServiceList.tsx
        │       └── settings/
        │           ├── SettingsDialog.tsx
        │           ├── AIServicesTab.tsx
        │           ├── StorageTab.tsx
        │           └── ServerTab.tsx
        ├── pages/
        │   ├── HomePage.tsx
        │   ├── AIServicesPage.tsx
        │   ├── RecentPage.tsx
        │   └── WelcomePage.tsx      # First-run setup
        ├── stores/                  # nanostores
        │   ├── n8n.ts               # Server status
        │   ├── workflows.ts         # Workflow state
        │   ├── settings.ts          # App settings
        │   └── ai-services.ts       # AI service state
        ├── hooks/
        │   ├── useN8nStatus.ts
        │   ├── useWorkflows.ts
        │   └── useSettings.ts
        ├── lib/
        │   ├── utils.ts             # cn() helper, etc.
        │   ├── api.ts               # window.electronAPI wrapper
        │   └── query-client.ts      # React Query setup
        └── styles/
            └── globals.css          # Tailwind + theme variables

resources/                          # Build resources
├── icon.icns                       # macOS icon
├── icon.ico                        # Windows icon
└── icon.png                        # Linux icon

tests/
├── unit/                           # Vitest unit tests
│   ├── main/
│   └── renderer/
├── integration/                    # IPC integration tests
└── e2e/                            # Playwright E2E tests

# Configuration files (root)
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.preload.json
├── tsconfig.renderer.json
├── forge.config.ts                 # Electron Forge config
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
├── eslint.config.js
├── .prettierrc
└── tailwind.config.ts              # If needed for customization
```

**Structure Decision**: Electron application with separate main/preload/renderer source trees. The main process handles n8n lifecycle and IPC, while the renderer process contains the full Preact UI. This follows Electron best practices for security (context isolation) and maintainability.

---

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)

**Goal**: Establish project scaffolding, build tooling, and core Electron architecture.

**Deliverables**:
1. Electron Forge project with Vite plugin configuration
2. TypeScript configuration for main/preload/renderer
3. ESLint + Prettier configuration
4. Basic main process with window creation
5. Preload script with context bridge
6. Minimal renderer with Preact + Tailwind

**Key Files**:
- `forge.config.ts`, `vite.*.config.ts`, `tsconfig.*.json`
- `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/main.tsx`

### Phase 2: n8n Integration (Server Lifecycle)

**Goal**: Implement n8n server spawning, management, and health monitoring.

**Deliverables**:
1. n8n process manager (spawn, stop, restart)
2. Port detection and availability checking
3. Health check and status monitoring
4. Environment configuration for n8n
5. Logging infrastructure (capture n8n stdout/stderr)
6. IPC handlers for server control

**Key Files**:
- `src/main/n8n-manager.ts`
- `src/main/ipc-handlers/n8n.ts`
- `src/main/utils/port-finder.ts`

### Phase 3: Configuration Layer

**Goal**: Implement application configuration storage with secure credential handling.

**Deliverables**:
1. electron-store setup with schema
2. safeStorage integration for API keys
3. Configuration IPC handlers
4. Data folder management
5. First-run detection and setup flow

**Key Files**:
- `src/main/config-manager.ts`
- `src/main/ipc-handlers/config.ts`

### Phase 4: UI Shell & Navigation

**Goal**: Build the application shell with sidebar navigation and theming.

**Deliverables**:
1. Dark theme CSS variables
2. Sidebar component with navigation
3. Main layout with content area
4. Status bar (server status indicator)
5. Basic routing between pages
6. shadcn-preact component setup

**Key Files**:
- `src/renderer/src/components/layout/*`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles/globals.css`

### Phase 5: Home Screen & Workflow Management

**Goal**: Implement the home screen with workflow cards and management actions.

**Deliverables**:
1. Workflow card component
2. Workflow grid/list views
3. Search and filter functionality
4. Context menu (Edit, Duplicate, Delete)
5. New workflow dropdown
6. Recent workflows tracking
7. Empty state

**Key Files**:
- `src/renderer/src/pages/HomePage.tsx`
- `src/renderer/src/components/features/workflows/*`
- `src/main/ipc-handlers/workflows.ts`

### Phase 6: n8n Editor Integration

**Goal**: Embed n8n web editor and connect workflow actions.

**Deliverables**:
1. BrowserView for n8n editor embedding
2. Navigation from workflow card to editor
3. Workflow save detection
4. Execution status monitoring
5. Import from JSON file
6. Export to JSON file

**Key Files**:
- `src/main/index.ts` (BrowserView management)
- `src/main/ipc-handlers/workflows.ts`

### Phase 7: AI Services Configuration

**Goal**: Implement AI service management UI and connection testing.

**Deliverables**:
1. AI Services page with service cards
2. Settings dialog - AI Services tab
3. API key input with secure storage
4. Server URL configuration for local services
5. Connection testing
6. Model discovery

**Key Files**:
- `src/renderer/src/pages/AIServicesPage.tsx`
- `src/renderer/src/components/features/ai-services/*`
- `src/renderer/src/components/features/settings/AIServicesTab.tsx`
- `src/main/services/ai-service-tester.ts`
- `src/main/ipc-handlers/ai-services.ts`

### Phase 8: Settings & Storage

**Goal**: Complete settings dialog and storage management.

**Deliverables**:
1. Settings dialog modal
2. Storage tab (data folder, cache)
3. Server tab (status, logs, advanced settings)
4. Backup creation
5. Backup restoration
6. Cache clearing

**Key Files**:
- `src/renderer/src/components/features/settings/*`
- `src/main/services/backup-manager.ts`
- `src/main/ipc-handlers/storage.ts`

### Phase 9: First-Run Experience

**Goal**: Implement the onboarding flow for new users.

**Deliverables**:
1. Welcome page
2. Data folder selection
3. Progress indicator
4. Automatic n8n user creation
5. Transition to home screen

**Key Files**:
- `src/renderer/src/pages/WelcomePage.tsx`

### Phase 10: System Tray & Lifecycle

**Goal**: Implement system tray integration and application lifecycle.

**Deliverables**:
1. Tray icon with status indicator
2. Tray context menu
3. Minimize to tray behavior
4. Graceful shutdown
5. Start on boot option (platform-specific)

**Key Files**:
- `src/main/index.ts` (tray management)

### Phase 11: Updates & Polish

**Goal**: Implement update checking and final polish.

**Deliverables**:
1. Update availability checking
2. Release notes display
3. Download and install flow
4. Error handling improvements
5. Loading states
6. Accessibility improvements

### Phase 12: Testing & Build

**Goal**: Comprehensive testing and production builds.

**Deliverables**:
1. Unit tests for business logic
2. Integration tests for IPC
3. E2E tests for critical paths
4. Windows installer (NSIS)
5. macOS installer (DMG, notarized)
6. Linux installer (AppImage)
7. CI/CD pipeline

---

## Dependencies

### Production

```json
{
  "dependencies": {
    "electron-store": "^10.0.0",
    "preact": "^10.24.0",
    "@preact/signals": "^1.3.0",
    "nanostores": "^0.11.0",
    "@nanostores/preact": "^0.5.0",
    "@tanstack/react-query": "^5.60.0",
    "axios": "^1.7.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0",
    "lucide-preact": "^0.460.0",
    "date-fns": "^4.1.0",
    "n8n": "1.x.x"
  }
}
```

### Development

```json
{
  "devDependencies": {
    "@electron-forge/cli": "^7.5.0",
    "@electron-forge/maker-dmg": "^7.5.0",
    "@electron-forge/maker-squirrel": "^7.5.0",
    "@electron-forge/maker-zip": "^7.5.0",
    "@electron-forge/plugin-vite": "^7.5.0",
    "@preact/preset-vite": "^2.9.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "electron": "^28.0.0",
    "eslint": "^9.0.0",
    "eslint-config-prettier": "^9.0.0",
    "prettier": "^3.0.0",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "@playwright/test": "^1.48.0"
  }
}
```

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| shadcn-preact missing components | Medium | Medium | Build custom components as needed; consider headless alternatives |
| n8n API changes between versions | Low | High | Lock n8n version; add version compatibility checks |
| Large installer size | Medium | Medium | Optimize bundling; use ASAR; exclude unused n8n nodes |
| macOS notarization issues | Medium | Medium | Test notarization early in development; have Apple Developer account ready |
| Linux keyring availability | Medium | Low | Implement fallback with warning; document requirements |
| Memory usage exceeds target | Medium | Medium | Profile regularly; implement lazy loading; manage BrowserView lifecycle |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Startup time | <10 seconds | Time from click to home screen |
| Idle memory | <500MB | Task Manager/Activity Monitor |
| Installer size | <300MB | Built artifact size |
| First workflow success | 90% | User testing |
| AI service config time | <2 minutes | User testing |
| Test coverage | >70% | Coverage report |

---

## Next Steps

Run `/speckit.tasks` to generate the detailed task breakdown for implementation.
