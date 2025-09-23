/**
 * Performance optimization utilities for large file operations
 *
 * This module provides optimized functions for handling large file content
 * while maintaining accuracy and reliability.
 */

import { createTwoFilesPatch } from 'diff';

/**
 * Maximum content size for full diff generation (1MB)
 */
const MAX_FULL_DIFF_SIZE = 1024 * 1024;

/**
 * Maximum lines to show in truncated diff (reserved for future use)
 */
const _MAX_DIFF_LINES = 100;

/**
 * Generates optimized unified diff for large files
 *
 * For small files, uses standard diff generation.
 * For large files, creates a truncated summary diff to improve performance.
 */
export function generateOptimizedDiff(
  oldPath: string,
  newPath: string,
  oldContent: string,
  newContent: string,
  oldHeader: string,
  newHeader: string
): string {
  // For small files, use standard diff generation
  if (oldContent.length + newContent.length < MAX_FULL_DIFF_SIZE) {
    return createTwoFilesPatch(
      oldPath,
      newPath,
      oldContent,
      newContent,
      oldHeader,
      newHeader
    );
  }

  // For large files, create a summary diff
  return createSummaryDiff(
    oldPath,
    newPath,
    oldContent,
    newContent,
    oldHeader,
    newHeader
  );
}

/**
 * Creates a summary diff for large files to improve performance
 */
function createSummaryDiff(
  oldPath: string,
  newPath: string,
  oldContent: string,
  newContent: string,
  oldHeader: string,
  newHeader: string
): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Create a header showing file information
  const header = `Index: ${newPath}
===================================================================
--- ${oldPath}\t${oldHeader}
+++ ${newPath}\t${newHeader}
@@ -1,${oldLines.length} +1,${newLines.length} @@`;

  // For very large files, show just the summary
  if (oldLines.length > 1000 || newLines.length > 1000) {
    const summary = [
      header,
      `// Large file modification summary:`,
      `// Old: ${oldLines.length} lines (${oldContent.length} chars)`,
      `// New: ${newLines.length} lines (${newContent.length} chars)`,
      `// Change: ${newLines.length - oldLines.length > 0 ? '+' : ''}${newLines.length - oldLines.length} lines`,
      ''
    ];

    // Show first few lines if content is different
    if (oldContent !== newContent) {
      summary.push('// First few lines:');
      const linesToShow = Math.min(5, newLines.length);
      for (let i = 0; i < linesToShow; i++) {
        summary.push(`+${newLines[i]}`);
      }

      if (newLines.length > 5) {
        summary.push(`// ... and ${newLines.length - 5} more lines`);
      }
    }

    return summary.join('\n');
  }

  // For medium files, show truncated diff
  return createTwoFilesPatch(
    oldPath,
    newPath,
    oldContent.substring(0, MAX_FULL_DIFF_SIZE / 2),
    newContent.substring(0, MAX_FULL_DIFF_SIZE / 2),
    oldHeader,
    newHeader
  ) + '\n// ... content truncated for performance';
}

/**
 * Performs optimized string replacement for large content
 */
export function performOptimizedStringReplace(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false
): string {
  // For small content, use standard replacement
  if (content.length < 100000) {
    if (replaceAll) {
      return content.split(oldString).join(newString);
    } else {
      const index = content.indexOf(oldString);
      if (index === -1) {return content;}
      return content.substring(0, index) +
             newString +
             content.substring(index + oldString.length);
    }
  }

  // For large content, use optimized approach
  if (replaceAll) {
    // Use regex for better performance on large strings
    const escapedOldString = oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return content.replace(new RegExp(escapedOldString, 'g'), newString);
  } else {
    // Single replacement - find index and replace
    const index = content.indexOf(oldString);
    if (index === -1) {return content;}

    // For very large strings, use buffer-like approach
    if (content.length > 1000000) {
      const before = content.substring(0, index);
      const after = content.substring(index + oldString.length);
      return before + newString + after;
    } else {
      return content.substring(0, index) +
             newString +
             content.substring(index + oldString.length);
    }
  }
}