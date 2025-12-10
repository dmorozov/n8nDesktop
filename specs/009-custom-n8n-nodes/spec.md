# Feature Specification: Custom n8n Nodes with User-Friendly UI

**Feature Branch**: `009-custom-n8n-nodes`
**Created**: 2025-12-10
**Status**: Draft
**Input**: User description: "Main aim of new sub project is to create custom n8n nodes with user friendly interface. We need to define custom UI nodes: 1) User friendly way to select local files and copy them into the n8n data folder; 2) User friendly way to provide a prompt for the workflow; 3) User friendly way to show the result of the workflow execution."

## Overview

This feature creates a new sub-project containing custom n8n nodes designed specifically for the n8n Desktop application. These nodes provide user-friendly interfaces for common workflow operations that are enhanced by the desktop environment, including native file selection, rich text input, and formatted result display.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select and Import Local Files (Priority: P1)

A user working with a document processing workflow needs to select files from their computer to process. Instead of manually typing file paths, they want to browse and select files using a familiar file picker dialog, have those files automatically copied to the n8n data folder, and have the file reference available for subsequent nodes in the workflow.

**Why this priority**: File input is the foundational requirement for most document processing workflows. Without an easy way to get files into the workflow, users cannot leverage the desktop application's local processing capabilities.

**Independent Test**: Can be fully tested by placing a FileSelector node in a workflow, clicking to open the file picker, selecting one or more files, and verifying the files are copied to the data folder with correct references output.

**Acceptance Scenarios**:

1. **Given** a workflow with a FileSelector node, **When** the user clicks the file selection trigger, **Then** a native operating system file picker dialog opens
2. **Given** an open file picker dialog, **When** the user selects one or more files and confirms, **Then** the selected files are copied to the configured n8n data folder
3. **Given** files have been copied successfully, **When** the node executes, **Then** the output contains references to the copied files including their new paths and original filenames
4. **Given** a file selection in progress, **When** the user cancels the dialog, **Then** no files are copied and the node indicates no selection was made
5. **Given** the user selects files that already exist in the data folder, **When** the copy operation runs, **Then** the system handles duplicates appropriately (rename or skip based on configuration)

---

### User Story 2 - Enter Formatted Prompt Text (Priority: P2)

A user creating an AI-powered workflow needs to provide detailed instructions or prompts. They want a comfortable editing experience with formatting support (markdown) so they can structure their prompts clearly with headings, lists, and emphasis.

**Why this priority**: Prompts are essential for AI workflows, and a good editing experience improves the quality of prompts users create. This directly impacts workflow effectiveness.

**Independent Test**: Can be fully tested by placing a Prompt Input node in a workflow, entering formatted text in the editor, executing the workflow, and verifying the text is passed correctly to connected nodes.

**Acceptance Scenarios**:

1. **Given** a workflow with a Prompt Input node, **When** the user opens the node configuration, **Then** a rich text editor with markdown support is displayed
2. **Given** the markdown editor is open, **When** the user enters formatted text with headings, lists, and emphasis, **Then** the editor renders a preview of the formatted content
3. **Given** text has been entered in the editor, **When** the workflow executes, **Then** the raw markdown text is available as the node's output for use by downstream nodes
4. **Given** the editor contains existing content, **When** the user modifies and saves changes, **Then** the changes persist when the workflow is reopened

---

### User Story 3 - Display Formatted Workflow Results (Priority: P3)

A user has run a document processing or AI workflow and wants to view the results in a readable format. Instead of parsing through raw JSON output, they want to see the relevant result rendered as formatted text (markdown to readable display).

**Why this priority**: Viewing results in a human-readable format completes the user workflow loop. Without this, users must manually interpret JSON data, which defeats the purpose of a user-friendly desktop application.

**Independent Test**: Can be fully tested by connecting a Result Display node to a workflow output, configuring which property to display, running the workflow, and verifying the content renders as formatted output.

**Acceptance Scenarios**:

1. **Given** a workflow with a Result Display node connected to a data source, **When** the user configures the node, **Then** they can specify which property from the input data to display
2. **Given** the Result Display node is configured, **When** the workflow executes with markdown content in the specified property, **Then** the content is rendered as formatted output
3. **Given** the workflow has executed, **When** the user views the Result Display node, **Then** they see the formatted content in a readable panel
4. **Given** the input data property contains plain text, **When** displayed, **Then** the text is shown with appropriate line breaks and spacing
5. **Given** the specified property does not exist in the input, **When** the node executes, **Then** a clear message indicates no content was found

