import * as path from 'path';

/**
 * FilePathMatcher provides flexible file path matching capabilities.
 *
 * Path Matching Semantics:
 * 1. Absolute Path Matching: Exact match between normalized absolute paths
 *    Example: "/workspace/src/file.ts" matches "/workspace/src/file.ts"
 *
 * 2. Relative Path Matching: Pattern is relative to workspace root
 *    Example: "src/file.ts" matches "/workspace/src/file.ts" when workspace is "/workspace"
 *    Also supports "./" prefix: "./src/file.ts" works the same as "src/file.ts"
 *
 * 3. Partial Path Matching: Pattern appears anywhere in the file path
 *    Examples:
 *    - "file.ts" matches "/workspace/src/components/file.ts"
 *    - "components" matches "/workspace/src/components/Button.tsx"
 *    - "src/utils" matches "/workspace/src/utils/helpers.ts"
 *
 * Path Normalization:
 * - Converts backslashes to forward slashes (Windows compatibility)
 * - Removes duplicate slashes: "///" becomes "/"
 * - Removes trailing slashes except for root
 * - Ensures consistent comparison regardless of input format
 *
 * Workspace Boundary Protection:
 * - getRelativePath() uses path.relative for robust calculation
 * - Prevents path traversal attacks by checking for ".." in relative paths
 * - Handles similar prefix scenarios (e.g., "/project" vs "/project-backup")
 */
export class FilePathMatcher {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = this.normalizePath(workspaceRoot);
  }

  /**
   * Check if a file path matches a given pattern
   *
   * Matching Priority (first match wins):
   * 1. Exact absolute path match
   * 2. Relative path from workspace root match
   * 3. Partial path substring match
   *
   * @param filePath - The file path to test (absolute or relative)
   * @param pattern - The pattern to match against
   * @returns true if the path matches the pattern using any supported method
   */
  isMatch(filePath: string, pattern: string): boolean {
    if (!filePath || !pattern) {
      return false;
    }

    const normalizedFilePath = this.normalizePath(filePath);
    const normalizedPattern = this.normalizePath(pattern);

    // Exact absolute path match
    if (normalizedFilePath === normalizedPattern) {
      return true;
    }

    // Relative path from workspace root
    if (this.isRelativePathMatch(normalizedFilePath, normalizedPattern)) {
      return true;
    }

    // Partial path match (filename or path segments)
    if (this.isPartialMatch(normalizedFilePath, normalizedPattern)) {
      return true;
    }

    return false;
  }

  /**
   * Normalize a file path for consistent comparison
   */
  normalizePath(inputPath: string): string {
    if (!inputPath) {
      return '';
    }

    // Convert Windows paths to Unix style
    let normalized = inputPath.replace(/\\/g, '/');

    // Remove multiple slashes
    normalized = normalized.replace(/\/+/g, '/');

    // Remove trailing slash unless it's the root
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Get relative path from workspace root
   * Returns null if the path is outside the workspace
   * Uses path.relative for more robust path calculation
   */
  getRelativePath(absolutePath: string): string | null {
    const normalizedAbsolute = this.normalizePath(absolutePath);
    const normalizedWorkspace = this.workspaceRoot;

    try {
      // Use path.relative for more robust relative path calculation
      const relativePath = path.relative(normalizedWorkspace, normalizedAbsolute);

      // Check if the path goes outside the workspace (contains '..')
      if (relativePath.startsWith('..')) {
        return null;
      }

      // Handle the case where the path is the workspace root itself
      if (relativePath === '') {
        return '.';
      }

      // Normalize the relative path to use forward slashes
      return this.normalizePath(relativePath);
    } catch (error) {
      // Handle any path calculation errors
      return null;
    }
  }

  private isRelativePathMatch(filePath: string, pattern: string): boolean {
    // Remove ./ prefix from pattern if present
    const cleanPattern = pattern.startsWith('./') ? pattern.slice(2) : pattern;

    // Check if pattern is a relative path
    if (!path.isAbsolute(cleanPattern)) {
      const expectedAbsolute = path.join(this.workspaceRoot, cleanPattern);
      const normalizedExpected = this.normalizePath(expectedAbsolute);
      return filePath === normalizedExpected;
    }

    return false;
  }

  private isPartialMatch(filePath: string, pattern: string): boolean {
    // Check if the pattern appears anywhere in the file path
    return filePath.includes(pattern);
  }
}