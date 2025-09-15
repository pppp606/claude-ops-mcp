import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Implementation } from '@modelcontextprotocol/sdk/types.js';
import { UIDManager } from './uid-manager';

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
  private uidManager: UIDManager;
  private static readonly SUPPORTED_PROTOCOL_VERSION = '2024-11-05';

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
    this.uidManager = new UIDManager();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // The SDK handles initialization internally, but we can add custom logic here if needed
    // TODO: Add request handlers for tools, resources, and prompts
    // Example: this.server.setRequestHandler('tools/list', this.handleToolsList.bind(this));
    // Example: this.server.setRequestHandler('resources/list', this.handleResourcesList.bind(this));
    // Example: this.server.setRequestHandler('prompts/list', this.handlePromptsList.bind(this));
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
    const requested = request.protocolVersion;
    const protocolVersion = requested ?? MCPServer.SUPPORTED_PROTOCOL_VERSION;

    // Generate and store UID for this session
    const uid = this.uidManager.initialize();
    const metadata = this.uidManager.getMetadata();

    // Log UID to stdout so it appears in Claude Code logs
    console.log(`[claude-ops-mcp] Session UID: ${uid}`);

    // Store UID globally for future access
    UIDManager.setCurrentUID(uid);

    // TODO: Add protocol version validation and error handling for unsupported versions
    return {
      protocolVersion,
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