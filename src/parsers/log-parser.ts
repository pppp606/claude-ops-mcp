import type { OperationIndex } from '../types/operation-index';
import { ChangeType } from '../types/operation-index';
import { UIDManager } from '../uid-manager';

/**
 * Interface representing a raw Claude Code log entry from JSONL format
 */
interface RawLogEntry {
  timestamp: string;
  tool: string;
  parameters: Record<string, unknown>;
  result?: unknown;
}

/**
 * Interface for Claude Code's actual log format
 */
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
  toolUseResult?: Record<string, unknown>;
}

/**
 * Configuration options for log parsing
 */
interface ParseOptions {
  /** Whether to skip malformed entries or throw an error */
  skipMalformed?: boolean;
  /** Maximum number of entries to parse (0 = no limit) */
  maxEntries?: number;
  /** Whether to validate timestamp format */
  validateTimestamp?: boolean;
}

/**
 * Result of parsing operations with metadata
 */
interface ParseResult {
  /** Successfully parsed operations */
  operations: OperationIndex[];
  /** Number of entries that were skipped due to errors */
  skippedCount: number;
  /** Total number of entries processed */
  totalProcessed: number;
}

/**
 * Custom error for log parsing with additional context
 */
export class LogParseError extends Error {
  constructor(
    message: string,
    public readonly lineNumber?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'LogParseError';
  }
}

/**
 * Parser for Claude Code operation logs in JSONL format
 *
 * This class provides efficient parsing of Claude Code operation logs,
 * with support for streaming large files and robust error handling.
 */
export class LogParser {
  // Cache tool categorizations for performance
  private static readonly FILE_OPERATION_TOOLS = new Set([
    'Edit',
    'Write',
    'Read',
    'MultiEdit',
    'Delete',
  ]);

  private static readonly FILE_PATH_KEYS = ['file_path', 'filepath', 'path'];

