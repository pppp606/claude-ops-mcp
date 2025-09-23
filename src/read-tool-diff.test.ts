/**
 * @fileoverview Comprehensive test suite for Read tool diff generation functionality
 * This file implements TDD Red phase tests for Read tool-specific diff generation,
 * focusing on the unique characteristics of Read operations and their display requirements.
 *
 * Read tool differs from other tools as it performs read-only operations without modifying files,
 * but needs to capture and format content for Claude analysis and debugging purposes.
 */

import type { ReadDiff } from './types/operation-index';

// Import the function we're testing (this will fail until implementation exists - RED PHASE)
import { generateReadDiff } from './operation-diff';

describe('Read Tool Diff Generation', () => {
  // Test helper to create mock read scenarios
  const createMockReadScenario = (
    filename: string,
    content: string,
    options: {
      offset?: number;
      limit?: number;
      expectedStartLine?: number;
      expectedEndLine?: number;
      expectedLinesRead?: number;
    } = {}
  ) => ({
    filename,
    content,
    offset: options.offset,
    limit: options.limit,
    expectedStartLine: options.expectedStartLine,
    expectedEndLine: options.expectedEndLine,
    expectedLinesRead: options.expectedLinesRead ?? content.split('\n').length
  });

  describe('File Content Display', () => {
    it('should generate ReadDiff for complete file reading', async () => {
      const scenario = createMockReadScenario(
        '/src/config/settings.json',
        '{\n  "setting1": "value1",\n  "setting2": "value2",\n  "setting3": "value3"\n}',
        { expectedLinesRead: 5 }
      );

      const result = await generateReadDiff(
        scenario.filename,
        scenario.content
      );

      // Verify ReadDiff structure
      expect(result.tool).toBe('Read');
      expect(result.content).toBe(scenario.content);
      expect(result.linesRead).toBe(scenario.expectedLinesRead);
      expect(result.startLine).toBeUndefined();
      expect(result.endLine).toBeUndefined();
    });

    it('should generate ReadDiff for partial file reading with offset', async () => {
      const fullContent = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10';
      const expectedPartialContent = 'line 4\nline 5\nline 6\nline 7\nline 8';

      const scenario = createMockReadScenario(
        '/src/utils/helper.ts',
        expectedPartialContent,
        {
          offset: 3, // Start from line 4 (0-indexed)
          limit: 5,  // Read 5 lines
          expectedStartLine: 4,
          expectedEndLine: 8,
          expectedLinesRead: 5
        }
      );

      const result = await generateReadDiff(
        scenario.filename,
        scenario.content,
        scenario.offset,
        scenario.limit
      );

      // Verify partial read information
      expect(result.tool).toBe('Read');
      expect(result.content).toBe(scenario.content);
      expect(result.linesRead).toBe(scenario.expectedLinesRead);
      expect(result.startLine).toBe(scenario.expectedStartLine);
      expect(result.endLine).toBe(scenario.expectedEndLine);
    });

    it('should generate ReadDiff for limited file reading without offset', async () => {
      const expectedContent = 'function test() {\n  return "hello";\n}\n\nconst value = 42;';

      const scenario = createMockReadScenario(
        '/src/components/Test.tsx',
        expectedContent,
        {
          limit: 5,
          expectedStartLine: 1,
          expectedEndLine: 5,
          expectedLinesRead: 5
        }
      );

      const result = await generateReadDiff(
        scenario.filename,
        scenario.content,
        undefined, // no offset
        scenario.limit
      );

      // Verify limited read from beginning
      expect(result.tool).toBe('Read');
      expect(result.content).toBe(scenario.content);
      expect(result.linesRead).toBe(scenario.expectedLinesRead);
      expect(result.startLine).toBe(scenario.expectedStartLine);
      expect(result.endLine).toBe(scenario.expectedEndLine);
    });
  });

  describe('Read Information Formatting', () => {
    it('should accurately count lines in content', async () => {
      const multiLineContent = 'import React from "react";\n\nfunction Component() {\n  return (\n    <div>\n      <h1>Title</h1>\n      <p>Content</p>\n    </div>\n  );\n}\n\nexport default Component;';

      const result = await generateReadDiff(
        '/src/components/Component.tsx',
        multiLineContent
      );

      expect(result.linesRead).toBe(12); // 12 lines including empty lines
      expect(result.content).toBe(multiLineContent);
    });

    it('should handle single line content correctly', async () => {
      const singleLineContent = 'export const API_URL = "https://api.example.com";';

      const result = await generateReadDiff(
        '/src/config/api.ts',
        singleLineContent
      );

      expect(result.linesRead).toBe(1);
      expect(result.content).toBe(singleLineContent);
      expect(result.startLine).toBeUndefined();
      expect(result.endLine).toBeUndefined();
    });

    it('should provide accurate range information for partial reads', async () => {
      const content = 'line 6\nline 7\nline 8';

      const result = await generateReadDiff(
        '/src/test.txt',
        content,
        5, // offset = 5 (start from line 6)
        3  // limit = 3 lines
      );

      expect(result.startLine).toBe(6);
      expect(result.endLine).toBe(8);
      expect(result.linesRead).toBe(3);
    });
  });

  describe('Display Format for Claude Usage', () => {
    it('should preserve exact content formatting for code analysis', async () => {
      const codeContent = 'class Calculator {\n  constructor() {\n    this.value = 0;\n  }\n\n  add(num) {\n    this.value += num;\n    return this;\n  }\n}';

      const result = await generateReadDiff(
        '/src/calculator.js',
        codeContent
      );

      // Content should be preserved exactly as provided for Claude analysis
      expect(result.content).toBe(codeContent);
      expect(result.content).toContain('class Calculator');
      expect(result.content).toContain('  constructor()');
      expect(result.content).toContain('    this.value = 0;');
      expect(result.linesRead).toBe(10);
    });

    it('should provide metadata for file structure understanding', async () => {
      const jsonContent = '{\n  "name": "test-project",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.0.0"\n  }\n}';

      const result = await generateReadDiff(
        '/package.json',
        jsonContent
      );

      // Metadata should help Claude understand file structure
      expect(result.tool).toBe('Read');
      expect(result.linesRead).toBe(7);
      expect(result.content).toContain('"name": "test-project"');
      expect(result.content).toContain('"dependencies"');
    });

    it('should handle configuration files with appropriate detail', async () => {
      const configContent = 'module.exports = {\n  preset: "ts-jest",\n  testEnvironment: "node",\n  collectCoverageFrom: [\n    "src/**/*.{ts,tsx}",\n    "!src/**/*.d.ts"\n  ]\n};';

      const result = await generateReadDiff(
        '/jest.config.js',
        configContent
      );

      expect(result.content).toBe(configContent);
      expect(result.linesRead).toBe(8);
      expect(result.content).toContain('preset: "ts-jest"');
      expect(result.content).toContain('collectCoverageFrom');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file reading', async () => {
      const result = await generateReadDiff(
        '/src/empty.txt',
        ''
      );

      expect(result.tool).toBe('Read');
      expect(result.content).toBe('');
      expect(result.linesRead).toBe(0);
      expect(result.startLine).toBeUndefined();
      expect(result.endLine).toBeUndefined();
    });

    it('should handle files with only whitespace', async () => {
      const whitespaceContent = '   \n\n  \t\n   ';

      const result = await generateReadDiff(
        '/src/whitespace.txt',
        whitespaceContent
      );

      expect(result.content).toBe(whitespaceContent);
      expect(result.linesRead).toBe(4); // 4 lines including empty ones
    });

    it('should handle very long lines correctly', async () => {
      const longLineContent = 'a'.repeat(5000) + '\nshort line\n' + 'b'.repeat(3000);

      const result = await generateReadDiff(
        '/src/long-lines.txt',
        longLineContent
      );

      expect(result.content).toBe(longLineContent);
      expect(result.linesRead).toBe(3);
      expect(result.content.length).toBeGreaterThan(8000);
    });

    it('should throw error for invalid file path', async () => {
      await expect(
        generateReadDiff('', 'content')
      ).rejects.toThrow('File path cannot be empty');
    });

    it('should throw error for null file path', async () => {
      await expect(
        generateReadDiff(null as any, 'content')
      ).rejects.toThrow('File path cannot be null or undefined');
    });

    it('should throw error for undefined content', async () => {
      await expect(
        generateReadDiff('/src/test.txt', undefined as any)
      ).rejects.toThrow('Content cannot be undefined');
    });

    it('should handle null content as empty string', async () => {
      const result = await generateReadDiff(
        '/src/null-content.txt',
        null as any
      );

      expect(result.content).toBe('');
      expect(result.linesRead).toBe(0);
    });
  });

  describe('Tool-specific Integration', () => {
    it('should maintain consistency with ReadDiff type definition', async () => {
      const result = await generateReadDiff(
        '/src/test.ts',
        'test content\nsecond line'
      );

      // Verify all required ReadDiff properties are present
      expect(result).toHaveProperty('tool');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('linesRead');
      expect(result.tool).toBe('Read');
      expect(typeof result.content).toBe('string');
      expect(typeof result.linesRead).toBe('number');
    });

    it('should provide optional range information when applicable', async () => {
      const result = await generateReadDiff(
        '/src/test.ts',
        'partial content',
        10, // offset
        5   // limit
      );

      expect(result.startLine).toBe(11); // offset + 1
      expect(result.endLine).toBe(15);   // startLine + limit - 1
      expect(result.linesRead).toBe(5);
    });

    it('should work with different file types and extensions', async () => {
      const testCases = [
        { path: '/src/component.tsx', content: '<div>JSX content</div>' },
        { path: '/src/styles.css', content: '.class { color: red; }' },
        { path: '/README.md', content: '# Project Title\n\nDescription here.' },
        { path: '/package.json', content: '{"name": "test"}' },
        { path: '/src/script.sh', content: '#!/bin/bash\necho "hello"' },
        { path: '/config.yaml', content: 'key: value\narray:\n  - item1' }
      ];

      for (const testCase of testCases) {
        const result = await generateReadDiff(testCase.path, testCase.content);

        expect(result.tool).toBe('Read');
        expect(result.content).toBe(testCase.content);
        expect(result.linesRead).toBeGreaterThan(0);
      }
    });

    it('should support read operations for debugging and analysis', async () => {
      const debugContent = 'console.log("Debug point 1");\nconst data = fetchData();\nconsole.log("Data:", data);\nprocessData(data);';

      const result = await generateReadDiff(
        '/src/debug.js',
        debugContent
      );

      // Should preserve debug information exactly for analysis
      expect(result.content).toContain('console.log("Debug point 1")');
      expect(result.content).toContain('fetchData()');
      expect(result.content).toContain('processData(data)');
      expect(result.linesRead).toBe(4);
    });
  });

  describe('Performance and Large Files', () => {
    it('should efficiently handle moderately large content', async () => {
      // Create content with 1000 lines
      const largeContent = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}: Some content here`).join('\n');

      const result = await generateReadDiff(
        '/src/large-file.txt',
        largeContent
      );

      expect(result.linesRead).toBe(1000);
      expect(result.content).toBe(largeContent);
      expect(result.content.split('\n')).toHaveLength(1000);
    });

    it('should handle partial reading of large content efficiently', async () => {
      const partialContent = Array.from({ length: 50 }, (_, i) => `Line ${i + 501}: Partial content`).join('\n');

      const result = await generateReadDiff(
        '/src/large-file-partial.txt',
        partialContent,
        500, // Start from line 501
        50   // Read 50 lines
      );

      expect(result.startLine).toBe(501);
      expect(result.endLine).toBe(550);
      expect(result.linesRead).toBe(50);
      expect(result.content).toBe(partialContent);
    });
  });
});