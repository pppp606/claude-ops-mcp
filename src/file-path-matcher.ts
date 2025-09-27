import * as path from 'path';

export class FilePathMatcher {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = this.normalizePath(workspaceRoot);
  }

  /**
   * Check if a file path matches a given pattern
   * Supports:
   * - Absolute paths (exact match)
   * - Relative paths from workspace root
   * - Partial path matching (filename or path segments)
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
   */
  getRelativePath(absolutePath: string): string | null {
    const normalizedAbsolute = this.normalizePath(absolutePath);

    if (!normalizedAbsolute.startsWith(this.workspaceRoot)) {
      return null;
    }

    if (normalizedAbsolute === this.workspaceRoot) {
      return '.';
    }

    const relative = normalizedAbsolute.slice(this.workspaceRoot.length);
    return relative.startsWith('/') ? relative.slice(1) : relative;
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