  // Tool to change type mapping for performance
  private static readonly TOOL_CHANGE_TYPE_MAP = new Map<string, ChangeType>([
    ['Write', ChangeType.CREATE],
    ['Edit', ChangeType.UPDATE],
    ['MultiEdit', ChangeType.UPDATE],
    ['Delete', ChangeType.DELETE],
    ['Read', ChangeType.READ],
    ['Bash', ChangeType.READ],
    ['Grep', ChangeType.READ],
    ['Glob', ChangeType.READ],
  ]);
  /**
   * Parses a single log entry string into an OperationIndex object
   * @param logEntry - JSON string representing a single log entry
   * @param options - Parsing options
   * @returns OperationIndex object or null if not a tool use entry
   * @throws LogParseError for malformed JSON or missing required fields
   */
  static parseLogEntry(
    logEntry: string,
    options: ParseOptions = {}
  ): OperationIndex | null {
    let entry: any;

    // Parse JSON with better error handling
    try {
      entry = JSON.parse(logEntry);
    } catch (error) {
      throw new LogParseError(
        'Invalid JSON format',
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Try to parse Claude Code format first
    const claudeCodeOp = this.parseClaudeCodeEntry(entry, options);
    if (claudeCodeOp) {
      return claudeCodeOp;
    }

    // Fall back to old format (for backward compatibility)
    return this.parseOldFormatEntry(entry, options);
  }

  /**
   * Parses Claude Code log format (assistant messages with tool_use)
   */
  private static parseClaudeCodeEntry(
    entry: ClaudeCodeLogEntry,
    options: ParseOptions
  ): OperationIndex | null {
    // Only process assistant messages with tool_use
    if (entry.type !== 'assistant' || !entry.message?.content) {
      return null;
    }

    // Find tool_use in content array
    const toolUse = entry.message.content.find(item => item.type === 'tool_use');
    if (!toolUse || !toolUse.name || !toolUse.input) {
      return null;
    }

    const tool = toolUse.name;
    const parameters = toolUse.input;
    const timestamp = entry.timestamp;

    if (!timestamp) {
      throw new LogParseError('Missing required field: timestamp');
    }

    // Validate timestamp format if requested
    if (options.validateTimestamp && !this.isValidTimestamp(timestamp)) {
      throw new LogParseError(`Invalid timestamp format: ${timestamp}`);
    }

    // Extract file path from parameters if available
    const filePath = this.extractFilePath(parameters, tool);

    // Generate operation summary
    const summary = this.generateSummary(tool, parameters, filePath);

    // Determine change type based on tool
    const changeType = this.determineChangeType(tool);

    const operation: OperationIndex = {
      id: toolUse.id || UIDManager.generateUID(),
      timestamp,
      tool,
      summary,
      changeType,
    };

    if (filePath) {
      operation.filePath = filePath;
    }

    return operation;
  }

  /**
   * Parses old log format (for backward compatibility)
   */
  private static parseOldFormatEntry(
    rawEntry: RawLogEntry,
    options: ParseOptions
  ): OperationIndex | null {
    // Validate required fields with detailed error messages
    if (!rawEntry.timestamp) {
      return null;
    }
    if (!rawEntry.tool) {
      return null;
    }
    if (!rawEntry.parameters) {
      return null;
    }
    if (
      typeof rawEntry.parameters !== 'object' ||
      Array.isArray(rawEntry.parameters)
    ) {
      return null;
    }

    // Validate timestamp format if requested
    if (
      options.validateTimestamp &&
      !this.isValidTimestamp(rawEntry.timestamp)
    ) {
      throw new LogParseError(
        `Invalid timestamp format: ${rawEntry.timestamp}`
      );
    }

    // Extract file path from parameters if available
    const filePath = this.extractFilePath(rawEntry.parameters, rawEntry.tool);

    // Generate operation summary
    const summary = this.generateSummary(
      rawEntry.tool,
      rawEntry.parameters,
      filePath
    );

    // Determine change type based on tool
    const changeType = this.determineChangeType(rawEntry.tool);

    const operation: OperationIndex = {
      id: UIDManager.generateUID(),
      timestamp: rawEntry.timestamp,
      tool: rawEntry.tool,
      summary,
      changeType,
    };

    if (filePath) {
      operation.filePath = filePath;
    }

    return operation;
  }

  /**
   * Parses a JSONL stream containing multiple log entries
   * @param jsonlContent - String containing JSONL format data (one JSON object per line)
   * @param options - Parsing options
   * @returns Array of OperationIndex objects (for backward compatibility)
   */
  static parseLogStream(
    jsonlContent: string,
    options: ParseOptions = {}
  ): OperationIndex[] {
    const result = this.parseLogStreamWithMetadata(jsonlContent, options);
    return result.operations;
  }

  /**
   * Parses a JSONL stream with detailed metadata about the parsing process
   * @param jsonlContent - String containing JSONL format data (one JSON object per line)
   * @param options - Parsing options
   * @returns ParseResult with operations and metadata
   */
  static parseLogStreamWithMetadata(
    jsonlContent: string,
    options: ParseOptions = {}
  ): ParseResult {
    if (!jsonlContent || jsonlContent.trim() === '') {
      return {
        operations: [],
        skippedCount: 0,
        totalProcessed: 0,
      };
    }

    const {
      skipMalformed = true,
      maxEntries = 0,
      validateTimestamp = false,
    } = options;

    const operations: OperationIndex[] = [];
    const lines = jsonlContent.split('\n');
    let skippedCount = 0;
    let processedCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmedLine = line.trim();

      // Skip empty lines
      if (trimmedLine === '') {
        continue;
      }

      processedCount++;

      // Check max entries limit
      if (maxEntries > 0 && operations.length >= maxEntries) {
        break;
      }

      try {
        const operation = this.parseLogEntry(trimmedLine, {
          validateTimestamp,
        });
        // Skip entries that don't parse to operations (e.g., non-tool entries)
        if (operation) {
          operations.push(operation);
        }
      } catch (error) {
        if (skipMalformed) {
          skippedCount++;
          continue;
        } else {
          // Re-throw with line number context
          if (error instanceof LogParseError) {
            throw new LogParseError(
              `Line ${i + 1}: ${error.message}`,
              i + 1,
              error.originalError
            );
          } else {
            throw new LogParseError(
              `Line ${i + 1}: ${String(error)}`,
              i + 1,
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }
      }
    }

    return {
      operations,
      skippedCount,
      totalProcessed: processedCount,
    };
  }

  /**
   * Validates if a timestamp string is in ISO 8601 format
   * @param timestamp - Timestamp string to validate
   * @returns True if valid ISO 8601 format
   */
  private static isValidTimestamp(timestamp: string): boolean {
    // Basic ISO 8601 format validation (Z required for UTC)
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (!iso8601Regex.test(timestamp)) {
      return false;
    }

    // Check if the date is actually valid
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }

  /**
   * Extracts file path from tool parameters (optimized)
   * @param parameters - Tool parameters object
   * @param tool - Tool name for context
   * @returns File path if found, undefined otherwise
   */
  private static extractFilePath(
    parameters: Record<string, unknown>,
    tool: string
  ): string | undefined {
    // Use cached Set for faster lookups
    if (!this.FILE_OPERATION_TOOLS.has(tool)) {
      return undefined;
    }

    // Check common file path parameter names
    for (const key of this.FILE_PATH_KEYS) {
      const value = parameters[key];
      if (value && typeof value === 'string') {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Generates a human-readable summary for the operation
   * @param tool - Tool name
   * @param parameters - Tool parameters
   * @param filePath - Extracted file path
   * @returns Summary string
   */
  private static generateSummary(
    tool: string,
    parameters: Record<string, unknown>,
    filePath?: string
  ): string {
    if (filePath) {
      return `${tool} operation on ${filePath}`;
    }

    // Special cases for tools without file paths
    switch (tool) {
      case 'Bash': {
        const command = parameters['command'];
        return `Bash command: ${typeof command === 'string' ? command : 'unknown command'}`;
      }

      case 'Grep': {
        const pattern = parameters['pattern'];
        return `Grep search for pattern: ${typeof pattern === 'string' ? pattern : 'unknown pattern'}`;
      }

      case 'Glob': {
        const pattern = parameters['pattern'];
        return `Glob search for pattern: ${typeof pattern === 'string' ? pattern : 'unknown pattern'}`;
      }

      default:
        return `${tool} operation`;
    }
  }

  /**
   * Determines the change type based on the tool used (optimized)
   * @param tool - Tool name
   * @returns ChangeType enum value
   */
  private static determineChangeType(tool: string): ChangeType {
    return this.TOOL_CHANGE_TYPE_MAP.get(tool) ?? ChangeType.READ;
  }

  /**
   * Utility method to filter operations by change type
   * @param operations - Array of operations to filter
   * @param changeType - Change type to filter by
   * @returns Filtered array of operations
   */
  static filterByChangeType(
    operations: OperationIndex[],
    changeType: ChangeType
  ): OperationIndex[] {
    return operations.filter(op => op.changeType === changeType);
  }

  /**
   * Utility method to group operations by file path
   * @param operations - Array of operations to group
   * @returns Map of file paths to operations
   */
  static groupByFilePath(
    operations: OperationIndex[]
  ): Map<string, OperationIndex[]> {
    const groups = new Map<string, OperationIndex[]>();

    for (const operation of operations) {
      const key = operation.filePath ?? '<no-file>';
      const existing = groups.get(key);
      if (existing) {
        existing.push(operation);
      } else {
        groups.set(key, [operation]);
      }
    }

    return groups;
  }

  /**
   * Utility method to get operations within a date range
   * @param operations - Array of operations to filter
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @returns Filtered array of operations
   */
  static filterByDateRange(
    operations: OperationIndex[],
    startDate: Date,
    endDate: Date
  ): OperationIndex[] {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    return operations.filter(op => {
      const opTime = new Date(op.timestamp).getTime();
      return opTime >= startTime && opTime <= endTime;
    });
  }
}
