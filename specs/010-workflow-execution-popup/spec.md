# Feature Specification: Workflow Execution Popup

**Feature Branch**: `010-workflow-execution-popup`
**Created**: 2025-12-10
**Status**: Draft
**Input**: User description: "Click on the workflow card will not open n8n editor but special window to configure input parameters. This popup window can have design/layout as: left panel (prompt/file selector), middle (n8n icon), right panel (output markdown, downloadable file). Execute button at bottom to collect input and execute workflow. Modify FileSelector to resolve files from internal state or external JSON. Store input/output popup configuration referenced by workflow id."

## Clarifications

### Session 2025-12-10

- Q: How should the popup trigger workflow execution in n8n? → A: Direct IPC - Pass execution request through Electron bridge to n8n process
- Q: Can users run the same workflow multiple times concurrently from the popup? → A: No - Disable Execute button while workflow is running; one execution at a time
- Q: What is the maximum execution timeout before showing an error to the user? → A: 5 minutes (300 seconds)
- Q: What should be the popup window size relative to the main application window? → A: Responsive modal - 80% of main window width/height, centered overlay
- Q: Where should popup configuration data be stored? → A: electron-store - JSON file in app data directory, keyed by workflow ID

## Overview

This feature transforms the workflow interaction model from "edit-first" to "execute-first" for end users. Instead of opening the n8n editor when clicking a workflow card, users see a simplified execution popup with three panels: input configuration (left), visual workflow indicator (middle), and output display (right). This provides a streamlined experience for non-technical users who want to run workflows without understanding the underlying n8n infrastructure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Execute Workflow via Simplified Popup (Priority: P1)

A non-technical user has a pre-built document processing workflow and wants to run it on their files. Instead of navigating the n8n editor, they click the workflow card on the home screen and see a simple popup with clearly labeled input fields on the left and an Execute button at the bottom.

**Why this priority**: This is the core value proposition—making workflow execution accessible to non-technical users. Without this, users must navigate the full n8n editor, which contradicts the User-First Simplicity principle from the constitution.

**Independent Test**: Can be fully tested by clicking a workflow card, verifying the execution popup opens (not the n8n editor), filling in inputs, clicking Execute, and confirming the workflow runs successfully.

**Acceptance Scenarios**:

1. **Given** a workflow card on the home screen, **When** the user clicks the card, **Then** the workflow execution popup opens instead of the n8n editor
2. **Given** the execution popup is open, **When** the user views the left panel, **Then** they see input fields corresponding to the workflow's PromptInput and FileSelector nodes
3. **Given** inputs are configured, **When** the user clicks the Execute button, **Then** the workflow executes with the provided inputs
4. **Given** execution is in progress, **When** the workflow is running, **Then** a loading indicator shows execution status
5. **Given** execution completes successfully, **When** results are ready, **Then** the right panel displays the workflow output

---

### User Story 2 - View Formatted Results in Output Panel (Priority: P1)

After a workflow executes, the user wants to see the results immediately without searching through node outputs. The right panel should display formatted markdown text from ResultDisplay nodes and provide download links for any generated files.

**Why this priority**: Viewing results is essential to completing the workflow loop. Users need immediate feedback to know their workflow succeeded and to access the output.

**Independent Test**: Can be fully tested by running a workflow with a ResultDisplay node, verifying the output appears in the right panel formatted as markdown, and confirming any file outputs have download buttons.

**Acceptance Scenarios**:

1. **Given** a completed workflow with a ResultDisplay node, **When** viewing the execution popup, **Then** the right panel shows the formatted markdown content
2. **Given** a completed workflow with file outputs, **When** viewing the right panel, **Then** download buttons appear for each output file
3. **Given** multiple output items exist, **When** viewing the right panel, **Then** each output is displayed in a scrollable list
4. **Given** the output content is long, **When** viewing the right panel, **Then** the content is scrollable without affecting other panels

---

### User Story 3 - Select Files via Popup Input Panel (Priority: P2)

A user needs to select local files as input for a workflow. In the left panel, they see a file selector component that allows browsing and selecting files, with the selected files listed and removable.

**Why this priority**: File input is a common requirement for document processing workflows. A dedicated file selection UI in the popup provides a more intuitive experience than the n8n node configuration.

**Independent Test**: Can be fully tested by opening a workflow popup with a FileSelector input, clicking to browse files, selecting multiple files, verifying they appear in the list, removing one, and confirming the final selection is correct.

**Acceptance Scenarios**:

1. **Given** a workflow with FileSelector nodes, **When** viewing the left panel, **Then** a file selection area is displayed
2. **Given** the file selection area, **When** the user clicks to browse, **Then** a native file picker dialog opens
3. **Given** files are selected, **When** the dialog closes, **Then** selected files appear in a list with their names and sizes
4. **Given** files are listed, **When** the user clicks a remove button on a file, **Then** that file is removed from the selection
5. **Given** files are selected and the workflow executes, **When** the FileSelector node runs, **Then** it receives the selected file paths from the popup configuration

---

### User Story 4 - Enter Prompt Text via Popup Input Panel (Priority: P2)

