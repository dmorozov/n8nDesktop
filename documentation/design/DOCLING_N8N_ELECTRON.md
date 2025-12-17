Architectural Blueprint for Embedded Document Intelligence: Integrating Granite Docling and N8N within Electron
I. Executive Architectural Synthesis and Integration Strategy
The successful realization of a self-contained desktop application that integrates an advanced workflow engine (n8n) with a specialized document intelligence model (Granite Docling) necessitates a highly structured architectural approach. The fundamental design adopted here is the Trident Local Server Model, where the Electron host environment acts as the central orchestrator for two simultaneous, independent backend services. This approach ensures maximal performance, separation of concerns, and robust inter-service communication.
I.A. Overview of the Trident Architecture (Electron Host, n8n Engine, Granite Docling API)
The architecture is defined by three cooperating layers, each fulfilling a distinct role:
Layer 1: The Host (Electron/Node.js)
The Electron main process serves as the foundational operating system shell and application wrapper. Its primary responsibilities include managing the application lifecycle, handling low-level operating system interactions (like file system access and system tray management), securing the local environment [1], and crucially, orchestrating the launch and monitoring of the two specialized child processes.[2]
Layer 2: The Automation Engine (n8n)
N8N provides the visual workflow designer and the underlying Node.js execution environment for business process automation.[3, 4] This engine manages task scheduling, monitors triggers (e.g., file drop events), handles all necessary file input/output (I/O) operations, and executes the core business logic, including the critical external call to the document intelligence service via its native HTTP Request node.[5]
Layer 3: The Intelligence Service (Python/FastAPI/Granite Docling)
This layer is dedicated exclusively to specialized tasks that depend on Python’s data science and machine learning ecosystem. It hosts the Granite Docling 258M Visual Language Model (VLM) and its associated Python libraries (docling, torch).[6] Running this resource-intensive inference as a standalone web service, typically using the FastAPI framework backed by the Uvicorn ASGI server [7, 8], isolates the VLM processing from the Electron and n8n Node.js threads.
The deployment complexity in this structure shifts from simple script execution to a microservices-in-a-desktop model. Since the user requires both the n8n automation engine and the Granite Docling Python library, the Electron application must manage two distinct, long-running server processes concurrently, demanding robust orchestration and sophisticated port management to guarantee seamless startup and operation.[9]
I.B. Comparative Analysis of Inter-Process Communication (IPC) Methods
Selecting the correct method for communication between the Electron host (Node.js), the n8n client, and the Python service is paramount. Three common methods were evaluated:
IPC Method
Description
Suitability for VLM/N8N Integration
Python Shell (python-shell)
Spawns a child process and communicates via standard I/O (stdin/stdout) streams, supporting text or JSON data formats.[10, 11]
Low. This method is simple but lacks performance for heavy, long-running tasks like VLM inference. It is prone to deadlocks or timeouts when dealing with large PDF files, and it does not provide the robust, structured API required for standardized calls from n8n.[11]
Dedicated IPC (Sockets/ZeroMQ)
Utilizes abstract messaging layers (like ZeroMQ or raw sockets) for high-performance, structured data exchange.[12]
Medium. While highly efficient, this method introduces significant complexity. It requires implementing custom client logic within Node.js and, critically, n8n does not natively support these protocols, necessitating a complex custom Node development within n8n.[12]
Local HTTP API (FastAPI/Uvicorn)
The Python process runs a dedicated REST API server on the loopback address (127.0.0.1).[13]
High (Recommended). This provides a standardized, language-agnostic REST interface that is inherently compatible with n8n's native HTTP Request node.[5] It supports asynchronous processing, clean status returns, and effective resource isolation necessary for maximizing resilience during heavy document parsing.
I.C. Recommendation: FastAPI/Uvicorn HTTP API
The recommended strategy involves implementing the Granite Docling functionality as a dedicated Python web service using FastAPI.[7, 8] This service runs on a local, non-conflicting port via Uvicorn. This architecture ensures that the specialized VLM inference task remains isolated, while the interface is instantly consumable by the n8n automation engine.
The architectural decision to use a dedicated API leverages the native capabilities of the n8n HTTP Request node [5], simplifying the overall workflow design and reducing the need for complex, custom Node.js bridge code within the Electron main process. This isolation also improves application stability; if the heavy VLM inference process crashes due to memory pressure, it does not bring down the entire Electron host or the n8n server.
II. The Granite Docling Processing Engine: Data Fidelity and Configuration
The primary technical challenge of this project lies in meeting the data fidelity requirement: converting PDF OCR results into Markdown while retaining source page information.[14] Standard document conversion pipelines often fail this requirement.
II.A. Deep Dive into Granite Docling and VLM Pipeline
Granite Docling 258M, an IBM Research product, is a compact Vision-Language Model (VLM) engineered for high-fidelity, end-to-end document conversion.[6, 15] Unlike traditional sequential pipelines that chain together layout analysis and OCR, Docling integrates vision and language to parse documents directly into structured, machine-readable formats.[15]
The preferred method of usage is the VLM pipeline, specified via CLI or SDK (--pipeline vlm --vlm-model granite_docling).[6, 15] This pipeline handles advanced document understanding, including page layout, reading order, table structure, and extensive OCR support for scanned PDFs.[16]
II.B. The Role of DocTags and DoclingDocument in Metadata Retention
Granite Docling first converts the input document (e.g., PDF) into an intermediate format called DocTags.[17, 18] DocTags is a purpose-built markup language designed to separate content from layout, ensuring high fidelity in preserving tables, code blocks, and document hierarchy.[15]
The DocTags are then used to build the final DoclingDocument object.[18] This internal object representation is lossless and maintains all critical metadata, including semantic structure, bounding boxes (bbox), and, importantly for this project, the provenance information containing the source page number (page_no) for every extracted element (paragraph, heading, figure).[14, 17]
II.C. Critical Implementation Detail: Mitigating Data Loss in Markdown Export
A significant architectural consideration is the inherent lossiness associated with standard Markdown export. Direct conversion of a rich internal document structure (like DoclingDocument) to simple formats like Markdown or HTML naturally discards granular metadata such as page numbers, as the target format does not have native fields for such provenance data.[14] The DoclingDocument.export_to_markdown() method is likely to strip this essential page number information.[14, 19]
To meet the user’s requirement for retaining source page information in the Markdown output (a necessity for advanced applications like Retrieval-Augmented Generation, or RAG [15, 17]), the Python API must implement a custom data transformation workflow:
Structured Post-Processing Routine
1. Conversion to DoclingDocument: The Python API must use the DocumentConverter().convert() method to load the PDF and generate the full, structured DoclingDocument object.[20]
2. Provenance Traversal: The script must iterate systematically through the content elements (headings, paragraphs, etc.) within the DoclingDocument.
3. Metadata Extraction: For each content element, the process must access its associated provenance (prov) metadata to retrieve the page_no attribute.[14]
4. Markdown Injection: The script must then manually prepend or append a page marker to the element’s text content using a standardized, parser-friendly syntax. A recommended format for RAG systems is a custom Markdown heading or an HTML comment block, such as ``, immediately preceding the content block.
5. Final Serialization: This metadata-injected string is compiled and returned as the final Markdown output.
This methodology transforms the Python backend from a simple wrapper script into a high-fidelity data transformation engine. This step is necessary because the default export methods prioritize human readability over machine-readable metadata preservation.
III. Python Backend Implementation: FastAPI Document Conversion Service
The Docling processing engine is realized as a high-performance local API built on FastAPI and Uvicorn.
III.A. Setting up the FastAPI Application and Dependencies
The Python environment requires installation of the core packages: fastapi, uvicorn, and docling (including the required VLM models and docling_core).[8]
The application defines a core endpoint, typically a POST /process-pdf, configured to accept file input or a local path reference.
The internal workflow for this endpoint integrates the custom processing detailed in Section II.C:
1. The API receives a request containing the local file path of the PDF (or the binary file stream itself).
2. It initializes the DocumentConverter.
3. It calls the custom, metadata-aware function to process the document and return the page-annotated Markdown string.
4. The result is wrapped in a standard JSON response object (e.g., status, metadata, and the Markdown content).
III.B. Port Selection and Local Server Configuration
Running two servers (n8n and FastAPI) within the same desktop application necessitates robust port conflict mitigation.[9] The n8n automation server typically defaults to port 5678.[3]
The architectural principle of robust deployment dictates that the orchestrating Electron layer should manage port availability, relieving the Python process of this responsibility. The FastAPI service (api.py) must be configured to receive its listening port dynamically via command-line arguments upon launch.
If dynamic allocation is not immediately implemented, a non-conflicting default port (e.g., 8001, distinct from the common 8000 default) is chosen for the FastAPI instance:
# In api.py (Conceptual launch block)
if __name__ == "__main__":
    import uvicorn
    # The Electron host should pass the port number dynamically
    # For initial testing, set a fallback non-conflicting port:
    API_PORT = 8001 
    uvicorn.run(app, host="127.0.0.1", port=API_PORT) 
