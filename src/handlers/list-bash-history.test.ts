import { handleListBashHistory, handleShowBashResult } from './list-bash-history';
import { ChangeType } from '../types/operation-index';
import type { OperationIndex } from '../types/operation-index';
import * as sessionDiscovery from '../session-discovery';
import * as logParser from '../parsers/log-parser';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../session-discovery');
jest.mock('../parsers/log-parser');
jest.mock('fs/promises');

describe('Bash History API', () => {
  const mockSessionDiscovery = sessionDiscovery as jest.Mocked<
    typeof sessionDiscovery
  >;
  const mockLogParser = logParser as jest.Mocked<typeof logParser>;
  const mockFs = fs as jest.Mocked<typeof fs>;

  const mockSessionFile = '/Users/test/.claude/projects/test-project/sessions/12345.jsonl';
  const mockWorkspaceRoot = '/Users/test/test-project';

  const mockBashOperations: OperationIndex[] = [
    {
      id: 'bash-1',
      timestamp: '2024-01-01T10:00:00.000Z',
      tool: 'Bash',
      filePath: `${mockWorkspaceRoot}/src/index.ts`,
      changeType: ChangeType.UPDATE,
      summary: 'npm run build',
    },
    {
      id: 'bash-2',
      timestamp: '2024-01-01T10:01:00.000Z',
      tool: 'Bash',
      changeType: ChangeType.UPDATE,
      summary: 'git status',
    },
    {
      id: 'bash-3',
      timestamp: '2024-01-01T10:02:00.000Z',
      tool: 'Bash',
      changeType: ChangeType.UPDATE,
      summary: 'npm test -- failed',
    },
    // Non-Bash operations to test filtering
    {
      id: 'edit-1',
      timestamp: '2024-01-01T10:03:00.000Z',
      tool: 'Edit',
      filePath: `${mockWorkspaceRoot}/src/test.ts`,
      changeType: ChangeType.UPDATE,
      summary: 'Updated test file',
    },
  ];

  const mockRawJsonlContent = [
    JSON.stringify({
      timestamp: '2024-01-01T10:00:00.000Z',
      tool: 'Bash',
      parameters: { command: 'npm run build' },
      result: {
        stdout: 'Build successful\nCompilation completed in 2.3s',
        stderr: '',
        exitCode: 0,
      },
    }),
    JSON.stringify({
      timestamp: '2024-01-01T10:01:00.000Z',
      tool: 'Bash',
      parameters: { command: 'git status' },
      result: {
        stdout: 'On branch main\nnothing to commit, working tree clean',
        stderr: '',
        exitCode: 0,
      },
    }),
    JSON.stringify({
      timestamp: '2024-01-01T10:02:00.000Z',
      tool: 'Bash',
      parameters: { command: 'npm test' },
      result: {
        stdout: 'Running tests...\n2 tests failed',
        stderr: 'Error: Test suite failed\nExpected: 5\nReceived: 3',
        exitCode: 1,
      },
    }),
    JSON.stringify({
      timestamp: '2024-01-01T10:03:00.000Z',
      tool: 'Edit',
      parameters: { file_path: `${mockWorkspaceRoot}/src/test.ts` },
    }),
  ].join('\n');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['CLAUDE_PROJECT_PATH'] = mockWorkspaceRoot;
    process.env['CLAUDE_SESSION_UID'] = 'test-session-uid';
  });

  afterEach(() => {
    delete process.env['CLAUDE_PROJECT_PATH'];
    delete process.env['CLAUDE_SESSION_UID'];
  });

  describe('handleListBashHistory', () => {
    beforeEach(() => {
      mockSessionDiscovery.SessionDiscovery.prototype.findSessionByUID = jest
        .fn()
        .mockResolvedValue({ sessionFile: mockSessionFile });
      mockFs.readFile.mockResolvedValue(mockRawJsonlContent);
      mockLogParser.LogParser.parseLogStream = jest
        .fn()
        .mockReturnValue(mockBashOperations);
    });

    describe('BashHistoryItem type tests', () => {
      it('should return bash commands with required BashHistoryItem fields', async () => {
        const result = await handleListBashHistory({ limit: 10 });

        expect(result.commands).toHaveLength(3); // Only Bash operations
        const bashCommand = result.commands[0]!;

        // Test BashHistoryItem interface compliance
        expect(bashCommand).toHaveProperty('id');
        expect(bashCommand).toHaveProperty('timestamp');
        expect(bashCommand).toHaveProperty('command');
        expect(bashCommand).toHaveProperty('exitCode');
        expect(bashCommand).toHaveProperty('workingDirectory');
        expect(bashCommand).toHaveProperty('summary');

        expect(typeof bashCommand.id).toBe('string');
        expect(typeof bashCommand.timestamp).toBe('string');
        expect(typeof bashCommand.command).toBe('string');
        expect(typeof bashCommand.exitCode).toBe('number');
        expect(typeof bashCommand.workingDirectory).toBe('string');
        expect(typeof bashCommand.summary).toBe('string');
      });

      it('should generate smart summary from stdout/stderr', async () => {
        const result = await handleListBashHistory({ limit: 10 });

        const buildCommand = result.commands.find(cmd => cmd.command === 'npm run build');
        const failedCommand = result.commands.find(cmd => cmd.exitCode === 1);

        expect(buildCommand?.summary).toContain('Build successful');
        expect(failedCommand?.summary).toContain('Test suite failed');
      });

      it('should extract command from bash diff', async () => {
        const result = await handleListBashHistory({ limit: 10 });

        expect(result.commands[0]?.command).toBe('npm test');
        expect(result.commands[1]?.command).toBe('git status');
        expect(result.commands[2]?.command).toBe('npm run build');
      });

      it('should extract working directory from bash diff', async () => {
        const result = await handleListBashHistory({ limit: 10 });

        result.commands.forEach(cmd => {
          expect(cmd.workingDirectory).toBe(mockWorkspaceRoot);
        });
      });
    });

    describe('Response format tests', () => {
      it('should return properly formatted ListBashHistoryResponse', async () => {
        const result = await handleListBashHistory({ limit: 10 });

        expect(result).toHaveProperty('commands');
        expect(result).toHaveProperty('totalCount');
        expect(result).toHaveProperty('hasMore');
        expect(result).toHaveProperty('limit');

        expect(Array.isArray(result.commands)).toBe(true);
        expect(typeof result.totalCount).toBe('number');
        expect(typeof result.hasMore).toBe('boolean');
        expect(typeof result.limit).toBe('number');
      });

      it('should respect limit parameter', async () => {
        const result = await handleListBashHistory({ limit: 2 });

        expect(result.commands).toHaveLength(2);
        expect(result.totalCount).toBe(3);
        expect(result.hasMore).toBe(true);
        expect(result.limit).toBe(2);
      });

      it('should use default limit when not provided', async () => {
        const result = await handleListBashHistory({});

        expect(result.commands).toHaveLength(3);
        expect(result.totalCount).toBe(3);
        expect(result.hasMore).toBe(false);
        expect(result.limit).toBe(100); // Default limit
      });

      it('should maintain chronological ordering (newest first)', async () => {
        const result = await handleListBashHistory({ limit: 10 });

        for (let i = 1; i < result.commands.length; i++) {
          const prevTime = new Date(result.commands[i - 1]!.timestamp).getTime();
          const currTime = new Date(result.commands[i]!.timestamp).getTime();
          expect(prevTime).toBeGreaterThanOrEqual(currTime);
        }
      });
    });

    describe('Filtering tests', () => {
      it('should filter only Bash operations from mixed operations', async () => {
        const result = await handleListBashHistory({ limit: 10 });

        expect(result.commands).toHaveLength(3); // Only Bash operations, not Edit
        result.commands.forEach(cmd => {
          expect(cmd.command).toBeDefined(); // All should have command field
        });
      });

      it('should handle empty bash history gracefully', async () => {
        const nonBashOperations = mockBashOperations.filter(op => op.tool !== 'Bash');
        mockLogParser.LogParser.parseLogStream = jest
          .fn()
          .mockReturnValue(nonBashOperations);

        const result = await handleListBashHistory({ limit: 10 });

        expect(result.commands).toHaveLength(0);
        expect(result.totalCount).toBe(0);
        expect(result.hasMore).toBe(false);
      });
    });

    describe('Error handling', () => {
      it('should throw error when session UID is not available', async () => {
        delete process.env['CLAUDE_SESSION_UID'];

        await expect(handleListBashHistory({ limit: 10 })).rejects.toThrow(
          'No active Claude session found'
        );
      });

      it('should throw error when workspace root is not available', async () => {
        delete process.env['CLAUDE_PROJECT_PATH'];

        await expect(handleListBashHistory({ limit: 10 })).rejects.toThrow(
          'Workspace root not available'
        );
      });

      it('should enforce limit constraints', async () => {
        await expect(handleListBashHistory({ limit: 0 })).rejects.toThrow(
          'Limit must be between 1 and 1000'
        );

        await expect(handleListBashHistory({ limit: 2000 })).rejects.toThrow(
          'Limit must be between 1 and 1000'
        );
      });

      it('should handle malformed bash diff gracefully', async () => {
        const malformedOperations = [
          {
            id: 'bash-malformed',
            timestamp: '2024-01-01T10:00:00.000Z',
            tool: 'Bash',
            changeType: ChangeType.UPDATE,
            summary: 'Malformed bash operation',
          },
        ];

        mockLogParser.LogParser.parseLogStream = jest
          .fn()
          .mockReturnValue(malformedOperations);

        // Mock file content without matching raw entry
        mockFs.readFile.mockResolvedValue('{"timestamp":"2024-01-01T09:00:00.000Z","tool":"Other"}');

        const result = await handleListBashHistory({ limit: 10 });

        // Should handle gracefully with fallback data
        expect(result.commands).toHaveLength(1);
        expect(result.commands[0]?.command).toBe('Malformed bash operation'); // Uses summary as fallback
      });

      it('should handle malformed result types gracefully', async () => {
        const bashOperations = [
          {
            id: 'bash-malformed-result',
            timestamp: '2024-01-01T10:00:00.000Z',
            tool: 'Bash',
            changeType: ChangeType.UPDATE,
            summary: 'npm test',
          },
        ];

        mockLogParser.LogParser.parseLogStream = jest
          .fn()
          .mockReturnValue(bashOperations);

        // Mock file content with malformed result types
        const malformedJsonlContent = JSON.stringify({
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Bash',
          parameters: { command: 'npm test' },
          result: {
            stdout: 123, // Should be string, but is number
            stderr: null, // Should be string, but is null
            exitCode: 'failure', // Should be number, but is string
          },
        });

        mockFs.readFile.mockResolvedValue(malformedJsonlContent);

        const result = await handleListBashHistory({ limit: 10 });

        expect(result.commands).toHaveLength(1);
        const command = result.commands[0]!;

        // Should use fallback values for malformed types
        expect(command.command).toBe('npm test');
        expect(command.exitCode).toBe(0); // Should fallback to 0 for non-number exitCode
        expect(command.summary).toBe('Command executed'); // Should fallback when stdout/stderr are not strings
      });

      it('should handle timestamp collisions with composite key matching', async () => {
        const sameTimestamp = '2024-01-01T10:00:00.000Z';
        const bashOperations = [
          {
            id: 'bash-1',
            timestamp: sameTimestamp,
            tool: 'Bash',
            changeType: ChangeType.UPDATE,
            summary: 'git status',
          },
          {
            id: 'bash-2',
            timestamp: sameTimestamp,
            tool: 'Bash',
            changeType: ChangeType.UPDATE,
            summary: 'npm test',
          },
        ];

        mockLogParser.LogParser.parseLogStream = jest
          .fn()
          .mockReturnValue(bashOperations);

        // Mock file content with two different commands at same timestamp
        const jsonlContent = [
          JSON.stringify({
            timestamp: sameTimestamp,
            tool: 'Bash',
            parameters: { command: 'git status' },
            result: { stdout: 'On branch main', stderr: '', exitCode: 0 },
          }),
          JSON.stringify({
            timestamp: sameTimestamp,
            tool: 'Bash',
            parameters: { command: 'npm test' },
            result: { stdout: 'Tests passed', stderr: '', exitCode: 0 },
          }),
        ].join('\n');

        mockFs.readFile.mockResolvedValue(jsonlContent);

        const result = await handleListBashHistory({ limit: 10 });

        expect(result.commands).toHaveLength(2);

        // Should match correctly by timestamp (and verify commands are distinct)
        expect(result.commands[0]?.command).toBeDefined();
        expect(result.commands[1]?.command).toBeDefined();
        expect(result.commands[0]?.command).not.toBe(result.commands[1]?.command);

        // Both commands should have their correct output
        const gitCommand = result.commands.find(cmd => cmd.command === 'git status');
        const npmCommand = result.commands.find(cmd => cmd.command === 'npm test');

        expect(gitCommand?.summary).toContain('On branch main');
        expect(npmCommand?.summary).toContain('Tests passed');
      });
    });
  });

  describe('handleShowBashResult', () => {
    beforeEach(() => {
      mockSessionDiscovery.SessionDiscovery.prototype.findSessionByUID = jest
        .fn()
        .mockResolvedValue({ sessionFile: mockSessionFile });
      mockFs.readFile.mockResolvedValue(mockRawJsonlContent);
      mockLogParser.LogParser.parseLogStream = jest
        .fn()
        .mockReturnValue(mockBashOperations);
    });

    describe('BashResult type tests', () => {
      it('should return detailed bash result with BashResult fields', async () => {
        const result = await handleShowBashResult({ id: 'bash-1' });

        // Test BashResult interface compliance
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('command');
        expect(result).toHaveProperty('exitCode');
        expect(result).toHaveProperty('workingDirectory');
        expect(result).toHaveProperty('stdout');
        expect(result).toHaveProperty('stderr');

        expect(typeof result.id).toBe('string');
        expect(typeof result.timestamp).toBe('string');
        expect(typeof result.command).toBe('string');
        expect(typeof result.exitCode).toBe('number');
        expect(typeof result.workingDirectory).toBe('string');
        expect(typeof result.stdout).toBe('string');
        expect(typeof result.stderr).toBe('string');
      });

      it('should return full stdout and stderr for specified command', async () => {
        const result = await handleShowBashResult({ id: 'bash-3' });

        expect(result.id).toBe('bash-3');
        expect(result.command).toBe('npm test');
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe('Running tests...\n2 tests failed');
        expect(result.stderr).toBe('Error: Test suite failed\nExpected: 5\nReceived: 3');
      });

      it('should handle successful command with empty stderr', async () => {
        const result = await handleShowBashResult({ id: 'bash-1' });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('Build successful\nCompilation completed in 2.3s');
        expect(result.stderr).toBe('');
      });
    });

    describe('Error handling', () => {
      it('should throw error for non-existent command ID', async () => {
        await expect(handleShowBashResult({ id: 'non-existent' })).rejects.toThrow(
          'Bash command with ID non-existent not found'
        );
      });

      it('should throw error for non-bash operation ID', async () => {
        await expect(handleShowBashResult({ id: 'edit-1' })).rejects.toThrow(
          'Operation edit-1 is not a Bash command'
        );
      });

      it('should require valid ID parameter', async () => {
        await expect(handleShowBashResult({ id: '' })).rejects.toThrow(
          'Command ID is required'
        );
      });
    });
  });
});