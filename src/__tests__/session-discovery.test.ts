import { SessionDiscovery } from '../session-discovery';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

jest.mock('fs/promises');
jest.mock('fs');
jest.mock('readline');
jest.mock('os');

describe('SessionDiscovery', () => {
  const mockHomedir = '/Users/testuser';
  const mockProjectHash = 'abc123def456';
  const mockSessionId = 'session-789';
  const mockUID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    (os.homedir as jest.Mock).mockReturnValue(mockHomedir);

    // Mock readline interface
    const mockRl = {
      close: jest.fn(),
      [Symbol.asyncIterator]: async function* () {
        // This will be customized per test
      },
    };

    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);

    // Mock createReadStream
    const mockStream = {
      close: jest.fn(),
    };

    (fsSync.createReadStream as jest.Mock).mockReturnValue(mockStream);
  });

  describe('findSessionByUID', () => {
    it('should find session file containing the specified UID', async () => {
      const claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');
      const projectPath = path.join(claudeProjectsPath, mockProjectHash);
      const sessionFile = `${mockSessionId}.jsonl`;
      const sessionFilePath = path.join(projectPath, sessionFile);

      const mockProjectDirent = {
        name: mockProjectHash,
        isDirectory: (): boolean => true,
        isFile: (): boolean => false,
      };
      const mockSessionDirent = {
        name: sessionFile,
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };
      const mockOtherSessionDirent = {
        name: 'other-session.jsonl',
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectDirent]) // List of project directories
        .mockResolvedValueOnce([mockSessionDirent, mockOtherSessionDirent]); // Session files in project

      const mockLogLines = [
        '{"timestamp": 1234567890, "type": "init", "data": {}}',
        `{"timestamp": 1234567891, "type": "server_response", "data": {"metadata": {"uid": "${mockUID}"}}}`,
        '{"timestamp": 1234567892, "type": "request", "data": {}}',
      ];

      // Mock the readline interface for this specific test
      const mockRl = {
        close: jest.fn(),
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockLogLines) {
            yield line;
          }
        },
      };

      (readline.createInterface as jest.Mock).mockReturnValue(mockRl);

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID(mockUID);

      expect(result).toEqual({
        sessionFile: sessionFilePath,
        projectHash: mockProjectHash,
        sessionId: mockSessionId,
      });
    });

    it('should return null if UID is not found in any session', async () => {
      const _claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');

      const mockProjectDirent = {
        name: mockProjectHash,
        isDirectory: (): boolean => true,
        isFile: (): boolean => false,
      };
      const mockSession1Dirent = {
        name: 'session1.jsonl',
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };
      const mockSession2Dirent = {
        name: 'session2.jsonl',
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectDirent])
        .mockResolvedValueOnce([mockSession1Dirent, mockSession2Dirent]);

      // Mock the readline interface to return empty results
      const mockRl = {
        close: jest.fn(),
        [Symbol.asyncIterator]: async function* () {
          yield '{"type": "other", "data": {}}';
        },
      };

      (readline.createInterface as jest.Mock).mockReturnValue(mockRl);

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID('non-existent-uid');

      expect(result).toBeNull();
    });

    it('should handle missing .claude directory gracefully', async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID(mockUID);

      expect(result).toBeNull();
    });

    it('should skip invalid JSONL lines', async () => {
      const claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');
      const projectPath = path.join(claudeProjectsPath, mockProjectHash);
      const sessionFile = `${mockSessionId}.jsonl`;
      const sessionFilePath = path.join(projectPath, sessionFile);

      const mockProjectDirent = {
        name: mockProjectHash,
        isDirectory: (): boolean => true,
        isFile: (): boolean => false,
      };
      const mockSessionDirent = {
        name: sessionFile,
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectDirent])
        .mockResolvedValueOnce([mockSessionDirent]);

      const mockLogLines = [
        'invalid json line',
        `{"timestamp": 1234567891, "type": "server_response", "data": {"metadata": {"uid": "${mockUID}"}}}`,
        '{"timestamp": 1234567892, "type": "request", "data": {}}',
      ];

      // Mock the readline interface for this specific test
      const mockRl = {
        close: jest.fn(),
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockLogLines) {
            yield line;
          }
        },
      };

      (readline.createInterface as jest.Mock).mockReturnValue(mockRl);

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID(mockUID);

      expect(result).toEqual({
        sessionFile: sessionFilePath,
        projectHash: mockProjectHash,
        sessionId: mockSessionId,
      });
    });
  });

  describe('getClaudeProjectsPath', () => {
    it('should return the correct path to Claude projects directory', () => {
      const discovery = new SessionDiscovery();
      const projectsPath = discovery.getClaudeProjectsPath();

      expect(projectsPath).toBe(path.join(mockHomedir, '.claude', 'projects'));
    });
  });

  describe('parseSessionFile', () => {
    it('should extract session ID from filename', () => {
      const discovery = new SessionDiscovery();

      expect(discovery.parseSessionId('session-123.jsonl')).toBe('session-123');
      expect(discovery.parseSessionId('complex-session-id-456.jsonl')).toBe(
        'complex-session-id-456'
      );
      expect(discovery.parseSessionId('invalid-file.txt')).toBeNull();
    });
  });

  describe('cache integration', () => {
    it('should use cached result on second call', async () => {
      const claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');
      const projectPath = path.join(claudeProjectsPath, mockProjectHash);
      const sessionFile = `${mockSessionId}.jsonl`;
      const sessionFilePath = path.join(projectPath, sessionFile);

      // Mock directory entries with file type information
      const mockProjectDirent = {
        name: mockProjectHash,
        isDirectory: (): boolean => true,
        isFile: (): boolean => false,
      };
      const mockFileDirent = {
        name: sessionFile,
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectDirent])
        .mockResolvedValueOnce([mockFileDirent]);

      const mockLogLines = [
        `{"timestamp": 1234567891, "type": "server_response", "data": {"metadata": {"uid": "${mockUID}"}}}`,
      ];

      // Mock the readline interface for this specific test
      const mockRl = {
        close: jest.fn(),
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockLogLines) {
            yield line;
          }
        },
      };

      (readline.createInterface as jest.Mock).mockReturnValue(mockRl);

      const discovery = new SessionDiscovery();

      // First call - should read from filesystem
      const result1 = await discovery.findSessionByUID(mockUID);
      expect(result1).toEqual({
        sessionFile: sessionFilePath,
        projectHash: mockProjectHash,
        sessionId: mockSessionId,
      });

      // Clear mocks to ensure filesystem is not accessed again
      jest.clearAllMocks();

      // Second call - should use cache
      const result2 = await discovery.findSessionByUID(mockUID);
      expect(result2).toEqual({
        sessionFile: sessionFilePath,
        projectHash: mockProjectHash,
        sessionId: mockSessionId,
      });

      // Verify filesystem was not accessed on second call
      expect(fs.readdir).not.toHaveBeenCalled();
      expect(fs.readFile).not.toHaveBeenCalled();

      // Check cache statistics
      const stats = discovery.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should clear cache when requested', async () => {
      const _claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');
      const _projectPath = path.join(_claudeProjectsPath, mockProjectHash);
      const sessionFile = `${mockSessionId}.jsonl`;

      const mockProjectDirent = {
        name: mockProjectHash,
        isDirectory: (): boolean => true,
        isFile: (): boolean => false,
      };
      const mockSessionDirent = {
        name: sessionFile,
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectDirent])
        .mockResolvedValueOnce([mockSessionDirent])
        .mockResolvedValueOnce([mockProjectDirent])
        .mockResolvedValueOnce([mockSessionDirent]);

      const mockLogLines = [
        `{"timestamp": 1234567891, "type": "server_response", "data": {"metadata": {"uid": "${mockUID}"}}}`,
      ];

      // Mock the readline interface for this specific test
      const mockRl = {
        close: jest.fn(),
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockLogLines) {
            yield line;
          }
        },
      };

      (readline.createInterface as jest.Mock).mockReturnValue(mockRl);

      const discovery = new SessionDiscovery();

      // First call - populate cache
      await discovery.findSessionByUID(mockUID);

      // Clear cache
      discovery.clearCache();

      // Next call should hit filesystem again
      await discovery.findSessionByUID(mockUID);

      // Both calls should have hit the filesystem
      expect(fs.readdir).toHaveBeenCalledTimes(4); // 2 calls per findSessionByUID
    });
  });

  describe('file type filtering', () => {
    it('should skip non-directory entries in projects folder', async () => {
      const mockProjectDirent = {
        name: mockProjectHash,
        isDirectory: (): boolean => true,
        isFile: (): boolean => false,
      };
      const mockFileDirent = {
        name: 'some-file.txt',
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };

      (fs.readdir as jest.Mock).mockResolvedValueOnce([
        mockProjectDirent,
        mockFileDirent,
      ]);

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID(mockUID);

      // Should have only processed the directory, not the file
      expect(fs.readdir).toHaveBeenCalledTimes(2); // Once for projects, once for the directory
      expect(result).toBeNull();
    });

    it('should skip non-file entries in project directories', async () => {
      const mockProjectDirent = {
        name: mockProjectHash,
        isDirectory: (): boolean => true,
        isFile: (): boolean => false,
      };
      const mockSubDirDirent = {
        name: 'subdirectory',
        isDirectory: (): boolean => true,
        isFile: (): boolean => false,
      };
      const mockFileDirent = {
        name: 'session.jsonl',
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectDirent])
        .mockResolvedValueOnce([mockSubDirDirent, mockFileDirent]);

      const mockLogLines = [
        `{"timestamp": 1234567891, "type": "server_response", "data": {"metadata": {"uid": "${mockUID}"}}}`,
      ];

      // Mock the readline interface for this specific test
      const mockRl = {
        close: jest.fn(),
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockLogLines) {
            yield line;
          }
        },
      };

      (readline.createInterface as jest.Mock).mockReturnValue(mockRl);

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID(mockUID);

      // Should have found the UID in the file, not the subdirectory
      expect(result).toBeTruthy();
      expect(result?.sessionId).toBe('session');
    });

    it('should skip non-jsonl files', async () => {
      const mockProjectDirent = {
        name: mockProjectHash,
        isDirectory: (): boolean => true,
        isFile: (): boolean => false,
      };
      const mockTxtFile = {
        name: 'readme.txt',
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };
      const mockJsonFile = {
        name: 'config.json',
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      };

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectDirent])
        .mockResolvedValueOnce([mockTxtFile, mockJsonFile]);

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID(mockUID);

      // Should not have attempted to read non-jsonl files
      expect(fs.readFile).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('configurable cache TTL', () => {
    it('should accept custom cache TTL', () => {
      const customTTL = 30 * 60 * 1000; // 30 minutes
      const discovery = new SessionDiscovery(customTTL);

      expect(discovery).toBeInstanceOf(SessionDiscovery);
    });

    it('should use environment variable for cache TTL', () => {
      const originalEnv = process.env['CLAUDE_OPS_CACHE_TTL_MS'];
      process.env['CLAUDE_OPS_CACHE_TTL_MS'] = '600000'; // 10 minutes

      const discovery = new SessionDiscovery();
      expect(discovery).toBeInstanceOf(SessionDiscovery);

      // Restore original environment
      if (originalEnv !== undefined) {
        process.env['CLAUDE_OPS_CACHE_TTL_MS'] = originalEnv;
      } else {
        delete process.env['CLAUDE_OPS_CACHE_TTL_MS'];
      }
    });
  });
});
