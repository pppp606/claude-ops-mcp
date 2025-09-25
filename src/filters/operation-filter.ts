import type { OperationIndex } from '../types/operation-index';

/**
 * Interface defining available filter options for operation filtering.
 *
 * @interface FilterOptions
 */
export interface FilterOptions {
  /**
   * Restrict the number of results returned.
   * If not specified, all matching operations are returned.
   * If 0 or negative, returns an empty array.
   */
  limit?: number;

  /**
   * Filter operations by exact file path or pattern matching.
   * If not specified, operations are not filtered by file path.
   */
  filePath?: string;

  /**
   * Return operations after a specific timestamp.
   * Should be an ISO 8601 timestamp string.
   * @example "2025-09-18T14:30:45.123Z"
   */
  since?: string;

  /**
   * Return operations before a specific timestamp.
   * Should be an ISO 8601 timestamp string.
   * @example "2025-09-18T14:30:45.123Z"
   */
  until?: string;
}

/**
 * Filters an array of operations based on the provided filter options.
 *
 * Filters are applied in the following order:
 * 1. filePath filter (if specified)
 * 2. since filter (if specified)
 * 3. until filter (if specified)
 * 4. limit filter (if specified)
 *
 * This order ensures that limit is applied last to get the correct number
 * of results after all other filters have been applied.
 *
 * @param operations - Array of operations to filter
 * @param options - Filter options to apply
 * @returns Filtered array of operations maintaining original ordering
 *
 * @example
 * ```typescript
 * const operations: OperationIndex[] = [...];
 *
 * // Limit to 10 operations
 * const limited = filterOperations(operations, { limit: 10 });
 *
 * // Filter by file path and limit
 * const filtered = filterOperations(operations, {
 *   filePath: '/src/components/Button.tsx',
 *   limit: 5
 * });
 *
 * // Filter by timestamp range
 * const recent = filterOperations(operations, {
 *   since: '2025-09-18T00:00:00.000Z',
 *   until: '2025-09-18T23:59:59.999Z'
 * });
 * ```
 */
/**
 * Filters operations by file path.
 * Supports exact matching, partial matching, and glob patterns.
 *
 * @param operations - Array of operations to filter
 * @param filePath - File path pattern to match against
 * @returns Filtered array of operations with matching file paths
 */
export function filterByFilePath(
  operations: OperationIndex[],
  filePath: string
): OperationIndex[] {
  if (!filePath) {
    return operations;
  }

  return operations.filter(op => {
    if (!op.filePath) {
      return false;
    }

    // Exact match
    if (op.filePath === filePath) {
      return true;
    }

    // Partial match
    if (op.filePath.includes(filePath)) {
      return true;
    }

    // Simple glob pattern (*.ext)
    if (filePath.startsWith('*')) {
      const extension = filePath.slice(1);
      return op.filePath.endsWith(extension);
    }

    return false;
  });
}

/**
 * Filters operations occurring after a specified timestamp.
 * Includes operations at the exact timestamp.
 *
 * @param operations - Array of operations to filter
 * @param since - ISO 8601 timestamp string
 * @returns Operations after or at the specified timestamp
 */
export function filterBySince(
  operations: OperationIndex[],
  since: string
): OperationIndex[] {
  if (!since) {
    return operations;
  }

  const sinceTime = new Date(since);
  if (isNaN(sinceTime.getTime())) {
    throw new Error(`Invalid timestamp format: ${since}`);
  }

  return operations.filter(op => {
    const opTime = new Date(op.timestamp);
    return opTime >= sinceTime;
  });
}

/**
 * Filters operations occurring before or at a specified timestamp.
 * Includes operations at the exact timestamp.
 *
 * @param operations - Array of operations to filter
 * @param until - ISO 8601 timestamp string
 * @returns Operations before or at the specified timestamp
 */
export function filterByUntil(
  operations: OperationIndex[],
  until: string
): OperationIndex[] {
  if (!until) {
    return operations;
  }

  const untilTime = new Date(until);
  if (isNaN(untilTime.getTime())) {
    throw new Error(`Invalid timestamp format: ${until}`);
  }

  return operations.filter(op => {
    const opTime = new Date(op.timestamp);
    return opTime <= untilTime;
  });
}

export function filterOperations(
  operations: OperationIndex[],
  options: FilterOptions
): OperationIndex[] {
  let filtered = [...operations];

  // Apply filters in order: filePath, since, until, then limit

  // Apply filePath filter
  if (options.filePath !== undefined) {
    filtered = filterByFilePath(filtered, options.filePath);
  }

  // Apply since filter
  if (options.since !== undefined) {
    filtered = filterBySince(filtered, options.since);
  }

  // Apply until filter
  if (options.until !== undefined) {
    filtered = filterByUntil(filtered, options.until);
  }

  // Apply limit filter last
  if (options.limit !== undefined) {
    if (options.limit <= 0) {
      return [];
    }
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}
