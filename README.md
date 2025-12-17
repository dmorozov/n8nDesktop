# n8n AI Runner

**Local AI-powered document processing for everyone.**

A desktop application that makes powerful AI workflows accessible to non-technical users. Process documents, chat with AI, and automate tasks—all running locally on your computer.

---

## The Story Behind This Project

My friend works in a small business and regularly needs to process documents—extracting information, summarizing contracts, organizing data. These are tasks that n8n (a powerful workflow automation tool) combined with AI services like ChatGPT can handle brilliantly.

But there was a problem: **n8n is designed for technical users.** It requires understanding of APIs, JSON, workflow design, and server administration. My friend just wanted to upload a PDF and get a summary.

So I built **n8n AI Runner**—a desktop application that:

1. **Hides the complexity**: The n8n server runs invisibly in the background
2. **Simplifies execution**: A clean popup interface for running workflows with just file selection and a click
3. **Enables sharing**: Technical colleagues can create workflow "packs" that non-technical users can run locally
4. **Keeps data private**: Everything runs on the user's computer, no cloud uploads required

The result is a bridge between technical capability and everyday usability. Someone technical can design sophisticated document processing workflows using n8n's visual editor, export them as JSON files, and share them with colleagues who can run them without ever seeing the underlying complexity.

---

## Key Features

### For End Users (Non-Technical)

- **Simple Workflow Execution**: Click "Run", select your file, see results
- **No Setup Required**: Install like any desktop application
- **Privacy First**: All processing happens locally on your computer
- **Multiple AI Options**: Use cloud services (OpenAI, Google) or local AI (Ollama)

### For Technical Users

- **Full n8n Editor**: Access the complete n8n workflow designer when needed
- **Custom Nodes**: Three specialized nodes (PromptInput, FileSelector, ResultDisplay) enable simplified execution
- **Embedded Docling**: Built-in document processing (PDF, images, OCR)
- **Template System**: Create and share workflow packs

---

## Architecture Overview

n8n AI Runner is an Electron application that orchestrates multiple services:

```
┌─────────────────────────────────────────────────────────────┐
│                    n8n AI Runner (Electron)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │   React UI      │  │  n8n Server  │  │   Docling     │   │
│  │   (Frontend)    │  │  (Workflows) │  │ (Doc Process) │   │
│  │                 │  │              │  │               │   │
│  │  - Workflow     │  │  - Node.js   │  │  - Python     │   │
│  │    Cards        │  │  - SQLite    │  │  - FastAPI    │   │
│  │  - Run Popup    │  │  - REST API  │  │  - OCR        │   │
│  │  - AI Config    │  │              │  │               │   │
│  └─────────────────┘  └──────────────┘  └───────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology |
|-----------|------------|
| Desktop Framework | Electron 39 |
| Frontend | React 19, TypeScript, TailwindCSS 4 |
| Workflow Engine | n8n 2.0.0 |
| Document Processing | IBM Docling 2.15.0 |
| State Management | Nanostores |
| Data Storage | SQLite (n8n), electron-store (config) |

---

## Documentation

### For Users

- **[User Guide](./documentation/USER_GUIDE.md)** - Complete guide for non-technical users
  - Getting started
  - Running workflows
  - Configuring AI services
  - Troubleshooting

### For Developers

- **[Technical Architecture](./documentation/TECHNICAL_ARCHITECTURE.md)** - Deep dive into the codebase
  - Process architecture
  - Custom n8n nodes
  - Workflow execution popup system
  - Document processing integration
  - Security considerations

### Design Documents

- **[Architecture Overview](./documentation/design/ARCHITECTURE.md)** - High-level system design
- **[Docling Integration](./documentation/design/DOCLING_N8N_ELECTRON.md)** - Document processing design
- **[IPC Recommendations](./documentation/design/IPC_RECOMMENDATIONS.md)** - Inter-process communication patterns

---

## Embedded Components

### n8n Workflow Automation

This application embeds [n8n](https://n8n.io/) (version 2.0.0), an open-source workflow automation platform.

| | |
|---|---|
| **Website** | https://n8n.io/ |
| **Documentation** | https://docs.n8n.io/ |
| **Source Code** | https://github.com/n8n-io/n8n |
| **License** | [Sustainable Use License](https://github.com/n8n-io/n8n/blob/master/LICENSE.md) |

> **Disclaimer**: This desktop application uses n8n as an embedded component and is not officially affiliated with or endorsed by n8n GmbH.

### IBM Granite Docling

This application includes [Docling](https://github.com/DS4SD/docling) (version 2.15.0), an open-source document processing library developed by IBM Research.

| | |
|---|---|
| **Website** | https://ds4sd.github.io/docling/ |
| **Documentation** | https://ds4sd.github.io/docling/reference/ |
| **Source Code** | https://github.com/DS4SD/docling |
| **License** | MIT License |
| **Model** | IBM Granite-Docling 258M VLM |

> **Disclaimer**: This desktop application uses Docling as an embedded service for local document processing and is not officially affiliated with or endorsed by IBM.

---

## Getting Started

### Prerequisites

- Node.js 20.x LTS
- Python 3.10+ (for Docling)
- Poetry (Python package manager)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd n8nDesktop

# Install all dependencies (npm + Python + custom nodes)
npm run setup:all

# Start development server
npm run dev
```

