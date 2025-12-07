# Feature Specification: Granite Docling OCR Integration

**Feature Branch**: `003-docling-integration`
**Created**: 2025-12-06
**Status**: Draft
**Input**: User description: "Integrate Granite Docling OCR processing tool chain into the Electron application using Python FastAPI backend to provide document intelligence capabilities"

## Overview

This feature integrates IBM's Granite Docling document processing engine into the n8n Desktop application, enabling users to convert PDF, DOCX, XLSX, and image files into structured Markdown format while preserving page metadata, tables, equations, and document hierarchy. The integration follows the Trident Local Server Model architecture with a Python FastAPI backend running alongside the existing n8n server.

### Integration Approach

- **User Interface**: Document processing is accessed via **n8n workflow editor** using the native HTTP Request node to call the local Docling API
- **Output Delivery**: Processed documents are returned as **JSON responses directly to n8n workflows** for further automation (RAG pipelines, database storage, API forwarding, etc.)
- **Service Startup**: Docling service is **enabled by default** and starts automatically with the application
- **Configuration**: Users configure processing tiers and temporary folder via a dedicated "Docling" tab in Settings

### Docling Processing Feature Categories

Based on computational resources and processing speed requirements, Docling features are categorized into three tiers:

#### Tier 1: Lightweight Processing (Fast, Low Resources)
- **Basic Text OCR**: Standard text extraction from documents
- **Reading Order Detection**: Determining the logical reading sequence
- **Heading/Paragraph Detection**: Basic document structure identification
- **List Recognition**: Bullet and numbered list extraction
- **Page Layout Analysis**: Basic page element positioning
- **Caption Handling**: Image and table caption extraction

*Typical processing time: <5 seconds per page | RAM: ~2-4 GB*

#### Tier 2: Standard Processing (Moderate Resources)
- **Table Recognition**: Detecting and extracting table structures with content (TEDS: 0.97)
- **Code Block Detection**: Identifying and preserving code snippets (F1: 0.988)
- **Image Classification**: Categorizing figures, diagrams, and photos
- **Multi-column Layout**: Complex document layout understanding
- **Inline Equation Detection**: Simple mathematical notation

*Typical processing time: 5-15 seconds per page | RAM: ~4-8 GB*

#### Tier 3: Advanced Processing (Resource-Intensive)
- **Formula/Equation Recognition**: Full LaTeX conversion of mathematical formulas (F1: 0.968)
- **Figure & Chart Classification**: Deep classification of visual elements
- **Chart-to-Table Conversion**: Converting charts into structured data
- **Complex Table Structure**: Tables with merged cells and nested headers
- **Full VLM Pipeline**: Complete vision-language model inference
- **Multi-language OCR**: Japanese, Arabic, Chinese text extraction

*Typical processing time: 15-60+ seconds per page | RAM: ~8-16 GB*

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Document Processing via n8n Workflow (Priority: P1)

A user wants to convert a PDF document into Markdown format as part of their n8n workflow automation. They use an HTTP Request node in n8n to call the local Docling service, passing a document file path, and receive structured JSON output containing the page-annotated Markdown for further workflow processing (RAG pipelines, database storage, API calls, etc.).

**Why this priority**: This is the core functionality that enables all document processing use cases within the n8n workflow ecosystem. Without basic document conversion working reliably via the n8n HTTP Request node, no other features provide value.

**Independent Test**: Can be fully tested by creating an n8n workflow with an HTTP Request node that calls the Docling API endpoint, passing a PDF file path, and verifying the JSON response contains Markdown with page markers. Delivers immediate value for document automation workflows.

**Acceptance Scenarios**:

1. **Given** a user has an n8n workflow with an HTTP Request node configured to call the Docling API, **When** they execute the workflow with a PDF file path, **Then** they receive a JSON response containing the document text as Markdown with embedded page number markers
2. **Given** a document is being processed via the Docling API, **When** the n8n workflow polls for status, **Then** the API returns progress information showing which stage of processing is active
3. **Given** document processing completes, **When** the n8n workflow receives the result, **Then** the JSON response contains the page-annotated Markdown, metadata (page count, processing time), and can be passed to subsequent workflow nodes

---

### User Story 2 - Configure Processing Levels (Priority: P2)

A user wants to control the depth of document analysis based on their needs and system resources. They access the Docling settings tab and select their preferred processing tier (Lightweight, Standard, or Advanced) to balance quality against processing speed.

**Why this priority**: Different users have different hardware capabilities and quality requirements. This enables users to optimize for their specific use case.

**Independent Test**: Can be tested by changing the processing level setting and processing the same document at each level, verifying different processing times and output detail levels.

**Acceptance Scenarios**:

1. **Given** a user opens the Settings dialog, **When** they navigate to the Docling tab, **Then** they see options to select processing tier (Lightweight, Standard, Advanced) with clear descriptions of what each tier includes
2. **Given** a user selects "Lightweight" processing, **When** they process a document with tables and equations, **Then** the tables and equations are not deeply analyzed (faster processing)
3. **Given** a user selects "Advanced" processing, **When** they process a document with complex equations, **Then** the equations are converted to LaTeX format with high fidelity

