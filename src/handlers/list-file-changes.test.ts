import { handleListFileChanges } from './list-file-changes';
import { ChangeType } from '../types/operation-index';
import type { OperationIndex } from '../types/operation-index';
import * as sessionDiscovery from '../session-discovery';
import * as logParser from '../parsers/log-parser';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../session-discovery');
jest.mock('../parsers/log-parser');
jest.mock('fs/promises');

describe('handleListFileChanges', () => {
  const mockSessionDiscovery = sessionDiscovery as jest.Mocked<
    typeof sessionDiscovery
  >;
  const mockLogParser = logParser as jest.Mocked<typeof logParser>;
  const mockFs = fs as jest.Mocked<typeof fs>;

  const mockSessionFile = '/Users/test/.claude/projects/test-project/sessions/12345.jsonl';
  const mockWorkspaceRoot = '/Users/test/test-project';

  const mockOperations: OperationIndex[] = [
    {
      id: '1',
      timestamp: '2024-01-01T10:00:00.000Z',
      tool: 'Edit',
      filePath: `${mockWorkspaceRoot}/src/index.ts`,
      changeType: ChangeType.UPDATE,
      summary: 'Updated index.ts',
    },
    {
      id: '2',
      timestamp: '2024-01-01T10:01:00.000Z',
      tool: 'Write',
      filePath: `${mockWorkspaceRoot}/src/components/Button.tsx`,
      changeType: ChangeType.CREATE,
      summary: 'Created Button component',
    },
    {
      id: '3',
      timestamp: '2024-01-01T10:02:00.000Z',
      tool: 'Read',
      filePath: `${mockWorkspaceRoot}/README.md`,
      changeType: ChangeType.READ,
      summary: 'Read README',
    },
    {
      id: '4',
      timestamp: '2024-01-01T10:03:00.000Z',
      tool: 'Edit',
      filePath: `${mockWorkspaceRoot}/src/utils/helpers.ts`,
      changeType: ChangeType.UPDATE,
      summary: 'Updated helpers',
    },
    {
      id: '5',
      timestamp: '2024-01-01T10:04:00.000Z',
      tool: 'Bash',
      filePath: `${mockWorkspaceRoot}/src/index.ts`,
      changeType: ChangeType.DELETE,
      summary: 'Deleted old index',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['CLAUDE_PROJECT_PATH'] = mockWorkspaceRoot;
  });

  afterEach(() => {
    delete process.env['CLAUDE_PROJECT_PATH'];
  });

  describe('Successful operations', () => {
    beforeEach(() => {
      process.env['CLAUDE_SESSION_UID'] = 'test-session-uid';
      mockSessionDiscovery.SessionDiscovery.prototype.findSessionByUID = jest
        .fn()
        .mockResolvedValue({ sessionFile: mockSessionFile });
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockOperations));
      mockLogParser.LogParser.parseLogStream = jest
        .fn()
        .mockReturnValue(mockOperations);
    });

    it('should return file changes for a specific file path', async () => {
      const result = await handleListFileChanges({
        filePath: 'src/index.ts',
        limit: 10,
      });

      expect(result.operations).toHaveLength(2);
      expect(result.operations[0]?.id).toBe('5'); // Newest first (DELETE)
      expect(result.operations[1]?.id).toBe('1'); // Older (UPDATE)
      expect(result.operations.every(op => op.changeType !== ChangeType.READ)).toBe(true);
      expect(result.totalCount).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should respect limit parameter', async () => {
      const result = await handleListFileChanges({
        filePath: 'src/',
        limit: 2,
      });

      expect(result.operations).toHaveLength(2);
      expect(result.operations[0]?.id).toBe('5'); // Newest first
      expect(result.operations[1]?.id).toBe('4'); // Second newest
      expect(result.totalCount).toBe(4); // All operations excluding READ
      expect(result.hasMore).toBe(true);
    });

    it('should use default limit when not provided', async () => {
      const result = await handleListFileChanges({
        filePath: 'src/',
      });

      expect(result.operations).toHaveLength(4); // All 4 operations excluding READ
      expect(result.totalCount).toBe(4);
      expect(result.hasMore).toBe(false);
    });

    it('should enforce maximum limit', async () => {
      await expect(
        handleListFileChanges({
          filePath: 'src/',
          limit: 2000, // Exceeds max limit
        })
      ).rejects.toThrow('Limit must be between 1 and 1000');
    });

    it('should handle absolute file paths', async () => {
      const result = await handleListFileChanges({
        filePath: `${mockWorkspaceRoot}/src/utils/helpers.ts`,
        limit: 10,
      });

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]?.id).toBe('4');
    });

    it('should handle partial path matching', async () => {
      const result = await handleListFileChanges({
        filePath: 'Button.tsx',
        limit: 10,
      });

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]?.id).toBe('2');
    });

    it('should exclude READ operations', async () => {
      const result = await handleListFileChanges({
        filePath: 'README.md',
        limit: 10,
      });

      expect(result.operations).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should return empty result for non-matching path', async () => {
      const result = await handleListFileChanges({
        filePath: 'nonexistent.ts',
        limit: 10,
      });

      expect(result.operations).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.warning).toContain('No file changes found');
    });

    it('should handle operations without filePath', async () => {
      const opsWithoutPath: OperationIndex[] = [
        {
          id: '6',
          timestamp: '2024-01-01T10:05:00.000Z',
          tool: 'Bash',
          changeType: ChangeType.UPDATE,
          summary: 'Ran command',
        },
      ];

      mockLogParser.LogParser.parseLogStream = jest
        .fn()
        .mockReturnValue(opsWithoutPath);

      const result = await handleListFileChanges({
        filePath: 'any.ts',
        limit: 10,
      });

      expect(result.operations).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should throw error when session UID is not available', async () => {
      delete process.env['CLAUDE_SESSION_UID'];

      await expect(
        handleListFileChanges({ filePath: 'test.ts', limit: 10 })
      ).rejects.toThrow('No active Claude session found');
    });

    it('should throw error when workspace root is not available', async () => {
      delete process.env['CLAUDE_PROJECT_PATH'];
      process.env['CLAUDE_SESSION_UID'] = 'test-uid';

      await expect(
        handleListFileChanges({ filePath: 'test.ts', limit: 10 })
      ).rejects.toThrow('Workspace root not available');
    });

    it('should throw error when session file is not found', async () => {
      process.env['CLAUDE_SESSION_UID'] = 'test-uid';
      mockSessionDiscovery.SessionDiscovery.prototype.findSessionByUID = jest
        .fn()
        .mockResolvedValue(null);

      await expect(
        handleListFileChanges({ filePath: 'test.ts', limit: 10 })
      ).rejects.toThrow('Session file not found');
    });

    it('should throw error for invalid file path', async () => {
      await expect(
        handleListFileChanges({ filePath: '', limit: 10 })
      ).rejects.toThrow('File path is required');
    });

    it('should throw error for invalid limit', async () => {
      await expect(
        handleListFileChanges({ filePath: 'test.ts', limit: 0 })
      ).rejects.toThrow('Limit must be between 1 and 1000');

      await expect(
        handleListFileChanges({ filePath: 'test.ts', limit: -1 })
      ).rejects.toThrow('Limit must be between 1 and 1000');
    });

    it('should handle file read errors gracefully', async () => {
      process.env['CLAUDE_SESSION_UID'] = 'test-uid';
      mockSessionDiscovery.SessionDiscovery.prototype.findSessionByUID = jest
        .fn()
        .mockResolvedValue({ sessionFile: mockSessionFile });
      mockFs.readFile.mockRejectedValue(new Error('File read error'));

      await expect(
        handleListFileChanges({ filePath: 'test.ts', limit: 10 })
      ).rejects.toThrow('Failed to read session file');
    });

    it('should handle log parsing errors gracefully', async () => {
      process.env['CLAUDE_SESSION_UID'] = 'test-uid';
      mockSessionDiscovery.SessionDiscovery.prototype.findSessionByUID = jest
        .fn()
        .mockResolvedValue({ sessionFile: mockSessionFile });
      mockFs.readFile.mockResolvedValue('invalid json');
      mockLogParser.LogParser.parseLogStream = jest.fn().mockImplementation(() => {
        throw new Error('Parse error');
      });

      await expect(
        handleListFileChanges({ filePath: 'test.ts', limit: 10 })
      ).rejects.toThrow('Failed to parse session logs');
    });
  });

  describe('Response format', () => {
    beforeEach(() => {
      process.env['CLAUDE_SESSION_UID'] = 'test-session-uid';
      mockSessionDiscovery.SessionDiscovery.prototype.findSessionByUID = jest
        .fn()
        .mockResolvedValue({ sessionFile: mockSessionFile });
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockOperations));
      mockLogParser.LogParser.parseLogStream = jest
        .fn()
        .mockReturnValue(mockOperations);
    });

    it('should return properly formatted response', async () => {
      const result = await handleListFileChanges({
        filePath: 'src/index.ts',
        limit: 10,
      });

      expect(result).toHaveProperty('operations');
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('hasMore');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('filePath');

      expect(Array.isArray(result.operations)).toBe(true);
      expect(typeof result.totalCount).toBe('number');
      expect(typeof result.hasMore).toBe('boolean');
      expect(typeof result.limit).toBe('number');
      expect(typeof result.filePath).toBe('string');
    });

    it('should include warning for empty results', async () => {
      const result = await handleListFileChanges({
        filePath: 'nonexistent.ts',
        limit: 10,
      });

      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('No file changes found');
    });

    it('should maintain operation ordering (newest first)', async () => {
      const result = await handleListFileChanges({
        filePath: 'src/',
        limit: 10,
      });

      // Operations should be in reverse chronological order
      for (let i = 1; i < result.operations.length; i++) {
        const prevTime = new Date(result.operations[i - 1]!.timestamp).getTime();
        const currTime = new Date(result.operations[i]!.timestamp).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });
  });
});