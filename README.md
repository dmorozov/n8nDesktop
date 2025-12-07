# Using AI in development

## SpecKit

Spec-Driven Development flips the script on traditional software development. For decades, code has been king — specifications were just scaffolding we built and discarded once the "real work" of coding began. Spec-Driven Development changes this: specifications become executable, directly generating working implementations rather than just guiding them.

Note: the GitHub SpecKit works with any Cli AI tools (Claude Code, Gemini CLI, OpenAI Codex etc.)

### Installation

```bash
Install uv tool:
curl -LsSf https://astral.sh/uv/install.sh | sh

Install SpecKit:
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

or upgrade:
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git
```

then:

```bash
specify init .
specify check
```

Documentation:
https://github.com/github/spec-kit

Specify commands available:
1. /speckit.constitution - Establish project principles
2. /speckit.specify - Create baseline specification
3. /speckit.clarify (optional) - Ask structured questions to de-risk ambiguous areas before planning (run before /speckit.plan if used)
4. /speckit.plan - Create implementation plan
5. /speckit.checklist (optional) - Generate quality checklists to validate requirements completeness, clarity, and consistency (after /speckit.plan)
6. /speckit.tasks - Generate actionable tasks
7. /speckit.analyze (optional) - Cross-artifact consistency & alignment report (after /speckit.tasks, before /speckit.implement)
8. /speckit.implement - Execute implementation

## Claude Code

### Installation

```bash
$ npm install -g @anthropic-ai/claude-code
$ claude
or
$ claude --dangerously-skip-permissions
```

OR

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

In Visual Studion Code -> Extensions (Ctrl+Shift+x) -> Search and add extension: Anthropic.claude-code

## Gemini CLI

Install globally with npm:

```bash
npm install -g @google/gemini-cli
```

Install globally with Homebrew:

```bash
brew install gemini-cli
```

VSCode extension: Google.gemini-cli-vscode-ide-companion

## Useful MCP servers

1. Playwright MCP - provides browser automation capabilities
License: Apacje 2.0
Url: https://github.com/microsoft/playwright-mcp

Install:

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

Other MCPs:

- Context7 Up-to-date code docs for any prompt
- GitHub Connect AI assistants to GitHub - manage repos, issues, PRs, and workflows through natural language.
- Playwright Automate web browsers using accessibility trees for testing and data extraction.

## Planning

### Create a project constitution document

/speckit.constitution Help me to establish project principles. Ask me questions to create a better project's constitution. The main aim of the project is to create a desktop version of n8n server
  using Electron framework and installer. Main audience are people who have limited technical skills and want to install the n8n application locally and play with the AI workflows. The application
  should be installable a standard way as any other Windows/Linux/OSX application and can be run by clicking shortcut created on user's desktop. Store all changes locally in the user selected folder.

Should the application support additional features beyond basic n8n server hosting?
Answer: Enhanced UX Add backup/restore, workflow import/export, simplified settings. The n8n need to be installable as a regular desktop application, so it should handle automatic user creation (required by n8n) and automatic login this user into embedded n8n server when the application is started. No authentication need to be required by the user running the application, i.e. should be hidden from the end user.

### Baseline specification

/speckit.specify Help me to create the baseline specification for the project. Ask me question to create a better document. The main target of the project is to provide a desktop application to work with n8n AI workflows locally as a desktop application. Provide regular way users working with desktop applications. I.e. easy to use installer, saving/loading local n8n workflow files, configuring external AI services (either locally runnable LLMs using Ollama or LM Studio or online services like Chat GPT or Gemini). That integration should be easily configurable through the application UI. The application should be a single user application. The required by n8n server user need to be automatically created when install the application and used under the hood automatically without prompting the user any credentials. I.e. we will need UI to select existing recently used workflow, open one from the local disk or create a new one. Configure re-usable AI services between workflows. I.e. we need the application configuration dialog to be implemented and accessible from the main UI.

