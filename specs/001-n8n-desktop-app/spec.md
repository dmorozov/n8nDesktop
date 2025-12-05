# Feature Specification: n8n Desktop Application

**Feature Branch**: `001-n8n-desktop-app`
**Created**: 2025-12-04
**Status**: Draft
**Input**: Desktop application for n8n AI workflows with local workflow management, AI service configuration, and automatic user setup

## Clarifications

### Session 2025-12-04

- Q: How should API keys for cloud AI services be protected at rest? → A: Store in plain text. Encryption is out of scope for initial release.
- Q: Where are workflows stored - n8n database or separate files? → A: n8n's SQLite database only; import adds to database with checkbox to override existing (checked by default); export creates JSON files.
- Q: What storage paths does the user configure? → A: Single "Data Folder" selected at first-run; all application data (database, cache, settings, backups) stored within it. "Data Folder" and "Workflows Directory" are interchangeable terms.
- Q: How are n8n version updates handled? → A: n8n version locked to app version; updates only via desktop application updates.
- Q: What does workflow "active/inactive" status mean? → A: "Active" indicates currently executing; "Inactive" means idle; multiple workflows can be active simultaneously; no auto-start on app launch.

### Session 2025-12-04 (Continued)

- Q: How should settings persistence work? → A: Explicit save required. Changes only persist when user clicks "Save Changes"; Cancel discards all changes. n8n does not support auto-save.
- Q: What level of accessibility support is required? → A: Minimal - basic keyboard navigation (Tab, Enter, Escape) for all interactive elements.
- Q: How should the app handle network unavailability? → A: For workflows using remote AI services, show banner/toast when network operations fail with retry option. Local services (Ollama, LM Studio) work offline with no notifications needed.
- Q: How should window close/background behavior work? → A: If Electron supports minimize-to-tray, use it with "Run in Background" toggle controlling whether n8n server runs when window is closed. Provide separate way (icon/menu) to exit and force-close active workflows. If minimize-to-tray not supported, check for active workflows before closing and show confirmation if any are running.
- Q: How should workflow name collisions on duplicate be handled? → A: Use timestamp suffix, e.g., "My Workflow (Copy 2025-12-04)".
- Q: How should long text be handled in workflow cards? → A: Truncate with ellipsis (...), show full text on hover tooltip.
- Q: How should n8n port conflicts on startup be handled? → A: Show error with option to change port in settings or retry.
- Q: What should the empty state display? → A: Template-based - Icon + "No workflows yet" + "Create New Workflow" button + "Start from template" with 3 starter templates (1 AI, 1 general automation, 1 data/PDF processing).
- Q: How should server logs be managed? → A: Persistent log file with rotation (keep last 7 days / 10MB). Modal dialog to view + "Open log file" button to view in system editor.
- Q: Should API keys be validated before saving? → A: No validation until "Test" clicked - save any input. API keys are optional for local services (Ollama, LM Studio).
- Q: Should backups be encrypted? → A: No encryption. Backups are plain ZIP files; user is responsible for securing the file.
- Q: Should concurrent workflow execution be limited? → A: Yes, configurable limit up to 3 active workflows by default.
- Q: What should the "Recent" page show? → A: Recently opened workflows sorted by last-opened time (not last-modified).
- Q: How comprehensive should the first-run experience be? → A: Minimal - App logo + "Select where to store your data" + folder picker + Continue.

### Session 2025-12-04 (Final Clarifications)

- Q: What options should the system tray context menu include? → A: Minimal - "Show Window" and "Exit" only.
- Q: Where should update notifications appear? → A: Banner at top of main window, persistent until dismissed or acted upon.
- Q: What is the graceful shutdown timeout? → A: 5 seconds; if exceeded, force kill the server process.
- Q: What filter options should be available for workflows? → A: Status only (All, Active, Inactive).
- Q: What happens if user tries to change data folder while workflows are running? → A: Block the change - show message "Stop all running workflows before changing data folder".
- Q: What columns should the list view include? → A: Name, Description, Status, AI Service, Last Modified, Actions.
- Q: How should "standard hardware" be defined for performance targets? → A: Recommended specs - 8GB RAM, SSD, 4-core CPU (2018+).
- Q: How should relative times be displayed? → A: Always relative - "Just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago", then date (e.g., "Dec 1") after 7 days.
- Q: How should workflow import failures be handled? → A: Show error message with details, no partial data saved.
- Q: What if AI service test succeeds but returns no models? → A: Show "Connected (No models)" status badge, allow save anyway.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install and First Launch (Priority: P1)

