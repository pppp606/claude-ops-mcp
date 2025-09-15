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

            // Check if this entry contains our UID
            if (
              entry?.type === 'server_response' &&
              entry?.data?.metadata?.uid === uid
            ) {
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
}