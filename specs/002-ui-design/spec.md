# Feature Specification: n8n Desktop UI Design

**Feature Branch**: `002-ui-design`
**Created**: 2025-12-04
**Status**: Draft
**Input**: UI design specification based on design mockups for home page, workflow management, AI services, and settings

## Clarifications

### Session 2025-12-04

- Q: How should API keys for cloud AI services be protected at rest? → A: Store in plain text. Encryption is out of scope for initial release.
- Q: Where are workflows stored - n8n database or separate files? → A: n8n's SQLite database only; import adds to database with checkbox to override existing (checked by default); export creates JSON files.
- Q: What storage paths does the user configure? → A: Single "Data Folder" selected at first-run; all application data (database, cache, settings, backups) stored within it. "Data Folder" and "Workflows Directory" are interchangeable terms.
- Q: How are n8n version updates handled? → A: n8n version locked to app version; updates only via desktop application updates.
- Q: What does workflow "active/inactive" status mean? → A: "Active" indicates currently executing; "Inactive" means idle; multiple workflows can be active simultaneously; no auto-start on app launch.

### Session 2025-12-04 (Continued)

- Q: How should settings persistence work? → A: Explicit save required. Changes only persist when user clicks "Save Changes"; Cancel discards all changes.
- Q: What level of accessibility support is required? → A: Minimal - basic keyboard navigation (Tab, Enter, Escape) for all interactive elements.
- Q: How should the app handle network unavailability? → A: For workflows using remote AI services, show banner/toast when network operations fail with retry option. Local services (Ollama, LM Studio) work offline with no notifications needed.
- Q: How should window close/background behavior work? → A: If Electron supports minimize-to-tray, use it with "Run in Background" toggle controlling whether n8n server runs when window is closed. Provide separate way (icon/menu) to exit and force-close active workflows.
- Q: How should workflow name collisions on duplicate be handled? → A: Use timestamp suffix, e.g., "My Workflow (Copy 2025-12-04)".
- Q: How should long text be handled in workflow cards? → A: Truncate with ellipsis (...), show full text on hover tooltip.
- Q: How should n8n port conflicts on startup be handled? → A: Show error dialog with option to change port in settings or retry.
- Q: What should the empty state display? → A: Template-based - Icon + "No workflows yet" + "Create New Workflow" button + "Start from template" with 3 starter templates (1 AI, 1 general automation, 1 data/PDF processing).
- Q: How should server logs be managed? → A: Persistent log file with rotation (keep last 7 days / 10MB). Modal dialog to view + "Open log file" button to view in system editor.
- Q: Should API keys be validated before saving? → A: No validation until "Test" clicked - save any input. API keys are optional for local services (Ollama, LM Studio).
- Q: Should backups be encrypted? → A: No encryption. Backups are plain ZIP files.
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

### User Story 1 - Navigate Home Screen and View Workflows (Priority: P1)

A user launches n8n Desktop and sees the home screen with a left sidebar containing navigation and a main content area displaying their workflows. The sidebar shows the app branding "n8n AI Runner", a prominent "New Workflow" button, and navigation links to Workflows, Recent, and AI Services. The main area displays workflow cards in a grid layout with search and filtering options.

**Why this priority**: The home screen is the first thing users see and the hub for all workflow operations. Without it, users cannot access any functionality.

**Independent Test**: Can be tested by launching the application and verifying all navigation elements are visible, clickable, and workflow cards display correct information.

**Acceptance Scenarios**:

1. **Given** the application is launched, **When** the home screen loads, **Then** the left sidebar displays the n8n AI Runner branding, "New Workflow" button, and navigation items (Workflows, Recent, AI Services).
2. **Given** the user has existing workflows, **When** viewing the home screen, **Then** workflow cards are displayed in a grid showing name, description, AI service used, status badge (active/inactive), node count, and last modified time.
3. **Given** the user is on the home screen, **When** they click on a workflow card, **Then** the workflow opens in the n8n editor.
4. **Given** the home screen is displayed, **When** the user types in the search box, **Then** workflows are filtered by name in real-time.
5. **Given** the home screen is displayed, **When** the user clicks the filter icon, **Then** filtering options appear (by status, AI service, date range).
6. **Given** the home screen is displayed, **When** the user clicks the grid/list view toggle, **Then** the workflow display switches between grid and list layouts.