A non-technical user downloads the n8n Desktop installer and installs it like any regular application. After installation, they click the desktop shortcut and are greeted with a welcome screen that guides them to select a folder for storing their data. The application automatically sets up everything needed in the background, and the user sees a home screen ready to create their first workflow.

**Why this priority**: Without installation and first-run setup, no other functionality is accessible. This is the foundation that enables all other user stories.

**Independent Test**: Can be fully tested by running the installer on a clean system and verifying the application launches to the home screen without any manual configuration.

**Acceptance Scenarios**:

1. **Given** the user has downloaded the installer, **When** they run it and follow the standard installation wizard, **Then** the application is installed with a desktop shortcut created automatically.
2. **Given** this is the first launch, **When** the user clicks the desktop shortcut, **Then** a welcome screen appears prompting them to select a data storage folder.
3. **Given** the user has selected a data folder, **When** setup completes, **Then** the application shows the home screen within 10 seconds without showing any server credentials or technical details.
4. **Given** the application is running, **When** the user looks at the system tray, **Then** an icon indicates the application status.

---

### User Story 2 - Create and Run a Workflow (Priority: P1)

A user wants to create their first AI workflow. From the home screen, they click "New Workflow" and the n8n editor opens in an embedded view. They build a simple workflow by dragging nodes and connecting them. They save the workflow with a name and run it to see results.

**Why this priority**: Creating and running workflows is the core value proposition—without this, the application has no purpose.

**Independent Test**: Can be tested by creating a simple workflow with 2-3 nodes, saving it, and executing it to verify output.

**Acceptance Scenarios**:

1. **Given** the user is on the home screen, **When** they click "New Workflow", **Then** the n8n workflow editor opens in the embedded view.
2. **Given** the user has built a workflow in the editor, **When** they save it, **Then** they are prompted to enter a name and the workflow appears in their recent workflows list.
3. **Given** the user has a saved workflow, **When** they click run/execute, **Then** the workflow executes and results are displayed in the editor.
4. **Given** a workflow is open, **When** the user makes changes and closes the application, **Then** they are prompted to save unsaved changes.

---

### User Story 3 - Configure AI Services (Priority: P2)

A user wants to use AI nodes in their workflows. They open the application settings and configure connections to AI services—either local LLMs running via Ollama/LM Studio or cloud services like ChatGPT or Gemini. Once configured, these AI services become available across all their workflows.

**Why this priority**: AI workflow capability is the main draw for the target audience, but basic workflow functionality must work first.

**Independent Test**: Can be tested by configuring an AI service (Ollama local or ChatGPT cloud) and verifying it appears as an available option in workflow AI nodes.

**Acceptance Scenarios**:

1. **Given** the user is in the application, **When** they open Settings from the home screen or menu, **Then** an AI Services configuration section is visible.
2. **Given** the user is in AI Services settings, **When** they add a new local AI service (Ollama), **Then** they can specify the local server address and the connection is tested.
3. **Given** the user is in AI Services settings, **When** they add a cloud AI service (ChatGPT/Gemini), **Then** they can enter their API key and select available models.
4. **Given** AI services are configured, **When** the user creates a workflow with AI nodes, **Then** the configured services appear as options in the node configuration.
5. **Given** an AI service is configured, **When** the user edits or removes it, **Then** workflows using that service are notified of the change.

---

### User Story 4 - Manage Existing Workflows (Priority: P2)

A user returns to the application to continue working on their workflows. They see a list of recent workflows on the home screen, can open any of them, and can also import workflows from JSON files or export their workflows for backup or sharing.

**Why this priority**: Returning users need to access their previous work efficiently, making this essential for ongoing usage.

**Independent Test**: Can be tested by creating multiple workflows, closing the app, reopening, and verifying all workflows appear in the recent list with correct names and last-modified dates.

**Acceptance Scenarios**:

1. **Given** the user has created workflows previously, **When** they launch the application, **Then** the home screen shows a list of recent workflows sorted by last modified date.
2. **Given** the user is on the home screen, **When** they click a workflow in the recent list, **Then** that workflow opens in the editor.
3. **Given** the user wants to import a workflow, **When** they click "Open" and select a JSON file from disk, **Then** the workflow is imported and opens in the editor.
4. **Given** the user has a workflow open, **When** they choose to export it, **Then** a JSON file is saved to their chosen location.
5. **Given** the user wants to organize workflows, **When** they right-click a workflow in the list, **Then** they can rename or delete it.

---

### User Story 5 - Backup and Restore Data (Priority: P3)

