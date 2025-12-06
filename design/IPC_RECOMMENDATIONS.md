The recommended Inter-Process Communication (IPC) method for connecting n8n (running within the Electron host) to Granite Docling (running as a Python service) is implementing a **Local HTTP API** using **FastAPI** and **Uvicorn**. This approach is strongly recommended due to its high compatibility with the existing architecture and its robustness for handling resource-intensive tasks.

### Recommended IPC Method: Local HTTP API (FastAPI/Uvicorn)

This method involves running the Python Docling processing logic as a dedicated REST API server on the local machine's loopback address (`127.0.0.1`).

**Key Advantages and Suitability for N8N/Docling Integration:**

1.  **Native N8N Compatibility (High Fit):** The local HTTP API method is highly recommended because it provides a standardized, language-agnostic REST interface that is **inherently compatible with n8n's native HTTP Request node**. N8N can seamlessly call endpoints on this local Python server as part of its workflow.
2.  **Resource Isolation (Critical):** Running the Python logic as a dedicated service isolates the resource-intensive tasks associated with the Granite Docling Visual Language Model (VLM) from the n8n Node.js execution environment and the Electron host. This isolation is critical for **application stability**; if the heavy VLM inference process fails (e.g., due to memory pressure during large document parsing), it should not cause the entire Electron host or the n8n server to crash.
3.  **Asynchronous and Stateful Operation (High Performance):** Utilizing a framework like FastAPI, backed by the Uvicorn ASGI server, allows the Python backend to run as a **long-running, persistent service**. This design avoids the performance degradation and significant latency caused by repeatedly spawning a Python process and reloading the VLM dependencies for every single document conversion request (which can take over 100 milliseconds per launch).
4.  **Standardized API and Debugging:** HTTP provides a familiar and structured API definition (REST), supporting asynchronous processing and clean status returns, which simplifies implementation and debugging compared to raw streams or custom sockets. The service must be bound strictly to the loopback address (`127.0.0.1`) for local security.

### Comparison with Alternative IPC Methods

When evaluating inter-process communication methods for this dual-server architecture (Electron/n8n in Node.js communicating with Python/Docling), the local HTTP API excels compared to other common approaches:

| IPC Method | Suitability for VLM/N8N Integration | Drawbacks for Docling |
| :--- | :--- | :--- |
| **Local HTTP API (FastAPI/Uvicorn)** | **High (Recommended)**: Standardized, leverages n8n's native HTTP Request node, and isolates resource-heavy VLM inference. | Moderate overhead compared to native IPC, but architectural benefits outweigh this. |
| **Python Shell (STDIN/STDOUT)** | **Low**: Uses standard I/O streams. | Lacks performance for heavy, long-running tasks like VLM inference and is prone to deadlocks or timeouts with large files. It does not provide the structured API necessary for reliable standardized calls directly from n8n workflows. |
| **Dedicated IPC (Sockets/ZeroMQ/RPC)** | **Medium**: Highly efficient for structured data exchange. | Introduces significant complexity and often requires custom client logic within Node.js because **n8n does not natively support these protocols**, forcing complex custom Node development within the n8n workflow. |

Because n8n's internal security policies **prevent direct use of Node.js modules like `child_process` within its `Function` node environment**, any non-HTTP method would require building a complex intermediary structure, further validating the necessity of the HTTP API approach.

By using FastAPI/Uvicorn, you create a robust bridge that ensures the specialized Python Docling service runs efficiently and reliably, accessible via the ubiquitous HTTP protocol that n8n is designed to utilize.