A user needs to provide instructions or a prompt as input for an AI workflow. In the left panel, they see a text area where they can type their prompt, with support for basic formatting.

**Why this priority**: Prompts are essential for AI workflows, and providing them through the popup keeps the user in a single, focused interface rather than requiring n8n editor access.

**Independent Test**: Can be fully tested by opening a workflow popup with a PromptInput node, typing text in the prompt area, executing the workflow, and verifying the prompt was received by the workflow.

**Acceptance Scenarios**:

1. **Given** a workflow with PromptInput nodes, **When** viewing the left panel, **Then** a text input area is displayed
2. **Given** the text input area, **When** the user types text, **Then** the text is captured and stored
3. **Given** text has been entered, **When** the workflow executes, **Then** the PromptInput node receives the text from the popup
4. **Given** the popup is closed and reopened, **When** no execution occurred, **Then** previously entered text is preserved

---

### User Story 5 - Store and Retrieve Popup Configuration per Workflow (Priority: P3)

The system needs to remember which workflows have execution popup configurations and what those configurations contain. Each workflow has associated metadata defining its input and output panel layouts.

**Why this priority**: Persistent configuration enables consistent user experience across sessions and allows pre-configuration of workflow inputs for repeated use.

**Independent Test**: Can be fully tested by configuring a workflow's popup inputs, closing and reopening the application, opening the same workflow popup, and verifying the configuration persists.

**Acceptance Scenarios**:

1. **Given** a workflow with configured popup inputs, **When** the application restarts, **Then** the popup configuration is preserved
2. **Given** a workflow ID, **When** the popup loads, **Then** it retrieves the stored configuration for that workflow
3. **Given** the user modifies input values, **When** the popup closes, **Then** the values are saved for the next session
4. **Given** a workflow without popup configuration, **When** the popup opens, **Then** default empty configuration is created

---

### User Story 6 - Access n8n Editor from Popup (Priority: P3)

An advanced user wants to modify the workflow structure. The popup should provide a way to open the full n8n editor when needed, without losing the simplified execution interface.

**Why this priority**: While the popup serves most users, power users need editor access. This ensures the simplified UI doesn't block advanced functionality.

**Independent Test**: Can be fully tested by opening a workflow popup, clicking an "Edit Workflow" link/button, verifying the n8n editor opens, and confirming returning to the popup is possible.

**Acceptance Scenarios**:

1. **Given** the execution popup is open, **When** the user clicks "Edit Workflow", **Then** the n8n editor opens for that workflow
2. **Given** the n8n editor was opened from the popup, **When** the user returns to the desktop app, **Then** they can reopen the execution popup

---

### Edge Cases

- What happens when a workflow has no PromptInput or FileSelector nodes? (Show empty input panel with message)
- What happens when a workflow has multiple PromptInput nodes? (Display each as separate input field with node name as label)
- How does the system handle workflow execution failure? (Display error message in output panel)
- What happens when workflow execution exceeds timeout? (After 5 minutes, display timeout error and re-enable Execute button)
- What happens when the user closes the popup during execution? (Continue execution in background, show notification when complete)
- What happens if user clicks Execute while already running? (Execute button is disabled during execution; only one run at a time)
- What happens when selected files are moved or deleted before execution? (Validate file existence, show error for missing files)
- How does the system handle very large file selections? (Set reasonable limit, show warning if exceeded)
- What happens when the workflow is modified in the editor after popup config was saved? (Detect changes, update config or warn user)

## Requirements *(mandatory)*

### Functional Requirements

**Popup Window:**
- **FR-001**: System MUST open execution popup (not n8n editor) when user clicks workflow card
- **FR-001a**: System MUST display popup as a responsive centered modal overlay (80% of main window width/height, min 600x400px, max 1400x900px)
- **FR-001b**: System MUST close popup when user clicks backdrop (outside modal), with confirmation if execution in progress
- **FR-001c**: System MUST close popup when user presses Escape key, with confirmation if execution in progress
- **FR-001d**: System MUST support keyboard navigation: Tab through inputs, Enter to execute (when focused on Execute button)
- **FR-001e**: System MUST set focus to first input field when popup opens
- **FR-002**: System MUST display three-panel layout: input (left ~40%), visual indicator (middle ~100px), output (right flex)
- **FR-003**: System MUST provide Execute button that triggers workflow execution
- **FR-003a**: System MUST provide Cancel button during execution to abort workflow (best-effort cancellation)
- **FR-004**: System MUST display execution progress indicator during workflow run
- **FR-004a**: System MUST disable Execute button while a workflow execution is in progress (no concurrent executions)
- **FR-004b**: System MUST timeout workflow execution after 5 minutes (300 seconds) and display a timeout error
- **FR-004c**: System MUST display loading skeleton during initial popup render while analyzing workflow
- **FR-005**: System MUST provide way to access n8n editor from the popup ("Edit Workflow" action, closes popup)