At the same time ask Versel V0 application (https://v0.app/):

Please create a UI design for a desktop application. The primary objective of the project is to develop a desktop application that enables local execution of n8n AI workflows. Provide a regular way for users working with desktop applications. I.e., easy-to-use installer, saving/loading local n8n workflow files, configuring external AI services (either locally runnable LLMs using Ollama or LM Studio or online services like Chat GPT or Gemini). That integration should be easily configurable through the application UI. The application should be a single-user application. The required n8n server user needs to be automatically created when installing the application and used automatically under the hood without prompting the user for any credentials. I.e., we will need UI to select the existing recently used workflow, open one from the local disk or create a new one. Configure re-usable AI services between workflows. I.e., we need the application configuration dialog to be implemented and accessible from the main UI.

I took screenshots of the generated UI and placed them in the "design" folder.

### Baseline specification - Design

/speckit.specify Help me to create the UI design specification for the project. Please analyze design images in the "design" folder:

- 'AI services config page.png'
- 'home page - existing workflow card menu.png'
- 'home page.png'
- 'new workflow dropdown.png'
- 'settings - AI services.png'
- 'settings - N8N.png'
- 'settings - Storage.png'

You can adjust the proposed design based on the best Electron framework application design principles and services (like configuration) provided out of box.

### Clarify the specifications

/speckit.clarify You have created two separate specifications:
- "specs/001-n8n-desktop-app" to define specification for the desktop application
- "specs/002-ui-design" to create a specification for UI design of the same application
Please make sure that both will be used for the next planning phase. They are defines the same application requirements.
Ask me structured questions to de-risk ambiguous areas before planning.

### Plan

/speckit.plan Please help me to define the implementation plan. Ask me questions and do web research to create a better detailed plan. Make sure that both "001-n8n-desktop-app"and "002-ui-design" sspecifications taken into account and involved into the plan. Make sure you do proper research on how to implement desktop application and embed n8n server into the Electron desktop application. The following technologies should be used for the project:
- Electron framework https://www.electronjs.org/
- n8n https://github.com/n8n-io/n8n
- n8n AI workflows https://n8n.io/?ps_partner_key=ZDAwMjc5YmY0NjQ0&ps_xid=YyODYvEI9EcbKB&gsxid=YyODYvEI9EcbKB&gspk=ZDAwMjc5YmY0NjQ0&gad_source=1
- Typescript
- Vite
- Preact https://preactjs.com/
- Shadcn-ui for the UI https://ui.shadcn.com/docs/installation/vite
- tailwindcss
- nanostores for the state management
- @tanstack/react-query and axios for the API queries
- properly configured ESLint+Prettier with configured best practices linting rules for the selected tech stack.

Use local json files to store application configuration if the Electron do not provide outbox way of handling that.

### Check lists

/speckit.checklist Generate quality checklists to validate requirements completeness, clarity, and consistency

## Generate tasks

/speckit.tasks

Summary

  | Metric                 | Value                |
  |------------------------|----------------------|
  | Total Tasks            | 177                  |
  | MVP Tasks              | 79 (Phases 1-5 + 11) |
  | Parallel Opportunities | ~60% of tasks        |

  Tasks by User Story

  | User Story             | Priority | Tasks | Description                              |
  |------------------------|----------|-------|------------------------------------------|
  | Setup                  | -        | 15    | Project infrastructure                   |
  | Foundation             | -        | 27    | Core infrastructure (blocks all stories) |
  | US1 - Home Screen      | P1       | 14    | Sidebar, workflow cards, search/filter   |
  | US2 - Create Workflow  | P1       | 15    | New workflow dropdown, import, templates |
  | US3 - Manage Workflow  | P1       | 13    | Context menu, edit/duplicate/delete/run  |
  | US4 - View AI Services | P2       | 10    | AI Services page with cards              |
  | US5 - Configure AI     | P2       | 10    | Settings > AI Services tab               |
  | US6 - Storage Settings | P2       | 11    | Settings > Storage tab, backup/restore   |
  | US7 - Server Settings  | P3       | 12    | Settings > Server tab, logs              |
  | US8 - Status Monitor   | P3       | 5     | Server status indicator                  |
  | First-Run              | -        | 5     | Welcome page, folder selection           |
  | Recent Page            | -        | 3     | Recently opened workflows                |
  | Tray/Lifecycle         | -        | 7     | System tray, minimize, shutdown          |
  | Updates                | -        | 5     | Update banner                            |
  | Error Handling         | -        | 5     | Port conflict, network errors            |
  | Polish                 | -        | 5     | Accessibility, loading states            |
  | Testing/Build          | -        | 15    | Unit, integration, E2E, installers       |

  Suggested MVP Scope

  Phases 1-5 + 11 (79 tasks):
  - Setup + Foundation
  - US1: Home Screen with workflow cards
  - US2: Create new workflows + import + templates
  - US3: Edit/duplicate/delete/run workflows
  - First-run experience

  This delivers a fully functional workflow management application that users can install and use immediately.

  Independent Test Criteria per Story

  - US1: Launch app → sidebar visible → workflow cards display correctly
  - US2: New Workflow dropdown → Create New → editor opens; Open from Disk → import works
  - US3: Right-click card → context menu works → all actions function
  - US4: AI Services page → cards display with status
  - US5: Settings > AI Services → configure and test connection
  - US6: Settings > Storage → change folder, clear cache, backup/restore
  - US7: Settings > Server → status displays, restart works, logs viewable
  - US8: Status indicator visible on all screens, clickable

## Manual Verification Instructions

  1. Start the Development Server

  cd /home/dmorozov/Work/n8nDesktop
  npm run dev

  2. Verify UI Components

  Once the app launches, verify:

  1. Sidebar Navigation
    - Logo and "n8n AI Runner" branding at top
    - "New Workflow" dropdown button with "Create New" and "Open from Disk" options
    - Navigation links: Workflows, Recent, AI Services
    - Settings button at bottom
    - Server status indicator (green/yellow/red dot with text)
  2. Home Page (Workflows)
    - Page title "Workflows" with count badge
    - Search input field
    - Status filter dropdown (All, Active, Inactive)
    - Grid/List view toggle
    - Empty state if no workflows (with "Create New Workflow" and template options)
  3. Recent Page
    - Navigate by clicking "Recent" in sidebar
    - Shows recently opened workflows sorted by last modified
  4. AI Services Page
    - Navigate by clicking "AI Services" in sidebar
    - Shows configured AI services with "Add Service" button
    - Empty state if no services configured

  3. Verify Build

  npm run lint      # Should pass with no errors
  npm run typecheck # Should pass with no errors


TODO:
I still see some issues with the n8n server. Please fix them:
- Make sure that the n8n will have all dependencies pre-installed so will not download them on the first server start.
- I have closed the application by clicking Exit in the context menu for the tray icon. The application is exist but the n8n server is still up. I can see the process is still listening the port.
- When create new workflow button pressed it shows error "Request failed with status code 401". That probably means the auto login functionality either doesn't work or we are not properly propagating authentication status when accessing n8n UI. Please do web research to resolve the issue.

- Black text color on dark theme makes button labels unreadable

Install theme:
npx shadcn@latest add https://zippystarter.com/r/blue.json
npx shadcn@latest add https://zippystarter.com/r/starbucks.json
npx shadcn@latest add https://zippystarter.com/r/amber.json
npx shadcn@latest add https://zippystarter.com/r/pumpkin-spice.json
npx shadcn@latest add https://zippystarter.com/r/nimble.jsonhttps://www.shadcn.io/theme/vercel

more themes:
https://www.shadcn.io/theme/vercel

- Disable create new workflow or load workflow (from file or recent) functionality till the n8n server status is active

## Manual environment configuration

### Phase 1. Create a dockerized environment

1 Create a project's folder:

```bash
mkdir n8n-granite-project
cd n8n-granite-project
```

2. Create docker-compose.yml:
Create a file named docker-compose.yml and paste the following configuration. This defines three services: n8n, ollama, and pdf_receiver

```yaml
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n # Persistent storage for n8n workflows
      - ./local_files:/files # Mount local directory for PDF access
    environment:
      - WEBHOOK_URL=http://localhost:5678/
      # Allow n8n container to connect to host's localhost (for Windows/Mac users)
      - NODE_EXTRA_CA_CERTS=/files/ca_cert.pem # Example for advanced CA usage

  ollama:
    image: ollama/ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

  pdf_receiver:
    build: . # Build from current directory (where app.py is)
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - ./local_files:/app/uploads # Shared volume to verify received files

volumes:
  n8n_data:
  ollama_data:
```

3. Create app.py for the PDF Receiver:
Create a file named app.py in the same directory (n8n-granite-project). This is the Flask server code from the previous instructions, slightly modified to use the mounted volume path.

```python
from flask import Flask, request, jsonify
import os

app = Flask(__name__)
UPLOAD_FOLDER = './uploads' # This maps to ./local_files on the host
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/upload-pdf', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "No selected file"}), 400

    if file:
        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)
        print(f"Saved file: {filepath}")
        return jsonify({"status": "success", "message": f"File {file.filename} received and saved"}), 200

    return jsonify({"status": "error", "message": "Something went wrong"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

```

4. Create a Dockerfile for the PDF Receiver:
Create a file named Dockerfile in the same directory. This defines how the Python app container is built.

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 5000

CMD ["python", "app.py"]
```

And a requirements.txt file:

```txt
Flask
```

5. Start All Services:
In your terminal within the n8n-granite-project directory, run:

```bash
docker compose up -d
```

This command starts n8n, Ollama, and builds/starts your PDF receiver

### Phase 2: Prepare Granite AI Model and Test File

1. Pull the IBM Granite Model:
Use Docker's command line to execute a command inside the running Ollama container to download the specific Granite model you need (e.g., ibm/granite-3-instruct:v1).

```bash
docker exec -it ollama ollama pull ibm/granite-3-instruct:v1
```

2. Add a Test PDF:
Create a subdirectory named local_files in your n8n-granite-project folder. Place a sample PDF (e.g., test.pdf) inside this new directory. This folder is shared between your host machine, n8n container, and pdf_receiver container.

### Phase 3: Configure n8n Workflow

1. Access n8n: Open your web browser and navigate to http://localhost:5678. Complete the initial setup.
2. Create the Workflow:
  1. Manual Trigger: Add this as your first node.
  2. Read/Write Files Node:
    - Operation: Read
    - Path: /files/test.pdf (This path works inside the Docker container due to the volume mapping in the docker-compose.yml file).
    - Output Format: Binary Data
  3. HTTP Request Node (Send PDF to Receiver):
    - Method: POST
    - URL: http://pdf_receiver:5000/upload-pdf (Use the service name pdf_receiver as the hostname; Docker Compose networking handles this).
    - Body Content Type: File
    - File field name: file
    - File content: Expression {{ $node["Read/Write Files"].binary }}
  4. HTTP Request Node (Optional: Send PDF text to Granite AI):
    - First, add an Extract from File (From PDF) node after the Read node to get text data.
    - Then, add a new HTTP Request node.
    - Method: POST
    - URL: http://ollama:11434/api/generate (Use the service name ollama and the port 11434).
    - Body Content Type: JSON
    - Body:
    ```json
    {
      "model": "ibm/granite-3-instruct:v1",
      "prompt": "Summarize the following document content: " + "{{ $node[\"Extract from File (From PDF)\"].json[\"text\"] }}"
    }
    ```

### Phase 4: Test the System

1. Run n8n Workflow: Click "Run Workflow" in n8n.
2. Verify PDF Reception: Check the local_files folder on your host machine for the newly saved test.pdf copy.
3. Verify AI Output: The n8n HTTP Request node connected to ollama should return the AI-generated summary in its output panel.

## Docling integration Planning

/speckit.specify Please plan adding new functionality to the current existing project. Check @design/ARCHITECTURE.md document first to set the understanding of the current project's architecture. New functionality is to integrate Granite Docling OCR processing tool chain into the application and use Python to expose this to the main Electron application. Use the following documents to collect main details for the implementation: design/DOCLING_N8N_ELECTRON.md, design/DOCLING_PLANNING.md, design/IPC_RECOMMENDATIONS.md. Do research, think, and create a detailed architectural plan. List all major features of the Granite Docling, split them into 3 categories, and order them by the level of resources and speed required to execute PDF processing (Table Recognition, Formula/Equation Recognition, Figure & Chart Classification, etc). The existing Electron application has already implemented settings page, define steps to add separate tab for the Docling configuration (need to configure temp folder and level of processing based on the 3 categoried identified). Do reserach on how to better organize passing the pdf files to be processed to the Docling and how to consume them back by the Electron application.

/speckit.clarify Please ask me structured questions to de-risk ambiguous areas before planning

/speckit.plan Create a detailed step by step implementation plan of robost and managable integrating Granite Docling (using Python) into to the Electron shell application that is running n8n server inside already. Use research documents: design/DOCLING_N8N_ELECTRON.md, design/DOCLING_PLANNING.md, design/IPC_RECOMMENDATIONS.md. List of documents should be passed by n8n server to the Docling. The Docling should parse the provided documents into Markdown preservice page numbers from the original documents. It should support: PDF, Excel and Microsoft Word documents. The result parsed Markdown should be passed back to the n8n server workflow for the futher processing. Include details of recommended integration points to build the robust production ready application. The Python inside of the Electron application should use virtual environment and project toml file to manage the dependencies. All dependencies for Granite Docling (binaries, libraries) and Python libraries should be included into the Electron application on compile time to avoid downloading them when the Electron application installed on the client's system. The Electron application should check if the Python runtime is available on the target computer and show error with details on how to install the Python environment on the target computer.
Add separate table with known issues of such integration and workarounds. Identify critical and recommended parts. Add separate section about how to initialize the Docling pipeline to use EasyOCR parser. Include instructions for batch convertion of multiple documents to speed up the process.

Define separate plan phases, at least the following separate phases need to be defined:
- Reuse existing Python project using pyproject.toml and poetry Python management tool: src/docling. Make all necessary changes required for the Docling IPC implementation
- Implement required IPC layer (using Local HTTP API FastAPI) between Docling and Electron.
- Implement UI to configure Docling integration ()
- Make sure that the AI configuration can be accessed by the n8n workflow to select the correspondent AI service within the workflow.
- Add definition of the n8n workflow to test the whole integration. The workflow should be able to 1) define list of documents to be processed; 2) call Docling to parse the list of documents (using batch approach) 3) Use existing AI service to ask to summorize all information from the document into small report.

Extra information links: 
https://github.com/docling-project/docling
https://docling-project.github.io/docling/getting_started/installation/
https://docling-project.github.io/docling/
https://docling-project.github.io/docling/examples/full_page_ocr/
https://docling-project.github.io/docling/examples/batch_convert/

Do web research to resolve unclear implementation details and use coding best practices.

/speckit.checklist Help me to crean up and resove any unclear requirements in the plan. For better verification for the results of AI generated code Please analyze design/AI_DEBUGGING.md document and do deep research online to improve debuggability of the Electron application by the AI itself to verify it's own results of implementation. It can include extensive logging, screen recording or MCP servers like Playwrite. 

/speckit.tasks
/speckit.analyze

To run the tests, you'll need to:
1. Install Poetry: curl -sSL https://install.python-poetry.org | python3 -
2. Run poetry install in src/docling/
3. Run poetry run pytest for Python tests
4. Run npm test for TypeScript tests

sudo netstat -tulpn | grep :5678