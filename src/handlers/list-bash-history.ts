import type { OperationIndex } from '../types/operation-index';
import { SessionDiscovery } from '../session-discovery';
import { LogParser } from '../parsers/log-parser';
import * as fs from 'fs/promises';

export interface ListBashHistoryParams {
  limit?: number;
}

export interface ListBashHistoryResponse {
  commands: BashHistoryItem[];
  totalCount: number;
  hasMore: boolean;
  limit: number;
}

export interface BashHistoryItem {
  id: string;
  timestamp: string;
  command: string;
  exitCode: number;
  workingDirectory: string;
  summary: string;
}

export interface ShowBashResultParams {
  id: string;
}

export interface BashResult {
  id: string;
  timestamp: string;
  command: string;
  exitCode: number;
  workingDirectory: string;
  stdout: string;
  stderr: string;
}

function validateLimit(limit?: number): number {
  const defaultLimit = 100;
  if (limit === undefined) {return defaultLimit;}

  if (limit < 1 || limit > 1000) {
    throw new Error('Limit must be between 1 and 1000');
  }

  return limit;
}

function generateSummary(bashInfo: { stdout: string; stderr: string; exitCode: number }): string {
  const { stdout, stderr, exitCode } = bashInfo;

  if (exitCode !== 0 && stderr) {
    // For failed commands, prioritize stderr content
    const errorLines = stderr.split('\n').filter(line => line.trim());
    if (errorLines.length > 0) {
      return errorLines[0] || 'Command failed';
    }
  }

  if (stdout) {
    // For successful commands or when stderr is empty, use stdout
    const outputLines = stdout.split('\n').filter(line => line.trim());
    if (outputLines.length > 0) {
      return outputLines[0] || 'Command executed';
    }
  }

  return 'Command executed';
}

interface RawLogEntry {
  timestamp: string;
  tool: string;
  parameters: Record<string, unknown>;
  result?: unknown;
}

function isBashOperation(operation: OperationIndex): boolean {
  return operation.tool === 'Bash';
}

function parseRawLogEntry(logLine: string): RawLogEntry | null {
  try {
    return JSON.parse(logLine) as RawLogEntry;
  } catch {
    return null;
  }
}

/**
 * Extracts Bash command information from raw log entry.
 * Working directory resolution order: parameters.workingDirectory -> CLAUDE_PROJECT_PATH -> empty string
 */
function extractBashInfo(rawEntry: RawLogEntry): {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  workingDirectory: string;
} {
  const params = rawEntry.parameters ?? {};

  // Extract command with type safety
  const cmdVal = params['command'];
  const command = typeof cmdVal === 'string' ? cmdVal : '';

  // Extract output from result with type safety
  const result = (rawEntry.result ?? {}) as Record<string, unknown>;
  const stdout = typeof result['stdout'] === 'string' ? result['stdout'] : '';
  const stderr = typeof result['stderr'] === 'string' ? result['stderr'] : '';
  const exitCode = typeof result['exitCode'] === 'number' ? result['exitCode'] : 0;

  // Working directory resolution: parameters first, then environment, then empty
  const wdVal = params['workingDirectory'];
  const workingDirectory = typeof wdVal === 'string' ? wdVal : (process.env['CLAUDE_PROJECT_PATH'] ?? '');

  return {
    command,
    stdout,
    stderr,
    exitCode,
    workingDirectory,
  };
}

function convertToBashHistoryItem(operation: OperationIndex, bashInfo: ReturnType<typeof extractBashInfo>): BashHistoryItem {
  return {
    id: operation.id,
    timestamp: operation.timestamp,
    command: bashInfo.command,
    exitCode: bashInfo.exitCode,
    workingDirectory: bashInfo.workingDirectory,
    summary: generateSummary({
      stdout: bashInfo.stdout,
      stderr: bashInfo.stderr,
      exitCode: bashInfo.exitCode,
    }),
  };
}

function convertToBashResult(operation: OperationIndex, bashInfo: ReturnType<typeof extractBashInfo>): BashResult {
  return {
    id: operation.id,
    timestamp: operation.timestamp,
    command: bashInfo.command,
    exitCode: bashInfo.exitCode,
    workingDirectory: bashInfo.workingDirectory,
    stdout: bashInfo.stdout,
    stderr: bashInfo.stderr,
  };
}

