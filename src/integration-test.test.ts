/**
 * Integration Tests for Operation History API
 *
 * These tests verify the complete workflow using real-world log data patterns,
 * testing the integration between log parsing, operation indexing, and diff generation.
 *
 * Test Categories:
 * 1. Real Log Data Processing
 * 2. End-to-End Workflow
 * 3. Performance Validation
 * 4. Error Recovery
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { LogParser } from './parsers/log-parser';
import { showOperationDiff, generateMultiEditDiff, generateBashDiff } from './operation-diff';
import { generateEditDiff, generateWriteDiff, generateReadDiff } from './operation-diff';
import type { OperationIndex, OperationDiff } from './types/operation-index';
import { ChangeType } from './types/operation-index';
import { performance } from 'perf_hooks';

// Real-world log data samples based on actual Claude Code usage patterns
const REAL_LOG_SAMPLES = {
  EDIT_OPERATION: '{"timestamp": "2025-09-23T14:30:45.123Z", "tool": "Edit", "parameters": {"file_path": "/src/components/Button.tsx", "old_string": "background: blue;", "new_string": "background: green;", "replace_all": false}, "result": {"success": true}}',

  WRITE_OPERATION: '{"timestamp": "2025-09-23T14:31:00.456Z", "tool": "Write", "parameters": {"file_path": "/src/utils/helper.ts", "content": "export function helper() { return \\"helper function\\"; }"}, "result": {"success": true}}',

  MULTI_EDIT_OPERATION: '{"timestamp": "2025-09-23T14:32:15.789Z", "tool": "MultiEdit", "parameters": {"file_path": "/src/services/api.ts", "edits": [{"old_string": "oldEndpoint", "new_string": "newEndpoint", "replace_all": false}, {"old_string": "oldMethod", "new_string": "newMethod", "replace_all": true}]}, "result": {"success": true}}',

  BASH_OPERATION: '{"timestamp": "2025-09-23T14:33:30.101Z", "tool": "Bash", "parameters": {"command": "npm run build", "timeout": 30000}, "result": {"success": true, "stdout": "Build completed successfully", "stderr": "", "exit_code": 0}}',

  READ_OPERATION: '{"timestamp": "2025-09-23T14:34:45.202Z", "tool": "Read", "parameters": {"file_path": "/src/config/settings.json", "limit": 100}, "result": {"success": true, "content": "{\\"setting1\\": \\"value1\\", \\"setting2\\": \\"value2\\"}"}}',

  COMPLEX_OPERATION: '{"timestamp": "2025-09-23T14:35:20.333Z", "tool": "MultiEdit", "parameters": {"file_path": "/src/components/Dashboard.tsx", "edits": [{"old_string": "import React from \\"react\\";", "new_string": "import React, { useState, useEffect } from \\"react\\";", "replace_all": false}, {"old_string": "const Dashboard = () => {", "new_string": "const Dashboard = () => {\\n  const [loading, setLoading] = useState(true);", "replace_all": false}, {"old_string": "return <div>Dashboard</div>;", "new_string": "return loading ? <div>Loading...</div> : <div>Dashboard</div>;", "replace_all": false}]}, "result": {"success": true}}',

  ERROR_CASE: '{"timestamp": "2025-09-23T14:36:10.444Z", "tool": "Edit", "parameters": {"file_path": "/nonexistent/file.ts", "old_string": "test", "new_string": "updated"}, "result": {"success": false, "error": "File not found"}}',

  LARGE_FILE_OPERATION: '{"timestamp": "2025-09-23T14:37:00.555Z", "tool": "Write", "parameters": {"file_path": "/src/generated/large-data.json", "content": "[{\\"id\\": 0, \\"value\\": \\"item-0\\"}, {\\"id\\": 1, \\"value\\": \\"item-1\\"}]"}, "result": {"success": true}}'
};

// Complete JSONL log stream for end-to-end testing
const COMPLETE_LOG_STREAM = Object.values(REAL_LOG_SAMPLES).join('\n');

describe('Integration Tests - Operation History API', () => {
  let performanceMetrics: {
    logParsing: number[];
    diffGeneration: number[];
    memoryUsage: number[];
  };

  beforeAll(() => {
    performanceMetrics = {
      logParsing: [],
      diffGeneration: [],
      memoryUsage: []
    };
  });

  afterAll(() => {
    // Log performance summary
    console.log('\n=== Performance Metrics Summary ===');
    console.log(`Log Parsing - Average: ${(performanceMetrics.logParsing.reduce((a, b) => a + b, 0) / performanceMetrics.logParsing.length).toFixed(2)}ms`);
    console.log(`Diff Generation - Average: ${(performanceMetrics.diffGeneration.reduce((a, b) => a + b, 0) / performanceMetrics.diffGeneration.length).toFixed(2)}ms`);
    console.log(`Memory Usage - Peak: ${Math.max(...performanceMetrics.memoryUsage).toFixed(2)}MB`);
  });

  describe('1. Real Log Data Processing', () => {
    test('should parse real Edit operation log entry', () => {
      const start = performance.now();
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.EDIT_OPERATION);
      const end = performance.now();
      performanceMetrics.logParsing.push(end - start);

      expect(operation).toMatchObject({
        tool: 'Edit',
        filePath: '/src/components/Button.tsx',
        summary: expect.stringContaining('Edit operation on /src/components/Button.tsx'),
        changeType: expect.any(String)
      });
      expect(operation.id).toBeDefined();
      expect(new Date(operation.timestamp).getTime()).not.toBeNaN();
    });

    test('should parse real Write operation log entry', () => {
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.WRITE_OPERATION);

      expect(operation).toMatchObject({
        tool: 'Write',
        filePath: '/src/utils/helper.ts',
        summary: expect.stringContaining('Write operation on /src/utils/helper.ts')
      });
    });

    test('should parse real MultiEdit operation log entry', () => {
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.MULTI_EDIT_OPERATION);

      expect(operation).toMatchObject({
        tool: 'MultiEdit',
        filePath: '/src/services/api.ts',
        summary: expect.stringContaining('MultiEdit operation on /src/services/api.ts')
      });
    });

    test('should parse real Bash operation log entry', () => {
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.BASH_OPERATION);

      expect(operation).toMatchObject({
        tool: 'Bash',
        summary: expect.stringContaining('npm run build')
      });
      expect(operation.filePath).toBeUndefined(); // Bash operations don't have file paths
    });

    test('should parse real Read operation log entry', () => {
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.READ_OPERATION);

      expect(operation).toMatchObject({
        tool: 'Read',
        filePath: '/src/config/settings.json',
        summary: expect.stringContaining('Read operation on /src/config/settings.json')
      });
    });

    test('should parse complex MultiEdit operation with multiple edits', () => {
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.COMPLEX_OPERATION);

      expect(operation).toMatchObject({
        tool: 'MultiEdit',
        filePath: '/src/components/Dashboard.tsx',
        summary: expect.stringContaining('MultiEdit operation on /src/components/Dashboard.tsx')
      });
    });

    test('should handle error cases in log data gracefully', () => {
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.ERROR_CASE);

      expect(operation).toMatchObject({
        tool: 'Edit',
        filePath: '/nonexistent/file.ts',
        summary: expect.stringContaining('Edit operation on /nonexistent/file.ts')
      });
    });

    test('should parse large file operations efficiently', () => {
      const start = performance.now();
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.LARGE_FILE_OPERATION);
      const end = performance.now();
      performanceMetrics.logParsing.push(end - start);

      expect(operation).toMatchObject({
        tool: 'Write',
        filePath: '/src/generated/large-data.json',
        summary: expect.stringContaining('Write operation on /src/generated/large-data.json')
      });

      // Should parse large content efficiently (under 100ms)
      expect(end - start).toBeLessThan(100);
    });

    test('should parse complete JSONL stream with multiple operations', () => {
      const start = performance.now();
      const operations = LogParser.parseLogStream(COMPLETE_LOG_STREAM);
      const end = performance.now();
      performanceMetrics.logParsing.push(end - start);

      expect(operations).toHaveLength(8);
      expect(operations[0]?.tool).toBe('Edit');
      expect(operations[1]?.tool).toBe('Write');
      expect(operations[2]?.tool).toBe('MultiEdit');
      expect(operations[3]?.tool).toBe('Bash');
      expect(operations[4]?.tool).toBe('Read');
      expect(operations[5]?.tool).toBe('MultiEdit');
      expect(operations[6]?.tool).toBe('Edit');
      expect(operations[7]?.tool).toBe('Write');

      // Should parse complete stream efficiently (under 50ms)
      expect(end - start).toBeLessThan(50);
    });

    test('should handle malformed entries in stream with skip option', () => {
      const malformedStream = [
        REAL_LOG_SAMPLES.EDIT_OPERATION,
        '{"invalid": "json"', // Malformed JSON
        REAL_LOG_SAMPLES.WRITE_OPERATION,
        '{}', // Missing required fields
        REAL_LOG_SAMPLES.READ_OPERATION
      ].join('\n');

      const result = LogParser.parseLogStreamWithMetadata(malformedStream, { skipMalformed: true });

      expect(result.operations).toHaveLength(3);
      expect(result.skippedCount).toBe(2);
      expect(result.totalProcessed).toBe(5); // Includes all non-empty lines
    });
  });

  describe('2. End-to-End Workflow', () => {
    test('should complete full workflow: Log → Index → Diff for Edit operation', async () => {
      // Step 1: Parse log entry
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.EDIT_OPERATION);
      expect(operation).toBeDefined();

      // Step 2: Generate diff using real-world patterns
      const start = performance.now();
      const diff = await generateEditDiff(
        '/src/components/Button.tsx',
        'const Button = () => { return <button style={{background: blue;}}>Click</button>; };',
        'background: blue;',
        'background: green;',
        false
      );
      const end = performance.now();
      performanceMetrics.diffGeneration.push(end - start);

      expect(diff).toMatchObject({
        tool: 'Edit',
        oldString: 'background: blue;',
        newString: 'background: green;',
        replaceAll: false,
        unifiedDiff: {
          filename: '/src/components/Button.tsx',
          oldVersion: expect.any(String),
          newVersion: expect.any(String),
          diffText: expect.stringContaining('-')
        }
      });

      // Should generate diff efficiently (under 10ms)
      expect(end - start).toBeLessThan(10);
    });

    test('should complete full workflow: Log → Index → Diff for Write operation', async () => {
      // Step 1: Parse log entry
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.WRITE_OPERATION);
      expect(operation).toBeDefined();

      // Step 2: Generate diff
      const start = performance.now();
      const diff = await generateWriteDiff(
        '/src/utils/helper.ts',
        undefined,
        'export function helper() { return "helper function"; }'
      );
      const end = performance.now();
      performanceMetrics.diffGeneration.push(end - start);

      expect(diff).toMatchObject({
        tool: 'Write',
        isNewFile: true,
        newContent: 'export function helper() { return "helper function"; }',
        unifiedDiff: {
          filename: '/src/utils/helper.ts',
          oldVersion: '',
          newVersion: 'export function helper() { return "helper function"; }',
          diffText: expect.stringContaining('+')
        }
      });
    });

    test('should complete full workflow for complex MultiEdit operation', async () => {
      // Parse complex operation
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.COMPLEX_OPERATION);
      expect(operation).toBeDefined();

      // Generate diff with realistic React component changes
      const originalContent = `import React from "react";

const Dashboard = () => {
  return <div>Dashboard</div>;
};

export default Dashboard;`;

      const edits = [
        {
          oldString: 'import React from "react";',
          newString: 'import React, { useState, useEffect } from "react";',
          replaceAll: false
        },
        {
          oldString: 'const Dashboard = () => {',
          newString: `const Dashboard = () => {
  const [loading, setLoading] = useState(true);`,
          replaceAll: false
        },
        {
          oldString: 'return <div>Dashboard</div>;',
          newString: 'return loading ? <div>Loading...</div> : <div>Dashboard</div>;',
          replaceAll: false
        }
      ];

      const start = performance.now();
      const diff = await generateMultiEditDiff(
        '/src/components/Dashboard.tsx',
        originalContent,
        edits
      );
      const end = performance.now();
      performanceMetrics.diffGeneration.push(end - start);

      expect(diff).toMatchObject({
        tool: 'MultiEdit',
        edits: expect.arrayContaining([
          expect.objectContaining({
            oldString: 'import React from "react";',
            newString: 'import React, { useState, useEffect } from "react";'
          })
        ]),
        unifiedDiff: expect.objectContaining({
          filename: '/src/components/Dashboard.tsx',
          diffText: expect.stringMatching(/[-+]/)
        })
      });

      // Verify intermediate states are tracked
      expect(diff.intermediateStates).toHaveLength(3);
      expect(diff.rollbackSteps).toHaveLength(3);
    });

    test('should complete full workflow for Bash operation with file system changes', async () => {
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.BASH_OPERATION);
      expect(operation).toBeDefined();

      const start = performance.now();
      const diff = await generateBashDiff(
        'npm run build',
        'Build completed successfully\nGenerated 1 file: dist/bundle.js',
        '',
        0,
        [
          {
            filePath: '/dist/bundle.js',
            changeType: ChangeType.CREATE,
            afterContent: 'console.log("Built successfully");'
          }
        ]
      );
      const end = performance.now();
      performanceMetrics.diffGeneration.push(end - start);

      expect(diff).toMatchObject({
        tool: 'Bash',
        command: 'npm run build',
        stdout: expect.stringContaining('Build completed successfully'),
        stderr: '',
        exitCode: 0,
        affectedFiles: expect.arrayContaining([
          expect.objectContaining({
            filePath: '/dist/bundle.js',
            changeType: ChangeType.CREATE
          })
        ])
      });
    });

    test('should handle Read operation workflow', async () => {
      const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.READ_OPERATION);
      expect(operation).toBeDefined();

      const start = performance.now();
      const diff = await generateReadDiff(
        '/src/config/settings.json',
        '{"setting1": "value1", "setting2": "value2"}',
        4,
        1,
        100
      );
      const end = performance.now();
      performanceMetrics.diffGeneration.push(end - start);

      expect(diff).toMatchObject({
        tool: 'Read',
        content: '{"setting1": "value1", "setting2": "value2"}',
        linesRead: 100
      });
    });
  });

  describe('3. Performance Validation', () => {
    test('should handle large volume operations efficiently', () => {
      // Generate large JSONL stream (1000 operations)
      const largeOperations = Array.from({ length: 1000 }, (_, i) =>
        REAL_LOG_SAMPLES.EDIT_OPERATION.replace('14:30:45.123Z', `14:${String(30 + Math.floor(i / 60)).padStart(2, '0')}:${String(45 + (i % 60)).padStart(2, '0')}.123Z`)
      ).join('\n');

      const start = performance.now();
      const operations = LogParser.parseLogStream(largeOperations);
      const end = performance.now();
      performanceMetrics.logParsing.push(end - start);

      expect(operations).toHaveLength(1000);
      // Should process 1000 operations in under 1 second
      expect(end - start).toBeLessThan(1000);
    });

    test('should handle large content efficiently', async () => {
      // Generate large content (100KB)
      const largeContent = Array.from({ length: 1000 }, (_, i) =>
        `Line ${i}: ${'x'.repeat(100)}`
      ).join('\n');

      const start = performance.now();
      const diff = await generateWriteDiff(
        '/tmp/large-file.txt',
        undefined,
        largeContent
      );
      const end = performance.now();
      performanceMetrics.diffGeneration.push(end - start);

      expect(diff.newContent).toHaveLength(largeContent.length);
      // Should handle large content efficiently (under 100ms)
      expect(end - start).toBeLessThan(100);
    });

    test('should maintain memory efficiency during processing', async () => {
      const beforeMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

      // Process multiple large operations
      for (let i = 0; i < 100; i++) {
        const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.EDIT_OPERATION);
        await generateWriteDiff(
          `/tmp/file-${i}.json`,
          undefined,
          JSON.stringify({ data: Array.from({ length: 100 }, (_, j) => `item-${j}`) })
        );
      }

      const afterMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      const memoryIncrease = afterMemory - beforeMemory;
      performanceMetrics.memoryUsage.push(memoryIncrease);

      // Memory increase should be reasonable (under 50MB)
      expect(memoryIncrease).toBeLessThan(50);
    });

    test('should handle concurrent operations', async () => {
      const start = performance.now();

      // Process multiple operations concurrently
      const promises = Array.from({ length: 50 }, async (_, i) => {
        const operation = LogParser.parseLogEntry(REAL_LOG_SAMPLES.EDIT_OPERATION);
        return generateEditDiff(
          `/src/file-${i}.tsx`,
          `const Component${i} = () => <div>Old</div>;`,
          'Old',
          'New',
          false
        );
      });

      const results = await Promise.all(promises);
      const end = performance.now();
      performanceMetrics.diffGeneration.push(end - start);

      expect(results).toHaveLength(50);
      results.forEach(diff => {
        expect(diff.tool).toBe('Edit');
        expect(diff.oldString).toBe('Old');
        expect(diff.newString).toBe('New');
      });

      // Should handle concurrent operations efficiently
      expect(end - start).toBeLessThan(500);
    });
  });

  describe('4. Error Recovery', () => {
    test('should handle corrupted log entries gracefully', () => {
      const corruptedStream = [
        REAL_LOG_SAMPLES.EDIT_OPERATION,
        '{"timestamp": "invalid-date", "tool": "Edit"}', // Invalid timestamp
        REAL_LOG_SAMPLES.WRITE_OPERATION,
        '{"tool": "Edit"}', // Missing timestamp
        REAL_LOG_SAMPLES.READ_OPERATION
      ].join('\n');

      const result = LogParser.parseLogStreamWithMetadata(corruptedStream, {
        skipMalformed: true,
        validateTimestamp: true
      });

      expect(result.operations).toHaveLength(3);
      expect(result.skippedCount).toBe(2);
    });

    test('should recover from diff generation errors', async () => {
      // Test with invalid file path
      await expect(generateEditDiff(
        '', // Invalid file path
        'content',
        'old',
        'new',
        false
      )).rejects.toThrow();

      // Test with missing old string
      await expect(generateEditDiff(
        '/valid/path.txt',
        'content without target',
        'nonexistent',
        'replacement',
        false
      )).rejects.toThrow();
    });

    test('should handle system resource constraints', async () => {
      // Test with extremely large content (should handle gracefully or fail fast)
      const extremelyLargeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB

      try {
        const diff = await generateWriteDiff(
          '/tmp/extreme-file.txt',
          undefined,
          extremelyLargeContent
        );
        // If it succeeds, verify it's handled correctly
        expect(diff.newContent).toHaveLength(extremelyLargeContent.length);
      } catch (error) {
        // If it fails, should be a proper error message
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/size|memory|limit/i);
      }
    });

    test('should maintain data integrity during partial failures', () => {
      const mixedQualityStream = [
        REAL_LOG_SAMPLES.EDIT_OPERATION,
        '{"invalid": json}', // Malformed JSON
        REAL_LOG_SAMPLES.WRITE_OPERATION,
        '{"timestamp": "", "tool": "", "parameters": {}}', // Empty required fields
        REAL_LOG_SAMPLES.MULTI_EDIT_OPERATION,
        'null', // Null entry
        REAL_LOG_SAMPLES.READ_OPERATION
      ].join('\n');

      const result = LogParser.parseLogStreamWithMetadata(mixedQualityStream, { skipMalformed: true });

      // Should preserve valid operations
      expect(result.operations).toHaveLength(4);
      expect(result.operations[0]?.tool).toBe('Edit');
      expect(result.operations[1]?.tool).toBe('Write');
      expect(result.operations[2]?.tool).toBe('MultiEdit');
      expect(result.operations[3]?.tool).toBe('Read');

      // Should track skipped entries
      expect(result.skippedCount).toBe(3);
    });
  });

  describe('5. Claude Integration Scenarios', () => {
    test('should provide useful information for Claude rollback scenarios', async () => {
      // Simulate a series of operations that Claude might want to rollback
      const operationSequence = [
        LogParser.parseLogEntry(REAL_LOG_SAMPLES.EDIT_OPERATION),
        LogParser.parseLogEntry(REAL_LOG_SAMPLES.MULTI_EDIT_OPERATION),
        LogParser.parseLogEntry(REAL_LOG_SAMPLES.WRITE_OPERATION)
      ];

      expect(operationSequence).toHaveLength(3);

      // Verify each operation has rollback-useful information
      operationSequence.forEach(operation => {
        expect(operation.timestamp).toBeDefined();
        expect(operation.tool).toBeDefined();
        expect(operation.summary).toBeDefined();
        expect(operation.id).toBeDefined();
      });

      // For MultiEdit, verify rollback steps are available
      const complexDiff = await generateMultiEditDiff(
        '/src/services/api.ts',
        'const api = { oldEndpoint, oldMethod };',
        [
          { oldString: 'oldEndpoint', newString: 'newEndpoint', replaceAll: false },
          { oldString: 'oldMethod', newString: 'newMethod', replaceAll: true }
        ]
      );

      expect(complexDiff.rollbackSteps).toHaveLength(2);
      expect(complexDiff.rollbackSteps![0]?.reverseEdit).toMatchObject({
        oldString: 'newEndpoint',
        newString: 'oldEndpoint'
      });
    });

    test('should provide debugging information for Claude analysis', async () => {
      const operations = LogParser.parseLogStream(COMPLETE_LOG_STREAM);

      // Group operations by file for debugging
      const fileGroups = LogParser.groupByFilePath(operations);
      expect(fileGroups.size).toBeGreaterThan(1);

      // Filter by change type for analysis
      const writeOps = LogParser.filterByChangeType(operations, ChangeType.CREATE);
      const updateOps = LogParser.filterByChangeType(operations, ChangeType.UPDATE);
      const readOps = LogParser.filterByChangeType(operations, ChangeType.READ);

      expect(writeOps.length).toBeGreaterThan(0);
      expect(updateOps.length).toBeGreaterThan(0);
      expect(readOps.length).toBeGreaterThan(0);

      // Date range filtering for temporal analysis
      const startDate = new Date('2025-09-23T14:30:00.000Z');
      const endDate = new Date('2025-09-23T14:35:00.000Z');
      const timeRangeOps = LogParser.filterByDateRange(operations, startDate, endDate);

      expect(timeRangeOps.length).toBeGreaterThan(0);
    });

    test('should validate real-world usage patterns', () => {
      // Test common Claude Code usage patterns
      const patterns = [
        // Pattern 1: Edit followed by test run
        [
          '{"timestamp": "2025-09-23T15:00:00.000Z", "tool": "Edit", "parameters": {"file_path": "/src/component.tsx", "old_string": "old", "new_string": "new"}}',
          '{"timestamp": "2025-09-23T15:00:05.000Z", "tool": "Bash", "parameters": {"command": "npm test"}}'
        ],
        // Pattern 2: Multiple related edits
        [
          '{"timestamp": "2025-09-23T15:01:00.000Z", "tool": "Edit", "parameters": {"file_path": "/src/types.ts", "old_string": "interface", "new_string": "type"}}',
          '{"timestamp": "2025-09-23T15:01:05.000Z", "tool": "Edit", "parameters": {"file_path": "/src/component.tsx", "old_string": "Interface", "new_string": "Type"}}'
        ],
        // Pattern 3: Create, edit, test cycle
        [
          '{"timestamp": "2025-09-23T15:02:00.000Z", "tool": "Write", "parameters": {"file_path": "/src/new-feature.ts", "content": "export const feature = () => {}"}}',
          '{"timestamp": "2025-09-23T15:02:05.000Z", "tool": "Edit", "parameters": {"file_path": "/src/new-feature.ts", "old_string": "{}", "new_string": "{ return \\"implemented\\"; }"}}',
          '{"timestamp": "2025-09-23T15:02:10.000Z", "tool": "Bash", "parameters": {"command": "npm run build"}}'
        ]
      ];

      patterns.forEach((pattern, index) => {
        const operations = LogParser.parseLogStream(pattern.join('\n'));
        expect(operations.length).toBeGreaterThan(1);

        // Verify chronological order
        for (let i = 1; i < operations.length; i++) {
          const prevTime = new Date(operations[i - 1]!.timestamp).getTime();
          const currTime = new Date(operations[i]!.timestamp).getTime();
          expect(currTime).toBeGreaterThanOrEqual(prevTime);
        }
      });
    });
  });
});