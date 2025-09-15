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

    it('should include UID in initialization response', async () => {
      const server = new MCPServer();
      const initResponse = await server.handleInitialize({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      expect(initResponse).toHaveProperty('metadata');
      expect(initResponse.metadata).toHaveProperty('uid');
      expect(initResponse.metadata).toBeDefined();
      expect(typeof initResponse.metadata?.uid).toBe('string');
      expect(initResponse.metadata?.uid.length).toBeGreaterThan(0);
    });

    it('should generate different UIDs for different server instances', async () => {
      const server1 = new MCPServer();
      const initResponse1 = await server1.handleInitialize({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      const server2 = new MCPServer();
      const initResponse2 = await server2.handleInitialize({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      expect(initResponse1.metadata).toBeDefined();
      expect(initResponse2.metadata).toBeDefined();
      expect(initResponse1.metadata?.uid).not.toBe(initResponse2.metadata?.uid);
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