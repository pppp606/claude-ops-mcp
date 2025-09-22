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
  READ = 'read'
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