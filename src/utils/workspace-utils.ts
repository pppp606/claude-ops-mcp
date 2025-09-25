/**
 * Workspace utilities for path validation and security
 *
 * Provides secure path validation based on workspace root to prevent
 * path traversal attacks and unauthorized file access.
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the workspace root directory
 * Falls back to current working directory if not specified
 */
export function getWorkspaceRoot(): string {
  // Check for test override first
  if (testWorkspaceRoot) {
    return testWorkspaceRoot;
  }

  // Try environment variable first
  if (process.env['CLAUDE_WORKSPACE_ROOT']) {
    return path.resolve(process.env['CLAUDE_WORKSPACE_ROOT']);
  }

  // Try to find workspace root by looking for common root files
  let currentDir = process.cwd();
  const rootIndicators = ['.git', 'package.json', 'tsconfig.json', '.claude'];

  while (currentDir !== path.dirname(currentDir)) {
    for (const indicator of rootIndicators) {
      if (fs.existsSync(path.join(currentDir, indicator))) {
        return currentDir;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback to current working directory
  return process.cwd();
}

/**
 * Validates that a file path is within the workspace root
 * @param filePath - The file path to validate
 * @param workspaceRoot - Optional workspace root (uses auto-detected if not provided)
 * @returns The resolved absolute path if valid
 * @throws Error if path is outside workspace or invalid
 */
export function validateWorkspacePath(filePath: string, workspaceRoot?: string): string {
  const wsRoot = workspaceRoot || getWorkspaceRoot();
  const resolvedPath = path.resolve(wsRoot, filePath);

  // Ensure the resolved path is within the workspace
  if (!resolvedPath.startsWith(wsRoot + path.sep) && resolvedPath !== wsRoot) {
    throw new Error(`Path '${filePath}' is outside the workspace root '${wsRoot}'`);
  }

  return resolvedPath;
}

/**
 * Checks if a path is within the workspace without throwing
 * @param filePath - The file path to check
 * @param workspaceRoot - Optional workspace root (uses auto-detected if not provided)
 * @returns True if path is within workspace, false otherwise
 */
export function isWithinWorkspace(filePath: string, workspaceRoot?: string): boolean {
  try {
    validateWorkspacePath(filePath, workspaceRoot);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get relative path from workspace root
 * @param filePath - The file path
 * @param workspaceRoot - Optional workspace root (uses auto-detected if not provided)
 * @returns Relative path from workspace root
 */
export function getRelativeWorkspacePath(filePath: string, workspaceRoot?: string): string {
  const wsRoot = workspaceRoot || getWorkspaceRoot();
  const resolvedPath = path.resolve(wsRoot, filePath);
  return path.relative(wsRoot, resolvedPath);
}

// Set workspace root for testing
let testWorkspaceRoot: string | undefined;

/**
 * Set workspace root for testing purposes
 * @private
 */
export function _setTestWorkspaceRoot(root: string | undefined): void {
  testWorkspaceRoot = root;
}

/**
 * Get test workspace root
 * @private
 */
export function _getTestWorkspaceRoot(): string | undefined {
  return testWorkspaceRoot;
}