# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

n8n Desktop wraps the n8n workflow automation server in an Electron shell, providing a native desktop experience for non-technical users who want to run AI workflows locally.

## Core Principles (from Constitution)

1. **User-First Simplicity**: No CLI, automatic user creation/login, standard installers
2. **Data Portability**: All data in user-selected folder, fully portable between machines
3. **Bundled Self-Containment**: Node.js + n8n bundled, no external dependencies
4. **Transparent Server Lifecycle**: Auto-start, tray icon status, graceful shutdown
5. **Test-Required Development**: Tests required before feature merge

## Architecture

- **Electron Main Process**: Server lifecycle, tray icon, window management, IPC
- **Embedded n8n**: Bundled Node.js runtime executes n8n server as child process
- **Data Layer**: SQLite database + files in user-selected folder
- **Platforms**: Windows (NSIS), macOS (DMG), Linux (AppImage)

## Technical Stack

- Electron (desktop shell)
- Bundled Node.js LTS (n8n runtime)
- SQLite (n8n database)
- electron-builder (packaging)

## Resource Targets

- Idle memory: <500MB
- Startup time: <10 seconds
- Installer size: <300MB

## SpecKit Integration

Use `/speckit.*` slash commands for spec-driven development:
- `/speckit.specify` - Create feature specification
- `/speckit.plan` - Create implementation plan
- `/speckit.tasks` - Generate task list
- `/speckit.implement` - Execute implementation

Constitution: `.specify/memory/constitution.md`

## Active Technologies
- TypeScript 5.6+, Node.js 20.x LTS + Electron 28+, Preact 10.24+, Vite 5+, TailwindCSS 4+, n8n (bundled) (002-ui-design)
- electron-store (JSON), Electron safeStorage (API keys), n8n SQLite (workflows) (002-ui-design)

## Recent Changes
- 002-ui-design: Added TypeScript 5.6+, Node.js 20.x LTS + Electron 28+, Preact 10.24+, Vite 5+, TailwindCSS 4+, n8n (bundled)

## Design
- [Architecture of the application](./design/ARCHITECTURE.md)
- [Docling N8N communication inside of Electron app](./design/DOCLING_N8N_ELECTRON.md)
- [Docling integration planning](./design/DOCLING_PLANNING.md)
- [IPC implementation recommendations](./design/IPC_RECOMMENDATIONS.md)
- [UI Design mock screens](./design/UI/)