**Input Panel (Left):**
- **FR-006**: System MUST auto-detect PromptInput nodes in workflow and display corresponding text inputs
- **FR-006a**: System MUST display inputs in workflow node order (top-to-bottom as defined in workflow)
- **FR-006b**: System MUST truncate long node display names (>30 chars) with ellipsis and tooltip
- **FR-007**: System MUST auto-detect FileSelector nodes in workflow and display file selection UI
- **FR-007a**: System MUST display empty state message "No input fields detected" when workflow has no PromptInput or FileSelector nodes
- **FR-008**: System MUST label each input with the corresponding node's display name
- **FR-009**: System MUST validate required inputs before allowing execution (disable Execute button if required inputs empty)
- **FR-010**: System MUST support native file picker dialog for file selection
- **FR-010a**: System MUST limit file selection to 10 files maximum per FileSelector, showing warning if exceeded
- **FR-010b**: System MUST truncate long file names (>40 chars) with ellipsis in file list

**Output Panel (Right):**
- **FR-011**: System MUST display ResultDisplay node outputs as formatted markdown (supporting headers, lists, code blocks, links)
- **FR-011a**: System MUST sanitize markdown HTML output to prevent XSS (remove script tags, event handlers)
- **FR-012**: System MUST provide download buttons for file outputs
- **FR-013**: System MUST handle multiple output items in scrollable list
- **FR-014**: System MUST show placeholder content "Run workflow to see results" before first execution
- **FR-014a**: System MUST display user-friendly error messages for failed workflows (e.g., "Workflow failed: [error summary]")
- **FR-014b**: System MUST distinguish user errors (e.g., "File not found") from system errors (e.g., "Connection failed") in error messages

**Visual Indicator (Middle):**
- **FR-015**: System MUST display n8n or workflow icon as visual separator
- **FR-016**: System MAY animate icon during execution to indicate progress

**Configuration Storage:**
- **FR-017**: System MUST store popup configuration per workflow ID in electron-store (JSON file in app data directory)
- **FR-018**: System MUST persist input values between sessions
- **FR-019**: System MUST store output results for display after execution
- **FR-020**: System MUST clear stored results when user initiates new execution

**Node Modifications:**
- **FR-021**: FileSelector node MUST support receiving file paths from external JSON configuration via Electron bridge
- **FR-021a**: FileSelector node MUST fall back to internal state when Electron bridge is unavailable (backward compatibility)
- **FR-022**: PromptInput node MUST support receiving prompt text from external configuration via Electron bridge
- **FR-022a**: PromptInput node MUST fall back to node parameter when Electron bridge is unavailable (backward compatibility)
- **FR-023**: ResultDisplay node MUST support emitting output for external consumption via Electron bridge
- **FR-023a**: ResultDisplay node MUST emit output immediately after processing (not wait for workflow completion)
- **FR-024**: Custom nodes MUST maintain backward compatibility with direct n8n usage (work identically when run without popup)

**Error Handling:**
- **FR-025**: System MUST display "n8n server is not running" error if workflow execution fails due to server unavailability
- **FR-026**: System MUST validate file existence before execution and show error listing missing files
- **FR-027**: System MUST handle IPC/network failures gracefully with retry option for transient errors
- **FR-028**: System MUST recover gracefully from corrupted popup configuration by resetting to defaults
- **FR-029**: System MUST handle concurrent popup opens for same workflow (only one popup per workflow allowed)

**Accessibility:**
- **FR-030**: System SHOULD announce execution status changes to screen readers (started, completed, failed)
- **FR-031**: System MUST ensure all interactive elements are keyboard accessible

### Key Entities

- **WorkflowPopupConfig**: Configuration for a workflow's execution popup (workflow ID, input configs, last execution results)
- **InputFieldConfig**: Definition of an input field in the popup (node ID, node type, label, current value)
- **OutputResult**: Result from workflow execution (node ID, content type, content value, file reference if applicable)
- **ExecutionState**: Current state of workflow execution (idle, running, completed, failed)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can execute a workflow from the popup within 30 seconds of opening (excluding file selection time)
- **SC-002**: 90% of non-technical users successfully execute their first workflow using the popup without accessing the n8n editor
- **SC-003**: Workflow results display in the output panel within 2 seconds of workflow completion
- **SC-004**: Popup configuration persists correctly across application restarts (100% of saved configurations restored)
- **SC-005**: File selection supports up to 10 files per execution
- **SC-006**: Popup opens within 500ms of clicking workflow card
- **SC-007**: Execute button is disabled until all required inputs are provided (prevents invalid executions)
- **SC-008**: Error messages for failed workflows are understandable by non-technical users

## Assumptions

- The workflow's PromptInput, FileSelector, and ResultDisplay nodes can be identified programmatically by their node type
- Workflow execution is triggered via Direct IPC through the Electron bridge to the n8n process (extending the existing bridge from spec 009)
- The Electron bridge can pass input data to workflows and retrieve execution results
- Popup configurations are stored in electron-store as JSON, keyed by workflow ID
- The existing custom nodes (spec 009) are completed and functional

## Out of Scope

- Visual workflow builder or editor within the popup
- Real-time collaboration features
- Workflow scheduling or automation from the popup
- Custom theming for the popup UI
- Support for nodes other than PromptInput, FileSelector, and ResultDisplay in the input/output panels
- Mobile or web versions of the execution popup
- Workflow versioning or history within the popup
