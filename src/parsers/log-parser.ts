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
 * Parser for Claude Code operation logs in JSONL format
 */
export class LogParser {
  /**
   * Parses a single log entry string into an OperationIndex object
   * @param logEntry - JSON string representing a single log entry
   * @returns OperationIndex object
   * @throws Error for malformed JSON or missing required fields
   */
  static parseLogEntry(logEntry: string): OperationIndex {
    let rawEntry: RawLogEntry;

    // Parse JSON
    try {
      rawEntry = JSON.parse(logEntry);
    } catch (error) {
      throw new Error('Invalid JSON format');
    }

    // Validate required fields
    if (!rawEntry.timestamp || !rawEntry.tool || !rawEntry.parameters) {
      throw new Error('Missing required fields: timestamp, tool, and parameters are required');
    }

    // Extract file path from parameters if available
    const filePath = this.extractFilePath(rawEntry.parameters, rawEntry.tool);

    // Generate operation summary
    const summary = this.generateSummary(rawEntry.tool, rawEntry.parameters, filePath);

    // Determine change type based on tool
    const changeType = this.determineChangeType(rawEntry.tool);

    const operation: OperationIndex = {
      id: UIDManager.generateUID(),
      timestamp: rawEntry.timestamp,
      tool: rawEntry.tool,
      summary,
      changeType
    };

    if (filePath) {
      operation.filePath = filePath;
    }

    return operation;
  }

  /**
   * Extracts file path from tool parameters
   * @param parameters - Tool parameters object
   * @param tool - Tool name for context
   * @returns File path if found, undefined otherwise
   */
  private static extractFilePath(parameters: Record<string, unknown>, tool: string): string | undefined {
    // For tools that typically work with files, check for file path parameters
    const fileOperationTools = ['Edit', 'Write', 'Read', 'MultiEdit', 'Delete'];

    if (!fileOperationTools.includes(tool)) {
      return undefined;
    }

    // Common file path parameter names
    const filePathKeys = ['file_path', 'filepath'];

    for (const key of filePathKeys) {
      if (parameters[key] && typeof parameters[key] === 'string') {
        return parameters[key];
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
        return `Bash command: ${command || 'unknown command'}`;
      }

      case 'Grep': {
        const pattern = parameters['pattern'];
        return `Grep search for pattern: ${pattern || 'unknown pattern'}`;
      }

      default:
        return `${tool} operation`;
    }
  }

  /**
   * Determines the change type based on the tool used
   * @param tool - Tool name
   * @returns ChangeType enum value
   */
  private static determineChangeType(tool: string): ChangeType {
    switch (tool) {
      case 'Write':
        return ChangeType.CREATE;

      case 'Edit':
      case 'MultiEdit':
        return ChangeType.UPDATE;

      case 'Delete':
        return ChangeType.DELETE;

      case 'Read':
      case 'Bash':
      case 'Grep':
      case 'Glob':
      default:
        return ChangeType.READ;
    }
  }
}