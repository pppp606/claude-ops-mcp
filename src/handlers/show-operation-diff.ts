import { SessionDiscovery } from '../session-discovery';
import { UIDManager } from '../uid-manager';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as readline from 'readline';

export interface ShowOperationDiffParams {
  id: string;
  toolUseId?: string;
}

export interface OperationDiffResponse {
  id: string;
  timestamp: string;
  tool: string;
  filePath?: string;
  diff?: {
    oldString?: string;
    newString?: string;
    unified?: string;
  };
  bash?: {
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number;
  };
  _debug?: {
    hasToolResult: boolean;
    toolResultKeys?: string[];
    toolUseResultKeys?: string[];
  };
}

interface ClaudeCodeLogEntry {
  type: string;
  timestamp: string;
  message?: {
    content?: Array<{
      type: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
    }>;
  };
  tool_use_id?: string;
  toolUseResult?: Record<string, unknown>;
}

/**
 * Finds a log entry by tool use ID in the session file
 */
async function findLogEntryById(
  sessionFile: string,
  operationId: string
): Promise<{ toolUse: ClaudeCodeLogEntry | null; toolResult: ClaudeCodeLogEntry | null }> {
  const stream = createReadStream(sessionFile, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let toolUse: ClaudeCodeLogEntry | null = null;
  let toolResult: ClaudeCodeLogEntry | null = null;

  try {
    for await (const line of rl) {
      if (!line.trim()) {
        continue;
      }

      try {
        const entry: ClaudeCodeLogEntry = JSON.parse(line);

        // Look for tool_use entry
        if (entry.type === 'assistant' && entry.message?.content) {
          const toolUseItem = entry.message.content.find(
            item => item.type === 'tool_use' && item.id === operationId
          );
          if (toolUseItem) {
            toolUse = entry;
          }
        }

        // Look for tool_result entry (can be in two formats)
        // Format 1: Direct tool_use_id field
        if (entry.tool_use_id === operationId) {
          toolResult = entry;
        }

        // Format 2: Inside message.content array
        if (entry.type === 'user' && entry.message?.content) {
          const toolResultItem = entry.message.content.find(
            item => item.tool_use_id === operationId
          );
          if (toolResultItem) {
            toolResult = entry;
          }
        }

        // If we found both, we can stop
        if (toolUse && toolResult) {
          break;
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

  return { toolUse, toolResult };
}

/**
 * Handler for the showOperationDiff MCP tool
 * Returns detailed diff information for a specific operation
 */
export async function handleShowOperationDiff(
  params: ShowOperationDiffParams
): Promise<OperationDiffResponse> {
  // Validate operation ID
  if (!params.id || params.id.trim() === '') {
    throw new Error('Operation ID is required');
  }

  // Try to get cached session file first
  let sessionFile = UIDManager.getCachedSessionFile();

  if (!sessionFile) {
    // Not cached yet - try to find it using toolUseId
    if (!params.toolUseId) {
      throw new Error('Tool use ID not provided by Claude Code');
    }

    const sessionDiscovery = new SessionDiscovery();
    const sessionInfo = await sessionDiscovery.findSessionByToolUseId(params.toolUseId);

    if (!sessionInfo || !sessionInfo.sessionFile) {
      throw new Error(`Session file not found for tool use ID: ${params.toolUseId}`);
    }

    // Found the session file - cache it for future calls
    sessionFile = sessionInfo.sessionFile;
    UIDManager.setCachedSessionFile(sessionFile);
  }

  // Find the log entries for this operation
  const { toolUse, toolResult } = await findLogEntryById(sessionFile, params.id);

  if (!toolUse) {
    throw new Error(`Operation with ID ${params.id} not found`);
  }

  // Extract tool information
  const toolUseContent = toolUse.message?.content?.find(
    item => item.type === 'tool_use' && item.id === params.id
  );

  if (!toolUseContent) {
    throw new Error(`Tool use content not found for operation ${params.id}`);
  }

  const tool = toolUseContent.name || 'Unknown';
  const input = toolUseContent.input || {};
  const timestamp = toolUse.timestamp;

  // Build base response
  const response: OperationDiffResponse = {
    id: params.id,
    timestamp,
    tool,
    _debug: {
      hasToolResult: !!toolResult,
      ...(toolResult && { toolResultKeys: Object.keys(toolResult) }),
      ...(toolResult?.toolUseResult && { toolUseResultKeys: Object.keys(toolResult.toolUseResult) }),
    },
  };

  // Extract file path if available
  const filePath = (input['file_path'] || input['filePath'] || input['path']) as string | undefined;
  if (filePath) {
    response.filePath = filePath;
  }

  // Process tool-specific diff information
  if (toolResult?.toolUseResult) {
    const result = toolResult.toolUseResult;

    // Handle Edit/Write tools
    if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') {
      const oldString = result['oldString'] as string | undefined;
      const newString = result['newString'] as string | undefined;
      const structuredPatch = result['structuredPatch'] as any;

      response.diff = {};

      if (oldString !== undefined) {
        response.diff.oldString = oldString;
      }
      if (newString !== undefined) {
        response.diff.newString = newString;
      }

      // Generate unified diff if we have old and new strings
      if (oldString !== undefined && newString !== undefined) {
        const oldLines = oldString.split('\n');
        const newLines = newString.split('\n');

        // Simple unified diff format
        let unified = `--- ${filePath || 'original'}\n+++ ${filePath || 'modified'}\n`;
        const maxLines = Math.max(oldLines.length, newLines.length);

        for (let i = 0; i < maxLines; i++) {
          const oldLine = oldLines[i];
          const newLine = newLines[i];

          if (oldLine !== newLine) {
            if (oldLine !== undefined) {
              unified += `-${oldLine}\n`;
            }
            if (newLine !== undefined) {
              unified += `+${newLine}\n`;
            }
          } else if (oldLine !== undefined) {
            unified += ` ${oldLine}\n`;
          }
        }

        response.diff.unified = unified;
      }
    }

    // Handle Bash tool
    if (tool === 'Bash') {
      const command = input['command'] as string;
      const stdout = result['stdout'] as string || '';
      const stderr = result['stderr'] as string || '';
      const exitCode = result['exitCode'] as number || 0;

      response.bash = {
        command,
        stdout,
        stderr,
        exitCode,
      };
    }
  }

  return response;
}