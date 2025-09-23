import type { OperationDiff, OperationIndex, EditDiff, WriteDiff, MultiEditDiff, BashDiff, ReadDiff } from './types/operation-index';
import { ChangeType } from './types/operation-index';

// Import the function we're testing (this will fail until implementation exists)
import { showOperationDiff } from './operation-diff';

describe('showOperationDiff', () => {
  // Mock data for testing
  const mockEditOperation: OperationIndex = {
    id: 'edit-op-123',
    timestamp: '2025-09-23T14:30:45.123Z',
    tool: 'Edit',
    filePath: '/src/components/Button.tsx',
    summary: 'Updated button component styling',
    changeType: ChangeType.UPDATE
  };

  const mockWriteOperation: OperationIndex = {
    id: 'write-op-456',
    timestamp: '2025-09-23T14:31:00.456Z',
    tool: 'Write',
    filePath: '/src/utils/helper.ts',
    summary: 'Created new utility function',
    changeType: ChangeType.CREATE
  };

  const mockMultiEditOperation: OperationIndex = {
    id: 'multi-edit-op-789',
    timestamp: '2025-09-23T14:32:15.789Z',
    tool: 'MultiEdit',
    filePath: '/src/services/api.ts',
    summary: 'Refactored API endpoints',
    changeType: ChangeType.UPDATE
  };

  const mockBashOperation: OperationIndex = {
    id: 'bash-op-101',
    timestamp: '2025-09-23T14:33:30.101Z',
    tool: 'Bash',
    summary: 'Executed build script',
    changeType: ChangeType.UPDATE
  };

  const mockReadOperation: OperationIndex = {
    id: 'read-op-202',
    timestamp: '2025-09-23T14:34:45.202Z',
    tool: 'Read',
    filePath: '/src/config/settings.json',
    summary: 'Read configuration file',
    changeType: ChangeType.READ
  };

  describe('Basic Functionality Tests', () => {
    it('should return OperationDiff type for valid Edit operation ID', async () => {
      // This test will fail until showOperationDiff is implemented
      const result = await showOperationDiff('edit-op-123');

      // Type checks
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.operationId).toBeDefined();
      expect(result.tool).toBe('Edit');
      expect(result.changeType).toBe(ChangeType.UPDATE);
      expect(result.diff).toBeDefined();

      // Ensure it's an EditDiff
      const editDiff = result.diff as EditDiff;
      expect(editDiff.tool).toBe('Edit');
      expect(editDiff.oldString).toBeDefined();
      expect(editDiff.newString).toBeDefined();
      expect(typeof editDiff.replaceAll).toBe('boolean');
      expect(editDiff.unifiedDiff).toBeDefined();
    });

    it('should return OperationDiff type for valid Write operation ID', async () => {
      const result = await showOperationDiff('write-op-456');

      expect(result).toBeDefined();
      expect(result.operationId).toBeDefined();
      expect(result.tool).toBe('Write');
      expect(result.changeType).toBe(ChangeType.CREATE);

      // Ensure it's a WriteDiff
      const writeDiff = result.diff as WriteDiff;
      expect(writeDiff.tool).toBe('Write');
      expect(typeof writeDiff.isNewFile).toBe('boolean');
      expect(writeDiff.newContent).toBeDefined();
      expect(writeDiff.unifiedDiff).toBeDefined();
    });

    it('should return OperationDiff type for valid MultiEdit operation ID', async () => {
      const result = await showOperationDiff('multi-edit-op-789');

      expect(result).toBeDefined();
      expect(result.operationId).toBeDefined();
      expect(result.tool).toBe('MultiEdit');

      // Ensure it's a MultiEditDiff
      const multiEditDiff = result.diff as MultiEditDiff;
      expect(multiEditDiff.tool).toBe('MultiEdit');
      expect(Array.isArray(multiEditDiff.edits)).toBe(true);
      expect(multiEditDiff.unifiedDiff).toBeDefined();
    });

    it('should return OperationDiff type for valid Bash operation ID', async () => {
      const result = await showOperationDiff('bash-op-101');

      expect(result).toBeDefined();
      expect(result.operationId).toBeDefined();
      expect(result.tool).toBe('Bash');

      // Ensure it's a BashDiff
      const bashDiff = result.diff as BashDiff;
      expect(bashDiff.tool).toBe('Bash');
      expect(bashDiff.command).toBeDefined();
      expect(bashDiff.stdout).toBeDefined();
      expect(bashDiff.stderr).toBeDefined();
      expect(typeof bashDiff.exitCode).toBe('number');
      expect(Array.isArray(bashDiff.affectedFiles)).toBe(true);
    });

    it('should return OperationDiff type for valid Read operation ID', async () => {
      const result = await showOperationDiff('read-op-202');

      expect(result).toBeDefined();
      expect(result.operationId).toBeDefined();
      expect(result.tool).toBe('Read');
      expect(result.changeType).toBe(ChangeType.READ);

      // Ensure it's a ReadDiff
      const readDiff = result.diff as ReadDiff;
      expect(readDiff.tool).toBe('Read');
      expect(readDiff.content).toBeDefined();
      expect(typeof readDiff.linesRead).toBe('number');
    });

    it('should throw error for invalid operation ID', async () => {
      await expect(showOperationDiff('invalid-op-id')).rejects.toThrow();
    });

    it('should throw error for empty operation ID', async () => {
      await expect(showOperationDiff('')).rejects.toThrow();
    });

    it('should throw error for null/undefined operation ID', async () => {
      await expect(showOperationDiff(null as any)).rejects.toThrow();
      await expect(showOperationDiff(undefined as any)).rejects.toThrow();
    });
  });

  describe('Tool-specific Diff Generation Tests', () => {
    it('should generate correct EditDiff structure', async () => {
      const result = await showOperationDiff('edit-op-123');
      const editDiff = result.diff as EditDiff;

      expect(editDiff.tool).toBe('Edit');
      expect(typeof editDiff.oldString).toBe('string');
      expect(typeof editDiff.newString).toBe('string');
      expect(typeof editDiff.replaceAll).toBe('boolean');

      // Unified diff structure
      expect(editDiff.unifiedDiff.filename).toBeDefined();
      expect(editDiff.unifiedDiff.oldVersion).toBeDefined();
      expect(editDiff.unifiedDiff.newVersion).toBeDefined();
      expect(editDiff.unifiedDiff.diffText).toBeDefined();
    });

    it('should generate correct WriteDiff structure', async () => {
      const result = await showOperationDiff('write-op-456');
      const writeDiff = result.diff as WriteDiff;

      expect(writeDiff.tool).toBe('Write');
      expect(typeof writeDiff.isNewFile).toBe('boolean');
      expect(typeof writeDiff.newContent).toBe('string');

      // previousContent should be undefined for new files
      if (writeDiff.isNewFile) {
        expect(writeDiff.previousContent).toBeUndefined();
      } else {
        expect(writeDiff.previousContent).toBeDefined();
      }
    });

    it('should generate correct MultiEditDiff structure', async () => {
      const result = await showOperationDiff('multi-edit-op-789');
      const multiEditDiff = result.diff as MultiEditDiff;

      expect(multiEditDiff.tool).toBe('MultiEdit');
      expect(Array.isArray(multiEditDiff.edits)).toBe(true);
      expect(multiEditDiff.edits.length).toBeGreaterThan(0);

      // Check structure of individual edits
      multiEditDiff.edits.forEach(edit => {
        expect(typeof edit.oldString).toBe('string');
        expect(typeof edit.newString).toBe('string');
        expect(typeof edit.replaceAll).toBe('boolean');
      });
    });

    it('should generate correct BashDiff structure', async () => {
      const result = await showOperationDiff('bash-op-101');
      const bashDiff = result.diff as BashDiff;

      expect(bashDiff.tool).toBe('Bash');
      expect(typeof bashDiff.command).toBe('string');
      expect(typeof bashDiff.stdout).toBe('string');
      expect(typeof bashDiff.stderr).toBe('string');
      expect(typeof bashDiff.exitCode).toBe('number');
      expect(Array.isArray(bashDiff.affectedFiles)).toBe(true);

      // Check structure of affected files
      bashDiff.affectedFiles.forEach(file => {
        expect(typeof file.filePath).toBe('string');
        expect(Object.values(ChangeType)).toContain(file.changeType);
        // unifiedDiff is optional (undefined for CREATE/DELETE)
        if (file.unifiedDiff) {
          expect(file.unifiedDiff.filename).toBeDefined();
        }
      });
    });

    it('should generate correct ReadDiff structure', async () => {
      const result = await showOperationDiff('read-op-202');
      const readDiff = result.diff as ReadDiff;

      expect(readDiff.tool).toBe('Read');
      expect(typeof readDiff.content).toBe('string');
      expect(typeof readDiff.linesRead).toBe('number');
      expect(readDiff.linesRead).toBeGreaterThanOrEqual(0);

      // Optional range properties
      if (readDiff.startLine !== undefined) {
        expect(typeof readDiff.startLine).toBe('number');
      }
      if (readDiff.endLine !== undefined) {
        expect(typeof readDiff.endLine).toBe('number');
      }
    });
  });

  describe('Integration Tests', () => {
    it('should integrate with OperationIndex data structure', async () => {
      const result = await showOperationDiff('edit-op-123');

      // Should contain all properties from OperationIndex
      // Note: operationId may be different from input id due to UUID format requirements
      expect(result.operationId).toBeDefined();
      expect(result.timestamp).toBe(mockEditOperation.timestamp);
      expect(result.tool).toBe(mockEditOperation.tool);
      expect(result.filePath).toBe(mockEditOperation.filePath);
      expect(result.summary).toBe(mockEditOperation.summary);
      expect(result.changeType).toBe(mockEditOperation.changeType);

      // Plus additional diff information
      expect(result.diff).toBeDefined();
    });

    it('should handle operations without filePath correctly', async () => {
      const result = await showOperationDiff('bash-op-101');

      // Bash operations might not have filePath (global commands)
      expect(result.filePath).toBeUndefined();
      expect(result.diff).toBeDefined();
    });

    it('should work with LogParser parsed data', async () => {
      // This test ensures compatibility with LogParser output format
      const result = await showOperationDiff('edit-op-123');

      // Verify timestamp format matches LogParser expectations (ISO 8601)
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(result.timestamp).toMatch(iso8601Regex);

      // Verify UUID format for operation ID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.operationId).toMatch(uuidRegex);
    });

    it('should maintain consistency with ChangeType enum', async () => {
      const testCases = [
        { id: 'edit-op-123', expectedChangeType: ChangeType.UPDATE },
        { id: 'write-op-456', expectedChangeType: ChangeType.CREATE },
        { id: 'read-op-202', expectedChangeType: ChangeType.READ }
      ];

      for (const testCase of testCases) {
        const result = await showOperationDiff(testCase.id);
        expect(result.changeType).toBe(testCase.expectedChangeType);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw descriptive error for non-existent operation ID', async () => {
      await expect(showOperationDiff('non-existent-123'))
        .rejects
        .toThrow(/operation.*not found/i);
    });

    it('should throw error for malformed operation ID', async () => {
      await expect(showOperationDiff('not-a-valid-uuid'))
        .rejects
        .toThrow();
    });

    it('should handle database/storage errors gracefully', async () => {
      // Test error handling when underlying storage fails
      await expect(showOperationDiff('error-trigger-id'))
        .rejects
        .toThrow();
    });
  });
});