---

### User Story 2 - Create New Workflow (Priority: P1)

A user clicks the "New Workflow" dropdown button in the sidebar and sees options to either "Create New" workflow or "Open from Disk" to import an existing workflow file. Selecting "Create New" opens a blank workflow in the n8n editor. Selecting "Open from Disk" opens a file browser to select a workflow JSON file.

**Why this priority**: Creating workflows is the primary action users need to perform. This must work before any other workflow functionality.

**Independent Test**: Can be tested by clicking "New Workflow", selecting "Create New", and verifying a blank workflow editor opens.

**Acceptance Scenarios**:

1. **Given** the user is on any screen, **When** they click the "New Workflow" button, **Then** a dropdown appears with "Create New" and "Open from Disk" options.
2. **Given** the dropdown is open, **When** the user clicks "Create New", **Then** a new blank workflow opens in the embedded n8n editor.
3. **Given** the dropdown is open, **When** the user clicks "Open from Disk", **Then** a native file browser opens filtered to JSON files.
4. **Given** the user selects a valid workflow JSON file, **When** they confirm, **Then** the workflow is imported and opens in the editor.

---

### User Story 3 - Manage Existing Workflow (Priority: P1)

A user wants to manage an existing workflow from the home screen. They can hover over or right-click a workflow card to access a context menu with options to Edit (open in editor), Duplicate (create a copy), or Delete the workflow. The "Run" button on each card allows quick execution without opening the editor.

**Why this priority**: Managing workflows (edit, duplicate, delete, run) are essential daily operations users need for productive work.

**Independent Test**: Can be tested by right-clicking a workflow card and verifying all context menu options work correctly.

**Acceptance Scenarios**:

1. **Given** a workflow card is displayed, **When** the user clicks the menu icon (three dots) or right-clicks, **Then** a context menu appears with Edit, Duplicate, and Delete options.
2. **Given** the context menu is open, **When** the user clicks "Edit", **Then** the workflow opens in the n8n editor.
3. **Given** the context menu is open, **When** the user clicks "Duplicate", **Then** a copy of the workflow is created with "(Copy)" appended to the name.
4. **Given** the context menu is open, **When** the user clicks "Delete", **Then** a confirmation dialog appears before deletion.
5. **Given** a workflow card is displayed, **When** the user clicks the "Run" button, **Then** the workflow executes and status updates to show execution progress.

---

### User Story 4 - View and Manage AI Services (Priority: P2)

A user navigates to the AI Services page via the sidebar to see all configured AI service providers displayed as cards. Each card shows the service name (OpenAI, Ollama, LM Studio, Google Gemini), type badge (cloud/local), connection status, description, available models as tags, and a "Configure" button. Users can add new services via the "+ Add Service" button.

**Why this priority**: AI service configuration is required before users can use AI nodes in workflows, but basic workflow functionality should work first.

**Independent Test**: Can be tested by navigating to AI Services page and verifying all service cards display correct information and Configure buttons are functional.

**Acceptance Scenarios**:

1. **Given** the user clicks "AI Services" in the sidebar, **When** the page loads, **Then** configured AI services are displayed as cards showing name, type (cloud/local), connection status, description, and available models.
2. **Given** the AI Services page is displayed, **When** a service is connected, **Then** a green "Connected" status badge is shown.
3. **Given** the AI Services page is displayed, **When** a service is not configured, **Then** a "Not configured" status is shown with a highlighted "Configure" button.
4. **Given** the user clicks "+ Add Service", **When** the add service flow starts, **Then** they can select from supported AI service types to configure.
5. **Given** a service card is displayed, **When** the user clicks "Configure", **Then** the settings dialog opens to the AI Services tab with that service expanded.
6. **Given** a configured service card is displayed, **When** the user clicks the delete icon, **Then** a confirmation dialog appears before removal.

---

### User Story 5 - Configure AI Service Settings (Priority: P2)

A user opens the Settings dialog and navigates to the "AI Services" tab to configure API keys and connection details for AI providers. For cloud services (OpenAI, Gemini), they enter API keys with a masked input field and can test the connection. For local services (Ollama, LM Studio), they enter the server URL and test connectivity. Each service shows available models and allows selecting a default model.

**Why this priority**: Detailed AI service configuration is necessary for AI workflows but builds on the AI Services page foundation.