---

### User Story 4 - Integrate Custom Nodes Sub-project (Priority: P1)

A developer building the n8n Desktop application needs the custom nodes to be properly integrated into the build process. The nodes should be in a dedicated folder structure and included in the main application's build workflow.

**Why this priority**: Without proper build integration, the custom nodes cannot be distributed with the application, making all other features unavailable to users.

**Independent Test**: Can be fully tested by running the build:all command and verifying the custom nodes package is built and available.

**Acceptance Scenarios**:

1. **Given** the custom nodes source code in src/n8n_nodes, **When** the build:all script runs, **Then** the custom nodes are compiled and packaged
2. **Given** the application is built, **When** n8n starts within the Electron app, **Then** the custom nodes appear in the n8n nodes palette
3. **Given** a custom node is placed in a workflow, **When** the workflow is saved and reopened, **Then** the node configuration persists correctly

---

### Edge Cases

- What happens when the user selects a file larger than available disk space in the data folder?
- How does the system handle file names with special characters or very long paths?
- What happens when the n8n data folder path is not configured or inaccessible?
- How does the Result Display node handle extremely large text content?
- What happens when the markdown content contains potentially unsafe elements?
- How does the system behave when the file copy operation is interrupted?

## Requirements *(mandatory)*

### Functional Requirements

**FileSelector Node:**
- **FR-001**: System MUST provide a node that triggers a native file picker dialog when activated
- **FR-002**: System MUST copy selected files to the configured n8n data folder
- **FR-003**: System MUST output file references including new path and original filename
- **FR-004**: System MUST support selection of multiple files in a single operation
- **FR-005**: System MUST handle file selection cancellation gracefully
- **FR-006**: System MUST support filtering by file types (configurable extensions)

**PromptInput Node:**
- **FR-007**: System MUST provide a node with a markdown-capable text editor
- **FR-008**: System SHOULD display a preview of formatted content (note: n8n's built-in htmlEditor provides syntax highlighting but not full markdown rendering preview; full preview is best-effort within n8n UI constraints)
- **FR-009**: System MUST preserve the raw markdown text as node output
- **FR-010**: System MUST persist editor content when workflow is saved

**ResultDisplay Node:**
- **FR-011**: System MUST provide a node that renders markdown content as formatted output
- **FR-012**: System MUST allow configuration of which input property to display
- **FR-013**: System MUST handle missing or empty properties with appropriate feedback
- **FR-014**: System MUST sanitize content to prevent rendering of unsafe elements (specifically: strip `<script>`, `<iframe>`, `<object>`, `<embed>` tags; sanitize `javascript:` URLs; escape inline event handlers like `onclick`)

**Build Integration:**
- **FR-015**: System MUST include custom nodes in the build:all script
- **FR-016**: System MUST package nodes so they are recognized by bundled n8n
- **FR-017**: System MUST place custom nodes source in src/n8n_nodes directory

### Key Entities

- **Custom Node**: A workflow automation component with specialized UI capabilities for desktop use
- **File Reference**: Metadata about a copied file including original name, new path, size, and type
- **Prompt Content**: User-entered text with optional markdown formatting
- **Display Configuration**: Settings specifying how result data should be rendered

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select and import files into workflows within 10 seconds (excluding file copy time)
- **SC-002**: 95% of users successfully complete file selection on their first attempt
- **SC-003**: Prompt text entry supports all standard markdown elements (headings, lists, bold, italic, code blocks)
- **SC-004**: Result display renders markdown content within 1 second of workflow completion
- **SC-005**: Build process completes with custom nodes included without manual intervention
- **SC-006**: Custom nodes appear in n8n palette immediately upon application startup
- **SC-007**: File copy operations handle files up to 500MB without failure
- **SC-008**: Editor supports prompt text up to 50,000 characters without performance degradation

## Assumptions

- The Electron application has access to native file dialogs through the main process
- Inter-process communication (IPC) is available between Electron main process and n8n nodes
- The n8n data folder path is configurable in the application settings
- n8n supports loading custom community nodes from a local package
- Users have read/write permissions for both source file locations and the data folder
- The markdown rendering library handles common formatting and is secure against XSS

## Out of Scope

- Cloud synchronization of files or workflows
- Real-time collaboration on prompts
- Version history for entered prompts
- Advanced file management (move, delete, rename within data folder)
- Custom styling or themes for the markdown preview
- Support for non-markdown formatting systems
