import type { OperationIndex, ChangeType } from '../types/operation-index';
import { FilePathMatcher } from '../file-path-matcher';

/**
 * Enhanced filter operations for file change history
 */

/**
 * Filters operations by file path using advanced matching.
 * Uses FilePathMatcher to support:
 * - Absolute path matching
 * - Relative path matching from workspace root
 * - Partial path matching (filename or path segments)
 *
 * @param operations - Array of operations to filter
 * @param pattern - File path pattern to match against
 * @param workspaceRoot - Root directory of the workspace for relative path resolution
 * @returns Filtered array of operations with matching file paths
 */
export function filterByFilePath(
  operations: OperationIndex[],
  pattern: string,
  workspaceRoot: string
): OperationIndex[] {
  if (!pattern) {
    return operations;
  }

  const matcher = new FilePathMatcher(workspaceRoot);

  return operations.filter(op => {
    if (!op.filePath) {
      return false;
    }

    return matcher.isMatch(op.filePath, pattern);
  });
}

/**
 * Filters operations by change type.
 * Useful for excluding READ operations when looking for file changes.
 *
 * @param operations - Array of operations to filter
 * @param changeTypes - Array of change types to include (e.g., ['CREATE', 'UPDATE', 'DELETE'])
 * @returns Filtered array of operations matching the specified change types
 */
export function filterByChangeType(
  operations: OperationIndex[],
  changeTypes?: ChangeType[]
): OperationIndex[] {
  if (!changeTypes || changeTypes.length === 0) {
    return operations;
  }

  return operations.filter(op => {
    if (!op.changeType) {
      return false;
    }

    return changeTypes.includes(op.changeType);
  });
}