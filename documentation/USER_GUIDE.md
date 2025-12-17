# n8n AI Runner - User Guide

Welcome to **n8n AI Runner**, a desktop application designed to make AI-powered document processing accessible to everyone, regardless of technical expertise.

---

## Table of Contents

1. [What is n8n AI Runner?](#what-is-n8n-ai-runner)
2. [Getting Started](#getting-started)
3. [Understanding the Interface](#understanding-the-interface)
4. [Managing Your Workflows](#managing-your-workflows)
5. [Running Workflows (The Easy Way)](#running-workflows-the-easy-way)
6. [Configuring AI Services](#configuring-ai-services)
7. [Settings and Preferences](#settings-and-preferences)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)
10. [Glossary](#glossary)

---

## What is n8n AI Runner?

n8n AI Runner is a desktop application that allows you to run powerful AI workflows on your local computer without needing any technical knowledge. Think of it as a smart assistant that can:

- **Process documents** - Extract text from PDFs, images, and other documents
- **Summarize content** - Get AI-generated summaries of long documents
- **Chat with AI** - Ask questions and get intelligent responses
- **Automate tasks** - Run pre-configured workflows with a single click

### Who is this for?

This application is designed for people who:
- Need to process documents regularly but don't want to learn complex tools
- Want to use AI services (like ChatGPT) through a simple interface
- Prefer to keep their data on their own computer (not in the cloud)
- Have been given workflow "packs" by a technical colleague to run locally

### Key Benefits

- **Privacy**: All processing happens on your computer
- **Simplicity**: No coding or technical knowledge required
- **Portability**: Your data stays in a folder you choose, easy to backup
- **Flexibility**: Use cloud AI services (OpenAI, Google) or local AI (Ollama)

---

## Getting Started

### First Launch

When you first open n8n AI Runner:

1. **The application will start automatically** - You'll see a loading screen while the internal services start up
2. **Choose your data folder** - You'll be asked where to store your workflows and processed files
3. **Server status indicator** - Look at the bottom-left corner; a green dot means everything is ready

### Understanding the Status Indicator

At the bottom of the sidebar, you'll see:
- 🟢 **Green dot** + "n8n Server Running" = Ready to use
- 🟡 **Yellow dot** + "Starting..." = Please wait
- 🔴 **Red dot** + "Error" = Something went wrong (see Troubleshooting)

---

## Understanding the Interface

### The Main Window

```
┌─────────────────────────────────────────────────────────┐
│  n8n AI Runner                                          │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │           Main Content Area                  │
│          │                                              │
│ + New    │   Your workflows appear here as cards       │
│          │                                              │
│ Workflows│   [Workflow 1]  [Workflow 2]  [Workflow 3]  │
│ Recent   │                                              │
│ AI Svc   │                                              │
│          │                                              │
├──────────┼──────────────────────────────────────────────┤
│ Status   │                                              │
│ Settings │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Sidebar Navigation

- **+ New Workflow** - Create or import new workflows
- **Workflows** - View all your workflows
- **Recent** - Quickly access recently used workflows
- **AI Services** - Configure your AI providers (OpenAI, Ollama, etc.)
- **Settings** - Application preferences
- **Status** - Server status indicator

---

## Managing Your Workflows

### What is a Workflow?

A workflow is a pre-configured set of steps that processes your input and produces a result. For example:
- "Document Summarizer" - Takes a PDF and creates a summary
- "AI Chat Assistant" - Lets you have a conversation with an AI
- "Email Classifier" - Categorizes emails automatically

### Viewing Your Workflows

1. Click **Workflows** in the sidebar
2. Your workflows appear as cards showing:
   - **Name** - What the workflow does
   - **Status** - Active (green) or Inactive
   - **AI Service** - Which AI it uses (e.g., "OpenAI GPT-4")
   - **Node count** - Technical detail, can be ignored
   - **Run button** - Click to execute the workflow

### Creating a New Workflow

Click **+ New Workflow** to see options:

1. **Create New** - Opens the advanced editor (for technical users)
2. **Open from Disk** - Import a workflow file (.json) that someone shared with you

### Importing Workflow Packs

If a technical colleague has prepared workflows for you:

1. Click **+ New Workflow** → **Open from Disk**
2. Navigate to the workflow file (usually ends in `.json`)
3. Select the file and click **Open**
4. The workflow will appear in your list

### Workflow Card Actions

Click the **three dots** (⋯) on any workflow card to:
- **Edit** - Open in the technical editor
- **Duplicate** - Make a copy
- **Delete** - Remove the workflow

---

## Running Workflows (The Easy Way)

This is the main feature that makes n8n AI Runner special - you can run complex AI workflows without seeing any of the technical complexity.

### The Run Button

1. Find the workflow you want to run
2. Click the green **Run** button
3. A simple popup window appears

### The Workflow Execution Popup

When you click Run, you'll see a friendly popup with:

```
┌────────────────────────────────────────────────────────────┐
│                   Document Summarizer                       │
├──────────────────┬─────────────┬───────────────────────────┤
│                  │             │                           │
│   YOUR INPUT     │   STATUS    │      RESULTS              │
│                  │             │                           │
│ [Select File]    │    ⏳       │   Summary will appear     │
│                  │  Running    │   here after processing   │
│ [Enter Text]     │             │                           │
│                  │             │                           │
├──────────────────┴─────────────┴───────────────────────────┤
│                    [Execute]  [Cancel]                      │
└────────────────────────────────────────────────────────────┘
```

### Input Types

Depending on the workflow, you may need to provide:

**File Input**
- Click "Select File" or "Browse"
- Choose a document from your computer (PDF, Word, image, etc.)
- The file will be processed by the workflow

**Text Input**
- Type or paste your text in the provided box
- For example, enter a question for an AI chat workflow

### Running the Workflow

1. Provide the required inputs
2. Click **Execute** (or press **Ctrl+Enter**)
3. Watch the status indicator in the middle
4. Results appear on the right side when complete

### Understanding Results

Results can appear as:
- **Text** - Plain text or formatted content
- **Markdown** - Nicely formatted with headers, bullet points, etc.
- **Files** - Downloadable files that were generated

### Keyboard Shortcuts

- **Ctrl+Enter** - Execute the workflow
- **Escape** - Close the popup

---

## Configuring AI Services

AI Services are the "brains" behind your workflows. You need at least one AI service configured for most workflows to work.

### Accessing AI Services

1. Click **AI Services** in the sidebar
2. You'll see available AI providers as cards

### Available AI Providers

#### Cloud Services (Require Internet + API Key)

**OpenAI**
- Powers ChatGPT
- Models: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- Requires: OpenAI API key
- Cost: Pay per use

**Google Gemini**
- Google's AI models
- Models: Gemini Pro, Gemini Pro Vision
- Requires: Google API key
- Cost: Free tier available, then pay per use

#### Local Services (Run on Your Computer)

**Ollama**
- Run AI models locally for free
- Models: Llama 3, Mistral, CodeLlama, and more
- Requires: Ollama installed separately
- Cost: Free (uses your computer's resources)

**LM Studio**
- Another local AI option
- Easy model downloading and management
- Requires: LM Studio installed separately
- Cost: Free

### Adding an AI Service

1. Click **+ Add Service** in the top right
2. Select the provider type
3. Enter your API key (for cloud services) or endpoint URL (for local services)
4. Click **Test Connection** to verify
5. Click **Save**

### Getting API Keys

**For OpenAI:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in or create an account
3. Navigate to API Keys section
4. Click "Create new secret key"
5. Copy the key and paste it in n8n AI Runner

**For Google Gemini:**
1. Go to [makersuite.google.com](https://makersuite.google.com)
2. Sign in with your Google account
3. Click "Get API key"
4. Copy and paste into n8n AI Runner

### Managing AI Services

Each AI service card shows:
- **Status** - Connected (green checkmark) or Not configured
- **Provider type** - Cloud or Local
- **Available models** - Which AI models you can use
- **Configure button** - Change settings
- **Delete button** - Remove the service

---

## Settings and Preferences

Access settings by clicking the **gear icon** at the bottom of the sidebar.

### Settings Tabs

#### AI Services Tab
Quick access to AI service configuration (same as AI Services page).

#### Storage Tab

**Workflow Storage**
- **Workflows Directory** - Where your workflow files are saved
- **Auto-save Workflows** - Automatically save changes as you work
- **Create Backups** - Keep backup copies of your workflows

**Data Storage**
- **Data Directory** - Where application data is stored
- **Cache size** - How much temporary data is stored
- **Clear Cache** - Free up disk space

#### Server Tab

Advanced settings for the internal server (usually no need to change):
- **Port** - Network port used by the server
- **Logs** - View technical logs for troubleshooting

---

## Common Tasks

### Task 1: Summarize a PDF Document

1. Make sure you have an AI service configured (e.g., OpenAI)
2. Find the "PDF Processing with AI Summary" or "Document Summarizer" workflow
3. Click **Run**
4. Click **Select File** and choose your PDF
5. Click **Execute**
6. Wait for processing (may take 1-2 minutes for large documents)
7. Read your summary in the results panel

### Task 2: Chat with AI

1. Find the "AI Chat Assistant" workflow
2. Click **Run**
3. Type your question in the text box
4. Click **Execute**
5. Read the AI's response in the results panel
6. To ask follow-up questions, close and re-run the workflow

### Task 3: Process Multiple Documents

For workflows that support multiple files:
1. Click **Run** on the workflow
2. Click **Select Files** (note: plural)
3. Hold **Ctrl** (or **Cmd** on Mac) and click multiple files
4. Click **Execute**
5. Results will include information about all processed files

### Task 4: Export Your Work

To backup your workflows:
1. Go to **Settings** → **Storage**
2. Note your **Workflows Directory** path
3. Copy this entire folder to your backup location

To share a workflow:
1. Find the workflow in your Workflows Directory
2. Copy the `.json` file
3. Share it with your colleague

---

## Troubleshooting

### The server won't start (Red status indicator)

**Possible causes:**
- Another application is using the same port (5678)
- Your antivirus is blocking the application
- Not enough system memory

**Solutions:**
1. Close other applications and restart n8n AI Runner
2. Add n8n AI Runner to your antivirus whitelist
3. Restart your computer

### Workflows run but produce no results

**Possible causes:**
- AI service not configured or API key invalid
- Internet connection issue (for cloud AI services)
- The input file format is not supported

**Solutions:**
1. Check AI Services page - make sure at least one shows "Connected"
2. Test your internet connection
3. Try a different file or simpler input

### "API key invalid" or authentication errors

**Solutions:**
1. Go to AI Services
2. Click Configure on the affected service
3. Re-enter your API key (copy fresh from the provider's website)
4. Click Test Connection before saving

### Document processing is very slow

**Possible causes:**
- Large document being processed
- Using a slow AI model
- Slow internet connection

**Solutions:**
1. Wait patiently - large documents can take several minutes
2. Try a faster model (e.g., GPT-3.5 Turbo instead of GPT-4)
3. Split large documents into smaller parts

### The popup window is empty or doesn't show inputs

**Possible cause:**
- The workflow doesn't use the special input/output nodes

**Solution:**
- This workflow may need to be run through the technical editor
- Contact the person who created the workflow

### Application uses too much memory

**Solutions:**
1. Go to **Settings** → **Storage** → **Clear Cache**
2. Close and restart the application
3. Process fewer documents at once

---

## Glossary

**API Key**
A secret code that allows you to use an AI service. Like a password for your AI account.

**Cloud Service**
An AI service that runs on the internet (like OpenAI or Google). Requires internet connection and usually costs money per use.

**Local Service**
An AI service that runs on your own computer (like Ollama). Free to use but requires more computer resources.

**Node**
A single step in a workflow. Technical term, usually not important for regular users.

**Workflow**
A pre-configured sequence of steps that processes your input and produces a result.

**Workflow Pack**
A collection of workflow files that someone has prepared for you to use.

**n8n**
The underlying automation engine that powers n8n AI Runner. It's a powerful open-source tool that this application makes easy to use.

**Docling**
The document processing engine built into n8n AI Runner. It can read PDFs, images, and other documents.

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the status indicator** - Make sure the server is running (green dot)
2. **Verify AI services** - At least one should show "Connected"
3. **Try restarting** - Close and reopen the application
4. **Contact your IT support** - If you received this software from your organization

---

## Credits and Disclaimers

### n8n Workflow Automation Engine

This application embeds [n8n](https://n8n.io/) (version 2.0.0), an open-source workflow automation platform.

- **Website**: https://n8n.io/
- **Source Code**: https://github.com/n8n-io/n8n
- **License**: [Sustainable Use License](https://github.com/n8n-io/n8n/blob/master/LICENSE.md)

n8n is developed and maintained by n8n GmbH. This desktop application uses n8n as an embedded component and is not officially affiliated with or endorsed by n8n GmbH.

### IBM Granite Docling

This application includes [Docling](https://github.com/DS4SD/docling) (version 2.15.0), an open-source document processing library developed by IBM Research.

- **Website**: https://ds4sd.github.io/docling/
- **Source Code**: https://github.com/DS4SD/docling
- **License**: MIT License
- **Model**: IBM Granite-Docling 258M VLM

Docling provides advanced document understanding capabilities including OCR, table extraction, and document structure analysis. This desktop application uses Docling as an embedded service for local document processing.

### Your Data and Privacy

- All document processing happens locally on your computer
- Your files are never uploaded to external servers (unless you explicitly use cloud AI services)
- Cloud AI services (OpenAI, Google) will process the text content you send to them according to their privacy policies
- For maximum privacy, use local AI services like Ollama

---

*Last updated: December 2024*
*n8n AI Runner version 1.0.0*