**Independent Test**: Can be tested by opening Settings > AI Services, entering an API key or server URL, clicking Test, and verifying connection status updates.

**Acceptance Scenarios**:

1. **Given** the user opens Settings, **When** they click the "AI Services" tab, **Then** all AI service configurations are listed with expandable sections.
2. **Given** a cloud service (OpenAI/Gemini) section is visible, **When** viewing configuration, **Then** an API Key field (masked by default), show/hide toggle, Test button, and Default Model dropdown are displayed.
3. **Given** a local service (Ollama/LM Studio) section is visible, **When** viewing configuration, **Then** a Server URL field, Test button, and Default Model dropdown are displayed.
4. **Given** valid credentials are entered, **When** the user clicks "Test", **Then** the connection is verified and status updates to "Connected" (green) or shows error message.
5. **Given** configuration changes are made, **When** the user clicks "Save Changes", **Then** settings are persisted and the dialog closes.
6. **Given** configuration changes are made, **When** the user clicks "Cancel", **Then** changes are discarded and the dialog closes.

---

### User Story 6 - Configure Storage Settings (Priority: P2)

A user opens the Settings dialog and navigates to the "Storage" tab to manage where workflows and application data are stored. They can change the Workflows Directory, enable/disable Auto-save, enable/disable automatic backups, view and change the Data Directory, see cache size, and clear the cache.

**Why this priority**: Storage configuration affects data persistence and backup, important for user data safety but not blocking core functionality.

**Independent Test**: Can be tested by opening Settings > Storage, changing the workflows directory via Browse, and verifying workflows are accessible from the new location.

**Acceptance Scenarios**:

1. **Given** the user opens Settings, **When** they click the "Storage" tab, **Then** Workflow Storage and Data Storage sections are displayed.
2. **Given** the Storage tab is active, **When** viewing Workflow Storage section, **Then** Workflows Directory path with Browse button, Auto-save toggle, and Create Backups toggle are visible.
3. **Given** the user clicks Browse for Workflows Directory, **When** they select a folder, **Then** the path updates and workflows will be saved to the new location.
4. **Given** the Storage tab is active, **When** viewing Data Storage section, **Then** Data Directory path with Browse button, Cache size display, and Clear Cache button are visible.
5. **Given** the user clicks "Clear Cache", **When** confirmed, **Then** cache is cleared and cache size updates to reflect freed space.

---

### User Story 7 - Configure Server Settings (Priority: P3)

A user opens the Settings dialog and navigates to the "Server" tab to view n8n server status and configure advanced options. They can see server status (Running/Stopped), port number, version, and uptime. The Authentication section confirms credentials are auto-managed. Advanced Settings allow configuring startup behavior and server port.

**Why this priority**: Server settings are for advanced users and troubleshooting; most users will never need to change these.

**Independent Test**: Can be tested by opening Settings > Server and verifying server status displays correctly and Restart Server button functions.

**Acceptance Scenarios**:

1. **Given** the user opens Settings, **When** they click the "Server" tab, **Then** n8n Server status section shows status indicator, port, version, and uptime.
2. **Given** the Server tab is active, **When** the server is running, **Then** a green "Running" badge and status dot are displayed.
3. **Given** the Server tab is active, **When** the user clicks "Restart Server", **Then** the server restarts and status updates accordingly.
4. **Given** the Server tab is active, **When** the user clicks "View Logs", **Then** server logs are displayed in a scrollable view.
5. **Given** the Server tab is active, **When** viewing Authentication section, **Then** a message confirms "Server credentials are automatically managed. No action required."
6. **Given** the Server tab is active, **When** viewing Advanced Settings, **Then** "Start on System Boot" toggle, "Run in Background" toggle, and Server Port field are available.

---

### User Story 8 - Monitor Application Status (Priority: P3)

A user can always see the n8n server status in the bottom-left corner of the sidebar, showing "n8n Server Running" with a green status indicator. This provides constant visibility into server health without opening settings.

**Why this priority**: Status monitoring is passive functionality that enhances user awareness but doesn't block core operations.

**Independent Test**: Can be tested by verifying the status indicator is visible and accurately reflects server state.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** viewing any screen, **Then** the sidebar footer shows "n8n Server Running" with a green dot when server is healthy.
2. **Given** the server encounters an error, **When** viewing any screen, **Then** the status indicator changes to red/yellow with an error message.
3. **Given** the status indicator is visible, **When** the user clicks it, **Then** the Settings dialog opens to the Server tab for detailed status.

