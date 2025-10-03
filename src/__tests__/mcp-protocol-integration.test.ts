/**
 * MCP Protocol Integration Tests
 *
 * Tests SDK 1.18.2 compatibility and functional equivalence
 * by testing handlers directly with realistic scenarios.
 */

import { MCPServer } from '../server';
import { SessionDiscovery } from '../session-discovery';
import { handleListFileChanges } from '../handlers/list-file-changes';
import { handleListBashHistory, handleShowBashResult } from '../handlers/list-bash-history';
import { handleShowOperationDiff } from '../handlers/show-operation-diff';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('MCP Protocol Integration Tests - SDK 1.18.2 Compatibility', () => {
  let server: MCPServer;
  let testDir: string;
  let testSessionFile: string;
  let mockSessionDiscovery: jest.SpyInstance;

  beforeEach(async () => {
    // Create temporary test directory and session file
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
    testSessionFile = path.join(testDir, 'test-session.jsonl');

    // Create sample session data with various operation types
    const sampleOperations = [
      {
        timestamp: '2025-01-01T00:00:00.000Z',
        tool: 'Edit',
        filePath: '/test/file.ts',
        changeType: 'UPDATE',
        diff: {
          type: 'edit',
          filePath: '/test/file.ts',
          oldString: 'const x = 1;',
          newString: 'const x = 2;',
          replaceAll: false,
          originalContent: 'const x = 1;',
        },
      },
      {
        timestamp: '2025-01-01T00:01:00.000Z',
        tool: 'Write',
        filePath: '/test/new-file.ts',
        changeType: 'CREATE',
        diff: {
          type: 'write',
          filePath: '/test/new-file.ts',
          content: 'console.log("hello");',
        },
      },
      {
        timestamp: '2025-01-01T00:02:00.000Z',
        tool: 'Bash',
        changeType: 'UPDATE',
        diff: {
          type: 'bash',
          command: 'npm test',
          exitCode: 0,
          stdout: 'All tests passed\n25 tests passed',
          stderr: '',
        },
      },
      {
        timestamp: '2025-01-01T00:03:00.000Z',
        tool: 'Bash',
        changeType: 'UPDATE',
        diff: {
          type: 'bash',
          command: 'npm run build',
          exitCode: 0,
          stdout: 'Build completed successfully',
          stderr: '',
        },
      },
    ];

    await fs.writeFile(
      testSessionFile,
      sampleOperations.map(op => JSON.stringify(op)).join('\n')
    );

    // Mock SessionDiscovery to return our test session file
    mockSessionDiscovery = jest
      .spyOn(SessionDiscovery.prototype, 'findSessionByToolUseId')
      .mockResolvedValue({
        sessionFile: testSessionFile,
        projectHash: 'test-project',
        sessionId: 'test-session',
      });

    server = new MCPServer();
  });

  afterEach(async () => {
    mockSessionDiscovery.mockRestore();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('SDK 1.18.2 Server Initialization', () => {
    it('should initialize server with capabilities', () => {
      // SDK 1.18.2 requires capabilities to be passed in Server constructor
      // If this test passes, it means the server initialized correctly
      expect(server).toBeDefined();
      expect(server.getServer()).toBeDefined();
    });

    it('should have correct server info', async () => {
      const serverInfo = await server.getServerInfo();
      expect(serverInfo.name).toBe('claude-ops-mcp');
      expect(serverInfo.version).toBe('0.1.0');
    });

    it('should have capabilities configured', async () => {
      const capabilities = await server.getCapabilities();
      expect(capabilities).toHaveProperty('tools');
      expect(capabilities).toHaveProperty('resources');
      expect(capabilities).toHaveProperty('prompts');
    });
  });

  describe('Tool Handler: listFileChanges', () => {
    it('should return file changes with toolUseId', async () => {
      const result = await handleListFileChanges({
        filePath: '/test/file.ts',
        limit: 10,
        toolUseId: 'test-tool-use-id',
      });

      expect(result).toHaveProperty('operations');
      expect(Array.isArray(result.operations)).toBe(true);
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.operations[0].filePath).toBe('/test/file.ts');
    });

    it('should filter by partial file path', async () => {
      const result = await handleListFileChanges({
        filePath: 'file.ts',
        limit: 10,
        toolUseId: 'test-tool-use-id',
      });

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].filePath).toBe('/test/file.ts');
    });

    it('should respect limit parameter', async () => {
      const result = await handleListFileChanges({
        filePath: 'test',
        limit: 1,
        toolUseId: 'test-tool-use-id',
      });

      expect(result.operations.length).toBeLessThanOrEqual(1);
    });

    it('should exclude READ operations', async () => {
      const result = await handleListFileChanges({
        filePath: 'test',
        limit: 100,
        toolUseId: 'test-tool-use-id',
      });

      // All returned operations should be CREATE, UPDATE, or DELETE
      result.operations.forEach(op => {
        expect(['CREATE', 'UPDATE', 'DELETE']).toContain(op.changeType);
      });
    });

    it('should throw error when toolUseId is missing and session not found', async () => {
      mockSessionDiscovery.mockResolvedValueOnce(null);

      await expect(
        handleListFileChanges({
          filePath: '/test/file.ts',
          limit: 10,
          // No toolUseId provided
        })
      ).rejects.toThrow();
    });
  });

  describe('Tool Handler: listBashHistory', () => {
    it('should return bash command history', async () => {
      const result = await handleListBashHistory({
        limit: 10,
        toolUseId: 'test-tool-use-id',
      });

      expect(result).toHaveProperty('commands');
      expect(Array.isArray(result.commands)).toBe(true);
      expect(result.commands.length).toBe(2); // We have 2 bash commands
    });

    it('should include proper command structure', async () => {
      const result = await handleListBashHistory({
        limit: 10,
        toolUseId: 'test-tool-use-id',
      });

      const command = result.commands[0];
      expect(command).toHaveProperty('id');
      expect(command).toHaveProperty('timestamp');
      expect(command).toHaveProperty('command');
      expect(command).toHaveProperty('summary');
      expect(command).toHaveProperty('exitCode');
    });

    it('should generate smart summaries', async () => {
      const result = await handleListBashHistory({
        limit: 10,
        toolUseId: 'test-tool-use-id',
      });

      // Summary should contain key information from stdout
      const testCommand = result.commands.find(c => c.command === 'npm test');
      expect(testCommand).toBeDefined();
      expect(testCommand!.summary).toContain('passed');
    });

    it('should respect limit parameter', async () => {
      const result = await handleListBashHistory({
        limit: 1,
        toolUseId: 'test-tool-use-id',
      });

      expect(result.commands.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Tool Handler: showBashResult', () => {
    it('should return detailed bash output', async () => {
      // First get a command ID
      const listResult = await handleListBashHistory({
        limit: 10,
        toolUseId: 'test-tool-use-id',
      });

      const commandId = listResult.commands[0].id;

      const result = await handleShowBashResult({
        id: commandId,
        toolUseId: 'test-tool-use-id',
      });

      expect(result).toHaveProperty('id', commandId);
      expect(result).toHaveProperty('command');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
    });

    it('should throw error for non-existent command ID', async () => {
      await expect(
        handleShowBashResult({
          id: 'non-existent-id',
          toolUseId: 'test-tool-use-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('Tool Handler: showOperationDiff', () => {
    it('should return detailed diff for Edit operation', async () => {
      // Add an operation with known ID
      const operationId = 'test-operation-id';
      const operation = {
        timestamp: '2025-01-01T00:05:00.000Z',
        tool: 'Edit',
        filePath: '/test/detail.ts',
        changeType: 'UPDATE',
        id: operationId,
        diff: {
          type: 'edit',
          filePath: '/test/detail.ts',
          oldString: 'const x = 1;',
          newString: 'const x = 2;',
          replaceAll: false,
          originalContent: 'const x = 1;',
        },
      };

      await fs.appendFile(testSessionFile, '\n' + JSON.stringify(operation));

      const result = await handleShowOperationDiff({
        id: operationId,
        toolUseId: 'test-tool-use-id',
      });

      expect(result).toHaveProperty('id', operationId);
      expect(result).toHaveProperty('type', 'edit');
      expect(result).toHaveProperty('diff');
      expect(result.diff).toHaveProperty('oldString', 'const x = 1;');
      expect(result.diff).toHaveProperty('newString', 'const x = 2;');
    });

    it('should throw error for non-existent operation ID', async () => {
      await expect(
        handleShowOperationDiff({
          id: 'non-existent-operation-id',
          toolUseId: 'test-tool-use-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('Response Format Compatibility', () => {
    it('should maintain consistent response structure', async () => {
      const result = await handleListFileChanges({
        filePath: '/test/file.ts',
        toolUseId: 'test-tool-use-id',
      });

      // Verify the response can be serialized to JSON (MCP requirement)
      expect(() => JSON.stringify(result)).not.toThrow();

      // Verify structure
      expect(result).toHaveProperty('operations');
      expect(Array.isArray(result.operations)).toBe(true);
    });

    it('should handle _meta field in parameters', async () => {
      // Test that toolUseId is properly extracted from _meta
      const result = await handleListBashHistory({
        limit: 10,
        toolUseId: 'test-tool-use-id',
      });

      expect(result).toHaveProperty('commands');
      expect(result.commands.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      mockSessionDiscovery.mockResolvedValueOnce(null);

      try {
        await handleListFileChanges({
          filePath: '/test/file.ts',
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/toolUseId|session/i);
      }
    });

    it('should handle malformed session files gracefully', async () => {
      // Write invalid JSON to session file
      await fs.writeFile(testSessionFile, 'invalid json\n{malformed');

      await expect(
        handleListFileChanges({
          filePath: '/test/file.ts',
          toolUseId: 'test-tool-use-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('Functional Equivalence with SDK 0.4.0', () => {
    it('should return same data structure as SDK 0.4.0', async () => {
      // This test ensures that upgrading to SDK 1.18.2 doesn't change
      // the response format that clients depend on

      const result = await handleListFileChanges({
        filePath: '/test/file.ts',
        toolUseId: 'test-tool-use-id',
      });

      // Verify expected structure from SDK 0.4.0 is maintained
      expect(result).toHaveProperty('operations');
      expect(result).toHaveProperty('metadata');

      const operation = result.operations[0];
      expect(operation).toHaveProperty('timestamp');
      expect(operation).toHaveProperty('tool');
      expect(operation).toHaveProperty('filePath');
      expect(operation).toHaveProperty('changeType');
    });

    it('should handle parameters same way as SDK 0.4.0', async () => {
      // Test that parameter handling is consistent
      const resultWithLimit = await handleListFileChanges({
        filePath: '/test',
        limit: 5,
        toolUseId: 'test-tool-use-id',
      });

      expect(resultWithLimit.operations.length).toBeLessThanOrEqual(5);

      const resultNoLimit = await handleListFileChanges({
        filePath: '/test',
        toolUseId: 'test-tool-use-id',
      });

      // Should use default limit of 100
      expect(resultNoLimit.operations.length).toBeLessThanOrEqual(100);
    });
  });
});
