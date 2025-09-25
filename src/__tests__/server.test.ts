// Mock the MCP SDK modules
jest.mock('@modelcontextprotocol/sdk/server/index', () => ({
  Server: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio', () => ({
  StdioServerTransport: jest.fn(),
}));

import { MCPServer } from '../server';
import { UIDManager } from '../uid-manager';

describe('MCPServer', () => {
  describe('initialization', () => {
    it('should create an instance of MCPServer', () => {
      const server = new MCPServer();
      expect(server).toBeInstanceOf(MCPServer);
    });

    it('should have an underlying MCP SDK server instance', () => {
      const server = new MCPServer();
      expect(server.getServer()).toBeDefined();
      expect(server.getServer()).toHaveProperty('connect');
      expect(server.getServer()).toHaveProperty('close');
    });

    it('should be initialized with proper server info', async () => {
      const server = new MCPServer();
      const serverInfo = await server.getServerInfo();

      expect(serverInfo).toEqual({
        name: 'claude-ops-mcp',
        version: '0.1.0',
      });
    });
  });

  describe('server name recognition', () => {
    it('should identify itself as claude-ops-mcp', async () => {
      const server = new MCPServer();
      const name = await server.getName();
      expect(name).toBe('claude-ops-mcp');
    });

    it('should return the correct server capabilities', async () => {
      const server = new MCPServer();
      const capabilities = await server.getCapabilities();

      expect(capabilities).toHaveProperty('tools');
      expect(capabilities).toHaveProperty('resources');
      expect(capabilities).toHaveProperty('prompts');
    });
  });

  describe('initialization response', () => {
    it('should handle initialization request properly', async () => {
      const server = new MCPServer();
      const initResponse = await server.handleInitialize({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      expect(initResponse).toHaveProperty('protocolVersion');
      expect(initResponse).toHaveProperty('serverInfo');
      expect(initResponse.serverInfo.name).toBe('claude-ops-mcp');
      expect(initResponse).toHaveProperty('capabilities');
    });

    it('should log UID during initialization', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const server = new MCPServer();

      await server.handleInitialize({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[claude-ops-mcp\] Session UID: [0-9a-f-]{36}/)
      );

      consoleSpy.mockRestore();
    });

    it('should set global UID during initialization', async () => {
      const server = new MCPServer();

      // Clear any existing UID
      UIDManager.setCurrentUID('');
      expect(UIDManager.getCurrentUID()).toBe('');

      await server.handleInitialize({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      const currentUID = UIDManager.getCurrentUID();
      expect(currentUID).toBeTruthy();
      expect(typeof currentUID).toBe('string');
      expect(currentUID?.length).toBeGreaterThan(0);
    });

    it('should return supported protocol version', async () => {
      const server = new MCPServer();
      const initResponse = await server.handleInitialize({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      expect(initResponse.protocolVersion).toBe('2024-11-05');
    });

    it('should handle initialization with empty capabilities', async () => {
      const server = new MCPServer();
      const initResponse = await server.handleInitialize({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      expect(initResponse.capabilities).toBeDefined();
      expect(initResponse.capabilities.tools).toBeDefined();
    });
  });

  describe('server lifecycle', () => {
    it('should start the server without errors', async () => {
      const server = new MCPServer();
      await expect(server.start()).resolves.not.toThrow();
    });

    it('should stop the server gracefully', async () => {
      const server = new MCPServer();
      await server.start();
      await expect(server.stop()).resolves.not.toThrow();
    });
  });
});