By binding the service strictly to the loopback address (127.0.0.1), the service is secured against external network access, limiting access only to other applications running locally on the same machine (i.e., the Electron host and the n8n service).[1]
III.C. Preparation for PyInstaller Packaging
Prior to bundling the Electron application, the Python service must be compiled into a standalone executable (python_engine.exe or equivalent) using PyInstaller.[21, 22] This compiled binary will be launched by the Electron main process. This pre-compilation step is essential for creating a self-contained distributable.
For enhanced security and integrity, particularly since the API handles sensitive document data, a basic layer of authentication is advised. This involves implementing a simple shared secret token known only to the Electron host and the FastAPI application. The Electron orchestrator passes this token to the n8n HTTP Request node, which includes it in the request headers, preventing trivial calls to the local API from other unauthenticated local processes.[23]
IV. Electron Host Architecture and Dual Server Orchestration
The Electron main process (main.js) functions as the system control center, handling the intricate tasks of launching, monitoring, and ensuring the stability of both the n8n and Python services.
IV.A. Electron Main Process Responsibilities
The responsibilities of the Electron main process extend beyond typical application initialization:
1. Security and Initialization: Establishing stringent security defaults, including enabling Context Isolation and Process Sandboxing in the renderer processes.[1]
2. Resource Discovery and Allocation: Implementing a utility within Node.js to dynamically discover available local ports before launching services. This is a critical step for application stability, as hardcoding ports can lead to application crashes if the port is already in use.[24]
3. Lifecycle Management: Launching the processes, streaming their logs to the Electron console for diagnostics, and implementing listeners for close and error events to ensure that if one process fails, the entire application can shut down gracefully or restart the service.
4. Path Management: Calculating the correct runtime path to the packaged binaries using Electron’s native path APIs, specifically locating the Python executable within process.resourcesPath after packaging.[25]
IV.B. Implementing Concurrent Service Launch via child_process
The Node.js child_process module facilitates the spawning of the two independent backend servers.[2] The child_process.execFile() method is preferred as it spawns the command directly without an intermediate shell, offering better security and efficiency.[2]
1. Launching the N8N Server: The n8n server, a Node.js application [26], is launched as a child process. The Electron process executes the bundled n8n binary, passing essential configuration flags:
2. Launching the Granite Docling (Python) Executable: The compiled Python engine binary (from PyInstaller) is located via the process.resourcesPath [25] and launched, passing the determined API port:
3. Startup Synchronization: Because the Granite Docling VLM requires time to load (Section II.C, derived point), the Electron application cannot assume immediate readiness. A readiness check must be implemented, typically by polling the designated local API endpoints (http://127.0.0.1:<port>/health) until an HTTP 200 response is returned, ensuring both the n8n UI and the FastAPI service are fully operational before loading the UI or allowing workflow execution.
The orchestration layer must handle the failure modes of two separate processes. If the Python executable fails to launch (e.g., a packaging error) or the n8n server crashes, the Electron application must detect this failure via the child process stream listeners. A robust system requires graceful shutdown of the operational service and presentation of a meaningful error message to the user, preventing silent application failure.
IV.C. Security Considerations for Local Services
Security hardening is paramount when embedding powerful frameworks like Electron and Node.js.
• Node.js Access Restriction: Only the main Electron process is permitted full access to powerful Node.js APIs (such as child_process) for server management.[1]
• Renderer Process Isolation: All renderer processes (which display the n8n UI) must maintain Context Isolation. A preload script using the contextBridge API must be used to selectively expose only safe Inter-Process Communication (IPC) endpoints to the renderer.[27] Direct access to Node.js APIs within the user-facing web contents is strictly forbidden.[1]
• Local Service Security: Although the FastAPI service runs on the local loopback address, utilizing the shared secret token (as mentioned in III.C) provides an essential layer of local authentication, preventing unauthorized local processes from interacting with the sensitive document conversion API.[23]
V. N8N Automation Layer and Workflow Design
The embedded n8n server manages the workflow automation process, providing the visual interface and execution environment necessary to tie the document trigger to the Python API.
V.A. Embedding N8N within the Electron Application
N8N, installed locally via npm [26], must be packaged alongside the Electron application.[28] Running n8n as an independent background child process (Section IV.B) allows it to function as a dedicated, scalable service, superior to attempting to run the entire n8n stack directly within the Electron main process thread.
For a self-contained desktop deployment, the database configuration must utilize SQLite.[29] Although SQLite is not recommended for high-load production environments due to concurrency limitations, it is appropriate for single-user desktop applications where the n8n database stores credentials, executions, and workflows locally.[30]
V.B. Designing the Docling PDF Parsing Workflow
The n8n workflow must be designed to initiate document parsing and handle the subsequent data flow. This layer excels at managing file I/O, error logging, and execution structure—critical functions that the Python API must be unburdened from.
Core Workflow Steps:
1. Trigger Node: Initiated by user action (e.g., a Manual Trigger node) or file monitoring (e.g., a Watch Folder node) when a PDF is made available.
2. File Read Node: Reads the binary PDF data or obtains the local file path.
3. HTTP Request Node (API Call): This is the core communication node.[5]
    ◦ Method: POST.
    ◦ URL: http://127.0.0.1:<FastAPI_Port>/process-pdf/.
    ◦ Payload: The preferred high-performance method is to transmit only the local file path to the FastAPI service, allowing the VLM to stream the document from the disk directly. This mitigates memory-intensive transfer issues associated with sending large binary file contents (100MB+ PDFs) over the HTTP connection.[31]
    ◦ Authentication: The shared secret token is included in the request headers (e.g., Authorization: Bearer <token>) for local security validation.
4. Data Manipulation/Output Node: The JSON response containing the page-annotated Markdown string is received. A subsequent node (e.g., a Write File node) saves the final structured Markdown text to the user's local disk.
The use of an external HTTP API is necessitated by n8n’s internal security policies, which explicitly prevent access to powerful Node.js modules like child_process within the Function node environment.[32] This constraint validates the architectural decision to host the Granite Docling functionality externally.
VI. Comprehensive Deployment and Packaging Strategy
Creating a single, self-contained desktop application requires a complex, multi-stage packaging pipeline that combines two distinct execution environments: Python and Node.js.
VI.A. Step 1: Python Packaging with PyInstaller
The Python environment, including the heavy dependencies of Granite Docling, FastAPI, and Uvicorn, must be compiled into a standalone executable.
1. PyInstaller Execution: PyInstaller is executed on the Python entry script (api.py) using either the --onefile or --onedir strategy.[22]
2. Hidden Import Management: Due to the asynchronous nature of frameworks like FastAPI and Uvicorn, they often rely on dynamic imports that PyInstaller cannot detect automatically. A critical packaging fix involves explicitly specifying these modules via --hidden-import flags or within the PyInstaller .spec file. Failure to include necessary modules like uvicorn.workers or specific internal dependencies of the VLM will result in a runtime crash of the packaged Python service.[33, 34]
3. VLM Model Weights: The Granite Docling VLM model weights (approximately 258M parameters [6]) must also be correctly bundled alongside the executable, as the docling library will attempt to load them from a predictable location at runtime.
VI.B. Step 2: Electron Packaging with Electron Builder/Packager
The Electron build process handles the bundling of the Node.js source, the n8n installation, and the integration of the pre-compiled Python binary.
1. Native Dependency Management: The package.json file must include the script "postinstall": "electron-builder install-app-deps" to ensure that any native Node modules used by the Electron host or n8n are correctly compiled against the target Electron version.[28]
2. Integrating the Python Executable (extraResources): Electron Builder provides the extraResources configuration specifically for embedding external, pre-compiled assets.[25] The PyInstaller output directory (dist/) must be mapped into a predictable location within the final application bundle.
"build": {
    "extraResources": [
        {
            "from": "dist/python_engine",
            "to": "engine",
            "filter": [ "**/*" ]
        }
    ]
    //...
}
3. Runtime Path Resolution: During runtime, the Electron main process uses the process.resourcesPath API to reliably construct the file path to the embedded Python engine executable, regardless of the operating system or application installation location.[25]
The final distributable size is a critical consequence of this dual-packaging approach. The inclusion of the full n8n Node.js dependency tree and the Granite Docling VLM weights means the final installer size will be substantial (likely exceeding 500 MB). This factor must be weighed against distribution costs and end-user download expectations. The licensing of the Granite Docling VLM is favorable, as it uses the permissive Apache 2.0 license, allowing free commercial use.[15]
VII. Business, Licensing, and Scalability Implications
The technical success of the integration must be framed by the commercial and resource requirements necessary for deployment.
VII.A. Resource Requirements Matrix for the Dual-Server Setup
The combined resource requirements for running a sophisticated VLM alongside a full Node.js automation server exceed the minimal requirements often associated with productivity applications. The VLM inference load is the dominant factor determining hardware specifications.


The application's stable performance relies on having adequate RAM to load both the n8n environment and the Granite Docling VLM model weights simultaneously. While n8n’s official minimum requirements are low (2GB RAM) [30], the dominant resource constraint is the VLM's memory needs for processing multi-page PDFs, pushing the practical requirement for the end-user machine well into the 10GB+ range.
VII.B. Crucial Legal Analysis: N8N Sustainable Use License (SSPL)
The most critical non-technical consideration is the licensing status of n8n. N8N operates under the Sustainable Use License (SSPL), which places specific restrictions on commercial offerings.[35]
• Allowed Use: If the desktop application is strictly for "internal business purposes"—meaning it is used only by employees or staff within the developing organization to automate internal processes—then the standard self-hosted Community version is compliant.[35]
• Restricted Use (Requires Commercial License): If the application is intended to be distributed, sold, or white-labeled to external customers, or if the value provided to the end-user derives substantially or entirely from the n8n functionality (i.e., exposing the workflow automation UI or capabilities) [35], a commercial license is mandated.
    ◦ This includes integration scenarios referred to as "n8n embed".[36]
    ◦ Commercial Embed Licenses are priced starting at approximately $50,000 per year.[36]
The choice of target distribution—internal tool versus external commercial product—is thus dictated by this licensing requirement. Technical success in integration does not negate this significant legal constraint.
VII.C. Future Scalability and Maintenance
The Trident architecture provides a high degree of modularity that supports future scalability. Because the Granite Docling component is exposed via a standard HTTP API (Section III), the underlying Python VLM can be easily updated, swapped for a different model, or extracted entirely and run on a separate, dedicated server if the application eventually transitions from a local desktop model to a centralized cloud or on-premise service.
However, maintenance complexity is high. The system relies on three distinct software ecosystems (Electron/Node.js, n8n, and Python/ML), each with its own dependency versioning and security patch lifecycle. Synchronization of these components during maintenance releases—particularly when updating native dependencies that must align with the Electron version [28]—requires rigorous build and release management.
VIII. Conclusions and Recommendations
The integration of Granite Docling (Python/FastAPI) and a local n8n server within an Electron application is technically feasible, provided the architectural complexities of concurrent server management and data fidelity are addressed prescriptively.
Architectural Conclusions
1. Mandatory Dual-Server Architecture: The deployment must rely on the Trident Local Server model, running the n8n server and the FastAPI/Docling service as separate child processes orchestrated by the Electron host. This isolation is crucial for performance and error handling.
2. HTTP IPC is Superior: Local HTTP API communication using FastAPI is the most resilient and most easily integrated method for connecting the Python processing engine to the n8n workflow environment via the native HTTP Request node.
3. Data Fidelity Requires Post-Processing: Standard Docling Markdown export is insufficient for meeting the requirement of retaining page provenance. A custom Python post-processing routine within the FastAPI service is mandatory to traverse the lossless DoclingDocument structure and manually inject page number metadata into the final Markdown string.
Recommendations for Deployment and Commercialization
1. Prioritize Port Orchestration: The Electron main process must be engineered to dynamically discover and assign non-conflicting port numbers for both the n8n server and the FastAPI service upon startup, passing these ports to the respective child processes via command-line arguments. This prevents startup failures in various user environments.
2. Define Target Audience Based on License: Before allocating significant development resources, the project’s commercial viability must be confirmed against the n8n Sustainable Use License. If the application is intended for external sale or distribution to customers (i.e., commercial embedding), procurement of an n8n Embed License is a non-negotiable prerequisite.
3. Establish High Hardware Baseline: Due to the resource demands of loading the Granite Docling VLM, the application’s minimum system requirements must be set high (Recommended: 10 GB+ RAM, 4+ CPU cores) to ensure a stable and reliable end-user experience, mitigating potential performance bottlenecks during heavy document processing.
--------------------------------------------------------------------------------
1. Security | Electron, https://electronjs.org/docs/latest/tutorial/security
2. Child process | Node.js v25.2.1 Documentation, https://nodejs.org/api/child_process.html
3. How to install n8n on a Local Server and Access it Securely from Anywhere, https://thewebsiteengineer.com/blog/how-to-install-n8n-on-a-local-server-and-access-it-securely-from-anywhere/
4. How to install and run n8n locally in 2025? - Reddit, https://www.reddit.com/r/n8n/comments/1mvb78b/how_to_install_and_run_n8n_locally_in_2025/
5. HTTP Request node documentation - n8n Docs, https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
6. ibm-granite/granite-docling-258M - Hugging Face, https://huggingface.co/ibm-granite/granite-docling-258M
7. FastAPI vs. Flask: Python web frameworks comparison and tutorial - Contentful, https://www.contentful.com/blog/fastapi-vs-flask/
8. Python Cross Platform APP using Electron JS and Fast API - GitHub, https://github.com/gnoviawan/fast-api-electron-js
9. Why I Left n8n for Python (And Why It Was the Best Decision for My Projects) : r/n8n - Reddit, https://www.reddit.com/r/n8n/comments/1mcm9d2/why_i_left_n8n_for_python_and_why_it_was_the_best/
10. How to Execute Python Scripts in Electron and NodeJS | Skcript, https://www.skcript.com/blog/how-to-execute-python-scripts-in-electron-and-nodejs
11. Python on Electron framework - Stack Overflow, https://stackoverflow.com/questions/32158738/python-on-electron-framework
12. electron-python-example/README.md at master - GitHub, https://github.com/fyears/electron-python-example/blob/master/README.md
13. Electron as a local API server responding to http requests? - Stack Overflow, https://stackoverflow.com/questions/65892429/electron-as-a-local-api-server-responding-to-http-requests
14. Page Numbers Not Appearing Correctly in Provenance Metadata · docling-project docling · Discussion #1012 - GitHub, https://github.com/docling-project/docling/discussions/1012
15. Granite Docling - IBM, https://www.ibm.com/granite/docs/models/docling
16. Documentation - Docling - GitHub Pages, https://docling-project.github.io/docling/
17. IBM Granite-Docling: Super Charge your RAG 2.0 Pipeline | by Vishal Mysore | Medium, https://medium.com/@visrow/ibm-granite-docling-super-charge-your-rag-2-0-pipeline-32ac102ffa40
18. IBM Granite-Docling - by Nandini Lokesh Reddy - Medium, https://medium.com/@nandinilreddy/ibm-granite-docling-204f1dec7df8
19. how to convert doctags code generated by granite docling via vLLM · Issue #2356 - GitHub, https://github.com/docling-project/docling/issues/2356
20. docling-project/docling: Get your documents ready for gen AI - GitHub, https://github.com/docling-project/docling
21. mohammadhasananisi/compile_fastapi: compile fastapi with pyinstaller - GitHub, https://github.com/mohammadhasananisi/compile_fastapi
22. Building a deployable Python-Electron App | by Andy Bulka | Medium, https://medium.com/@abulka/building-a-deployable-python-electron-app-4e8c807bfa5e
23. Hacking Electron Apps: Security Risks And How To Protect Your Application, https://redfoxsecurity.medium.com/hacking-electron-apps-security-risks-and-how-to-protect-your-application-9846518aa0c0
24. Run two instances of same Electron app locally at same time - Stack Overflow, https://stackoverflow.com/questions/70951214/run-two-instances-of-same-electron-app-locally-at-same-time
25. Bundling Python inside an Electron app - Simon Willison: TIL, https://til.simonwillison.net/electron/python-inside-electron
26. Run your node locally - n8n Docs, https://docs.n8n.io/integrations/creating-nodes/test/run-node-locally/
27. Inter-Process Communication - Electron, https://electronjs.org/docs/latest/tutorial/ipc
28. electron-builder, https://www.electron.build/
29. Prerequisites - n8n Docs, https://docs.n8n.io/embed/prerequisites/
30. N8N System Requirements 2025: Complete Hardware Specs + Real-World Resource Analysis - Latenode, https://latenode.com/blog/low-code-no-code-platforms/n8n-setup-workflows-self-hosting-templates/n8n-system-requirements-2025-complete-hardware-specs-real-world-resource-analysis
31. FastAPI local server: every request uses a different port -> port in use error #9406 - GitHub, https://github.com/fastapi/fastapi/discussions/9406
32. ERROR: Access denied to require 'child_process' - Questions - n8n Community, https://community.n8n.io/t/error-access-denied-to-require-child-process/4866
33. uvicorn and fastAPI with pyinstaller failing to start some of the uvicorn workers · Kludex uvicorn · Discussion #1820 - GitHub, https://github.com/encode/uvicorn/discussions/1820
34. PyInstaller and FastAPI (maximum recursion depth exceeded) - Stack Overflow, https://stackoverflow.com/questions/61491358/pyinstaller-and-fastapi-maximum-recursion-depth-exceeded
35. Sustainable Use License - n8n Docs, https://docs.n8n.io/sustainable-use-license/
36. Embedded iPaaS | Native automation workflows - n8n, https://n8n.io/embed/

