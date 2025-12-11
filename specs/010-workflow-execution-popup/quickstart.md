# Quickstart: Workflow Execution Popup

**Feature**: 010-workflow-execution-popup
**Date**: 2025-12-10

## Prerequisites

Before implementing this feature, ensure:

1. **Spec 009 (Custom n8n Nodes) is complete**
   - FileSelector, PromptInput, ResultDisplay nodes exist in `src/n8n_nodes/nodes/`
   - Nodes are functional in n8n editor
   - Electron bridge is working on port 5680

2. **Development environment is set up**
   ```bash
   npm run setup:all
   npm run build:n8n-nodes
   npm run dev
   ```

3. **n8n server is running**
   - Application starts and n8n is accessible at http://localhost:5678
   - At least one workflow exists with custom nodes

## Implementation Order

Follow this order for optimal development flow:

### Step 1: Main Process Infrastructure (Day 1)

1. **Create popup config store** (`src/main/stores/popup-config-store.ts`)
   ```typescript
   import Store from 'electron-store';
   import type { WorkflowPopupConfig } from '../../specs/010-workflow-execution-popup/contracts/ipc-contracts';

   const store = new Store<{ popupConfigs: Record<string, WorkflowPopupConfig> }>({
     name: 'popup-configs',
     defaults: { popupConfigs: {} },
   });

   export function getPopupConfig(workflowId: string): WorkflowPopupConfig | null {
     return store.get(`popupConfigs.${workflowId}`) || null;
   }

   export function setPopupConfig(config: WorkflowPopupConfig): void {
     store.set(`popupConfigs.${config.workflowId}`, {
       ...config,
       lastUpdated: new Date().toISOString(),
     });
   }

   export function deletePopupConfig(workflowId: string): void {
     store.delete(`popupConfigs.${workflowId}` as any);
   }
   ```

2. **Create IPC handlers** (`src/main/ipc-handlers/workflow-execution.ts`)
   - Implement `workflow-popup:analyze`
   - Implement `workflow-popup:get-config` / `workflow-popup:save-config`
   - Implement `workflow-popup:select-files`

3. **Update preload** (`src/preload/index.ts`)
   - Expose `workflowPopup` API object

### Step 2: Workflow Executor (Day 2)

1. **Create workflow executor** (`src/main/services/workflow-executor.ts`)
   ```typescript
   export class WorkflowExecutor {
     async analyzeWorkflow(workflowId: string): Promise<WorkflowAnalysisResult>;
     async executeWorkflow(request: ExecuteWorkflowRequest): Promise<string>; // returns executionId
     async pollExecution(executionId: string): Promise<ExecutionResult>;
   }
   ```

2. **Extend Electron bridge** (`src/main/services/electron-bridge.ts`)
   - Add execution config endpoints for n8n nodes
   - Add result storage endpoints

### Step 3: UI Components (Day 3-4)

1. **Create modal wrapper** (`src/renderer/src/components/ui/modal.tsx`)
   ```tsx
   import * as Dialog from '@radix-ui/react-dialog';

   export function Modal({ open, onClose, children }) {
     return (
       <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
         <Dialog.Portal>
           <Dialog.Overlay className="fixed inset-0 bg-black/50" />
           <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
             w-[80vw] h-[80vh] max-w-[1400px] max-h-[900px] bg-background rounded-lg">
             {children}
           </Dialog.Content>
         </Dialog.Portal>
       </Dialog.Root>
     );
   }
   ```

2. **Create popup components** (`src/renderer/src/components/features/workflow-popup/`)
   - `WorkflowExecutionPopup.tsx` - Main container
   - `InputPanel.tsx` - Left panel
   - `OutputPanel.tsx` - Right panel
   - `CenterIndicator.tsx` - Middle section

3. **Create input components**
   - `PromptInput.tsx` - Markdown text area
   - `FileSelector.tsx` - File browser with list

4. **Create output components**
   - `MarkdownOutput.tsx` - Render markdown
   - `FileDownload.tsx` - Download button

### Step 4: State Management (Day 5)

1. **Create execution store** (`src/renderer/src/stores/workflow-execution.ts`)
   ```typescript
   import { atom, computed } from 'nanostores';

   export const $executionState = atom<ExecutionState>({
     status: 'idle',
     workflowId: null,
     executionId: null,
     error: null,
   });

   export const $isExecuting = computed($executionState, s => s.status === 'running');
   ```

2. **Create execution hook** (`src/renderer/src/hooks/useWorkflowExecution.ts`)
   ```typescript
   export function useWorkflowExecution(workflowId: string) {
     const execute = async (inputs: Record<string, InputFieldConfig>) => {
       // Set state to running
       // Call IPC to execute
       // Poll for results
       // Update state with results
     };

     return { execute, isExecuting, results, error };
   }
   ```

### Step 5: Integration (Day 6)

1. **Modify WorkflowCard** (`src/renderer/src/components/features/workflows/WorkflowCard.tsx`)
   ```tsx
   // Change onClick to open popup instead of editor
   onClick={() => onOpenPopup?.(workflow)}
   ```

2. **Add popup to parent component**
   - Add state for selected workflow
   - Render WorkflowExecutionPopup when workflow selected

### Step 6: Node Modifications (Day 7)

1. **Update FileSelector node**
   ```typescript
   // In execute method, check for external config first
   const bridgeUrl = process.env.ELECTRON_BRIDGE_URL;
   const executionId = /* get from workflow context */;

   const externalConfig = await fetch(
     `${bridgeUrl}/api/electron-bridge/execution-config/${executionId}/${nodeId}`
   );

   if (externalConfig.hasExternalConfig) {
     return externalConfig.config.value; // Use popup-provided files
   }
   // Fallback to internal state
   ```

2. **Update PromptInput node** - Similar pattern

3. **Update ResultDisplay node**
   ```typescript
   // After processing, emit result to bridge
   await fetch(`${bridgeUrl}/api/electron-bridge/execution-result`, {
     method: 'POST',
     body: JSON.stringify({ executionId, nodeId, result }),
   });
   ```

### Step 7: Testing (Day 8)

1. **Unit tests**
   ```bash
   npm run test:unit -- --filter workflow-execution
   ```

2. **E2E tests**
   ```bash
   npm run test:e2e -- workflow-popup.spec.ts
   ```

## Key Files Reference

| File | Purpose |
|------|---------|
| `contracts/ipc-contracts.ts` | Type definitions for all IPC |
| `data-model.md` | Entity definitions and schema |
| `research.md` | Technical decisions |
| `plan.md` | Full implementation plan |

## Testing During Development

```bash
# Run dev server
npm run dev

# In n8n, create a workflow with:
# 1. PromptInput node
# 2. FileSelector node
# 3. ResultDisplay node (connected to processing)

# Click the workflow card - popup should open
# Enter prompt, select files
# Click Execute
# Verify results appear in right panel
```

## Common Issues

1. **Popup doesn't open**: Check IPC handlers are registered in main process
2. **Files not available to workflow**: Check bridge endpoints are responding
3. **Results not showing**: Verify ResultDisplay node is emitting to bridge
4. **Timeout errors**: n8n may need longer startup, increase timeout

## Next Steps After Implementation

1. Update checklist.md with completed items
2. Run full test suite
3. Create PR for review
