import { filterByFilePath, filterByChangeType } from './operation-filter-enhanced';
import { ChangeType } from '../types/operation-index';
import type { OperationIndex } from '../types/operation-index';

describe('Enhanced Operation Filtering', () => {
  const workspaceRoot = '/Users/test/project';

  const mockOperations: OperationIndex[] = [
    {
      id: '1',
      timestamp: '2024-01-01T10:00:00.000Z',
      tool: 'Edit',
      filePath: '/Users/test/project/src/index.ts',
      changeType: ChangeType.UPDATE,
      summary: 'Updated index.ts',
    },
    {
      id: '2',
      timestamp: '2024-01-01T10:01:00.000Z',
      tool: 'Write',
      filePath: '/Users/test/project/src/components/Button.tsx',
      changeType: ChangeType.CREATE,
      summary: 'Created Button component',
    },
    {
      id: '3',
      timestamp: '2024-01-01T10:02:00.000Z',
      tool: 'Read',
      filePath: '/Users/test/project/README.md',
      changeType: ChangeType.READ,
      summary: 'Read README',
    },
    {
      id: '4',
      timestamp: '2024-01-01T10:03:00.000Z',
      tool: 'Edit',
      filePath: '/Users/test/project/src/utils/helpers.ts',
      changeType: ChangeType.UPDATE,
      summary: 'Updated helpers',
    },
    {
      id: '5',
      timestamp: '2024-01-01T10:04:00.000Z',
      tool: 'Bash',
      filePath: '/Users/test/project/src/index.ts',
      changeType: ChangeType.DELETE,
      summary: 'Deleted old index',
    },
    {
      id: '6',
      timestamp: '2024-01-01T10:05:00.000Z',
      tool: 'MultiEdit',
      filePath: '/Users/test/project/tests/app.test.ts',
      changeType: ChangeType.UPDATE,
      summary: 'Updated test file',
    },
  ];

  describe('filterByFilePath with FilePathMatcher', () => {
    it('should match by absolute path', () => {
      const result = filterByFilePath(
        mockOperations,
        '/Users/test/project/src/index.ts',
        workspaceRoot
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('1');
      expect(result[1]?.id).toBe('5');
    });

    it('should match by relative path from workspace', () => {
      const result = filterByFilePath(
        mockOperations,
        'src/index.ts',
        workspaceRoot
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('1');
      expect(result[1]?.id).toBe('5');
    });

    it('should match by filename only', () => {
      const result = filterByFilePath(
        mockOperations,
        'helpers.ts',
        workspaceRoot
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('4');
    });

    it('should match by partial path', () => {
      const result = filterByFilePath(
        mockOperations,
        'src/components',
        workspaceRoot
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('2');
    });

    it('should match multiple files with same partial path', () => {
      const result = filterByFilePath(
        mockOperations,
        'src/',
        workspaceRoot
      );
      expect(result).toHaveLength(4);
      expect(result.map(op => op.id)).toEqual(['1', '2', '4', '5']);
    });

    it('should handle ./ prefix in relative paths', () => {
      const result = filterByFilePath(
        mockOperations,
        './src/utils/helpers.ts',
        workspaceRoot
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('4');
    });

    it('should return empty array for non-matching path', () => {
      const result = filterByFilePath(
        mockOperations,
        'nonexistent.ts',
        workspaceRoot
      );
      expect(result).toHaveLength(0);
    });

    it('should handle operations without filePath', () => {
      const opsWithoutPath: OperationIndex[] = [
        {
          id: '7',
          timestamp: '2024-01-01T10:06:00.000Z',
          tool: 'Bash',
          changeType: ChangeType.READ,
          summary: 'Ran command',
        },
      ];
      const result = filterByFilePath(
        opsWithoutPath,
        'any.ts',
        workspaceRoot
      );
      expect(result).toHaveLength(0);
    });

    it('should handle empty pattern', () => {
      const result = filterByFilePath(mockOperations, '', workspaceRoot);
      expect(result).toEqual(mockOperations);
    });
  });

  describe('filterByChangeType', () => {
    it('should filter by single change type', () => {
      const result = filterByChangeType(mockOperations, [ChangeType.CREATE]);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('2');
    });

    it('should filter by multiple change types', () => {
      const result = filterByChangeType(mockOperations, [ChangeType.CREATE, ChangeType.UPDATE]);
      expect(result).toHaveLength(4);
      expect(result.map(op => op.id)).toEqual(['1', '2', '4', '6']);
    });

    it('should filter out READ operations for file changes', () => {
      const changeTypes: ChangeType[] = [ChangeType.CREATE, ChangeType.UPDATE, ChangeType.DELETE];
      const result = filterByChangeType(mockOperations, changeTypes);
      expect(result).toHaveLength(5);
      expect(result.find(op => op.changeType === ChangeType.READ)).toBeUndefined();
    });

    it('should return all operations when no change types specified', () => {
      const result = filterByChangeType(mockOperations, []);
      expect(result).toEqual(mockOperations);
    });

    it('should return all operations when undefined change types', () => {
      const result = filterByChangeType(mockOperations, undefined);
      expect(result).toEqual(mockOperations);
    });

    it('should handle operations without changeType', () => {
      const opsWithoutType: OperationIndex[] = [
        {
          id: '8',
          timestamp: '2024-01-01T10:07:00.000Z',
          tool: 'Bash',
          summary: 'Command without type',
          changeType: undefined as any,
        },
      ];
      const result = filterByChangeType(opsWithoutType, [ChangeType.CREATE]);
      expect(result).toHaveLength(0);
    });
  });

  describe('Combined filtering for listFileChanges', () => {
    it('should filter by file path and exclude READ operations', () => {
      // This simulates what listFileChanges will do
      const changeTypes: ChangeType[] = [ChangeType.CREATE, ChangeType.UPDATE, ChangeType.DELETE];

      // First filter by file path
      let result = filterByFilePath(
        mockOperations,
        'src/index.ts',
        workspaceRoot
      );

      // Then filter by change types (excluding READ)
      result = filterByChangeType(result, changeTypes);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('1');
      expect(result[1]?.id).toBe('5');
      expect(result[0]?.changeType).toBe(ChangeType.UPDATE);
      expect(result[1]?.changeType).toBe(ChangeType.DELETE);
    });

    it('should handle complex filtering scenario', () => {
      const changeTypes: ChangeType[] = [ChangeType.CREATE, ChangeType.UPDATE, ChangeType.DELETE];

      // Filter for all src files
      let result = filterByFilePath(mockOperations, 'src/', workspaceRoot);

      // Then filter out READ operations
      result = filterByChangeType(result, changeTypes);

      expect(result).toHaveLength(4);
      expect(result.every(op => op.filePath?.includes('src/'))).toBe(true);
      expect(result.every(op => op.changeType !== ChangeType.READ)).toBe(true);
    });
  });
});