---

### Edge Cases

- What happens when the user tries to open a corrupted workflow JSON file?
  - Display an error message explaining the file could not be parsed, with option to view technical details.
- What happens when an AI service connection test fails?
  - Display specific error message (invalid API key, server unreachable, timeout) with suggestions for resolution.
- What happens when the workflows directory becomes inaccessible?
  - Show prominent warning banner on home screen with option to select a new directory.
- What happens when the user deletes the last workflow?
  - Show empty state on home screen with prompt to create first workflow.
- What happens when cache clearing fails?
  - Display error message with manual cleanup instructions.

## Requirements *(mandatory)*

### Functional Requirements

**Application Shell & Layout**
- **FR-001**: Application MUST display a persistent left sidebar with branding, primary actions, and navigation.
- **FR-002**: Sidebar MUST contain: app logo and name ("n8n AI Runner"), "New Workflow" dropdown button, navigation links (Workflows, Recent, AI Services), server status indicator, and Settings access.
- **FR-003**: Main content area MUST fill remaining space and display context-appropriate content based on navigation selection.
- **FR-004**: Application MUST use a dark theme with green accent color for primary actions and status indicators.

**Home Screen / Workflows View**
- **FR-005**: Home screen MUST display page title "All Workflows" with workflow count badge.
- **FR-006**: Home screen MUST provide search input for filtering workflows by name.
- **FR-007**: Home screen MUST provide filter dropdown with status options: All, Active, Inactive.
- **FR-008**: Home screen MUST provide grid/list view toggle for switching display layouts. List view columns: Name, Description, Status, AI Service, Last Modified, Actions.
- **FR-009**: Workflow cards in grid view MUST display: workflow icon, name (truncated with ellipsis if too long, full text on hover tooltip), last modified time (relative format: "Just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago", then "Dec 1" after 7 days), description (truncated with ellipsis, full text on hover tooltip), AI service used with icon, execution status badge (active=currently running/inactive=idle), node count, and Run button.
- **FR-010**: Workflow cards MUST provide context menu (via click or right-click) with Edit, Duplicate, and Delete options. Duplicate appends timestamp suffix to name, e.g., "My Workflow (Copy 2025-12-04)".
- **FR-011**: Home screen MUST display empty state when no workflows exist: icon, "No workflows yet" message, "Create New Workflow" button, and "Start from template" with 3 starter templates (1 AI, 1 general automation, 1 data/PDF processing).

**New Workflow Dropdown**
- **FR-012**: "New Workflow" button MUST be a dropdown with chevron indicator.
- **FR-013**: Dropdown MUST contain "Create New" option with plus icon.
- **FR-014**: Dropdown MUST contain "Open from Disk..." option with folder icon.
- **FR-036**: When importing a workflow that matches an existing workflow name, system MUST show confirmation dialog with "Override existing workflow" checkbox (checked by default).

**AI Services Page**
- **FR-015**: AI Services page MUST display title "AI Services" with connected service count badge.
- **FR-016**: AI Services page MUST provide "+ Add Service" button in top-right.
- **FR-017**: AI service cards MUST display: service icon, name, type badge (cloud/local), connection status, description, available models as tags, Configure button, and delete button (for configured services).
- **FR-018**: Service cards for unconfigured services MUST highlight the Configure button (green/prominent).
- **FR-019**: AI Services page MUST display "About AI Services" information section with links to documentation and supported models.

**Settings Dialog**
- **FR-020**: Settings MUST open as a modal dialog overlay.
- **FR-021**: Settings dialog MUST have three tabs: AI Services, Storage, Server.
- **FR-022**: Settings dialog MUST have Cancel and Save Changes buttons in footer.
- **FR-023**: Tab navigation MUST be displayed horizontally at top of dialog content.

**Settings - AI Services Tab**
- **FR-024**: Each AI service MUST be displayed as an expandable/collapsible section.
- **FR-025**: Cloud services (OpenAI, Gemini) MUST show: service icon, name, models list, connection status badge, API Key input (masked), show/hide toggle for API key, Test button, Default Model dropdown.
- **FR-026**: Local services (Ollama, LM Studio) MUST show: service icon, name, models list, connection status badge, Server URL input, Test button, Default Model dropdown.
- **FR-027**: Connection status badges MUST show "Connected" (green), "Connected (No models)" (green with note), "Not Configured" (gray), or error state (red).
- **FR-037**: API keys MUST be stored in plain text in the data folder. API keys are optional for local services (Ollama, LM Studio).