### Building

```bash
# Build for distribution
npm run make
```

---

## Build Scripts

| Script | Description |
|--------|-------------|
| `npm run setup:all` | Installs all dependencies (npm packages + Docling Python deps) |
| `npm run setup:docling` | Installs Docling Python dependencies using Poetry |
| `npm run setup:docling:pip` | Alternative: Installs Docling deps using pip (if Poetry not available) |
| `npm run build:all` | Runs setup:all, builds n8n-nodes, then builds the Electron app |
| `npm run clean:all` | Removes all build artifacts and dependencies |
| `npm run check:all` | Runs all checks (typecheck, lint, unit tests) |
| `npm run make` | Creates distributable installers |

---

## Custom n8n Nodes

Three custom nodes enable the simplified workflow execution popup:

1. **Prompt Input** (`CUSTOM.promptInput`) - Rich text input for AI prompts. Take the input (if any) from the user friendly workflow executor window.
2. **File Selector** (`CUSTOM.fileSelector`) - Native file picker with type filtering. Take the input (if any) from the user friendly workflow executor window.
3. **Result Display** (`CUSTOM.resultDisplay`) - Output display in popup. Pass the output from the workflow execution to the user friendly workflow executor window.

The custom nodes are:
1. Packaged in `resources/n8n_nodes/` (minimal size, no dev dependencies)
2. Found by the app at runtime
3. Copied to `~/.n8n/custom/` so n8n can load them

---

## Workflow Templates

Pre-built templates are available in the `templates/` folder:

- **AI Chat Assistant** - Basic chatbot with AI Agent
- **PDF Processing with AI Summary** - Document extraction and summarization
- **Web Scraper** - Web page content extraction
- **Automation** - General automation template

Templates use placeholders that are replaced at runtime:
- `{{DOCLING_API_URL}}` - Docling API endpoint
- `{{DOCLING_AUTH_TOKEN}}` - Authentication token
- `{{N8N_FILES_FOLDER}}` - File storage path
- `{{DATA_FOLDER}}` - Base data folder

---

## Development

### Debug Configurations

**Option 1: Main Process Only**
- Select "Electron: Main Process" in VS Code
- Press F5
- Breakpoints in `src/main/**/*.ts` work

**Option 2: Renderer Only**
- Select "Electron: Renderer Only (with task)"
- Press F5
- Starts app with `--remote-debugging-port=9222`

**Option 3: Both Processes**
1. Run in terminal: `npm run start:debug`
2. Wait for app to start
3. Select "Electron: Renderer (Attach)" and press F5

### Project Structure

```
n8nDesktop/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React frontend
│   ├── preload/        # Preload scripts
│   ├── docling/        # Python Docling service
│   └── n8n_nodes/      # Custom n8n nodes
├── templates/          # Workflow templates
├── documentation/      # User & technical docs
│   └── design/         # Design documents
└── .specify/           # SpecKit configuration
```

---

## SpecKit Integration

This project uses [SpecKit](https://github.com/github/spec-kit) for spec-driven development:

```bash
# Install SpecKit
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Initialize
specify init .
specify check
```

Available commands:
- `/speckit.specify` - Create feature specification
- `/speckit.plan` - Create implementation plan
- `/speckit.tasks` - Generate task list
- `/speckit.implement` - Execute implementation

Constitution: `.specify/memory/constitution.md`

---

## License

MIT License

---

## Contributing

Contributions are welcome! Please read the technical documentation before submitting PRs.

---

*Built with care to bridge the gap between powerful AI tools and everyday users.*
