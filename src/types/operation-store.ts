/**
 * Operation Store Interface
 *
 * Defines the contract for operation data access layers.
 * This allows for dependency injection and easy testing with mock implementations.
 */

import type { OperationDiff, OperationIndex } from './operation-index';
import { ChangeType } from './operation-index';

/**
 * Interface for operation data storage and retrieval
 */
export interface OperationStore {
  /**
   * Retrieves an operation by its unique identifier
   * @param id - The unique identifier of the operation
   * @returns Promise resolving to OperationIndex if found
   * @throws Error if operation not found
   */
  getOperation(id: string): Promise<OperationIndex>;

  /**
   * Retrieves detailed diff information for an operation
   * @param id - The unique identifier of the operation
   * @returns Promise resolving to OperationDiff with detailed change information
   * @throws Error if operation not found or diff cannot be generated
   */
  getOperationDiff(id: string): Promise<OperationDiff>;

  /**
   * Checks if an operation exists
   * @param id - The unique identifier of the operation
   * @returns Promise resolving to boolean indicating existence
   */
  operationExists(id: string): Promise<boolean>;
}

/**
 * Mock implementation for testing purposes
 */
export class MockOperationStore implements OperationStore {
  private mockOperations: Map<string, OperationDiff> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Initialize with test data matching existing test expectations
    this.mockOperations.set('edit-op-123', {
      operationId: '12345678-1234-4234-b123-123456789abc',
      timestamp: '2025-09-23T14:30:45.123Z',
      tool: 'Edit',
      filePath: '/src/components/Button.tsx',
      summary: 'Updated button component styling',
      changeType: ChangeType.UPDATE,
      diff: {
        tool: 'Edit',
        oldString: 'background: blue;',
        newString: 'background: green;',
        replaceAll: false,
        unifiedDiff: {
          filename: '/src/components/Button.tsx',
          oldVersion: 'const Button = () => { return <button style={{background: blue;}}>Click</button>; };',
          newVersion: 'const Button = () => { return <button style={{background: green;}}>Click</button>; };',
          diffText: '@@ -1,1 +1,1 @@\n-const Button = () => { return <button style={{background: blue;}}>Click</button>; };\n+const Button = () => { return <button style={{background: green;}}>Click</button>; };'
        }
      }
    });

    this.mockOperations.set('write-op-456', {
      operationId: '12345678-1234-4234-b456-123456789abc',
      timestamp: '2025-09-23T14:31:00.456Z',
      tool: 'Write',
      filePath: '/src/utils/helper.ts',
      summary: 'Created new utility function',
      changeType: ChangeType.CREATE,
      diff: {
        tool: 'Write',
        isNewFile: true,
        newContent: 'export function helper() { return "helper function"; }',
        unifiedDiff: {
          filename: '/src/utils/helper.ts',
          oldVersion: '',
          newVersion: 'export function helper() { return "helper function"; }',
          diffText: '@@ -0,0 +1,1 @@\n+export function helper() { return "helper function"; }'
        }
      }
    });

    this.mockOperations.set('multi-edit-op-789', {
      operationId: '12345678-1234-4234-b789-123456789abc',
      timestamp: '2025-09-23T14:32:15.789Z',
      tool: 'MultiEdit',
      filePath: '/src/services/api.ts',
      summary: 'Refactored API endpoints',
      changeType: ChangeType.UPDATE,
      diff: {
        tool: 'MultiEdit',
        edits: [
          {
            oldString: 'oldEndpoint',
            newString: 'newEndpoint',
            replaceAll: false
          },
          {
            oldString: 'oldMethod',
            newString: 'newMethod',
            replaceAll: true
          }
        ],
        unifiedDiff: {
          filename: '/src/services/api.ts',
          oldVersion: 'const api = { oldEndpoint, oldMethod };',
          newVersion: 'const api = { newEndpoint, newMethod };',
          diffText: '@@ -1,1 +1,1 @@\n-const api = { oldEndpoint, oldMethod };\n+const api = { newEndpoint, newMethod };'
        }
      }
    });

    this.mockOperations.set('bash-op-101', {
      operationId: '12345678-1234-4234-b101-123456789abc',
      timestamp: '2025-09-23T14:33:30.101Z',
      tool: 'Bash',
      summary: 'Executed build script',
      changeType: ChangeType.UPDATE,
      diff: {
        tool: 'Bash',
        command: 'npm run build',
        stdout: 'Build completed successfully',
        stderr: '',
        exitCode: 0,
        affectedFiles: [
          {
            filePath: '/dist/bundle.js',
            changeType: ChangeType.CREATE
          }
        ]
      }
    });

    this.mockOperations.set('read-op-202', {
      operationId: '12345678-1234-4234-b202-123456789abc',
      timestamp: '2025-09-23T14:34:45.202Z',
      tool: 'Read',
      filePath: '/src/config/settings.json',
      summary: 'Read configuration file',
      changeType: ChangeType.READ,
      diff: {
        tool: 'Read',
        content: '{"setting1": "value1", "setting2": "value2"}',
        linesRead: 4
      }
    });
  }

  async getOperation(id: string): Promise<OperationIndex> {
    const operation = this.mockOperations.get(id);
    if (!operation) {
      throw new Error(`Operation with ID "${id}" not found`);
    }

    // Convert OperationDiff to OperationIndex
    const index: OperationIndex = {
      id: operation.operationId,
      timestamp: operation.timestamp,
      tool: operation.tool,
      summary: operation.summary,
      changeType: operation.changeType
    };

    if (operation.filePath) {
      index.filePath = operation.filePath;
    }

    return index;
  }

  async getOperationDiff(id: string): Promise<OperationDiff> {
    const operation = this.mockOperations.get(id);
    if (!operation) {
      throw new Error(`Operation with ID "${id}" not found`);
    }
    return operation;
  }

  async operationExists(id: string): Promise<boolean> {
    return this.mockOperations.has(id);
  }

  // Test utility methods
  addMockOperation(id: string, operation: OperationDiff): void {
    this.mockOperations.set(id, operation);
  }

  clearMockData(): void {
    this.mockOperations.clear();
  }
}