export async function handleListBashHistory(
  params: ListBashHistoryParams
): Promise<ListBashHistoryResponse> {
  const limit = validateLimit(params.limit);

  // Get environment variables
  const sessionUID = process.env['CLAUDE_SESSION_UID'];
  const workspaceRoot = process.env['CLAUDE_PROJECT_PATH'];

  if (!sessionUID) {
    throw new Error('No active Claude session found');
  }

  if (!workspaceRoot) {
    throw new Error('Workspace root not available');
  }

  // Find session file
  const sessionDiscovery = new SessionDiscovery();
  const sessionInfo = await sessionDiscovery.findSessionByUID(sessionUID);

  if (!sessionInfo) {
    throw new Error('Session file not found');
  }

  // Read and parse session file
  let fileContent: string;
  try {
    const buffer = await fs.readFile(sessionInfo.sessionFile);
    fileContent = buffer.toString('utf-8');
  } catch (error) {
    throw new Error('Failed to read session file: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }

  // Parse operations
  let operations: OperationIndex[];
  try {
    operations = LogParser.parseLogStream(fileContent);
  } catch (error) {
    throw new Error('Failed to parse session logs: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }

  // Filter only Bash operations
  const bashOperations = operations.filter(isBashOperation);

  // Sort by timestamp (newest first) with stable tiebreaker
  bashOperations.sort((a, b) => {
    const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    return timeDiff !== 0 ? timeDiff : b.id.localeCompare(a.id);
  });

  // Apply limit
  const totalCount = bashOperations.length;
  const limitedOperations = bashOperations.slice(0, limit);
  const hasMore = totalCount > limit;

  // Parse raw log entries to get detailed Bash information
  const fileLines = fileContent.split('\n').filter(line => line.trim());
  const bashInfoArray: Array<{
    timestamp: string;
    command: string;
    bashInfo: ReturnType<typeof extractBashInfo>;
  }> = [];

  for (const line of fileLines) {
    const rawEntry = parseRawLogEntry(line);
    if (rawEntry && rawEntry.tool === 'Bash') {
      const bashInfo = extractBashInfo(rawEntry);
      bashInfoArray.push({
        timestamp: rawEntry.timestamp,
        command: bashInfo.command,
        bashInfo,
      });
    }
  }

  // Convert to BashHistoryItem format
  const commands = limitedOperations.map(operation => {
    // Find matching bash info using composite matching
    const commandFromSummary = operation.summary?.split(' ').slice(0, 2).join(' ') || '';

    let matchedBashInfo = bashInfoArray.find(entry =>
      entry.timestamp === operation.timestamp &&
      (entry.command === commandFromSummary || entry.command.startsWith(commandFromSummary.split(' ')[0] || ''))
    );

    // Fallback to timestamp-only matching
    if (!matchedBashInfo) {
      matchedBashInfo = bashInfoArray.find(entry => entry.timestamp === operation.timestamp);
    }

    if (matchedBashInfo) {
      return convertToBashHistoryItem(operation, matchedBashInfo.bashInfo);
    } else {
      // Fallback for operations without detailed info
      return convertToBashHistoryItem(operation, {
        command: operation.summary || 'Unknown command',
        stdout: '',
        stderr: '',
        exitCode: 0,
        workingDirectory: process.env['CLAUDE_PROJECT_PATH'] || '',
      });
    }
  });

  return {
    commands,
    totalCount,
    hasMore,
    limit,
  };
}

export async function handleShowBashResult(
  params: ShowBashResultParams
): Promise<BashResult> {
  const { id } = params;

  if (!id || id.trim() === '') {
    throw new Error('Command ID is required');
  }

  // Get environment variables
  const sessionUID = process.env['CLAUDE_SESSION_UID'];
  const workspaceRoot = process.env['CLAUDE_PROJECT_PATH'];

  if (!sessionUID) {
    throw new Error('No active Claude session found');
  }

  if (!workspaceRoot) {
    throw new Error('Workspace root not available');
  }

  // Find session file
  const sessionDiscovery = new SessionDiscovery();
  const sessionInfo = await sessionDiscovery.findSessionByUID(sessionUID);

  if (!sessionInfo) {
    throw new Error('Session file not found');
  }

  // Read and parse session file
  let fileContent: string;
  try {
    const buffer = await fs.readFile(sessionInfo.sessionFile);
    fileContent = buffer.toString('utf-8');
  } catch (error) {
    throw new Error('Failed to read session file: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }

  // Parse operations
  let operations: OperationIndex[];
  try {
    operations = LogParser.parseLogStream(fileContent);
  } catch (error) {
    throw new Error('Failed to parse session logs: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }

  // Find the specific operation
  const operation = operations.find(op => op.id === id);

  if (!operation) {
    throw new Error(`Bash command with ID ${id} not found`);
  }

  if (operation.tool !== 'Bash') {
    throw new Error(`Operation ${id} is not a Bash command`);
  }

  // Parse raw log entries to get detailed Bash information
  const fileLines = fileContent.split('\n').filter(line => line.trim());
  let bashInfo: ReturnType<typeof extractBashInfo> | null = null;

  // Try composite matching first for better accuracy
  const commandFromSummary = operation.summary?.split(' ').slice(0, 2).join(' ') || '';

  for (const line of fileLines) {
    const rawEntry = parseRawLogEntry(line);
    if (rawEntry && rawEntry.tool === 'Bash' && rawEntry.timestamp === operation.timestamp) {
      const tempBashInfo = extractBashInfo(rawEntry);

      // Prefer command match, but accept any bash operation at same timestamp
      if (!bashInfo || tempBashInfo.command === commandFromSummary ||
          tempBashInfo.command.startsWith(commandFromSummary.split(' ')[0] || '')) {
        bashInfo = tempBashInfo;
        if (tempBashInfo.command === commandFromSummary) {
          break; // Exact match found
        }
      }
    }
  }

  if (!bashInfo) {
    throw new Error(`Detailed Bash information not found for operation ${id}`);
  }

  return convertToBashResult(operation, bashInfo);
}