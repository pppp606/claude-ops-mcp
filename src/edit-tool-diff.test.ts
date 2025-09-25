/**
 * @fileoverview Comprehensive test suite for Edit tool diff generation functionality
 * This file implements TDD Red phase tests for Edit tool-specific diff generation,
 * focusing on the unique characteristics of Edit operations and their diff requirements.
 */

import { createTwoFilesPatch } from 'diff';
import type { EditDiff, UnifiedDiff } from './types/operation-index';
import { setTestStrategy, LegacyTestStrategy } from './strategies/test-strategy';
import { _setTestWorkspaceRoot } from './utils/workspace-utils';

// Setup test strategy for all tests in this file
beforeAll(() => {
  setTestStrategy(new LegacyTestStrategy());
});

// Import the function we're testing (this will fail until implementation exists - RED PHASE)
import { generateEditDiff } from './operation-diff';

describe('Edit Tool Diff Generation', () => {
  // Test helper to create mock file content scenarios
  const createMockFileScenario = (
    filename: string,
    originalContent: string,
    editedContent: string
  ) => ({
    filename,
    originalContent,
    editedContent,
    expectedDiff: createTwoFilesPatch(
      filename,
      filename,
      originalContent,
      editedContent,
      'Original',
      'Modified'
    )
  });

  describe('Basic Edit Diff Generation', () => {
    it('should generate EditDiff for simple string replacement', async () => {
      const scenario = createMockFileScenario(
        '/src/components/Button.tsx',
        'const color = "blue";\nconst size = "medium";',
        'const color = "green";\nconst size = "medium";'
      );

      const result = await generateEditDiff(
        scenario.filename,
        scenario.originalContent,
        'const color = "blue";',
        'const color = "green";',
        false // replace_all = false
      );

      // Verify EditDiff structure
      expect(result.tool).toBe('Edit');
      expect(result.oldString).toBe('const color = "blue";');
      expect(result.newString).toBe('const color = "green";');
      expect(result.replaceAll).toBe(false);

      // Verify UnifiedDiff structure
      expect(result.unifiedDiff.filename).toBe(scenario.filename);
      expect(result.unifiedDiff.oldVersion).toBe(scenario.originalContent);
      expect(result.unifiedDiff.newVersion).toBe(scenario.editedContent);
      expect(result.unifiedDiff.diffText).toContain('-const color = "blue";');
      expect(result.unifiedDiff.diffText).toContain('+const color = "green";');
    });

    it('should generate EditDiff for multiline string replacement', async () => {
      const originalContent = [
        'function calculateTotal(items) {',
        '  let total = 0;',
        '  for (const item of items) {',
        '    total += item.price;',
        '  }',
        '  return total;',
        '}'
      ].join('\n');

      const editedContent = [
        'function calculateTotal(items) {',
        '  let total = 0;',
        '  for (const item of items) {',
        '    total += item.price * item.quantity;',
        '  }',
        '  return total;',
        '}'
      ].join('\n');

      const result = await generateEditDiff(
        '/src/utils/calculator.js',
        originalContent,
        '    total += item.price;',
        '    total += item.price * item.quantity;',
        false
      );

      expect(result.tool).toBe('Edit');
      expect(result.oldString).toBe('    total += item.price;');
      expect(result.newString).toBe('    total += item.price * item.quantity;');
      expect(result.unifiedDiff.diffText).toContain('-    total += item.price;');
      expect(result.unifiedDiff.diffText).toContain('+    total += item.price * item.quantity;');
    });

    it('should handle replace_all flag correctly for multiple occurrences', async () => {
      const originalContent = [
        'const API_URL = "http://localhost";',
        'const BACKUP_URL = "http://localhost";',
        'const TEST_URL = "http://localhost";'
      ].join('\n');

      const editedContentReplaceAll = [
        'const API_URL = "https://api.example.com";',
        'const BACKUP_URL = "https://api.example.com";',
        'const TEST_URL = "https://api.example.com";'
      ].join('\n');

      const result = await generateEditDiff(
        '/src/config/urls.js',
        originalContent,
        '"http://localhost"',
        '"https://api.example.com"',
        true // replace_all = true
      );

      expect(result.replaceAll).toBe(true);
      expect(result.unifiedDiff.newVersion).toBe(editedContentReplaceAll);
      expect(result.unifiedDiff.diffText).toContain('-const API_URL = "http://localhost";');
      expect(result.unifiedDiff.diffText).toContain('-const BACKUP_URL = "http://localhost";');
      expect(result.unifiedDiff.diffText).toContain('-const TEST_URL = "http://localhost";');
    });

    it('should handle replace_all=false for multiple occurrences (only first)', async () => {
      const originalContent = [
        'const PRIMARY = "old_value";',
        'const SECONDARY = "old_value";',
        'const TERTIARY = "old_value";'
      ].join('\n');

      const editedContentFirstOnly = [
        'const PRIMARY = "new_value";',
        'const SECONDARY = "old_value";',
        'const TERTIARY = "old_value";'
      ].join('\n');

      const result = await generateEditDiff(
        '/src/constants.js',
        originalContent,
        '"old_value"',
        '"new_value"',
        false // replace_all = false
      );

      expect(result.replaceAll).toBe(false);
      expect(result.unifiedDiff.newVersion).toBe(editedContentFirstOnly);
      // Should only show one replacement
      expect(result.unifiedDiff.diffText).toContain('-const PRIMARY = "old_value";');
      expect(result.unifiedDiff.diffText).toContain('+const PRIMARY = "new_value";');
      // Other occurrences should remain unchanged
      expect(result.unifiedDiff.newVersion).toContain('const SECONDARY = "old_value";');
    });
  });

  describe('Unified Diff Format Validation', () => {
    it('should generate valid unified diff headers', async () => {
      const result = await generateEditDiff(
        '/src/components/Header.vue',
        '<template>\n  <header>Old Title</header>\n</template>',
        'Old Title',
        'New Title',
        false
      );

      const diffText = result.unifiedDiff.diffText;

      // Check unified diff format compliance
      expect(diffText).toMatch(/^--- \/src\/components\/Header\.vue/m);
      expect(diffText).toMatch(/^\+\+\+ \/src\/components\/Header\.vue/m);
      expect(diffText).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/m);
    });

    it('should include proper context lines in diff', async () => {
      const originalContent = [
        'export class Calculator {',
        '  constructor() {',
        '    this.value = 0;',
        '  }',
        '',
        '  add(n) {',
        '    this.value += n;',
        '    return this;',
        '  }',
        '}'
      ].join('\n');

      const result = await generateEditDiff(
        '/src/Calculator.js',
        originalContent,
        '    this.value += n;',
        '    this.value = this.value + n;',
        false
      );

      const diffText = result.unifiedDiff.diffText;

      // Should include context lines around the change
      expect(diffText).toContain(' add(n) {'); // context before
      expect(diffText).toContain(' return this;'); // context after
      expect(diffText).toContain('-    this.value += n;'); // removed line
      expect(diffText).toContain('+    this.value = this.value + n;'); // added line
    });

    it('should handle line numbers correctly in unified diff', async () => {
      const originalContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

      const result = await generateEditDiff(
        '/test/file.txt',
        originalContent,
        'Line 3',
        'Modified Line 3',
        false
      );

      const diffText = result.unifiedDiff.diffText;

      // Check that @@ header contains correct line numbers
      expect(diffText).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/m);
      expect(diffText).toContain('-Line 3');
      expect(diffText).toContain('+Modified Line 3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string replacement', async () => {
      const originalContent = 'Hello World\nExtra text';

      const result = await generateEditDiff(
        '/test/empty.txt',
        originalContent,
        'Extra text',
        '',
        false
      );

      expect(result.oldString).toBe('Extra text');
      expect(result.newString).toBe('');
      expect(result.unifiedDiff.diffText).toContain('-Extra text');
      expect(result.unifiedDiff.newVersion).toBe('Hello World\n');
    });

    it('should handle insertion (empty old string)', async () => {
      const originalContent = 'function test() {\n}';

      const result = await generateEditDiff(
        '/test/insert.js',
        originalContent,
        '',
        '  console.log("inserted");',
        false
      );

      expect(result.oldString).toBe('');
      expect(result.newString).toBe('  console.log("inserted");');
      expect(result.unifiedDiff.diffText).toContain('+  console.log("inserted");');
    });

    it('should handle identical strings (no change)', async () => {
      const originalContent = 'const value = 42;';

      const result = await generateEditDiff(
        '/test/nochange.js',
        originalContent,
        'const value = 42;',
        'const value = 42;',
        false
      );

      expect(result.oldString).toBe('const value = 42;');
      expect(result.newString).toBe('const value = 42;');
      expect(result.unifiedDiff.oldVersion).toBe(result.unifiedDiff.newVersion);
      // Diff should indicate no changes
      expect(result.unifiedDiff.diffText).not.toMatch(/^[+-][^+-]/m);
    });

    it('should handle non-existent old_string gracefully', async () => {
      const originalContent = 'function hello() {\n  return "world";\n}';

      // This should throw an error or handle gracefully when old_string doesn't exist
      await expect(generateEditDiff(
        '/test/notfound.js',
        originalContent,
        'nonexistent string',
        'replacement',
        false
      )).rejects.toThrow(/old.*string.*not.*found/i);
    });

    it('should handle newlines and whitespace correctly', async () => {
      const originalContent = 'line1\n\nline3\n  indented';

      const result = await generateEditDiff(
        '/test/whitespace.txt',
        originalContent,
        '\n\n',
        '\n',
        false
      );

      expect(result.oldString).toBe('\n\n');
      expect(result.newString).toBe('\n');
      expect(result.unifiedDiff.newVersion).toBe('line1\nline3\n  indented');
    });

    it('should handle special regex characters in strings', async () => {
      const originalContent = 'const regex = /.*?[a-z]+$/;';

      const result = await generateEditDiff(
        '/test/regex.js',
        originalContent,
        '/.*?[a-z]+$/',
        '/^[A-Z]+.*?$/',
        false
      );

      expect(result.oldString).toBe('/.*?[a-z]+$/');
      expect(result.newString).toBe('/^[A-Z]+.*?$/');
      expect(result.unifiedDiff.diffText).toContain('-const regex = /.*?[a-z]+$/;');
      expect(result.unifiedDiff.diffText).toContain('+const regex = /^[A-Z]+.*?$/;');
    });
  });

  describe('Tool-specific Integration', () => {
    it('should maintain EditDiff type consistency', async () => {
      const result = await generateEditDiff(
        '/src/test.ts',
        'const a = 1;',
        'const a = 1;',
        'const a = 2;',
        false
      );

      // Type checks for EditDiff interface compliance
      expect(result).toHaveProperty('tool', 'Edit');
      expect(result).toHaveProperty('oldString');
      expect(result).toHaveProperty('newString');
      expect(result).toHaveProperty('replaceAll');
      expect(result).toHaveProperty('unifiedDiff');

      // UnifiedDiff type checks
      expect(result.unifiedDiff).toHaveProperty('filename');
      expect(result.unifiedDiff).toHaveProperty('oldVersion');
      expect(result.unifiedDiff).toHaveProperty('newVersion');
      expect(result.unifiedDiff).toHaveProperty('diffText');

      // Type validation
      expect(typeof result.tool).toBe('string');
      expect(typeof result.oldString).toBe('string');
      expect(typeof result.newString).toBe('string');
      expect(typeof result.replaceAll).toBe('boolean');
      expect(typeof result.unifiedDiff.filename).toBe('string');
      expect(typeof result.unifiedDiff.oldVersion).toBe('string');
      expect(typeof result.unifiedDiff.newVersion).toBe('string');
      expect(typeof result.unifiedDiff.diffText).toBe('string');
    });

    it('should integrate with showOperationDiff API structure', async () => {
      const result = await generateEditDiff(
        '/src/integration.ts',
        'export const version = "1.0.0";',
        '"1.0.0"',
        '"2.0.0"',
        false
      );

      // Verify structure matches what showOperationDiff expects for EditDiff
      expect(result.tool).toBe('Edit');
      expect(result.unifiedDiff.filename).toBe('/src/integration.ts');

      // Should be compatible with OperationDiff.diff field
      const mockOperationDiff = {
        operationId: 'test-123',
        timestamp: '2025-09-23T14:30:45.123Z',
        tool: 'Edit',
        filePath: '/src/integration.ts',
        summary: 'Updated version',
        changeType: 'update',
        diff: result
      };

      expect(mockOperationDiff.diff.tool).toBe('Edit');
      expect(mockOperationDiff.diff).toHaveProperty('unifiedDiff');
    });

    it('should support Claude rollback/debug use cases', async () => {
      const result = await generateEditDiff(
        '/src/debug-example.js',
        'function buggyFunction() {\n  return undefined;\n}',
        'return undefined;',
        'return null;',
        false
      );

      // Verify diff provides sufficient information for rollback
      expect(result.unifiedDiff.oldVersion).toContain('return undefined;');
      expect(result.unifiedDiff.newVersion).toContain('return null;');
      expect(result.unifiedDiff.diffText).toContain('-  return undefined;');
      expect(result.unifiedDiff.diffText).toContain('+  return null;');

      // Verify exact strings for precise rollback
      expect(result.oldString).toBe('return undefined;');
      expect(result.newString).toBe('return null;');
    });
  });

  describe('Performance and Memory Considerations', () => {
    it('should handle large file content efficiently', async () => {
      const largeContent = 'line\n'.repeat(10000); // 10k lines
      const modifiedContent = largeContent.replace('line\n', 'modified_line\n');

      const startTime = Date.now();
      const result = await generateEditDiff(
        '/test/large.txt',
        largeContent,
        'line',
        'modified_line',
        false
      );
      const endTime = Date.now();

      // Should complete in reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000); // 1 second max

      expect(result.tool).toBe('Edit');
      expect(result.unifiedDiff.diffText).toContain('-line');
      expect(result.unifiedDiff.diffText).toContain('+modified_line');
    });

    it('should handle binary-like content gracefully', async () => {
      const binaryLikeContent = '\x00\x01\x02\xFF\xFE\xFD';

      // Binary content should throw an error
      await expect(generateEditDiff(
        '/test/binary.dat',
        binaryLikeContent + 'text',
        'text',
        'newtext',
        false
      )).rejects.toThrow('Cannot edit binary file content');
    });
  });
});