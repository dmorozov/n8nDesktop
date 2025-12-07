# Quickstart: Docling Integration

## Prerequisites

1. **Python 3.10+** installed on your system
   - Check: `python3 --version` (or `python --version` on Windows)
   - Install from: https://www.python.org/downloads/

2. **Poetry** package manager for Python
   - Install: `curl -sSL https://install.python-poetry.org | python3 -`

3. **Node.js 20+** and the n8n Desktop development environment set up

## Development Setup

### 1. Install Python Dependencies

```bash
cd src/docling
poetry install
```

To include EasyOCR support:
```bash
poetry install --extras easyocr
```

### 2. Start the Docling Service (Standalone)

For development/testing without Electron:

```bash
cd src/docling
poetry run python -m docling_service.main --port 8001 --processing-tier standard
```

Verify with:
```bash
curl http://localhost:8001/api/v1/health
```

### 3. Run the Electron Application

The Docling service will start automatically when enabled:

```bash
npm start
```

## Testing Document Processing

### Via curl (Direct API):

```bash
# Process a single document
curl -X POST http://localhost:8001/api/v1/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"file_path": "/path/to/document.pdf"}'

# Check job status
curl http://localhost:8001/api/v1/jobs/JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Via n8n Workflow:

1. Create a new workflow in n8n
2. Add an **HTTP Request** node
3. Configure:
   - Method: POST
   - URL: `http://localhost:8001/api/v1/process`
   - Headers: `Authorization: Bearer {{$env.DOCLING_AUTH_TOKEN}}`
   - Body: `{ "file_path": "/path/to/document.pdf" }`

## Configuration

### Processing Tiers

| Tier | Best For | RAM Usage |
|------|----------|-----------|
| `lightweight` | Simple text documents | 2-4 GB |
| `standard` | Documents with tables, code | 4-8 GB |
| `advanced` | Complex PDFs with equations, charts | 8-16 GB |

### Settings UI

Access via: **Settings → Docling** tab

- **Processing Tier**: Select default processing level
- **Temporary Folder**: Location for processing files
- **Max Concurrent Jobs**: 1-3 parallel jobs
- **Timeout Action**: What to do when processing exceeds time

## Troubleshooting

### Service Won't Start

1. Check Python availability:
   ```bash
   python3 --version  # Should be 3.10+
   ```

2. Check dependencies installed:
   ```bash
   cd src/docling && poetry install
   ```

3. Check port availability:
   ```bash
   lsof -i :8001  # Should show nothing if port is free
   ```

### Processing Fails

1. Verify file path is absolute and file exists
2. Check file format is supported (PDF, DOCX, XLSX, PNG, JPEG)
3. Review logs in Settings → Docling → View Logs
4. Try `lightweight` tier first to verify basic functionality

### Debugging with Trace IDs

Each API request generates a trace ID (UUID) for log correlation:

1. Check the `X-Trace-Id` header in API responses
2. Use the Log Viewer's trace ID filter to find related logs
3. Include the trace ID when reporting issues

Example:
```bash
# Get trace ID from response header
curl -i http://localhost:8001/api/v1/health
# X-Trace-Id: 550e8400-e29b-41d4-a716-446655440000

# Search logs by trace ID
grep "550e8400-e29b-41d4-a716-446655440000" logs/*.log
```

### Memory Issues

1. Reduce concurrent jobs to 1
2. Use `lightweight` processing tier
3. Process smaller documents or split large PDFs

## API Reference

See full OpenAPI specification: `specs/003-docling-integration/contracts/openapi.yaml`

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Service health check |
| `/api/v1/process` | POST | Process single document |
| `/api/v1/process/batch` | POST | Process multiple documents |
| `/api/v1/jobs/{id}` | GET | Get job status |
| `/api/v1/jobs/{id}` | DELETE | Cancel queued job |
| `/api/v1/jobs` | GET | List all jobs |

## Running Tests

### Python Unit Tests

```bash
cd src/docling
poetry run pytest
# Expected: 96 tests passed
```

### TypeScript Unit Tests

```bash
npm test
# Expected: 70+ tests passed (note: some integration tests require mocking updates)
```

### Quick Verification

```bash
# 1. Start the Docling service
cd src/docling
poetry run python -m docling_service.main --port 8001

# 2. In another terminal, test health endpoint
curl http://localhost:8001/api/v1/health
# Should return: {"status":"healthy","version":"0.1.0",...}

# 3. Test authentication (should fail without token)
curl -X POST http://localhost:8001/api/v1/process \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/tmp/test.pdf"}'
# Should return: 401 Unauthorized

# 4. Test with token
curl -X POST http://localhost:8001/api/v1/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"file_path": "/tmp/test.pdf"}'
```

## Next Steps

1. Run unit tests: `cd src/docling && poetry run pytest`
2. Run integration tests: `npm run test:integration`
3. Import sample workflow from `resources/workflows/docling-batch-summarize.json`
4. Review Playwright MCP configuration: `specs/003-docling-integration/testing/playwright-mcp.md`
