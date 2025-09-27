import { handleListFileChanges } from './handlers/list-file-changes';
import { ChangeType } from './types/operation-index';
import type { OperationIndex } from './types/operation-index';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('./session-discovery');
jest.mock('./parsers/log-parser');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('listFileChanges Integration Test', () => {
  let mockSessionFile: string;
  let mockWorkspaceRoot: string;

  beforeAll(() => {
    mockSessionFile = '/tmp/claude-test/sessions/test-session.jsonl';
    mockWorkspaceRoot = '/tmp/test-project';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables
    process.env['CLAUDE_SESSION_UID'] = 'test-session-uid';
    process.env['CLAUDE_PROJECT_PATH'] = mockWorkspaceRoot;
  });

  afterEach(() => {
    delete process.env['CLAUDE_SESSION_UID'];
    delete process.env['CLAUDE_PROJECT_PATH'];
  });

  describe('Complete Flow Integration', () => {
    beforeEach(() => {
      // Mock fs.readFile
      (mockFs.readFile as jest.Mock).mockResolvedValue('');

      // Mock SessionDiscovery
      const mockSessionDiscovery = {
        findSessionByUID: jest.fn().mockResolvedValue({
          sessionFile: mockSessionFile,
        }),
      };

      // Mock LogParser
      const mockLogParser = {
        parseLogStream: jest.fn().mockReturnValue([]),
      };

      require('./session-discovery').SessionDiscovery = jest.fn().mockImplementation(() => mockSessionDiscovery);
      require('./parsers/log-parser').LogParser = mockLogParser;
    });

    it('should handle listFileChanges with sample data', async () => {
      // Mock sample operations data
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
      ];

      // Set up mocks
      const logContent = mockOperations.map(op => JSON.stringify(op)).join('\n');
      (mockFs.readFile as jest.Mock).mockResolvedValue(logContent);
      require('./parsers/log-parser').LogParser.parseLogStream.mockReturnValue(mockOperations);

      // Test the handler
      const result = await handleListFileChanges({
        filePath: 'src/index.ts',
        limit: 10,
      });

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]?.id).toBe('1');
      expect(result.operations[0]?.changeType).toBe(ChangeType.UPDATE);
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.warning).toBeUndefined();
    });

    it('should handle file path patterns correctly', async () => {
      const mockOperations: OperationIndex[] = [
        {
          id: '1',
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Edit',
          filePath: `${mockWorkspaceRoot}/src/utils/helpers.ts`,
          changeType: ChangeType.UPDATE,
          summary: 'Updated helpers',
        },
        {
          id: '2',
          timestamp: '2024-01-01T10:01:00.000Z',
          tool: 'Write',
          filePath: `${mockWorkspaceRoot}/src/components/Button.tsx`,
          changeType: ChangeType.CREATE,
          summary: 'Created Button',
        },
      ];

      const logContent = mockOperations.map(op => JSON.stringify(op)).join('\n');
      (mockFs.readFile as jest.Mock).mockResolvedValue(logContent);
      require('./parsers/log-parser').LogParser.parseLogStream.mockReturnValue(mockOperations);

      // Test partial path matching
      const result = await handleListFileChanges({
        filePath: 'src/',
        limit: 10,
      });

      expect(result.operations).toHaveLength(2);
      expect(result.totalCount).toBe(2);

      // Test filename matching
      const filenameResult = await handleListFileChanges({
        filePath: 'helpers.ts',
        limit: 10,
      });

      expect(filenameResult.operations).toHaveLength(1);
      expect(filenameResult.operations[0]?.id).toBe('1');
    });

    it('should exclude READ operations correctly', async () => {
      const mockOperations: OperationIndex[] = [
        {
          id: '1',
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Read',
          filePath: `${mockWorkspaceRoot}/src/index.ts`,
          changeType: ChangeType.READ,
          summary: 'Read index.ts',
        },
        {
          id: '2',
          timestamp: '2024-01-01T10:01:00.000Z',
          tool: 'Edit',
          filePath: `${mockWorkspaceRoot}/src/index.ts`,
          changeType: ChangeType.UPDATE,
          summary: 'Updated index.ts',
        },
      ];

      const logContent = mockOperations.map(op => JSON.stringify(op)).join('\n');
      (mockFs.readFile as jest.Mock).mockResolvedValue(logContent);
      require('./parsers/log-parser').LogParser.parseLogStream.mockReturnValue(mockOperations);

      const result = await handleListFileChanges({
        filePath: 'src/index.ts',
        limit: 10,
      });

      // Should only return the UPDATE operation, not the READ
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]?.id).toBe('2');
      expect(result.operations[0]?.changeType).toBe(ChangeType.UPDATE);
    });

    it('should handle empty results with warning', async () => {
      (mockFs.readFile as jest.Mock).mockResolvedValue('');
      require('./parsers/log-parser').LogParser.parseLogStream.mockReturnValue([]);

      const result = await handleListFileChanges({
        filePath: 'nonexistent.ts',
        limit: 10,
      });

      expect(result.operations).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.warning).toContain('No file changes found');
    });
  });
});