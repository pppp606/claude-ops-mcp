import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionCache } from './session-cache';
import type { SessionInfo, CacheStats } from './session-cache';

export class SessionDiscovery {
  private claudeProjectsPath: string;
  private cache: SessionCache;

  constructor() {
    this.claudeProjectsPath = this.getClaudeProjectsPath();
    this.cache = new SessionCache();
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
      // Read all project directories
      const projectDirs = await fs.readdir(this.claudeProjectsPath);

      for (const projectHash of projectDirs) {
        const projectPath = path.join(this.claudeProjectsPath, projectHash);

        try {
          // Read all session files in the project directory
          const sessionFiles = await fs.readdir(projectPath);

          for (const sessionFile of sessionFiles) {
            if (!sessionFile.endsWith('.jsonl')) {
              continue;
            }

            const sessionFilePath = path.join(projectPath, sessionFile);

            // Read and check the session file for the UID
            const content = await fs.readFile(sessionFilePath, 'utf-8');
            const lines = content.split('\n');

            for (const line of lines) {
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
              } catch (parseError) {
                // Skip invalid JSON lines
                continue;
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
}