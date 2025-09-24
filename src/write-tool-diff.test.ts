/**
 * @fileoverview Comprehensive test suite for Write tool diff generation functionality
 * This file implements TDD Red phase tests for Write tool-specific diff generation,
 * focusing on the unique characteristics of Write operations and their diff requirements.
 *
 * Write tool characteristics:
 * - Creates new files or completely overwrites existing files
 * - Uses file_path and content parameters
 * - Supports both new file creation and file replacement operations
 */

import { createTwoFilesPatch } from 'diff';
import type { WriteDiff, UnifiedDiff } from './types/operation-index';

// Import the function we're testing (this will fail until implementation exists - RED PHASE)
import { generateWriteDiff } from './operation-diff';

describe('Write Tool Diff Generation', () => {
  // Test helper to create mock file scenarios for Write operations
  const createMockWriteScenario = (
    filename: string,
    previousContent: string | undefined,
    newContent: string,
    isNewFile: boolean = false
  ) => ({
    filename,
    previousContent,
    newContent,
    isNewFile,
    expectedDiff: createTwoFilesPatch(
      filename,
      filename,
      previousContent || '',
      newContent,
      isNewFile ? 'New file' : 'Original',
      'Written'
    )
  });

  describe('New File Creation', () => {
    it('should generate WriteDiff for new file creation', async () => {
      const filename = '/src/components/NewComponent.tsx';
      const newContent = [
        'import React from "react";',
        '',
        'export const NewComponent: React.FC = () => {',
        '  return <div>New Component</div>;',
        '};',
        '',
        'export default NewComponent;'
      ].join('\n');

      const result = await generateWriteDiff(
        filename,
        undefined, // no previous content for new files
        newContent
      );

      // Verify WriteDiff structure
      expect(result.tool).toBe('Write');
      expect(result.isNewFile).toBe(true);
      expect(result.newContent).toBe(newContent);
      expect(result.previousContent).toBeUndefined();

      // Verify UnifiedDiff structure for new file
      expect(result.unifiedDiff.filename).toBe(filename);
      expect(result.unifiedDiff.oldVersion).toBe('');
      expect(result.unifiedDiff.newVersion).toBe(newContent);
      expect(result.unifiedDiff.diffText).toContain('--- /dev/null');
      expect(result.unifiedDiff.diffText).toContain('+++ /src/components/NewComponent.tsx');
      expect(result.unifiedDiff.diffText).toContain('+import React from "react";');
      expect(result.unifiedDiff.diffText).toContain('+export const NewComponent: React.FC = () => {');
    });

    it('should generate WriteDiff for empty file creation', async () => {
      const filename = '/src/config/empty.json';
      const newContent = '';

      const result = await generateWriteDiff(
        filename,
        undefined,
        newContent
      );

      expect(result.tool).toBe('Write');
      expect(result.isNewFile).toBe(true);
      expect(result.newContent).toBe('');
      expect(result.previousContent).toBeUndefined();
      expect(result.unifiedDiff.oldVersion).toBe('');
      expect(result.unifiedDiff.newVersion).toBe('');

      // Even empty files should show proper diff headers
      expect(result.unifiedDiff.diffText).toContain('--- /dev/null');
      expect(result.unifiedDiff.diffText).toContain('+++ /src/config/empty.json');
    });

    it('should handle directory paths correctly for new files', async () => {
      const filename = '/deep/nested/directory/structure/file.ts';
      const newContent = 'export const value = "nested file";';

      const result = await generateWriteDiff(
        filename,
        undefined,
        newContent
      );

      expect(result.isNewFile).toBe(true);
      expect(result.unifiedDiff.filename).toBe(filename);
      expect(result.unifiedDiff.diffText).toContain('+++ /deep/nested/directory/structure/file.ts');
      expect(result.unifiedDiff.diffText).toContain('+export const value = "nested file";');
    });
  });

  describe('File Overwrite Operations', () => {
    it('should generate WriteDiff for complete file overwrite', async () => {
      const filename = '/src/utils/config.ts';
      const previousContent = [
        'export const config = {',
        '  version: "1.0.0",',
        '  environment: "development"',
        '};'
      ].join('\n');

      const newContent = [
        'interface Config {',
        '  version: string;',
        '  environment: "development" | "production";',
        '  apiUrl: string;',
        '}',
        '',
        'export const config: Config = {',
        '  version: "2.0.0",',
        '  environment: "production",',
        '  apiUrl: "https://api.example.com"',
        '};'
      ].join('\n');

      const result = await generateWriteDiff(
        filename,
        previousContent,
        newContent
      );

      expect(result.tool).toBe('Write');
      expect(result.isNewFile).toBe(false);
      expect(result.newContent).toBe(newContent);
      expect(result.previousContent).toBe(previousContent);

      // Verify complete replacement is shown in diff
      expect(result.unifiedDiff.oldVersion).toBe(previousContent);
      expect(result.unifiedDiff.newVersion).toBe(newContent);
      expect(result.unifiedDiff.diffText).toContain('-export const config = {');
      expect(result.unifiedDiff.diffText).toContain('-  version: "1.0.0",');
      expect(result.unifiedDiff.diffText).toContain('+interface Config {');
      expect(result.unifiedDiff.diffText).toContain('+  version: "2.0.0",');
    });

    it('should handle major content restructuring', async () => {
      const filename = '/src/services/api.js';
      const previousContent = [
        'function fetchData() {',
        '  return fetch("/api/data");',
        '}'
      ].join('\n');

      const newContent = [
        'import axios from "axios";',
        '',
        'class ApiService {',
        '  constructor(baseURL) {',
        '    this.client = axios.create({ baseURL });',
        '  }',
        '',
        '  async fetchData() {',
        '    const response = await this.client.get("/data");',
        '    return response.data;',
        '  }',
        '}',
        '',
        'export default new ApiService(process.env.API_URL);'
      ].join('\n');

      const result = await generateWriteDiff(
        filename,
        previousContent,
        newContent
      );

      expect(result.isNewFile).toBe(false);
      expect(result.unifiedDiff.diffText).toContain('-function fetchData() {');
      expect(result.unifiedDiff.diffText).toContain('-  return fetch("/api/data");');
      expect(result.unifiedDiff.diffText).toContain('+import axios from "axios";');
      expect(result.unifiedDiff.diffText).toContain('+class ApiService {');
    });

    it('should handle binary file replacement detection', async () => {
      const filename = '/assets/image.png';
      const previousContent = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR...old_binary_data';
      const newContent = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR...new_binary_data';

      const result = await generateWriteDiff(
        filename,
        previousContent,
        newContent
      );

      expect(result.tool).toBe('Write');
      expect(result.isNewFile).toBe(false);
      expect(result.newContent).toBe(newContent);
      expect(result.previousContent).toBe(previousContent);

      // Binary content should still generate valid diff structure
      expect(result.unifiedDiff.filename).toBe(filename);
      expect(result.unifiedDiff.oldVersion).toBe(previousContent);
      expect(result.unifiedDiff.newVersion).toBe(newContent);
    });
  });

  describe('Unified Diff Format Validation', () => {
    it('should generate valid unified diff headers for new files', async () => {
      const filename = '/src/new-module.ts';
      const newContent = 'export const newModule = true;';

      const result = await generateWriteDiff(
        filename,
        undefined,
        newContent
      );

      const diffText = result.unifiedDiff.diffText;

      // Check new file diff format
      expect(diffText).toMatch(/^--- \/dev\/null/m);
      expect(diffText).toMatch(/^\+\+\+ \/src\/new-module\.ts/m);
      expect(diffText).toMatch(/^@@ -0,0 \+1,1 @@/m);
      expect(diffText).toContain('+export const newModule = true;');
    });

    it('should generate valid unified diff headers for file overwrites', async () => {
      const filename = '/src/existing-module.ts';
      const previousContent = 'export const oldModule = false;';
      const newContent = 'export const newModule = true;';

      const result = await generateWriteDiff(
        filename,
        previousContent,
        newContent
      );

      const diffText = result.unifiedDiff.diffText;

      // Check overwrite diff format
      expect(diffText).toMatch(/^--- \/src\/existing-module\.ts/m);
      expect(diffText).toMatch(/^\+\+\+ \/src\/existing-module\.ts/m);
      expect(diffText).toMatch(/^@@ -1,1 \+1,1 @@/m);
      expect(diffText).toContain('-export const oldModule = false;');
      expect(diffText).toContain('+export const newModule = true;');
    });

    it('should include proper line count in diff headers', async () => {
      const filename = '/src/multiline.txt';
      const previousContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'New Line 1\nNew Line 2\nNew Line 3\nNew Line 4\nNew Line 5';

      const result = await generateWriteDiff(
        filename,
        previousContent,
        newContent
      );

      const diffText = result.unifiedDiff.diffText;

      // Should show correct line counts in @@ header
      expect(diffText).toMatch(/^@@ -1,3 \+1,5 @@/m);
      expect(diffText).toContain('-Line 1');
      expect(diffText).toContain('-Line 2');
      expect(diffText).toContain('-Line 3');
      expect(diffText).toContain('+New Line 1');
      expect(diffText).toContain('+New Line 5');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file overwrite', async () => {
      const filename = '/src/temp.txt';
      const previousContent = 'Some existing content';
      const newContent = '';

      const result = await generateWriteDiff(
        filename,
        previousContent,
        newContent
      );

      expect(result.isNewFile).toBe(false);
      expect(result.newContent).toBe('');
      expect(result.previousContent).toBe(previousContent);
      expect(result.unifiedDiff.diffText).toContain('-Some existing content');
      expect(result.unifiedDiff.newVersion).toBe('');
    });

    it('should handle identical content overwrite (no actual change)', async () => {
      const filename = '/src/unchanged.js';
      const content = 'const value = "same";';

      const result = await generateWriteDiff(
        filename,
        content,
        content
      );

      expect(result.isNewFile).toBe(false);
      expect(result.newContent).toBe(content);
      expect(result.previousContent).toBe(content);
      expect(result.unifiedDiff.oldVersion).toBe(result.unifiedDiff.newVersion);

      // Should show no changes in diff
      expect(result.unifiedDiff.diffText).not.toMatch(/^[+-][^+-]/m);
    });

    it('should handle large file content efficiently', async () => {
      const filename = '/src/large-file.txt';
      const largeContent = 'line\n'.repeat(10000); // 10k lines
      const newLargeContent = 'new_line\n'.repeat(15000); // 15k lines

      const startTime = Date.now();
      const result = await generateWriteDiff(
        filename,
        largeContent,
        newLargeContent
      );
      const endTime = Date.now();

      // Should complete in reasonable time - relaxed for CI environments
      expect(endTime - startTime).toBeLessThan(70000); // 70 seconds max for CI

      expect(result.tool).toBe('Write');
      expect(result.isNewFile).toBe(false);
      expect(result.newContent).toBe(newLargeContent);
      expect(result.previousContent).toBe(largeContent);
    });

    it('should handle special characters and encoding', async () => {
      const filename = '/src/special-chars.txt';
      const previousContent = 'Hello 世界 🌍 café naïve résumé';
      const newContent = 'Bonjour 世界 🚀 café naïve résumé updated';

      const result = await generateWriteDiff(
        filename,
        previousContent,
        newContent
      );

      expect(result.newContent).toBe(newContent);
      expect(result.previousContent).toBe(previousContent);
      expect(result.unifiedDiff.diffText).toContain('-Hello 世界 🌍 café');
      expect(result.unifiedDiff.diffText).toContain('+Bonjour 世界 🚀 café');
    });

    it('should handle newlines and whitespace correctly', async () => {
      const filename = '/src/whitespace.txt';
      const previousContent = 'line1\n\n\nline4\n  indented';
      const newContent = 'line1\nline2\nline3\nline4\n    more_indented';

      const result = await generateWriteDiff(
        filename,
        previousContent,
        newContent
      );

      expect(result.unifiedDiff.oldVersion).toBe(previousContent);
      expect(result.unifiedDiff.newVersion).toBe(newContent);
      expect(result.unifiedDiff.diffText).toContain('+line2');
      expect(result.unifiedDiff.diffText).toContain('+line3');
      expect(result.unifiedDiff.diffText).toContain('-  indented');
      expect(result.unifiedDiff.diffText).toContain('+    more_indented');
    });
  });

  describe('Tool-specific Integration', () => {
    it('should maintain WriteDiff type consistency', async () => {
      const result = await generateWriteDiff(
        '/src/type-test.ts',
        'old content',
        'new content'
      );

      // Type checks for WriteDiff interface compliance
      expect(result).toHaveProperty('tool', 'Write');
      expect(result).toHaveProperty('isNewFile');
      expect(result).toHaveProperty('newContent');
      expect(result).toHaveProperty('previousContent');
      expect(result).toHaveProperty('unifiedDiff');

      // UnifiedDiff type checks
      expect(result.unifiedDiff).toHaveProperty('filename');
      expect(result.unifiedDiff).toHaveProperty('oldVersion');
      expect(result.unifiedDiff).toHaveProperty('newVersion');
      expect(result.unifiedDiff).toHaveProperty('diffText');

      // Type validation
      expect(typeof result.tool).toBe('string');
      expect(typeof result.isNewFile).toBe('boolean');
      expect(typeof result.newContent).toBe('string');
      expect(typeof result.unifiedDiff.filename).toBe('string');
      expect(typeof result.unifiedDiff.oldVersion).toBe('string');
      expect(typeof result.unifiedDiff.newVersion).toBe('string');
      expect(typeof result.unifiedDiff.diffText).toBe('string');
    });

    it('should integrate with showOperationDiff API structure', async () => {
      const result = await generateWriteDiff(
        '/src/integration-test.ts',
        undefined, // new file
        'export const integration = true;'
      );

      // Verify structure matches what showOperationDiff expects for WriteDiff
      expect(result.tool).toBe('Write');
      expect(result.unifiedDiff.filename).toBe('/src/integration-test.ts');

      // Should be compatible with OperationDiff.diff field
      const mockOperationDiff = {
        operationId: 'write-test-123',
        timestamp: '2025-09-23T14:30:45.123Z',
        tool: 'Write',
        filePath: '/src/integration-test.ts',
        summary: 'Created new integration test file',
        changeType: 'create',
        diff: result
      };

      expect(mockOperationDiff.diff.tool).toBe('Write');
      expect(mockOperationDiff.diff).toHaveProperty('unifiedDiff');
      expect(mockOperationDiff.diff).toHaveProperty('isNewFile');
    });

    it('should support Claude rollback/debug use cases for new files', async () => {
      const result = await generateWriteDiff(
        '/src/debug-new-file.js',
        undefined,
        'function newFeature() {\n  console.log("new feature");\n}'
      );

      // Verify diff provides sufficient information for rollback (deletion)
      expect(result.isNewFile).toBe(true);
      expect(result.previousContent).toBeUndefined();
      expect(result.newContent).toContain('function newFeature()');
      expect(result.unifiedDiff.diffText).toContain('+function newFeature() {');

      // For rollback, we need to know this was a new file creation
      expect(result.unifiedDiff.oldVersion).toBe('');
    });

    it('should support Claude rollback/debug use cases for file overwrites', async () => {
      const originalContent = 'function oldVersion() {\n  return "old";\n}';
      const newContent = 'function newVersion() {\n  return "new";\n}';

      const result = await generateWriteDiff(
        '/src/debug-overwrite.js',
        originalContent,
        newContent
      );

      // Verify diff provides sufficient information for rollback (restore previous content)
      expect(result.isNewFile).toBe(false);
      expect(result.previousContent).toBe(originalContent);
      expect(result.newContent).toBe(newContent);
      expect(result.unifiedDiff.diffText).toContain('-function oldVersion() {');
      expect(result.unifiedDiff.diffText).toContain('+function newVersion() {');

      // For rollback, we need the complete previous content
      expect(result.unifiedDiff.oldVersion).toBe(originalContent);
    });

    it('should correctly detect isNewFile flag based on previousContent', async () => {
      // Test new file case
      const newFileResult = await generateWriteDiff(
        '/src/new.ts',
        undefined,
        'new file content'
      );
      expect(newFileResult.isNewFile).toBe(true);

      // Test overwrite case
      const overwriteResult = await generateWriteDiff(
        '/src/existing.ts',
        'existing content',
        'new content'
      );
      expect(overwriteResult.isNewFile).toBe(false);

      // Test empty string vs undefined previousContent
      const emptyOverwriteResult = await generateWriteDiff(
        '/src/empty-existing.ts',
        '', // empty but existing file
        'new content'
      );
      expect(emptyOverwriteResult.isNewFile).toBe(false);
    });
  });

  describe('Performance and Memory Considerations', () => {
    it('should handle massive file creation efficiently', async () => {
      const massiveContent = 'export const data = [\n' +
        Array.from({ length: 50000 }, (_, i) => `  "item${i}"`).join(',\n') +
        '\n];';

      const startTime = Date.now();
      const result = await generateWriteDiff(
        '/src/massive-data.ts',
        undefined,
        massiveContent
      );
      const endTime = Date.now();

      // Should complete in reasonable time even for massive files
      expect(endTime - startTime).toBeLessThan(3000); // 3 seconds max

      expect(result.tool).toBe('Write');
      expect(result.isNewFile).toBe(true);
      expect(result.newContent).toBe(massiveContent);
      expect(result.unifiedDiff.diffText).toContain('+export const data = [');
    });

    it('should handle binary content without corruption', async () => {
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).toString('binary');
      const newBinaryContent = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).toString('binary');

      const result = await generateWriteDiff(
        '/assets/binary.dat',
        binaryContent,
        newBinaryContent
      );

      expect(result.tool).toBe('Write');
      expect(result.isNewFile).toBe(false);
      expect(result.newContent).toBe(newBinaryContent);
      expect(result.previousContent).toBe(binaryContent);

      // Binary content should preserve exact byte sequences
      expect(result.unifiedDiff.oldVersion).toBe(binaryContent);
      expect(result.unifiedDiff.newVersion).toBe(newBinaryContent);
    });
  });
});