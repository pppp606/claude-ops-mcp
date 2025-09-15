import { SessionDiscovery } from '../session-discovery';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

jest.mock('fs/promises');
jest.mock('os');

describe('SessionDiscovery', () => {
  const mockHomedir = '/Users/testuser';
  const mockProjectHash = 'abc123def456';
  const mockSessionId = 'session-789';
  const mockUID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    (os.homedir as jest.Mock).mockReturnValue(mockHomedir);
  });

  describe('findSessionByUID', () => {
    it('should find session file containing the specified UID', async () => {
      const claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');
      const projectPath = path.join(claudeProjectsPath, mockProjectHash);
      const sessionFile = `${mockSessionId}.jsonl`;
      const sessionFilePath = path.join(projectPath, sessionFile);

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectHash]) // List of project directories
        .mockResolvedValueOnce([sessionFile, 'other-session.jsonl']); // Session files in project

      const mockLogContent = [
        '{"timestamp": 1234567890, "type": "init", "data": {}}',
        `{"timestamp": 1234567891, "type": "server_response", "data": {"metadata": {"uid": "${mockUID}"}}}`,
        '{"timestamp": 1234567892, "type": "request", "data": {}}',
      ].join('\n');

      (fs.readFile as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath === sessionFilePath) {
          return Promise.resolve(mockLogContent);
        }
        return Promise.resolve('{"type": "other", "data": {}}');
      });

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID(mockUID);

      expect(result).toEqual({
        sessionFile: sessionFilePath,
        projectHash: mockProjectHash,
        sessionId: mockSessionId,
      });
    });

    it('should return null if UID is not found in any session', async () => {
      const claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectHash])
        .mockResolvedValueOnce(['session1.jsonl', 'session2.jsonl']);

      (fs.readFile as jest.Mock).mockResolvedValue('{"type": "other", "data": {}}');

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID('non-existent-uid');

      expect(result).toBeNull();
    });

    it('should handle missing .claude directory gracefully', async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const discovery = new SessionDiscovery();
      const result = await discovery.findSessionByUID(mockUID);

      expect(result).toBeNull();
    });

    it('should skip invalid JSONL lines', async () => {
      const claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');
      const projectPath = path.join(claudeProjectsPath, mockProjectHash);
      const sessionFile = `${mockSessionId}.jsonl`;
      const sessionFilePath = path.join(projectPath, sessionFile);

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectHash])
        .mockResolvedValueOnce([sessionFile]);

      const mockLogContent = [
        'invalid json line',
        `{"timestamp": 1234567891, "type": "server_response", "data": {"metadata": {"uid": "${mockUID}"}}}`,
        '{"timestamp": 1234567892, "type": "request", "data": {}}',
      ].join('\n');

      (fs.readFile as jest.Mock).mockResolvedValue(mockLogContent);

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
      expect(discovery.parseSessionId('complex-session-id-456.jsonl')).toBe('complex-session-id-456');
      expect(discovery.parseSessionId('invalid-file.txt')).toBeNull();
    });
  });

  describe('cache integration', () => {
    it('should use cached result on second call', async () => {
      const claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');
      const projectPath = path.join(claudeProjectsPath, mockProjectHash);
      const sessionFile = `${mockSessionId}.jsonl`;
      const sessionFilePath = path.join(projectPath, sessionFile);

      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([mockProjectHash])
        .mockResolvedValueOnce([sessionFile]);

      const mockLogContent = `{"timestamp": 1234567891, "type": "server_response", "data": {"metadata": {"uid": "${mockUID}"}}}`;
      (fs.readFile as jest.Mock).mockResolvedValue(mockLogContent);

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
      const claudeProjectsPath = path.join(mockHomedir, '.claude', 'projects');
      const projectPath = path.join(claudeProjectsPath, mockProjectHash);
      const sessionFile = `${mockSessionId}.jsonl`;

      (fs.readdir as jest.Mock)
        .mockResolvedValue([mockProjectHash])
        .mockResolvedValue([sessionFile]);

      const mockLogContent = `{"timestamp": 1234567891, "type": "server_response", "data": {"metadata": {"uid": "${mockUID}"}}}`;
      (fs.readFile as jest.Mock).mockResolvedValue(mockLogContent);

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
});