A user wants to protect their workflows and settings by creating a backup. They access the backup feature from settings, choose a location, and create a complete backup. Later, they can restore from this backup on the same or different machine.

**Why this priority**: Data safety is important but not blocking for initial usage—users can manually copy the data folder initially.

**Independent Test**: Can be tested by creating a backup, uninstalling the app, reinstalling, and restoring from backup to verify all workflows and settings return.

**Acceptance Scenarios**:

1. **Given** the user is in Settings, **When** they navigate to Backup & Restore, **Then** they see options to create backup and restore from backup.
2. **Given** the user clicks Create Backup, **When** they select a destination, **Then** a single backup file is created containing all workflows, credentials, and settings.
3. **Given** the user has a backup file, **When** they choose Restore and select the file, **Then** a confirmation prompt warns this will replace current data.
4. **Given** the user confirms restore, **When** the restore completes, **Then** all workflows and settings from the backup are available.

---

### User Story 6 - Application Updates (Priority: P3)

A user is notified when a new version of n8n Desktop is available. They can view release notes and choose when to download and install the update.

**Why this priority**: Updates are important for maintenance but not required for core functionality.

**Independent Test**: Can be tested by simulating an available update and verifying the notification appears with correct version info.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** a new version is available, **Then** a non-intrusive notification appears.
2. **Given** an update notification is shown, **When** the user clicks it, **Then** they see release notes and a download option.
3. **Given** the user chooses to download, **When** download completes, **Then** they are prompted to install now or later.
4. **Given** the user chooses to install, **When** they confirm, **Then** the application closes, installs the update, and relaunches.

---

### Edge Cases

- What happens when the user's selected data folder becomes unavailable (e.g., external drive disconnected)?
  - Application shows an error with option to select a new data folder or wait for the drive to reconnect.
- What happens when a configured AI service becomes unreachable during workflow execution?
  - Workflow execution pauses with a clear error message identifying which service failed and offering retry option.
- What happens when the user tries to open a workflow file that was created with a newer version?
  - Application warns about version mismatch and offers to attempt import with potential feature loss.
- What happens when disk space is insufficient for backup?
  - Backup fails with clear error message showing required vs available space.
- What happens when the embedded n8n server fails to start?
  - Application shows diagnostic information with common solutions (port conflict, insufficient memory) and option to view logs.

## Requirements *(mandatory)*

### Functional Requirements

**Installation & Setup**
- **FR-001**: System MUST provide platform-native installers (Windows wizard, macOS DMG, Linux AppImage).
- **FR-002**: Installation MUST create a desktop shortcut automatically.
- **FR-003**: First launch MUST prompt user to select a single data folder where all application data (database, cache, settings, backups) will be stored.
- **FR-004**: System MUST automatically create and manage internal n8n user credentials without user interaction.
- **FR-005**: System MUST complete first-run setup within 30 seconds on standard hardware.

**Home Screen & Navigation**
- **FR-006**: Application MUST display a home screen on launch showing recent workflows, new workflow, and open workflow options.
- **FR-007**: Home screen MUST display recent workflows sorted by last modified date with workflow name and modification timestamp.
- **FR-008**: Users MUST be able to access Settings from the home screen.

**Workflow Management**
- **FR-009**: Users MUST be able to create new workflows from the home screen.
- **FR-010**: System MUST display n8n workflow editor in an embedded browser view within the application window.
- **FR-011**: Users MUST be able to save workflows with a custom name.
- **FR-012**: Users MUST be able to execute workflows and view results in the editor.
- **FR-013**: System MUST prompt to save unsaved changes when closing a workflow or the application.
- **FR-014**: Users MUST be able to import workflows from JSON files into n8n's internal database.
- **FR-034**: When importing a workflow matching an existing name, system MUST show confirmation with "Override existing" checkbox (checked by default).
- **FR-015**: Users MUST be able to export workflows to JSON files.
- **FR-016**: Users MUST be able to rename and delete workflows from the home screen.

**AI Service Configuration**
- **FR-017**: Settings MUST include an AI Services configuration section.
- **FR-018**: Users MUST be able to configure local AI services (Ollama, LM Studio) by specifying server address.
- **FR-019**: Users MUST be able to configure cloud AI services (ChatGPT, Gemini) by entering API keys.
- **FR-035**: API keys MUST be stored in plain text in the data folder. API keys are optional for local AI services (Ollama, LM Studio).
- **FR-020**: System MUST test AI service connections when configured and display connection status.
- **FR-021**: Configured AI services MUST be available as options in workflow AI nodes.
- **FR-022**: Users MUST be able to edit and remove configured AI services.

