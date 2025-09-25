import type { OperationIndex } from './operation-index';
import { ChangeType } from './operation-index';

describe('OperationIndex', () => {
  describe('OperationIndex interface', () => {
    it('should have the correct structure with required properties', () => {
      const operation: OperationIndex = {
        id: 'test-id-123',
        timestamp: '2025-09-18T12:00:00.000Z',
        tool: 'Edit',
        summary: 'Test operation summary',
        changeType: ChangeType.UPDATE,
      };

      expect(operation.id).toBeDefined();
      expect(typeof operation.id).toBe('string');
      expect(operation.timestamp).toBeDefined();
      expect(typeof operation.timestamp).toBe('string');
      expect(operation.tool).toBeDefined();
      expect(typeof operation.tool).toBe('string');
      expect(operation.summary).toBeDefined();
      expect(typeof operation.summary).toBe('string');
      expect(operation.changeType).toBeDefined();
    });

    it('should support optional filePath property', () => {
      const operationWithFile: OperationIndex = {
        id: 'test-id-456',
        timestamp: '2025-09-18T12:00:00.000Z',
        tool: 'Write',
        filePath: '/path/to/file.ts',
        summary: 'Created new file',
        changeType: ChangeType.CREATE,
      };

      const operationWithoutFile: OperationIndex = {
        id: 'test-id-789',
        timestamp: '2025-09-18T12:00:00.000Z',
        tool: 'Read',
        summary: 'Read operation without specific file',
        changeType: ChangeType.READ,
      };

      expect(operationWithFile.filePath).toBe('/path/to/file.ts');
      expect(operationWithoutFile.filePath).toBeUndefined();
    });

    it('should validate timestamp is ISO 8601 format', () => {
      const validOperation: OperationIndex = {
        id: 'test-id-iso',
        timestamp: '2025-09-18T12:34:56.789Z',
        tool: 'Edit',
        summary: 'Test ISO timestamp',
        changeType: ChangeType.UPDATE,
      };

      // Test that the timestamp follows ISO 8601 pattern
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(validOperation.timestamp).toMatch(iso8601Regex);
    });

    it('should support different tool types', () => {
      const tools = ['Edit', 'Write', 'Read', 'Delete', 'Grep', 'Bash'];

      tools.forEach((tool, index) => {
        const operation: OperationIndex = {
          id: `test-id-${index}`,
          timestamp: '2025-09-18T12:00:00.000Z',
          tool,
          summary: `Operation using ${tool}`,
          changeType: ChangeType.READ,
        };

        expect(operation.tool).toBe(tool);
      });
    });
  });

  describe('ChangeType enum', () => {
    it('should have CREATE value', () => {
      expect(ChangeType.CREATE).toBe('create');
    });

    it('should have UPDATE value', () => {
      expect(ChangeType.UPDATE).toBe('update');
    });

    it('should have DELETE value', () => {
      expect(ChangeType.DELETE).toBe('delete');
    });

    it('should have READ value', () => {
      expect(ChangeType.READ).toBe('read');
    });

    it('should support all enum values in OperationIndex', () => {
      const baseOperation = {
        id: 'test-enum',
        timestamp: '2025-09-18T12:00:00.000Z',
        tool: 'Test',
        summary: 'Testing enum values',
      };

      const createOp: OperationIndex = {
        ...baseOperation,
        changeType: ChangeType.CREATE,
      };
      const updateOp: OperationIndex = {
        ...baseOperation,
        changeType: ChangeType.UPDATE,
      };
      const deleteOp: OperationIndex = {
        ...baseOperation,
        changeType: ChangeType.DELETE,
      };
      const readOp: OperationIndex = {
        ...baseOperation,
        changeType: ChangeType.READ,
      };

      expect(createOp.changeType).toBe('create');
      expect(updateOp.changeType).toBe('update');
      expect(deleteOp.changeType).toBe('delete');
      expect(readOp.changeType).toBe('read');
    });
  });
});
