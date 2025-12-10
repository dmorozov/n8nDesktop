# Build

| Script                    | Description                                                            |
|---------------------------|------------------------------------------------------------------------|
| npm run setup:all         | Installs all dependencies (npm packages + Docling Python deps)         |
| npm run setup:docling     | Installs Docling Python dependencies using Poetry                      |
| npm run setup:docling:pip | Alternative: Installs Docling deps using pip (if Poetry not available) |
| npm run build:all         | Runs setup:all then builds the Electron app                            |
| npm run clean:all         | Removes all build artifacts and dependencies                           |
| npm run check:all         | Runs all checks (typecheck, lint, unit tests)                          |

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

## Themes

Install theme:
npx shadcn@latest add https://zippystarter.com/r/blue.json
npx shadcn@latest add https://zippystarter.com/r/starbucks.json
npx shadcn@latest add https://zippystarter.com/r/amber.json
npx shadcn@latest add https://zippystarter.com/r/pumpkin-spice.json
npx shadcn@latest add https://zippystarter.com/r/nimble.jsonhttps://www.shadcn.io/theme/vercel

more themes:
https://www.shadcn.io/theme/vercel

- Disable create new workflow or load workflow (from file or recent) functionality till the n8n server status is active

### Configure n8n Workflow (with Docling)

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

## Debug Configurations

  Option 1: Main Process Only (works perfectly)

- Select "Electron: Main Process" → Press F5
- Breakpoints in src/main/**/*.ts work

  Option 2: Renderer Only (new)

- Select "Electron: Renderer Only (with task)" → Press F5
- This starts the app with --remote-debugging-port=9222 and attaches the Chrome debugger
- Breakpoints in src/renderer/**/*.tsx should work
- Note: No main process debugging in this mode

  Option 3: Both (two-step manual process)

  1. Run in terminal: npm run start:debug
  2. Wait for the app to fully start
  3. In VS Code, select "Electron: Renderer (Attach)" → Press F5
  4. Now you can use DevTools (F12) for renderer and console.log for main

## N8N custom nodes

http://n8nhackers.com/
https://ncnodes.com/
https://github.com/restyler/awesome-n8n

Example custom n8n node:
https://www.npmjs.com/package/n8n-nodes-pdforge

https://n8n.io/integrations/markdown/

## N8N Templates

Added getTemplatePlaceholderValues() function that returns:

- {{DOCLING_API_URL}} - Full API URL (e.g., http://127.0.0.1:8765/api/v1)
- {{DOCLING_AUTH_TOKEN}} - The auth token from config
- {{DOCLING_PORT}} - Just the port number
- {{N8N_FILES_FOLDER}} - Path to the n8n-files folder
- {{DATA_FOLDER}} - Base data folder path
- Added replacePlaceholders() function to substit

sudo netstat -tulpn | grep :5678
