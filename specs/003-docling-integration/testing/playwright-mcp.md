# Playwright MCP Configuration for Docling UI Testing (T090)

This document describes how to configure Playwright MCP (Model Context Protocol) for automated testing of the Docling integration UI components.

## Overview

The Docling integration provides a settings UI for configuring document processing. These UI components include:
- Processing tier selector
- Max concurrent jobs selector
- Temp folder configuration
- Service status indicator
- Job queue display
- Log viewer dialog

## Test ID Selectors

All Docling UI components use the `data-testid` pattern for reliable test automation:

### Main Settings Tab
- `docling-settings-tab` - Root container for Docling settings
- `docling-status-badge` - Service status indicator badge

### Service Controls
- `docling-enable-toggle` - Container for enable/disable toggle
- `docling-enable-switch` - The actual switch element
- `docling-start-button` - Start service button
- `docling-stop-button` - Stop service button
- `docling-restart-button` - Restart service button

### Status and Alerts
- `docling-service-status` - Service status container (has role="status")
- `docling-python-warning` - Python not found warning (has role="alert")
- `docling-advanced-warning` - Advanced tier resource warning (has role="alert")

### Configuration Sections
- `docling-tier-section` - Processing tier selection container
- `docling-tier-select` - Processing tier dropdown
- `docling-jobs-section` - Max concurrent jobs container
- `docling-jobs-select` - Max jobs dropdown
- `docling-timeout-section` - Timeout action container
- `docling-timeout-select` - Timeout action dropdown

### Temp Folder
- `docling-temp-folder-section` - Temp folder configuration container
- `docling-temp-folder-input` - Temp folder path input
- `docling-temp-folder-browse` - Browse button
- `docling-disk-space-info` - Disk space display
- `docling-disk-space-bar` - Disk usage progress bar
- `docling-disk-space-error` - Disk space error message

### Job Queue
- `docling-job-queue` - Job queue container
- `docling-refresh-jobs-button` - Refresh jobs button
- `docling-job-{jobId}` - Individual job row
- `docling-cancel-job-{jobId}` - Cancel job button

### Actions
- `docling-view-logs-button` - Open log viewer button
- `docling-save-button` - Save changes button

### Log Viewer Dialog
- `docling-log-viewer-dialog` - Log viewer modal
- `docling-log-trace-filter` - Trace ID filter container
- `docling-log-trace-input` - Trace ID input field
- `docling-log-trace-apply` - Apply filter button
- `docling-log-trace-clear` - Clear filter button
- `docling-log-refresh` - Refresh logs button
- `docling-log-autorefresh` - Auto-refresh toggle
- `docling-log-export` - Export logs button
- `docling-log-clear` - Clear logs button
- `docling-log-content` - Log entries container (has role="log")

## Playwright MCP Server Configuration

Add the following to your Claude MCP settings (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@anthropic/mcp-playwright"
      ],
      "env": {
        "PLAYWRIGHT_HEADLESS": "true"
      }
    }
  }
}
```

## Example Test Scenarios

### 1. Enable/Disable Docling Service

```typescript
// Using Playwright MCP
await page.goto('electron://settings');
await page.click('[data-testid="docling-settings-tab"]');

// Check initial state
const enableSwitch = page.locator('[data-testid="docling-enable-switch"]');
const isEnabled = await enableSwitch.isChecked();

// Toggle service
await enableSwitch.click();
await page.click('[data-testid="docling-save-button"]');
```

### 2. Change Processing Tier

```typescript
await page.click('[data-testid="docling-tier-select"]');
await page.click('text=Advanced');

// Verify warning appears
const warning = page.locator('[data-testid="docling-advanced-warning"]');
await expect(warning).toBeVisible();
await expect(warning).toHaveAttribute('role', 'alert');
```

### 3. Monitor Job Queue

```typescript
// Wait for job to appear
const job = page.locator('[data-testid^="docling-job-"]').first();
await expect(job).toBeVisible();

// Cancel job
const cancelBtn = job.locator('[data-testid^="docling-cancel-job-"]');
await cancelBtn.click();
```

### 4. Filter Logs by Trace ID

```typescript
await page.click('[data-testid="docling-view-logs-button"]');

const traceInput = page.locator('[data-testid="docling-log-trace-input"]');
await traceInput.fill('abc123-def456');
await page.click('[data-testid="docling-log-trace-apply"]');

// Verify logs are filtered
const logContent = page.locator('[data-testid="docling-log-content"]');
await expect(logContent).toContainText('abc123-def456');
```

## Accessibility Testing

All critical UI elements include ARIA attributes for accessibility testing:

```typescript
// Verify service status is announced
const statusContainer = page.locator('[data-testid="docling-service-status"]');
await expect(statusContainer).toHaveAttribute('role', 'status');
await expect(statusContainer).toHaveAttribute('aria-live', 'polite');

// Verify errors are announced immediately
const errorAlert = page.locator('[data-testid="docling-python-warning"]');
await expect(errorAlert).toHaveAttribute('role', 'alert');
await expect(errorAlert).toHaveAttribute('aria-live', 'assertive');

// Verify log viewer is accessible
const logViewer = page.locator('[data-testid="docling-log-content"]');
await expect(logViewer).toHaveAttribute('role', 'log');
await expect(logViewer).toHaveAttribute('aria-live', 'polite');
```

## Integration with CI/CD

For automated testing in CI:

```bash
# Install Playwright and dependencies
npm install -D @playwright/test
npx playwright install

# Run Docling UI tests
npx playwright test tests/e2e/docling*.spec.ts
```

## Notes

- All selectors follow the `docling-{component}-{element}` naming convention
- Status changes use `aria-live` for screen reader announcements
- Error messages use `role="alert"` for immediate announcement
- The log viewer supports trace ID filtering for debugging specific requests