**Settings - Storage Tab**
- **FR-028**: Storage tab MUST display the single Data Folder path (selected at first-run) with Browse button to relocate all data.
- **FR-045**: Browse button MUST be disabled when workflows are running; tooltip shows "Stop all running workflows before changing data folder".
- **FR-029**: Storage tab MUST have Auto-save Workflows toggle, Create Backups toggle, Cache size display, and Clear Cache button.

**Settings - Server Tab**
- **FR-030**: Server tab MUST have "n8n Server" section displaying: status badge (Running/Stopped), Status indicator with label, Port number, Version number, Uptime, Restart Server button, View Logs button.
- **FR-031**: Server tab MUST have "Authentication" section confirming auto-managed credentials.
- **FR-032**: Server tab MUST have "Advanced Settings" section with: Start on System Boot toggle, Run in Background toggle (controls server behavior when window closed), Server Port input field, Max Concurrent Workflows input (default: 3).
- **FR-038**: View Logs button MUST open modal dialog showing server logs with "Open log file" button to view in system editor. Logs are rotated (keep last 7 days / 10MB).

**Status Indicators**
- **FR-033**: Sidebar footer MUST display persistent server status with colored dot indicator and text.
- **FR-034**: Green status dot MUST indicate server running normally.
- **FR-035**: Server status MUST be clickable to open Settings > Server tab.

**Recent Page**
- **FR-039**: "Recent" navigation item MUST display recently opened workflows sorted by last-opened time (not last-modified).
- **FR-040**: Recent page MUST use same workflow card format as home screen.

**First-Run Experience**
- **FR-041**: First-run welcome screen MUST be minimal: app logo, "Select where to store your data" message, folder picker, Continue button.

**Network Error Handling**
- **FR-042**: When workflows using remote AI services fail due to network unavailability, system MUST show banner/toast with error message and retry option.

**Accessibility**
- **FR-043**: All interactive elements MUST support basic keyboard navigation (Tab to navigate, Enter to activate, Escape to close dialogs/menus).

**Port Conflict**
- **FR-044**: When n8n port is already in use on startup, system MUST show error dialog with option to change port in settings or retry.

**System Tray**
- **FR-046**: System tray context menu MUST contain only two options: "Show Window" and "Exit".

**Update Notifications**
- **FR-047**: Update availability MUST be shown as a banner at the top of the main window, persistent until dismissed or acted upon.

**Workflow Import**
- **FR-048**: When workflow import fails, system MUST show error dialog with details; no partial data is saved.

### Key Entities

- **Workflow Card**: Visual representation of a workflow showing name, description, AI service, status, node count, last modified time, and quick actions.
- **AI Service Card**: Visual representation of an AI provider showing name, type, status, description, models, and configuration access.
- **Settings Tab**: A section within the settings dialog containing related configuration options.
- **Status Indicator**: Visual element showing server health state with color-coded dot and descriptive text.

## Assumptions

- Dark theme is the only supported theme (no light mode toggle needed initially).
- Grid view is the default workflow display; list view is secondary.
- All icons use a consistent icon library (outlined style based on designs).
- Native file dialogs are used for Browse actions (workflows directory, import file).
- Settings changes take effect immediately upon Save (no restart required except server port changes).
- Relative time display follows standard conventions (e.g., "2 hours ago", "Yesterday", "1 week ago").
- Modal dialogs prevent interaction with background content until dismissed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can locate and click "New Workflow" within 3 seconds of viewing the home screen.
- **SC-002**: Users can identify workflow status (active/inactive) at a glance without reading text.
- **SC-003**: Users can configure a new AI service and successfully test connection within 2 minutes.
- **SC-004**: Users can find and access Settings from any screen within 2 clicks.
- **SC-005**: Server status is visible at all times without scrolling or navigation.
- **SC-006**: 90% of users can successfully import a workflow file on first attempt.
- **SC-007**: All interactive elements provide visual feedback within 100ms of user action.
- **SC-008**: Settings dialog is dismissed and changes applied within 1 second of clicking Save.
