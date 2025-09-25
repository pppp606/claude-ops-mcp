/**
 * Enum representing the type of change made in an operation.
 *
 * This enum categorizes operations based on their primary effect on the codebase:
 * - CREATE: Operations that create new files or entities
 * - UPDATE: Operations that modify existing files or entities
 * - DELETE: Operations that remove files or entities
 * - READ: Operations that only read or analyze without modification
 *
 * @example
 * ```typescript
 * const operation: OperationIndex = {
 *   id: 'op-123',
 *   timestamp: new Date().toISOString(),
 *   tool: 'Write',
 *   filePath: '/src/new-file.ts',
 *   summary: 'Created new TypeScript file',
 *   changeType: ChangeType.CREATE
 * };
 * ```
 */
export enum ChangeType {
  /** Indicates a file or entity was created */
  CREATE = 'create',
  /** Indicates a file or entity was modified */
  UPDATE = 'update',
  /** Indicates a file or entity was removed */
  DELETE = 'delete',
  /** Indicates a read-only operation with no modifications */
  READ = 'read',
}

/**
 * Interface representing an indexed operation in the Claude Code operation history.
 *
 * This interface provides a standardized way to track and categorize operations
 * performed during a Claude Code session, enabling operation history management,
 * rollback capabilities, and session analysis.
 *
 * @example
 * ```typescript
 * const editOperation: OperationIndex = {
 *   id: UIDManager.generateUID(),
 *   timestamp: new Date().toISOString(),
 *   tool: 'Edit',
 *   filePath: '/src/components/Button.tsx',
 *   summary: 'Updated button component styling',
 *   changeType: ChangeType.UPDATE
 * };
 *
 * const readOperation: OperationIndex = {
 *   id: UIDManager.generateUID(),
 *   timestamp: new Date().toISOString(),
 *   tool: 'Grep',
 *   summary: 'Searched for API usage patterns',
 *   changeType: ChangeType.READ
 * };
 * ```
 */
export interface OperationIndex {
  /**
   * Unique identifier for the operation.
   * Should be a UUID v4 string generated via UIDManager.generateUID()
   */
  id: string;

  /**
   * ISO 8601 timestamp when the operation occurred.
   * Format: YYYY-MM-DDTHH:mm:ss.sssZ
   * @example "2025-09-18T14:30:45.123Z"
   */
  timestamp: string;

  /**
   * Tool used to perform the operation.
   * Common values include: 'Edit', 'Write', 'Read', 'Delete', 'Grep', 'Bash', 'MultiEdit'
   */
  tool: string;

  /**
   * Optional absolute path to the file operated on.
   * Omitted for operations that don't target specific files (e.g., global searches)
   * @example "/Users/username/project/src/components/Button.tsx"
   */
  filePath?: string;

  /**
   * Brief description of the operation.
   * Should be concise but informative enough to understand the operation's purpose
   * @example "Updated button component styling" or "Searched for API usage patterns"
   */
  summary: string;

  /**
   * Type of change made by this operation.
   * Categorizes the operation's primary effect on the codebase
   */
  changeType: ChangeType;
}

/**
 * Interface for unified diff format representation.
 *
 * Provides a standard way to represent file changes using the unified diff format,
 * which shows the differences between two versions of a file in a human-readable way.
 *
 * @example
 * ```typescript
 * const unifiedDiff: UnifiedDiff = {
 *   filename: '/src/components/Button.tsx',
 *   oldVersion: 'original content',
 *   newVersion: 'modified content',
 *   diffText: '@@ -1,3 +1,3 @@\n-old line\n+new line'
 * };
 * ```
 */
export interface UnifiedDiff {
  /**
   * Absolute path to the file being diffed.
   * @example "/Users/username/project/src/components/Button.tsx"
   */
  filename: string;

  /**
   * Original content of the file before the operation.
   */
  oldVersion: string;

  /**
   * New content of the file after the operation.
   */
  newVersion: string;

  /**
   * Unified diff format text showing the changes.
   * Follows the standard unified diff format with @@ headers and +/- line markers.
   */
  diffText: string;
}

/**
 * Interface for Edit tool operation differences.
 *
 * Captures the specific changes made by an Edit operation, including
 * the exact strings that were replaced and their locations.
 */
export interface EditDiff {
  /**
   * The tool name that generated this diff.
   */
  tool: 'Edit';

  /**
   * The original string that was replaced.
   */
  oldString: string;

  /**
   * The new string that replaced the old string.
   */
  newString: string;

  /**
   * Whether all occurrences of oldString were replaced.
   */
  replaceAll: boolean;

  /**
   * Unified diff representation of the file changes.
   */
  unifiedDiff: UnifiedDiff;
}

/**
 * Interface for Write tool operation differences.
 *
 * Captures the complete file overwrite operation performed by the Write tool.
 */
export interface WriteDiff {
  /**
   * The tool name that generated this diff.
   */
  tool: 'Write';

  /**
   * Whether this was creating a new file (true) or overwriting an existing file (false).
   */
  isNewFile: boolean;