---

### User Story 3 - Configure Temporary Folder Location (Priority: P2)

A user wants to control where Docling stores temporary processing files to manage disk space or use a faster storage device. They configure a custom temporary folder path in settings.

**Why this priority**: Large documents generate significant temporary files. Users need control over storage location for disk space management and performance optimization.

**Independent Test**: Can be tested by setting a custom temp folder path and verifying processed files appear in that location during processing.

**Acceptance Scenarios**:

1. **Given** a user is in the Docling settings tab, **When** they click "Browse" for temporary folder, **Then** they can select a folder from their file system
2. **Given** a user has configured a custom temporary folder, **When** document processing occurs, **Then** temporary files are created in the specified location
3. **Given** the configured temporary folder becomes unavailable, **When** the user tries to process a document, **Then** they receive a clear error message about the inaccessible folder

---

### User Story 4 - Process Multiple Documents via Workflow (Priority: P3)

A user wants to process a batch of documents as part of an n8n workflow. They configure their workflow to iterate over multiple file paths and call the Docling API for each document, collecting results for aggregated processing.

**Why this priority**: Batch processing improves efficiency for users with many documents but requires the core single-document processing to work first. n8n's native looping and splitting capabilities handle orchestration.

**Independent Test**: Can be tested by creating an n8n workflow that iterates over 3+ document paths, calls the Docling API for each, and aggregates the results.

**Acceptance Scenarios**:

1. **Given** a user has an n8n workflow configured to process multiple documents, **When** the workflow executes with a list of file paths, **Then** each document is processed via the Docling API and results are collected
2. **Given** the workflow is processing multiple documents, **When** individual API calls complete, **Then** each response contains the processed Markdown and can be handled by subsequent workflow nodes
3. **Given** one document in a batch fails processing, **When** the workflow continues (using n8n error handling), **Then** the failed document returns an error response and remaining documents continue processing

---

### User Story 5 - Monitor Docling Service Health (Priority: P3)

A user wants to verify the Docling service is running correctly and view its resource usage. They can see the service status in the application interface and restart it if needed.

**Why this priority**: Service health visibility is important for troubleshooting but not essential for basic document processing.

**Independent Test**: Can be tested by viewing service status, stopping/starting the service, and verifying status updates reflect actual service state.

**Acceptance Scenarios**:

1. **Given** the Docling service is running, **When** the user views the status area, **Then** they see "Running" status with the service port number
2. **Given** the Docling service has stopped unexpectedly, **When** the user views the status area, **Then** they see "Stopped" or "Error" status with a restart option
3. **Given** the user clicks "Restart Docling Service", **When** the action completes, **Then** the service restarts and status updates to "Running"

---

### Edge Cases

- **Corrupted/password-protected documents**: System returns error response to n8n workflow with descriptive message
- **Large documents (100+ pages, 100MB+)**: Timeout auto-calculated based on page count; user can adjust timeout action in settings
- **Temp folder disk space exhausted**: Processing fails with clear error; user notified to free space or change temp folder location
- **Processing interrupted (app closed)**: In-flight jobs cancelled; orphaned temp files cleaned on next startup
- **Docling service fails to start**: Auto-restart attempted up to 3 times; after failures, error status shown requiring manual intervention
- **Unsupported language documents**: System processes with best-effort OCR; accuracy degradation noted in response metadata
- **Concurrent requests exceed limit**: Requests queued (up to configured 1-3 concurrent jobs); processed in order when capacity available

---

## Requirements *(mandatory)*

### Functional Requirements

#### Core Document Processing
- **FR-001**: System MUST accept PDF, DOCX, XLSX, and image files (PNG, JPEG, TIFF) for processing via the Docling REST API
- **FR-002**: System MUST convert documents to Markdown format while preserving page number annotations for each content element
- **FR-003**: System MUST provide processing progress via API status endpoints that n8n workflows can poll
- **FR-004**: System MUST return structured JSON responses containing the annotated Markdown, processing metadata, and status information suitable for n8n workflow consumption

#### Docling Service Management
- **FR-005**: System MUST launch the Docling Python service as a child process automatically on application startup (enabled by default)
- **FR-006**: System MUST dynamically assign a non-conflicting port to the Docling service
- **FR-007**: System MUST perform health checks on the Docling service at regular intervals (every 5 seconds)
- **FR-008**: System MUST gracefully shut down the Docling service when the application closes
- **FR-009**: System MUST provide ability to manually restart the Docling service from the Settings UI
- **FR-024**: System MUST make the Docling API port available to n8n workflows (e.g., via environment variable or configuration)
- **FR-034**: System MUST automatically attempt to restart the Docling service when it crashes or becomes unresponsive (up to 3 attempts)
- **FR-035**: System MUST stop auto-restart attempts after 3 consecutive failures and display an error status requiring manual intervention
- **FR-036**: System MUST reset the restart attempt counter when the service runs successfully for a sustained period (e.g., 1 minute)

