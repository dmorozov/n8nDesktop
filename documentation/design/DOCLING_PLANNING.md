The integration of Granite Docling into an Electron application hosting an n8n server requires adopting a robust, dual-server architecture known as the **Trident Local Server Model**. This ensures high performance, resilience, and clean communication, isolating the resource-intensive Python process from the Node.js environment.

The core strategy involves running the Granite Docling processing logic as a separate, persistent **FastAPI/Uvicorn HTTP API** that the n8n server calls using its native **HTTP Request node**.

---

## Detailed Step-by-Step Integration Plan

### Critical Integration Point: Architecture and Inter-Process Communication (IPC)

The recommended IPC method is running the Python logic as a dedicated REST API using **FastAPI** on the local loopback address (`127.0.0.1`). This architecture is critical because it decouples the heavy Docling/VLM inference process from the n8n Node.js process, maintaining stability and leveraging n8n’s native HTTP capabilities.

### Phase 1: Python Backend Development and Packaging

#### Step 1: Develop the Granite Docling FastAPI Service (Critical)

1.  **Environment Setup:** Create an isolated Python environment (e.g., using `venv`) and define dependencies (`docling`, `fastapi`, `uvicorn`, `requests`, `python-toml`) in a `pyproject.toml` or `requirements.txt` file.
2.  **API Definition:** Create a core API script (e.g., `api.py`) using FastAPI and define a POST endpoint (e.g., `/process-docs`). This endpoint must be configured to receive the list of document paths/identifiers from n8n.
3.  **Dynamic Port Configuration:** Configure the FastAPI server (using Uvicorn) to accept its listening port dynamically via a command-line argument at runtime, instead of hardcoding it. The service must bind exclusively to `127.0.0.1` for local security.
4.  **Security Token Integration:** Implement a layer of local authentication where the API expects a shared secret token in the request headers (e.g., `Authorization: Bearer <token>`).

#### Step 2: Implement Custom High-Fidelity Parsing Logic (Critical)

Since the requirement is to preserve page numbers and location metadata within the Markdown output, reliance on the default `DoclingDocument.export_to_markdown()` method is **insufficient**, as it is **lossy** and strips this provenance information.

1.  **Conversion:** Inside the `/process-docs` endpoint, use `docling.document_converter.DocumentConverter().convert(source=file_path)` to process the input documents (PDF, Excel, Microsoft Word - DOCX/XLSX). This converts the input into the internal, lossless `DoclingDocument` object.
2.  **Provenance Traversal:** Implement a custom function to iterate systematically through the content elements (paragraphs, headings) within the `DoclingDocument` object.
3.  **Metadata Extraction:** For each extracted element, access its provenance (`prov`) metadata to retrieve the **source page number** (`page_no`) attribute.
4.  **Markdown Injection (Custom Post-Processing):** Manually prepend a machine-readable page marker (e.g., a standardized comment or header format like `<span data-page="3"></span>`) to the element’s Markdown representation, embedding the extracted `page_no` before compiling the final Markdown string.
5.  **Response:** The API returns a standard JSON object wrapping the successfully annotated Markdown string back to the client (n8n).

#### Step 3: Python Packaging and Dependency Bundling (Critical)

The Python service, including all binary dependencies and VLM weights, must be bundled into a standalone executable using **PyInstaller** to ensure a zero-install deployment on the client machine.

1.  **PyInstaller Execution:** Run PyInstaller on the FastAPI entry script (`api.py`) using either the `--onefile` or `--onedir` strategy.
2.  **Hidden Imports:** Due to the dynamic nature of ASGI servers like Uvicorn, explicitly specify necessary modules in the PyInstaller `.spec` file using the `hiddenimports` flag (e.g., `uvicorn.logging`, `uvicorn.loops`) to prevent runtime failures.
3.  **Model Weight Bundling:** Ensure that the Granite Docling VLM model weights (≈ 258M parameters) and any required Python libraries/binaries (like those for PDF, Excel, Word handling) are correctly packaged alongside the executable.
4.  **Virtual Environment Inclusion:** The output of PyInstaller implicitly includes the Python runtime environment and its dependencies, fulfilling the requirement for managing Python and its libraries within the packaged application.

### Phase 2: Electron Orchestration and Deployment

#### Step 4: Electron Dual-Server Orchestration (Recommended)

The Electron main process, running Node.js, manages the lifecycle of the two backend processes (n8n and FastAPI/Docling).