  /**
   * The complete content that was written to the file.
   */
  newContent: string;

  /**
   * The previous content of the file (if it existed).
   * Undefined if this was a new file creation.
   */
  previousContent?: string;

  /**
   * Unified diff representation of the file changes.
   */
  unifiedDiff: UnifiedDiff;
}

/**
 * Interface for MultiEdit tool operation differences.
 *
 * Captures multiple edit operations performed in a single MultiEdit command.
 */
export interface MultiEditDiff {
  /**
   * The tool name that generated this diff.
   */
  tool: 'MultiEdit';

  /**
   * Array of individual edit operations performed.
   */
  edits: Array<{
    /**
     * The original string that was replaced in this edit.
     */
    oldString: string;

    /**
     * The new string that replaced the old string in this edit.
     */
    newString: string;

    /**
     * Whether all occurrences of oldString were replaced in this edit.
     */
    replaceAll: boolean;
  }>;

  /**
   * Unified diff representation of the cumulative file changes.
   */
  unifiedDiff: UnifiedDiff;
}

/**
 * Interface for Bash tool operation differences.
 *
 * Captures the command execution and any file system changes that resulted.
 */
export interface BashDiff {
  /**
   * The tool name that generated this diff.
   */
  tool: 'Bash';

  /**
   * The bash command that was executed.
   */
  command: string;

  /**
   * The stdout output from the command execution.
   */
  stdout: string;

  /**
   * The stderr output from the command execution.
   */
  stderr: string;

  /**
   * The exit code of the command execution.
   */
  exitCode: number;

  /**
   * Files that were created, modified, or deleted as a result of the command.
   * Each entry contains the file path and the type of change.
   */
  affectedFiles: Array<{
    /**
     * Absolute path to the affected file.
     */
    filePath: string;

    /**
     * Type of change that occurred to this file.
     */
    changeType: ChangeType;

    /**
     * Unified diff if the file was modified (undefined for CREATE/DELETE).
     */
    unifiedDiff?: UnifiedDiff;
  }>;
}

/**
 * Interface for Read tool operation differences.
 *
 * Captures read-only operations that don't modify files but may return content.
 */
export interface ReadDiff {
  /**
   * The tool name that generated this diff.
   */
  tool: 'Read';

  /**
   * The content that was read from the file.
   */
  content: string;

  /**
   * Number of lines that were read.
   */
  linesRead: number;

  /**
   * Starting line number if a specific range was read.
   */
  startLine?: number;

  /**
   * Ending line number if a specific range was read.
   */
  endLine?: number;
}

/**
 * Union type representing all possible tool-specific diff formats.
 */
export type ToolDiff =
  | EditDiff
  | WriteDiff
  | MultiEditDiff
  | BashDiff
  | ReadDiff;

/**
 * Interface representing detailed difference information for an operation.
 *
 * This interface extends the basic OperationIndex with detailed diff information,
 * allowing for comprehensive operation history analysis and rollback capabilities.
 *
 * @example
 * ```typescript
 * const operationDiff: OperationDiff = {
 *   operationId: 'op-123-456-789',
 *   timestamp: '2025-09-23T14:30:45.123Z',
 *   tool: 'Edit',
 *   filePath: '/src/components/Button.tsx',
 *   summary: 'Updated button component styling',
 *   changeType: ChangeType.UPDATE,
 *   diff: {
 *     tool: 'Edit',
 *     oldString: 'background: blue;',
 *     newString: 'background: green;',
 *     replaceAll: false,
 *     unifiedDiff: {
 *       filename: '/src/components/Button.tsx',
 *       oldVersion: '...',
 *       newVersion: '...',
 *       diffText: '@@ -15,1 +15,1 @@\n-background: blue;\n+background: green;'
 *     }
 *   }
 * };
 * ```
 */
export interface OperationDiff {
  /**
   * Unique identifier for the operation.
   * References the corresponding OperationIndex.id
   */
  operationId: string;

  /**
   * ISO 8601 timestamp when the operation occurred.
   * Format: YYYY-MM-DDTHH:mm:ss.sssZ
   * @example "2025-09-23T14:30:45.123Z"
   */
  timestamp: string;

  /**
   * Tool used to perform the operation.
   * Common values include: 'Edit', 'Write', 'Read', 'Delete', 'Grep', 'Bash', 'MultiEdit'
   */
  tool: string;

  /**
   * Optional absolute path to the file operated on.
   * Omitted for operations that don't target specific files (e.g., global searches)
   * @example "/Users/username/project/src/components/Button.tsx"
   */
  filePath?: string;

  /**
   * Brief description of the operation.
   * Should be concise but informative enough to understand the operation's purpose
   * @example "Updated button component styling" or "Searched for API usage patterns"
   */
  summary: string;

  /**
   * Type of change made by this operation.
   * Categorizes the operation's primary effect on the codebase
   */
  changeType: ChangeType;

  /**
   * Detailed diff information specific to the tool used.
   * Contains tool-specific change details and unified diff representation.
   */
  diff: ToolDiff;
}