#### Processing Configuration
- **FR-010**: System MUST allow users to select one of three processing tiers (Lightweight, Standard, Advanced)
- **FR-011**: System MUST persist processing tier selection between application sessions
- **FR-012**: System MUST allow users to configure a custom temporary folder location for processing files
- **FR-013**: System MUST validate that the configured temporary folder exists and is writable
- **FR-014**: System MUST display estimated resource requirements for each processing tier
- **FR-025**: System MUST allow users to configure maximum concurrent processing jobs (1-3), defaulting to 1
- **FR-026**: System MUST queue requests exceeding the concurrent limit and process them in order when capacity becomes available
- **FR-032**: System MUST automatically delete temporary files immediately after each processing job completes (success or failure)
- **FR-033**: System MUST perform periodic cleanup of orphaned temporary files on application startup (handles crash recovery scenarios)

#### Settings UI
- **FR-015**: System MUST provide a "Docling" tab in the Settings dialog for configuration
- **FR-016**: System MUST display current Docling service status (Running/Stopped/Error) in settings
- **FR-017**: System MUST show disk space usage in the temporary folder
- **FR-030**: System MUST display a job queue UI showing all current/pending processing jobs with status, progress, and elapsed time
- **FR-031**: System MUST provide ability to manually cancel any processing job from the job queue UI

#### Error Handling
- **FR-018**: System MUST display user-friendly error messages when document processing fails
- **FR-019**: System MUST log detailed error information for troubleshooting
- **FR-020**: System MUST detect and report when system resources are insufficient for selected processing tier
- **FR-027**: System MUST automatically calculate processing timeout based on document page count estimate
- **FR-028**: System MUST provide configurable timeout-exceeded action in settings (e.g., cancel job, extend timeout, notify user)
- **FR-029**: System MUST return an error response to the n8n workflow when a job is cancelled (manually or by timeout), causing the workflow to fail appropriately

#### Security
- **FR-021**: System MUST bind the Docling service to localhost only (127.0.0.1)
- **FR-022**: System MUST use a shared secret token for authentication between the Electron app and Docling service
- **FR-023**: System MUST not expose the Docling service port to external network access

### Key Entities

- **DoclingConfig**: User configuration for Docling service including processing tier, temp folder path, and service port
- **ProcessingJob**: Represents a document processing request with input file path, status, progress, and output result
- **ProcessingResult**: Contains the annotated Markdown output, metadata (page count, processing time), and any errors
- **DoclingStatus**: Current state of the Docling service (starting, running, stopped, error) with port and health information

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully convert a 10-page PDF document to page-annotated Markdown within 60 seconds using Standard processing tier (on reference hardware: 8GB RAM, 4-core CPU, SSD storage)
- **SC-002**: System maintains stable operation with memory usage below 8GB during Standard tier processing
- **SC-003**: Docling service achieves 99% uptime during normal application usage (auto-recovery from failures)
- **SC-004**: 95% of processing jobs complete successfully without user intervention
- **SC-005**: Users can configure Docling settings in under 2 minutes on first use
- **SC-006**: Processing status updates appear within 1 second of state changes
- **SC-007**: Application startup time increases by no more than 10 seconds due to Docling service initialization
- **SC-008**: System correctly preserves page number metadata in 100% of processed text elements

---

## Assumptions

1. **Python Environment**: The application requires Python 3.10+ installed on the target system. At startup, the application checks for Python availability and displays clear installation instructions if missing. Future releases may bundle Python using PyInstaller (see plan.md Constitution Check for justification of this deviation from Principle III).
2. **Resource Availability**: Users have minimum 8GB RAM available for Standard processing; Advanced processing requires 16GB
3. **Network**: No external network access is required; all processing occurs locally
4. **File Access**: Users have read access to source documents and write access to temp folder and output locations
5. **Service Isolation**: The Docling service runs independently of the n8n server and can be restarted without affecting n8n
6. **Document Size**: Maximum supported document size is 200MB or 500 pages per processing job

---

## Dependencies

1. **Existing Application**: Requires the current n8n Desktop application with Settings dialog implementation
2. **Python Runtime**: Bundled Python environment with Docling, FastAPI, and Uvicorn packages
3. **Electron IPC**: Leverages existing IPC communication patterns for service management
4. **Configuration Store**: Uses existing electron-store for persisting Docling configuration

---

## Clarifications

### Session 2025-12-06

- Q: How should the system handle multiple simultaneous processing requests? → A: Configurable concurrent limit (1-3 jobs based on user setting)
- Q: How should processing timeout be handled? → A: Auto-calculate timeout based on page count; configurable timeout-exceeded action in settings; job queue UI with manual cancel; cancelled/timed-out jobs fail the triggering n8n workflow
- Q: When/how should temporary processing files be cleaned up? → A: Clean on job completion + periodic cleanup of orphaned files (handles app crashes)
- Q: What should happen when the Docling service crashes or becomes unresponsive? → A: Auto-restart with retry limit (3 attempts), then require manual intervention

---

## Out of Scope

1. Cloud-based document processing (all processing is local)
2. Real-time collaborative document processing
3. Integration with external document management systems
4. Document editing or annotation capabilities
5. Audio/video file processing (future consideration)
6. Automatic workflow creation from processed documents