1.  **Port Management:** Implement a Node.js utility function to dynamically discover available local ports for the n8n service and the Docling FastAPI service to prevent port conflicts upon startup.
2.  **Concurrent Launch:** Use Node.js's **`child_process`** module (preferably **`child_process.execFile()`** for executing pre-compiled binaries directly without a shell) to launch both n8n and the compiled Python executable. Pass the dynamically allocated port and the secret token to the Python executable via command-line arguments.
    *   *Example launch:* `child_process.execFile(pathToPythonEngine, [fastApiPort, sharedSecret], { /* options */ });`
3.  **Startup Synchronization:** Implement a **readiness check** (e.g., polling the FastAPI service's `/health` endpoint) from the Electron main process. The UI should not load or allow operations until both n8n and the Docling API return an HTTP 200 response, accounting for the **VLM model loading time** (which can be substantial).
4.  **Graceful Shutdown:** Attach listeners (e.g., `'exit'`, `'error'`) to both child processes. Upon application exit, send termination signals (`.kill()`) to both n8n and the Python process, ensuring resources are released.

#### Step 5: Electron Packaging and Runtime Path Resolution (Critical)

Use Electron Builder or Packager for the final application bundling.

1.  **Inclusion of Python Executable:** Use the `extraResources` configuration in the `electron-builder.json` (or `package.json`) to embed the entire PyInstaller output directory (`dist/`) into the application bundle.
    *   This step is **critical** because external executables must reside outside the compressed **ASAR archive** to be executable by the OS.
2.  **Runtime Resolution:** The Electron main process must use `process.resourcesPath` at runtime to reliably locate the bundled Python executable across different operating systems.
    *   *Example path construction:* `path.join(process.resourcesPath, 'name-of-python-bundle', 'python_engine.exe')`.

#### Step 6: Python Runtime Availability Check and Error Handling (Recommended)

While the application bundles the required Python runtime via PyInstaller, robust error handling is required if the bundled executable fails to start (e.g., missing supporting libraries or resource constraints).

1.  **Failure Detection:** The Node.js main process monitors the Python child process for immediate `'error'` or non-zero exit code (`'exit'`) events upon launch.
2.  **Resource Requirements Check:** If the failure is detected, the Electron application should display a user-facing error dialog. Since the Granite Docling VLM is resource-intensive (recommended minimum **10 GB+ RAM** for stable operation), the error message should include system diagnostic details and suggest hardware upgrades or memory allocation adjustments if resource exhaustion is suspected.
3.  **Installation Guide Display:** For fatal startup errors, provide clear, detailed instructions within the application UI (or documentation link) on the expected operating environment and prerequisites (e.g., minimum system RAM, required OS/architecture).

### Phase 3: N8N Workflow Implementation

#### Step 7: Design the N8N Document Processing Workflow

1.  **Trigger Node:** Start the workflow with a relevant trigger (e.g., a **Local File Trigger** if monitoring a folder, or a **Manual Trigger** to input file paths manually).
2.  **Data Preparation:** Use preceding nodes (like a Function node) to construct a list of local **file paths** for the target documents (PDF, Excel, Word). Passing file paths to the API is generally preferred over transferring large binary file contents over HTTP to mitigate memory issues for multi-gigabyte documents.
3.  **API Call (HTTP Request Node):** Use the **HTTP Request node** to call the Docling FastAPI service.
    *   **Method:** POST.
    *   **URL:** `http://127.0.0.1:<FastAPI_Port>/process-docs` (using the port dynamically provided by the Electron host).
    *   **Body:** Send the list of file paths.
    *   **Headers:** Include the **shared secret token** in the authorization header (e.g., `Authorization: Bearer <token>`) for local security.
4.  **Result Handling:** The HTTP Request node receives the JSON response containing the annotated Markdown string from the Python service.

#### Step 8: Final Processing and Output

1.  **Extraction:** Extract the Markdown text content from the JSON response body received by the HTTP Request node.
2.  **Persistence:** Use a subsequent node, such as a **Write File node** or an internal database node (if persistence is needed, which runs on the default local SQLite DB for embedded n8n instances), to save the final structured Markdown text for further processing (e.g., RAG pipelines).

---

## Docling Configuration for Enhanced Performance

### Initializing the Docling Pipeline to use EasyOCR Parser

Docling supports various OCR engines, including EasyOCR, which must be installed as an optional extra (`docling[easyocr]`). To ensure the EasyOCR engine is used by the Document Converter in your Python FastAPI service (Step 2):

1.  **Install Extras:** Ensure the EasyOCR dependencies are bundled into your PyInstaller executable (Step 3).
2.  **Python Configuration:** When initializing the Document Converter in your Python service, specify the `EasyOcrOptions` within the pipeline options, and set `do_ocr` to true (if processing scanned PDFs).

```python
from docling.datamodel.pipeline_options import PipelineOptions, EasyOcrOptions
from docling.document_converter import DocumentConverter

pipeline_options = PipelineOptions()
pipeline_options.do_ocr = True
# CRITICAL: Select EasyOCR as the desired backend
pipeline_options.ocr_options = EasyOcrOptions() 

doc_converter = DocumentConverter(pipeline_options=pipeline_options)
# ... use doc_converter to process documents ...
```

### Batch Conversion for Multiple Documents

For batch conversion, especially for high-throughput scenarios using the Granite Docling 258M **Visual Language Model (VLM)**, the Python backend should leverage specialized libraries designed for parallel processing, such as **VLLM** (if processing page images) or Python's native concurrency tools (if processing sequential file I/O).

1.  **Python API Design:** The `/process-docs` endpoint should be engineered to accept a **list of file paths** or an array of request objects from the n8n client (Step 7).
2.  **Concurrent Processing:** Instead of processing documents sequentially in the FastAPI endpoint, employ Python's `asyncio` or `multiprocessing` library to distribute the conversion tasks across multiple CPU cores. For the file-based conversion used here, leveraging concurrent execution (workers/threads) minimizes the overhead associated with the high initial start-up time of processes and heavy dependencies.
3.  **VLM Batch Inference (Advanced Optimization):** If the workflow involves image-based inputs (like splitting PDFs into pages/images), using VLLM in the backend allows loading the VLM model once and generating outputs for multiple pages in a single optimized batch run, significantly speeding up processing time for page-intensive jobs.

---

## Known Issues and Production Workarounds

| Issue | Description | Criticality | Workaround / Solution |
| :--- | :--- | :--- | :--- |
| **Page Metadata Loss** | Direct Markdown export (`export_to_markdown()`) strips provenance data (like `page_no`) critical for RAG applications. | **Critical** | **Custom Post-Processing (Step 2):** Implement a custom Python routine to traverse the lossless `DoclingDocument` structure and manually inject `page_no` data into the Markdown string before returning it. |
| **Packaging Conflicts (ASAR)** | The Python executable bundled via PyInstaller often cannot be executed if compressed inside the Electron ASAR archive. | **Critical** | **`extraResources` (Step 5):** Use Electron Builder's `extraResources` configuration to force the Python executable and its supporting libraries to be placed outside the ASAR archive in a predictable location (`process.resourcesPath`). |
| **Hidden Imports/Runtime Errors** | PyInstaller fails to automatically detect modules used dynamically by `uvicorn` (ASGI server), leading to runtime errors in the packaged executable. | **Critical** | **PyInstaller Spec File (Step 3):** Manually add necessary packages (e.g., `uvicorn.logging`, internal VLM dependencies) using the `hiddenimports` flag in the `.spec` file. |
| **Dual-Server Port Conflicts** | N8N (default port 5678) and FastAPI/Uvicorn might attempt to use the same port or conflict with other local services. | **Critical** | **Dynamic Port Orchestration (Step 4):** Implement port scanning in the Electron Main process to dynamically select and assign non-conflicting local ports for both servers, passing them as arguments during launch. |
| **Python Startup Latency** | Repeatedly invoking the heavy Python interpreter and loading the VLM model incurs high startup overhead (100ms+). | **Recommended** | **Persistent Service Model (Architecture):** Run the Python environment as a long-running, persistent FastAPI service launched once upon application start, minimizing latency for subsequent calls. |
| **Local Service Authentication** | Communication relies on loopback security (`127.0.0.1`), which is generally weak against other local processes. | **Recommended** | **Shared Secret Token (Step 1, 4, 7):** Implement a shared secret token passed from the Electron host to both the n8n client and the Python API to validate requests via HTTP headers. |

---

### The Integration Metaphor

Implementing this system is akin to a **bilingual central processing plant**. Electron acts as the main factory floor manager (Main Process) where all parts are packaged together. The n8n automation line (Node.js) sends raw materials (document paths) to the heavy-duty document press (Granite Docling/FastAPI). Because the document press speaks a different language (Python/VLM) and is slow to warm up, it runs continuously on its own isolated server. The key is that the Python press manager meticulously stamps the original page number onto every piece of text before sending the finished, structured product (Markdown) back to the automation line, ensuring the integrity and traceability of the final result.
