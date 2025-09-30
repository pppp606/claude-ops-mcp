import { SessionDiscovery } from '../session-discovery';
import { LogParser } from '../parsers/log-parser';
import { filterByFilePath, filterByChangeType } from '../filters/operation-filter-enhanced';
import { ChangeType } from '../types/operation-index';
import type { OperationIndex } from '../types/operation-index';
import { UIDManager } from '../uid-manager';
import * as fs from 'fs/promises';

/**
 * Parameters for the listFileChanges handler
 */
export interface ListFileChangesParams {
  /**
   * File path or pattern to match against
   * Can be absolute, relative, or partial path
   */
  filePath: string;

  /**
   * Maximum number of operations to return
   * Default: 100, Maximum: 1000
   */
  limit?: number;

  /**
   * Tool use ID from Claude Code (for session identification)
   */
  toolUseId?: string;
}

/**
 * Response from the listFileChanges handler
 */
export interface ListFileChangesResponse {
  /**
   * Array of file change operations (excludes READ operations)
   */
  operations: OperationIndex[];

  /**
   * Total count of matching operations (before limit)
   */
  totalCount: number;

  /**
   * Whether there are more operations beyond the limit
   */
  hasMore: boolean;

  /**
   * The limit that was applied
   */
  limit: number;

  /**
   * The file path pattern that was searched
   */
  filePath: string;

  /**
   * Warning message if applicable (e.g., no results found)
   */
  warning?: string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

/**
 * Handler for the listFileChanges MCP tool
 * Returns the change history for a specific file or path pattern
 *
 * @param params - Parameters for the file changes query
 * @returns File change history excluding READ operations
 */
export async function handleListFileChanges(
  params: ListFileChangesParams
): Promise<ListFileChangesResponse> {
  // Validate input parameters
  if (!params.filePath || params.filePath.trim() === '') {
    throw new Error('File path is required');
  }

  const limit = params.limit ?? DEFAULT_LIMIT;
  if (limit <= 0 || limit > MAX_LIMIT) {
    throw new Error(`Limit must be between 1 and ${MAX_LIMIT}`);
  }

  // Get workspace root from current working directory
  const workspaceRoot = process.cwd();

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
      // Session file not found - this shouldn't happen with toolUseId
      throw new Error(`Session file not found for tool use ID: ${params.toolUseId}`);
    }

    // Found the session file - cache it for future calls
    sessionFile = sessionInfo.sessionFile;
    UIDManager.setCachedSessionFile(sessionFile);
  }

  // Read and parse the session file
  let fileContent: string;
  try {
    fileContent = await fs.readFile(sessionFile, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read session file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Parse the log entries
  let operations: OperationIndex[];
  try {
    operations = LogParser.parseLogStream(fileContent);
  } catch (error) {
    throw new Error(`Failed to parse session logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Filter operations by file path
  let filteredOperations = filterByFilePath(
    operations,
    params.filePath,
    workspaceRoot
  );

  // Filter out READ operations (only include changes)
  const changeTypes: ChangeType[] = [
    ChangeType.CREATE,
    ChangeType.UPDATE,
    ChangeType.DELETE,
  ];
  filteredOperations = filterByChangeType(filteredOperations, changeTypes);

  // Sort operations by timestamp (newest first) with deterministic tiebreaker
  filteredOperations.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();

    // Primary sort by timestamp (newest first)
    if (timeB !== timeA) {
      return timeB - timeA;
    }

    // Tiebreaker: sort by operation ID for deterministic ordering
    return b.id.localeCompare(a.id);
  });

  // Store total count before applying limit
  const totalCount = filteredOperations.length;

  // Apply limit
  const actualLimit = Math.min(limit, MAX_LIMIT);
  const limitedOperations = filteredOperations.slice(0, actualLimit);

  // Prepare response
  const response: ListFileChangesResponse = {
    operations: limitedOperations,
    totalCount,
    hasMore: totalCount > actualLimit,
    limit: actualLimit,
    filePath: params.filePath,
  };

  // Add warning if no results
  if (totalCount === 0) {
    response.warning = `No file changes found for pattern: ${params.filePath}`;
  }

  return response;
}