/**
 * @fileoverview Tests for the diff library integration
 * Verifies TypeScript compatibility and basic functionality
 */
import { createTwoFilesPatch, diffLines, createPatch } from 'diff';

describe('Diff Library Integration', () => {
  describe('TypeScript Compatibility', () => {
    test('should import diff functions without type errors', () => {
      expect(typeof createTwoFilesPatch).toBe('function');
      expect(typeof diffLines).toBe('function');
      expect(typeof createPatch).toBe('function');
    });
  });

  describe('Basic Diff Functionality', () => {
    test('should generate unified diff between two strings', () => {
      const oldText = 'Hello\nWorld\nTest';
      const newText = 'Hello\nWorld!\nTest\nNew line';

      const diff = createTwoFilesPatch(
        'old-file.txt',
        'new-file.txt',
        oldText,
        newText,
        'Old version',
        'New version'
      );

      expect(diff).toContain('--- old-file.txt');
      expect(diff).toContain('+++ new-file.txt');
      expect(diff).toContain('-World');
      expect(diff).toContain('+World!');
      expect(diff).toContain('+New line');
    });

    test('should handle empty strings', () => {
      const diff = createTwoFilesPatch(
        'empty.txt',
        'content.txt',
        '',
        'Hello World',
        '',
        ''
      );

      expect(diff).toContain('--- empty.txt');
      expect(diff).toContain('+++ content.txt');
      expect(diff).toContain('+Hello World');
    });

    test('should handle identical strings', () => {
      const content = 'Same content\nLine 2';
      const diff = createTwoFilesPatch(
        'file1.txt',
        'file2.txt',
        content,
        content,
        '',
        ''
      );

      // For identical content, diff may include headers but no actual changes
      expect(diff).toMatch(
        /^===================================================================$/m
      );
      expect(diff).toMatch(/^--- file1\.txt/m);
      expect(diff).toMatch(/^\+\+\+ file2\.txt/m);
      // Should not contain any +/- lines for actual changes
      expect(diff).not.toMatch(/^[+-][^+-]/m);
    });

    test('should generate line-by-line diff', () => {
      const oldText = 'Line 1\nLine 2\nLine 3';
      const newText = 'Line 1\nModified Line 2\nLine 3\nLine 4';

      const changes = diffLines(oldText, newText);

      expect(changes.length).toBeGreaterThan(0);

      // Find the unchanged parts (Line 1 should remain)
      const unchangedPart = changes.find(
        change =>
          change.value.includes('Line 1') && !change.added && !change.removed
      );
      expect(unchangedPart).toBeDefined();

      // Should have some removed content
      const removedPart = changes.find(change => change.removed);
      expect(removedPart).toBeDefined();

      // Should have some added content
      const addedPart = changes.find(change => change.added);
      expect(addedPart).toBeDefined();
    });
  });

  describe('Unified Diff Format Compliance', () => {
    test('should generate standard unified diff format', () => {
      const oldContent = 'function hello() {\n  console.log("old");\n}';
      const newContent =
        'function hello() {\n  console.log("new");\n  return true;\n}';

      const patch = createTwoFilesPatch(
        'hello.js',
        'hello.js',
        oldContent,
        newContent,
        'Original',
        'Modified'
      );

      // Check unified diff format elements
      expect(patch).toMatch(/^--- hello\.js\s+Original$/m);
      expect(patch).toMatch(/^\+\+\+ hello\.js\s+Modified$/m);
      expect(patch).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/m);
      expect(patch).toContain('-  console.log("old");');
      expect(patch).toContain('+  console.log("new");');
      expect(patch).toContain('+  return true;');
    });

    test('should handle context lines properly', () => {
      const oldCode = [
        'function test() {',
        '  const a = 1;',
        '  const b = 2;',
        '  return a + b;',
        '}',
      ].join('\n');

      const newCode = [
        'function test() {',
        '  const a = 1;',
        '  const c = 3;',
        '  return a + c;',
        '}',
      ].join('\n');

      const patch = createTwoFilesPatch('test.js', 'test.js', oldCode, newCode);

      // Should include context lines
      expect(patch).toContain(' function test() {');
      expect(patch).toContain(' const a = 1;');
      expect(patch).toContain('-  const b = 2;');
      expect(patch).toContain('-  return a + b;');
      expect(patch).toContain('+  const c = 3;');
      expect(patch).toContain('+  return a + c;');
    });
  });

  describe('Edge Cases', () => {
    test('should handle files with no trailing newline', () => {
      const oldText = 'No newline';
      const newText = 'No newline\nWith newline';

      const patch = createTwoFilesPatch(
        'file.txt',
        'file.txt',
        oldText,
        newText
      );

      expect(patch).toContain('No newline');
      expect(patch).toContain('+With newline');
    });

    test('should handle unicode characters', () => {
      const oldText = 'Hello 世界';
      const newText = 'Hello 🌍';

      const patch = createTwoFilesPatch(
        'unicode.txt',
        'unicode.txt',
        oldText,
        newText
      );

      expect(patch).toContain('-Hello 世界');
      expect(patch).toContain('+Hello 🌍');
    });
  });
});
