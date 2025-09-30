import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { SessionCache } from './session-cache';
import type { SessionInfo, CacheStats } from './session-cache';

export class SessionDiscovery {
  private claudeProjectsPath: string;
  private cache: SessionCache;

  constructor(cacheTTLMs?: number) {
    this.claudeProjectsPath = this.getClaudeProjectsPath();

    // Use provided TTL, environment variable, or default
    const ttl = cacheTTLMs ??
                (process.env['CLAUDE_OPS_CACHE_TTL_MS'] ? parseInt(process.env['CLAUDE_OPS_CACHE_TTL_MS'], 10) : undefined);

    this.cache = new SessionCache(ttl);
  }

  getClaudeProjectsPath(): string {
    return path.join(os.homedir(), '.claude', 'projects');
  }

  parseSessionId(filename: string): string | null {
    if (!filename.endsWith('.jsonl')) {
      return null;
    }
    return filename.replace('.jsonl', '');
  }

  async findSessionByUID(uid: string): Promise<SessionInfo | null> {
    // Check cache first
    const cachedSession = this.cache.get(uid);
    if (cachedSession) {
      return cachedSession;
    }

    try {
      // Read all project directories with file type information
      const projectDirents = await fs.readdir(this.claudeProjectsPath, { withFileTypes: true });

      for (const dirent of projectDirents) {
        if (!dirent.isDirectory()) {
          continue;
        }

        const projectHash = dirent.name;
        const projectPath = path.join(this.claudeProjectsPath, projectHash);

        try {
          // Read all session files in the project directory with file type information
          const fileDirents = await fs.readdir(projectPath, { withFileTypes: true });

          for (const fileDirent of fileDirents) {
            if (!fileDirent.isFile() || !fileDirent.name.endsWith('.jsonl')) {
              continue;
            }

            const sessionFile = fileDirent.name;

            const sessionFilePath = path.join(projectPath, sessionFile);

            // Use streaming read for memory efficiency
            const found = await this.searchUIDInFile(sessionFilePath, uid);
            if (found) {
              const sessionId = this.parseSessionId(sessionFile);
              if (sessionId) {
                const sessionInfo: SessionInfo = {
                  sessionFile: sessionFilePath,
                  projectHash,
                  sessionId,
                };
                // Store in cache before returning
                this.cache.set(uid, sessionInfo);
                return sessionInfo;
              }
            }
          }
        } catch (projectError) {
          // Skip inaccessible project directories
          continue;
        }
      }

      return null;
    } catch (error) {
      // Handle missing .claude directory or other errors
      return null;
    }
  }

  async findSessionByToolUseId(toolUseId: string, maxRetries: number = 2): Promise<SessionInfo | null> {
    // Check cache first (use toolUseId as cache key)
    const cachedSession = this.cache.get(toolUseId);
    if (cachedSession) {
      return cachedSession;
    }

    // Try multiple times with delay between attempts
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Wait before retry (75ms)
        await new Promise(resolve => setTimeout(resolve, 75));
      }

      try {
        // Read all project directories with file type information
        const projectDirents = await fs.readdir(this.claudeProjectsPath, { withFileTypes: true });

        for (const dirent of projectDirents) {
          if (!dirent.isDirectory()) {
            continue;
          }

          const projectHash = dirent.name;
          const projectPath = path.join(this.claudeProjectsPath, projectHash);

          try {
            // Read all session files in the project directory with file type information
            const fileDirents = await fs.readdir(projectPath, { withFileTypes: true });

            for (const fileDirent of fileDirents) {
              if (!fileDirent.isFile() || !fileDirent.name.endsWith('.jsonl')) {
                continue;
              }

              const sessionFile = fileDirent.name;
              const sessionFilePath = path.join(projectPath, sessionFile);

              // Search for toolUseId in file
              const found = await this.searchToolUseIdInFile(sessionFilePath, toolUseId);
              if (found) {
                const sessionId = this.parseSessionId(sessionFile);
                if (sessionId) {
                  const sessionInfo: SessionInfo = {
                    sessionFile: sessionFilePath,
                    projectHash,
                    sessionId,
                  };
                  // Store in cache before returning
                  this.cache.set(toolUseId, sessionInfo);
                  return sessionInfo;
                }
              }
            }
          } catch (projectError) {
            // Skip inaccessible project directories
            continue;
          }
        }
      } catch (error) {
        // Continue to next retry
        continue;
      }
    }

    // All attempts failed
    return null;
  }

  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  clearCache() {
    this.cache.clear();
  }

  private async searchUIDInFile(filePath: string, uid: string): Promise<boolean> {
    try {
      const stream = createReadStream(filePath, { encoding: 'utf-8' });
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      try {
        for await (const line of rl) {
          if (!line.trim()) {
            continue;
          }

          try {
            const entry = JSON.parse(line);

            // Check if this entry contains our UID in various formats
            if (this.containsUID(entry, uid)) {
              // Found the UID, close streams and return immediately
              rl.close();
              stream.close();
              return true;
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      } finally {
        rl.close();
        stream.close();
      }

      return false;
    } catch (error) {
      // Handle file read errors
      return false;
    }
  }

  private async searchToolUseIdInFile(filePath: string, toolUseId: string): Promise<boolean> {
    try {
      const stream = createReadStream(filePath, { encoding: 'utf-8' });
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      try {
        for await (const line of rl) {
          if (!line.trim()) {
            continue;
          }

          try {
            const entry = JSON.parse(line);

            // Check tool_result format: {"tool_use_id": "toolu_xxx", "type": "tool_result", ...}
            if (entry.tool_use_id === toolUseId) {
              rl.close();
              stream.close();
              return true;
            }

            // Check tool_use format: {"message": {"content": [{"type": "tool_use", "id": "toolu_xxx", ...}]}}
            if (entry.message?.content) {
              const content = entry.message.content;
              if (Array.isArray(content)) {
                for (const item of content) {
                  if (item?.type === 'tool_use' && item?.id === toolUseId) {
                    rl.close();
                    stream.close();
                    return true;
                  }
                }
              }
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      } finally {
        rl.close();
        stream.close();
      }

      return false;
    } catch (error) {
      // Handle file read errors
      return false;
    }
  }

  private containsUID(obj: any, uid: string): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    // Direct string comparison
    if (typeof obj === 'string' && obj === uid) {
      return true;
    }

    // Check for UID in common locations
    if (obj.uid === uid) {
      return true;
    }

    // Check server_response format
    if (obj?.type === 'server_response' && obj?.data?.metadata?.uid === uid) {
      return true;
    }

    // Check tool_result content for embedded JSON
    if (obj?.type === 'tool_result' && Array.isArray(obj?.content)) {
      for (const item of obj.content) {
        if (item?.type === 'text' && typeof item?.text === 'string') {
          try {
            // Try to parse the text as JSON and search recursively
            const parsed = JSON.parse(item.text);
            if (this.containsUID(parsed, uid)) {
              return true;
            }
          } catch {
            // If not valid JSON, check if it contains the UID as a substring
            if (item.text.includes(uid)) {
              return true;
            }
          }
        }
      }
    }

    // Recursively search all object values
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (this.containsUID(value, uid)) {
          return true;
        }
      } else if (value === uid) {
        return true;
      }
    }

    return false;
  }
}