**Backup & Restore**
- **FR-023**: Users MUST be able to create a complete backup containing all workflows, credentials, and settings as an unencrypted ZIP file.
- **FR-024**: Users MUST be able to restore from a backup file.
- **FR-025**: Restore operation MUST require user confirmation before overwriting existing data.

**Workflow Execution**
- **FR-036**: System MUST support concurrent workflow execution with a configurable limit (default: 3 active workflows).
- **FR-037**: When a workflow using remote AI services fails due to network unavailability, system MUST show a banner/toast with retry option.

**Server & Logging**
- **FR-038**: System MUST maintain persistent server logs with rotation (keep last 7 days or 10MB, whichever is smaller).
- **FR-039**: Users MUST be able to view server logs in a modal dialog with option to open log file in system editor.
- **FR-040**: When n8n port is already in use on startup, system MUST show error with option to change port in settings or retry.

**Empty State & Templates**
- **FR-041**: When no workflows exist, home screen MUST show empty state with "Create New Workflow" button and "Start from template" option.
- **FR-042**: System MUST provide 3 starter workflow templates: 1 AI-focused, 1 general automation, 1 data/PDF processing.

**System Tray & Lifecycle**
- **FR-026**: Application MUST display a system tray icon showing server status (running, stopped, error).
- **FR-045**: System tray context menu MUST contain only two options: "Show Window" and "Exit".
- **FR-027**: Application MUST start the embedded n8n server automatically on launch.
- **FR-028**: Application MUST gracefully shut down the n8n server with 5-second timeout; if exceeded, force kill the server process.
- **FR-029**: If Electron supports minimize-to-tray: closing main window MUST minimize to tray; "Run in Background" toggle controls whether n8n server continues running; separate menu/icon option to fully exit and force-close active workflows.
- **FR-043**: If minimize-to-tray not supported: closing with active workflows MUST show confirmation dialog; closing without active workflows exits immediately.

**Data Folder Management**
- **FR-046**: System MUST block data folder changes while workflows are running, showing message "Stop all running workflows before changing data folder".

**Accessibility**
- **FR-044**: All interactive elements MUST support basic keyboard navigation (Tab, Enter, Escape).

**Updates**
- **FR-030**: Application MUST check for updates on startup when internet is available.
- **FR-031**: Update availability MUST be shown as a banner at the top of the main window, persistent until dismissed or acted upon.
- **FR-032**: Users MUST be able to view release notes before downloading an update.
- **FR-033**: Users MUST be able to defer updates to install later.

**Workflow Import**
- **FR-047**: When workflow import fails, system MUST show error message with details; no partial data is saved.

**AI Service Configuration**
- **FR-048**: When AI service connection test succeeds but returns no models, system MUST show "Connected (No models)" status badge and allow save.

### Key Entities

- **Workflow**: A user-created automation containing nodes and connections, with name, creation date, last modified date, and execution status (active=running, inactive=idle). Stored in n8n's internal SQLite database.
- **AI Service Configuration**: A saved connection to an AI provider (local or cloud), including service type, connection details, and available models.
- **Application Settings**: User preferences including data folder location, window behavior, and update preferences.
- **Backup**: A portable archive containing all workflows, AI service configurations, credentials, and settings.

## Assumptions

- Users have basic computer literacy (can install applications, use file dialogs, understand settings menus).
- Target machines have sufficient resources: minimum 4GB RAM, 1GB disk space.
- Local AI services (Ollama, LM Studio) are installed and running separately by the user if they want to use them.
- Cloud AI services require users to have their own API keys.
- The embedded n8n server runs on localhost with an automatically assigned port.
- n8n version is locked to the application version; users receive n8n updates only through desktop app updates.
- Workflows are stored in n8n's internal SQLite database, not as separate files (export creates JSON files on demand).
- Data folder remains accessible throughout application usage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete installation and reach the home screen within 5 minutes, including data folder selection.
- **SC-002**: Users can create, save, and execute a simple workflow within 10 minutes on first use.
- **SC-003**: Application starts and shows home screen within 10 seconds on standard hardware.
- **SC-004**: Users can configure an AI service and use it in a workflow within 5 minutes.
- **SC-005**: 90% of first-time users successfully create and run a workflow without external help.
- **SC-006**: Backup and restore operations complete within 2 minutes for typical usage (up to 50 workflows).
- **SC-007**: Application runs with less than 500MB memory when idle.
- **SC-008**: Users can import/export workflow files and successfully use them on another machine with n8n Desktop.
