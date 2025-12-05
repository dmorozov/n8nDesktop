<!--
  Sync Impact Report
  ===================
  Version change: 0.0.0 → 1.0.0 (initial ratification)

  Modified principles: N/A (initial version)

  Added sections:
  - Core Principles (5 principles)
  - Technical Constraints
  - User Experience Standards
  - Governance

  Removed sections: N/A (initial version)

  Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ No changes needed (generic template)
  - .specify/templates/spec-template.md: ✅ No changes needed (generic template)
  - .specify/templates/tasks-template.md: ✅ No changes needed (generic template)

  Follow-up TODOs: None
-->

# n8n Desktop Constitution

## Core Principles

### I. User-First Simplicity

The primary audience consists of users with limited technical skills who want to run AI workflows locally. Every feature and design decision MUST prioritize ease of use:

- Installation MUST follow standard OS conventions (wizard on Windows, DMG on macOS, AppImage/DEB on Linux)
- No command-line interaction required for normal operation
- Desktop shortcut creation MUST be automatic during installation
- Authentication MUST be transparent—the application handles n8n user creation and auto-login without user intervention
- Error messages MUST be actionable and non-technical

### II. Data Portability and User Control

All user data MUST reside in a user-selected folder, enabling full portability:

- First launch MUST prompt for data storage location selection
- Workflows, credentials (encrypted), and settings stored in user-chosen directory
- Data folder structure MUST be documented and stable across versions
- Backup/restore functionality MUST be built-in, not requiring manual file copying
- Moving the data folder to another machine MUST result in a working installation

### III. Bundled Self-Containment

The application MUST be fully self-contained with no external dependencies:

- Node.js runtime bundled within the application package
- n8n server and all required npm packages bundled
- No internet connection required for core functionality after installation
- External network access only for: update notifications, n8n workflow HTTP nodes, AI provider APIs
- Each platform build (Windows, macOS, Linux) MUST be independently installable

### IV. Transparent Server Lifecycle

Users need not understand they are running a server, but advanced users should have visibility:

- n8n server starts automatically when application launches
- System tray icon indicates server status (running, stopped, error)
- Graceful shutdown when application closes or system shuts down
- Update notifications shown non-intrusively; user decides when to update
- Server logs accessible through UI for troubleshooting (hidden by default)

### V. Test-Required Development

All features MUST have corresponding tests to ensure reliability for non-technical users:

- Unit tests required for business logic and utilities
- Integration tests required for Electron ↔ n8n server communication
- End-to-end tests required for critical user journeys (install, first run, workflow execution)
- Tests MAY be written after implementation but MUST exist before feature merge
- CI pipeline MUST pass all tests before release builds

## Technical Constraints

**Runtime Stack**:
- Electron for cross-platform desktop shell
- Bundled Node.js (LTS version matching n8n requirements)
- SQLite for n8n's local database (default for self-hosted n8n)

**Target Platforms** (all supported from initial release):
- Windows 10/11 (x64)
- macOS 11+ (Intel and Apple Silicon)
- Linux (Ubuntu 20.04+, Debian 11+, Fedora 35+)

**Resource Budget** (balanced approach):
- Idle memory: Target <500MB RAM
- Active workflow execution: Scale with workflow complexity
- Startup time: Target <10 seconds to ready state
- Installer size: Target <300MB per platform

**Build Outputs**:
- Windows: NSIS installer (.exe)
- macOS: DMG with app bundle, notarized for Gatekeeper
- Linux: AppImage (primary), optional .deb/.rpm

## User Experience Standards

**First Run Experience**:
1. Welcome screen with data folder selection
2. Automatic n8n user creation (no credentials shown to user)
3. Browser opens to n8n UI, already logged in
4. System tray icon appears with status

**Enhanced Features** (beyond basic wrapper):
- Workflow backup and restore via UI
- Workflow import/export (JSON files)
- Simplified settings panel for common n8n configuration
- Data folder migration assistant

**Update Flow**:
1. Application checks for updates on startup (if online)
2. Non-intrusive notification if update available
3. User clicks to download new installer
4. User runs new installer (in-place upgrade)

## Governance

This constitution establishes non-negotiable principles for n8n Desktop development:

- All pull requests MUST demonstrate compliance with these principles
- Principle violations require explicit justification and team approval
- Amendments require: documented rationale, review period, version increment
- Version follows semantic versioning:
  - MAJOR: Principle removal or incompatible redefinition
  - MINOR: New principle or significant expansion
  - PATCH: Clarifications and refinements

**Version**: 1.0.0 | **Ratified**: 2025-12-04 | **Last Amended**: 2025-12-04
