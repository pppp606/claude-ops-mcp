import type { OperationIndex } from '../types/operation-index';
import { ChangeType } from '../types/operation-index';
import { filterOperations } from './operation-filter';

describe('OperationFilter', () => {
  const mockOperations: OperationIndex[] = [
    {
      id: 'op-001',
      timestamp: '2025-09-18T10:00:00.000Z',
      tool: 'Write',
      filePath: '/src/components/Button.tsx',
      summary: 'Created button component',
      changeType: ChangeType.CREATE
    },
    {
      id: 'op-002',
      timestamp: '2025-09-18T11:00:00.000Z',
      tool: 'Edit',
      filePath: '/src/components/Button.tsx',
      summary: 'Updated button styles',
      changeType: ChangeType.UPDATE
    },
    {
      id: 'op-003',
      timestamp: '2025-09-18T12:00:00.000Z',
      tool: 'Write',
      filePath: '/src/utils/helpers.ts',
      summary: 'Added utility functions',
      changeType: ChangeType.CREATE
    },
    {
      id: 'op-004',
      timestamp: '2025-09-18T13:00:00.000Z',
      tool: 'Grep',
      summary: 'Searched for API patterns',
      changeType: ChangeType.READ
    },
    {
      id: 'op-005',
      timestamp: '2025-09-18T14:00:00.000Z',
      tool: 'Delete',
      filePath: '/src/components/OldComponent.tsx',
      summary: 'Removed obsolete component',
      changeType: ChangeType.DELETE
    }
  ];

  describe('limit filter', () => {
    it('should return all operations when no limit is specified', () => {
      const result = filterOperations(mockOperations, {});
      expect(result).toHaveLength(5);
      expect(result).toEqual(mockOperations);
    });

    it('should return limited number of operations when limit is specified', () => {
      const result = filterOperations(mockOperations, { limit: 3 });
      expect(result).toHaveLength(3);
      expect(result).toEqual(mockOperations.slice(0, 3));
    });

    it('should return all operations when limit is greater than array length', () => {
      const result = filterOperations(mockOperations, { limit: 10 });
      expect(result).toHaveLength(5);
      expect(result).toEqual(mockOperations);
    });

    it('should return empty array when limit is 0', () => {
      const result = filterOperations(mockOperations, { limit: 0 });
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle negative limit by returning empty array', () => {
      const result = filterOperations(mockOperations, { limit: -1 });
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should maintain original ordering when applying limit', () => {
      const result = filterOperations(mockOperations, { limit: 2 });
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('op-001');
      expect(result[1]?.id).toBe('op-002');
    });

    it('should handle empty input array with limit', () => {
      const result = filterOperations([], { limit: 5 });
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });
  });

  describe('filePath filter', () => {
    it('should return all operations when no filePath filter is specified', () => {
      const result = filterOperations(mockOperations, {});
      expect(result).toHaveLength(5);
    });

    it('should filter by exact file path', () => {
      const result = filterOperations(mockOperations, { filePath: '/src/components/Button.tsx' });
      expect(result).toHaveLength(2);
      expect(result.every(op => op.filePath === '/src/components/Button.tsx')).toBe(true);
    });

    it('should filter by partial path match', () => {
      const result = filterOperations(mockOperations, { filePath: '/src/components/' });
      expect(result).toHaveLength(3);
      expect(result.every(op => op.filePath?.includes('/src/components/'))).toBe(true);
    });

    it('should handle operations without filePath', () => {
      const result = filterOperations(mockOperations, { filePath: '/src/' });
      expect(result).toHaveLength(4);
      expect(result.find(op => op.id === 'op-004')).toBeUndefined();
    });

    it('should return empty array when no matches found', () => {
      const result = filterOperations(mockOperations, { filePath: '/nonexistent/' });
      expect(result).toHaveLength(0);
    });

    it('should handle glob pattern matching', () => {
      const result = filterOperations(mockOperations, { filePath: '*.tsx' });
      expect(result).toHaveLength(3);
      expect(result.every(op => op.filePath?.endsWith('.tsx'))).toBe(true);
    });
  });

  describe('since filter', () => {
    it('should return all operations when no since filter is specified', () => {
      const result = filterOperations(mockOperations, {});
      expect(result).toHaveLength(5);
    });

    it('should filter operations after specified timestamp', () => {
      const result = filterOperations(mockOperations, { since: '2025-09-18T11:30:00.000Z' });
      expect(result).toHaveLength(3);
      expect(result[0]?.id).toBe('op-003');
    });

    it('should include operations at exact timestamp', () => {
      const result = filterOperations(mockOperations, { since: '2025-09-18T12:00:00.000Z' });
      expect(result).toHaveLength(3);
      expect(result[0]?.id).toBe('op-003');
    });

    it('should return all operations if since is before all timestamps', () => {
      const result = filterOperations(mockOperations, { since: '2024-01-01T00:00:00.000Z' });
      expect(result).toHaveLength(5);
    });

    it('should return empty array if since is after all timestamps', () => {
      const result = filterOperations(mockOperations, { since: '2026-01-01T00:00:00.000Z' });
      expect(result).toHaveLength(0);
    });

    it('should throw error for invalid timestamp format', () => {
      expect(() => filterOperations(mockOperations, { since: 'invalid-date' })).toThrow();
    });
  });

  describe('until filter', () => {
    it('should return all operations when no until filter is specified', () => {
      const result = filterOperations(mockOperations, {});
      expect(result).toHaveLength(5);
    });

    it('should filter operations before specified timestamp', () => {
      const result = filterOperations(mockOperations, { until: '2025-09-18T11:30:00.000Z' });
      expect(result).toHaveLength(2);
      expect(result[result.length - 1]?.id).toBe('op-002');
    });

    it('should include operations at exact timestamp', () => {
      const result = filterOperations(mockOperations, { until: '2025-09-18T12:00:00.000Z' });
      expect(result).toHaveLength(3);
      expect(result[result.length - 1]?.id).toBe('op-003');
    });

    it('should return empty array if until is before all timestamps', () => {
      const result = filterOperations(mockOperations, { until: '2024-01-01T00:00:00.000Z' });
      expect(result).toHaveLength(0);
    });

    it('should return all operations if until is after all timestamps', () => {
      const result = filterOperations(mockOperations, { until: '2026-01-01T00:00:00.000Z' });
      expect(result).toHaveLength(5);
    });

    it('should throw error for invalid timestamp format', () => {
      expect(() => filterOperations(mockOperations, { until: 'not-a-date' })).toThrow();
    });
  });

  describe('composite filtering', () => {
    it('should apply multiple filters together', () => {
      const result = filterOperations(mockOperations, {
        filePath: '/src/',
        since: '2025-09-18T10:30:00.000Z',
        limit: 2
      });
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('op-002');
      expect(result[1]?.id).toBe('op-003');
    });

    it('should apply all filters in correct order', () => {
      const result = filterOperations(mockOperations, {
        filePath: '/src/',
        since: '2025-09-18T10:00:00.000Z',
        until: '2025-09-18T13:00:00.000Z',
        limit: 10
      });
      expect(result).toHaveLength(3);
      expect(result.every(op => op.filePath?.includes('/src/'))).toBe(true);
    });

    it('should maintain original ordering after filtering', () => {
      const result = filterOperations(mockOperations, {
        filePath: '/src/',
        since: '2025-09-18T10:00:00.000Z',
        until: '2025-09-18T14:00:00.000Z'
      });
      const timestamps = result.map(op => new Date(op.timestamp).getTime());
      const sorted = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sorted);
    });

    it('should handle empty results gracefully', () => {
      const result = filterOperations(mockOperations, {
        filePath: '/nonexistent/',
        since: '2026-01-01T00:00:00.000Z'
      });
      expect(result).toHaveLength(0);
    });
  });
});