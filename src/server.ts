import { Server } from '@modelcontextprotocol/sdk/server/index';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import type { Implementation } from '@modelcontextprotocol/sdk/types';

interface ServerCapabilities {
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
}

interface InitializeRequest {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  clientInfo: {
    name: string;
    version: string;
  };
}

interface InitializeResult {
  protocolVersion: string;
  serverInfo: Implementation;
  capabilities: ServerCapabilities;
}

export class MCPServer {
  private server: Server;
  private serverInfo: Implementation;
  private capabilities: ServerCapabilities;

  constructor() {
    this.serverInfo = {
      name: 'claude-ops-mcp',
      version: '0.1.0',
    };

    this.capabilities = {
      tools: {},
      resources: {},
      prompts: {},
    };

    this.server = new Server(this.serverInfo);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // The SDK handles initialization internally, but we can add custom logic here if needed
  }

  getServer(): Server {
    return this.server;
  }

  async getServerInfo(): Promise<Implementation> {
    return this.serverInfo;
  }

  async getName(): Promise<string> {
    return this.serverInfo.name;
  }

  async getCapabilities(): Promise<ServerCapabilities> {
    return this.capabilities;
  }

  async handleInitialize(request: InitializeRequest): Promise<InitializeResult> {
    return {
      protocolVersion: request.protocolVersion,
      serverInfo: this.serverInfo,
      capabilities: this.capabilities,
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async stop(): Promise<void> {
    await this.server.close();
  }
}