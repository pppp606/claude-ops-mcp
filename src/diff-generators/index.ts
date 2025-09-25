/**
 * Diff Generators Index
 *
 * Centralized exports for all diff generation modules.
 */

export { generateEditDiff } from './edit-diff';
export { generateWriteDiff } from './write-diff';
export { generateReadDiff } from './read-diff';
export { generateMultiEditDiff } from './multiedit-diff';
export { generateBashDiff } from './bash-diff';

// Re-export types for convenience
export type {
  EditDiff,
  WriteDiff,
  ReadDiff,
  MultiEditDiff,
  BashDiff,
  OperationDiff,
  UnifiedDiff,
  ChangeType
} from '../types/operation-index';