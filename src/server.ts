import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Implementation } from '@modelcontextprotocol/sdk/types.js';
import { UIDManager } from './uid-manager';
import { SessionDiscovery } from './session-discovery';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  private sessionDiscovery: SessionDiscovery;
  private currentSessionFile: string | null = null;
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
    this.sessionDiscovery = new SessionDiscovery();

    // Generate UID immediately when server is created
    const uid = this.uidManager.initialize();
    UIDManager.setCurrentUID(uid);

    // Identify current session file (with a slight delay to ensure the process is ready)
    setTimeout(() => {
      this.identifyCurrentSession().catch(() => {
        // Silently handle session identification errors
      });
    }, 100);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // No custom handlers needed for now
    // MCP SDK handles basic initialization automatically
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

  private async identifyCurrentSession(): Promise<void> {
    try {
      // Get current working directory from process
      const cwd = process.cwd();

      // Extract project path for Claude projects
      const claudeProjectsPath = this.sessionDiscovery.getClaudeProjectsPath();

      // Find the most recent session file for this project
      const projectHash = this.getProjectHashFromPath(cwd);

      if (!projectHash) {
        return;
      }

      const projectPath = path.join(claudeProjectsPath, projectHash);

      try {
        await fs.access(projectPath);
        const files = await fs.readdir(projectPath, { withFileTypes: true });
        const sessionFiles = files
          .filter(f => f.isFile() && f.name.endsWith('.jsonl'))
          .map(f => ({
            name: f.name,
            fullPath: path.join(projectPath, f.name),
            sessionId: f.name.replace('.jsonl', '')
          }))
          .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (newest first)

        if (sessionFiles.length > 0) {
          // Get the most recent session file
          const latestSession = sessionFiles[0]!; // We know it exists due to length check

          // Check if this session file was recently modified (within last 5 minutes)
          const stats = await fs.stat(latestSession.fullPath);
          const now = new Date();
          const fileModTime = stats.mtime;
          const timeDiff = now.getTime() - fileModTime.getTime();
          const fiveMinutes = 5 * 60 * 1000;

          if (timeDiff < fiveMinutes) {
            this.currentSessionFile = latestSession.fullPath;
          }
        }
      } catch (error) {
        // Silently handle directory access errors
      }
    } catch (error) {
      // Silently handle errors - this is background functionality
    }
  }

  private getProjectHashFromPath(projectPath: string): string | null {
    // Convert project path to Claude's project hash format
    // Claude uses format like: -Users-username-path-to-project
    const normalizedPath = projectPath.replace(/\//g, '-').replace(/^-/, '');
    return `-${normalizedPath}`;
  }

  getCurrentSessionFile(): string | null {
    return this.currentSessionFile;
  }

  // テスト用メソッド - セッション特定状況を確認
  getSessionStatus(): {uid: string | null, sessionFile: string | null} {
    return {
      uid: UIDManager.getCurrentUID(),
      sessionFile: this.currentSessionFile
    };
  }
}