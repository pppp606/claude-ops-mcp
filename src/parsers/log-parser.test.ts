import { LogParser, LogParseError } from './log-parser';
import { ChangeType } from '../types/operation-index';

describe('LogParser', () => {
  describe('parseLogEntry', () => {
    it('should parse a valid Edit tool log entry', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:00:00.000Z',
        tool: 'Edit',
        parameters: {
          file_path: '/path/to/file.ts',
          old_string: 'const x = 1;',
          new_string: 'const x = 2;',
        },
        result: 'success',
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).not.toBeNull();
      expect(result!.id).toBeDefined();
      expect(result!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      expect(result!.timestamp).toBe('2024-01-01T10:00:00.000Z');
      expect(result!.tool).toBe('Edit');
      expect(result!.filePath).toBe('/path/to/file.ts');
      expect(result!.summary).toBe('Edit operation on /path/to/file.ts');
      expect(result!.changeType).toBe(ChangeType.UPDATE);
    });

    it('should parse a valid Write tool log entry', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:01:00.000Z',
        tool: 'Write',
        parameters: {
          file_path: '/path/to/new-file.ts',
          content: 'export const newFunction = () => {};',
        },
        result: 'success',
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result!.id).toBeDefined();
      expect(result!.timestamp).toBe('2024-01-01T10:01:00.000Z');
      expect(result!.tool).toBe('Write');
      expect(result!.filePath).toBe('/path/to/new-file.ts');
      expect(result!.summary).toBe('Write operation on /path/to/new-file.ts');
      expect(result!.changeType).toBe(ChangeType.CREATE);
    });

    it('should parse a valid Read tool log entry', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:02:00.000Z',
        tool: 'Read',
        parameters: {
          file_path: '/path/to/existing-file.ts',
        },
        result: 'file contents',
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result!.timestamp).toBe('2024-01-01T10:02:00.000Z');
      expect(result!.tool).toBe('Read');
      expect(result!.filePath).toBe('/path/to/existing-file.ts');
      expect(result!.summary).toBe(
        'Read operation on /path/to/existing-file.ts'
      );
      expect(result!.changeType).toBe(ChangeType.READ);
    });

    it('should parse a valid Bash tool log entry without file path', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:03:00.000Z',
        tool: 'Bash',
        parameters: {
          command: 'npm install',
        },
        result: 'command output',
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result!.timestamp).toBe('2024-01-01T10:03:00.000Z');
      expect(result!.tool).toBe('Bash');
      expect(result!.filePath).toBeUndefined();
      expect(result!.summary).toBe('Bash command: npm install');
      expect(result!.changeType).toBe(ChangeType.READ);
    });

    it('should parse a valid Grep tool log entry without file path', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:04:00.000Z',
        tool: 'Grep',
        parameters: {
          pattern: 'function.*test',
          path: '/src',
        },
        result: 'search results',
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result!.timestamp).toBe('2024-01-01T10:04:00.000Z');
      expect(result!.tool).toBe('Grep');
      expect(result!.filePath).toBeUndefined();
      expect(result!.summary).toBe('Grep search for pattern: function.*test');
      expect(result!.changeType).toBe(ChangeType.READ);
    });

    it('should parse a valid MultiEdit tool log entry', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:05:00.000Z',
        tool: 'MultiEdit',
        parameters: {
          file_path: '/path/to/file.ts',
          edits: [
            { old_string: 'old1', new_string: 'new1' },
            { old_string: 'old2', new_string: 'new2' },
          ],
        },
        result: 'success',
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result!.timestamp).toBe('2024-01-01T10:05:00.000Z');
      expect(result!.tool).toBe('MultiEdit');
      expect(result!.filePath).toBe('/path/to/file.ts');
      expect(result!.summary).toBe('MultiEdit operation on /path/to/file.ts');
      expect(result!.changeType).toBe(ChangeType.UPDATE);
    });

    it('should throw LogParseError for malformed JSON', () => {
      const malformedJson = '{ invalid json }';

      expect(() => LogParser.parseLogEntry(malformedJson)).toThrow(
        LogParseError
      );
      expect(() => LogParser.parseLogEntry(malformedJson)).toThrow(
        'Invalid JSON format'
      );
    });

    it('should return null for missing required fields', () => {
      const incompleteEntry = JSON.stringify({
        tool: 'Edit',
        // missing timestamp and parameters
      });

      const result = LogParser.parseLogEntry(incompleteEntry);
      expect(result).toBeNull();
    });

    it('should validate timestamp format when requested', () => {
      const entryWithBadTimestamp = JSON.stringify({
        timestamp: 'invalid-timestamp',
        tool: 'Edit',
        parameters: {
          file_path: '/file.ts',
          old_string: 'old',
          new_string: 'new',
        },
        result: 'success',
      });

      expect(() =>
        LogParser.parseLogEntry(entryWithBadTimestamp, {
          validateTimestamp: true,
        })
      ).toThrow(LogParseError);
    });

    it('should accept valid ISO 8601 timestamps when validation is enabled', () => {
      const validTimestamps = [
        '2024-01-01T10:00:00.000Z',
        '2024-01-01T10:00:00Z',
        '2024-01-01T10:00:00.123Z',
      ];

      for (const timestamp of validTimestamps) {
        const entry = JSON.stringify({
          timestamp,
          tool: 'Edit',
          parameters: {
            file_path: '/file.ts',
            old_string: 'old',
            new_string: 'new',
          },
          result: 'success',
        });

        expect(() =>
          LogParser.parseLogEntry(entry, { validateTimestamp: true })
        ).not.toThrow();
      }
    });

    it('should handle log entry with unknown tool type', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:06:00.000Z',
        tool: 'UnknownTool',
        parameters: {},
        result: 'some result',
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result!.tool).toBe('UnknownTool');
      expect(result!.filePath).toBeUndefined();
      expect(result!.summary).toBe('UnknownTool operation');
      expect(result!.changeType).toBe(ChangeType.READ);
    });
  });

  describe('parseLogStream', () => {
    it('should parse multiple log entries from JSONL stream', () => {
      const jsonlContent = [
        JSON.stringify({
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Edit',
          parameters: {
            file_path: '/file1.ts',
            old_string: 'old',
            new_string: 'new',
          },
          result: 'success',
        }),
        JSON.stringify({
          timestamp: '2024-01-01T10:01:00.000Z',
          tool: 'Write',
          parameters: { file_path: '/file2.ts', content: 'content' },
          result: 'success',
        }),
        JSON.stringify({
          timestamp: '2024-01-01T10:02:00.000Z',
          tool: 'Bash',
          parameters: { command: 'npm test' },
          result: 'output',
        }),
      ].join('\n');

      const results = LogParser.parseLogStream(jsonlContent);

      expect(results).toHaveLength(3);

      expect(results[0]!.tool).toBe('Edit');
      expect(results[0]!.filePath).toBe('/file1.ts');
      expect(results[0]!.changeType).toBe(ChangeType.UPDATE);

      expect(results[1]!.tool).toBe('Write');
      expect(results[1]!.filePath).toBe('/file2.ts');
      expect(results[1]!.changeType).toBe(ChangeType.CREATE);

      expect(results[2]!.tool).toBe('Bash');
      expect(results[2]!.filePath).toBeUndefined();
      expect(results[2]!.changeType).toBe(ChangeType.READ);
    });

    it('should handle empty lines in JSONL stream', () => {
      const jsonlContent = [
        JSON.stringify({
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Edit',
          parameters: {
            file_path: '/file.ts',
            old_string: 'old',
            new_string: 'new',
          },
          result: 'success',
        }),
        '',
        '   ',
        JSON.stringify({
          timestamp: '2024-01-01T10:01:00.000Z',
          tool: 'Write',
          parameters: { file_path: '/file2.ts', content: 'content' },
          result: 'success',
        }),
      ].join('\n');

      const results = LogParser.parseLogStream(jsonlContent);

      expect(results).toHaveLength(2);
      expect(results[0]!.tool).toBe('Edit');
      expect(results[1]!.tool).toBe('Write');
    });

    it('should skip malformed entries and continue processing', () => {
      const jsonlContent = [
        JSON.stringify({
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Edit',
          parameters: {
            file_path: '/file.ts',
            old_string: 'old',
            new_string: 'new',
          },
          result: 'success',
        }),
        '{ invalid json }',
        JSON.stringify({
          tool: 'Write', // missing timestamp and parameters
        }),
        JSON.stringify({
          timestamp: '2024-01-01T10:01:00.000Z',
          tool: 'Write',
          parameters: { file_path: '/file2.ts', content: 'content' },
          result: 'success',
        }),
      ].join('\n');

      const results = LogParser.parseLogStream(jsonlContent);

      expect(results).toHaveLength(2);
      expect(results[0]!.tool).toBe('Edit');
      expect(results[1]!.tool).toBe('Write');
    });

    it('should return empty array for empty or whitespace-only input', () => {
      expect(LogParser.parseLogStream('')).toEqual([]);
      expect(LogParser.parseLogStream('   \n\n  \n')).toEqual([]);
    });

    it('should handle single line without newline', () => {
      const jsonlContent = JSON.stringify({
        timestamp: '2024-01-01T10:00:00.000Z',
        tool: 'Edit',
        parameters: {
          file_path: '/file.ts',
          old_string: 'old',
          new_string: 'new',
        },
        result: 'success',
      });

      const results = LogParser.parseLogStream(jsonlContent);

      expect(results).toHaveLength(1);
      expect(results[0]!.tool).toBe('Edit');
      expect(results[0]!.filePath).toBe('/file.ts');
    });

    it('should handle JSONL with trailing newline', () => {
      const jsonlContent = [
        JSON.stringify({
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Edit',
          parameters: {
            file_path: '/file.ts',
            old_string: 'old',
            new_string: 'new',
          },
          result: 'success',
        }),
        JSON.stringify({
          timestamp: '2024-01-01T10:01:00.000Z',
          tool: 'Write',
          parameters: { file_path: '/file2.ts', content: 'content' },
          result: 'success',
        }),
        '', // trailing newline results in empty string
      ].join('\n');

      const results = LogParser.parseLogStream(jsonlContent);

      expect(results).toHaveLength(2);
      expect(results[0]!.tool).toBe('Edit');
      expect(results[1]!.tool).toBe('Write');
    });

    it('should preserve operation order from the stream', () => {
      const jsonlContent = [
        JSON.stringify({
          timestamp: '2024-01-01T10:02:00.000Z',
          tool: 'Read',
          parameters: { file_path: '/file3.ts' },
          result: 'content',
        }),
        JSON.stringify({
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Edit',
          parameters: {
            file_path: '/file1.ts',
            old_string: 'old',
            new_string: 'new',
          },
          result: 'success',
        }),
        JSON.stringify({
          timestamp: '2024-01-01T10:01:00.000Z',
          tool: 'Write',
          parameters: { file_path: '/file2.ts', content: 'content' },
          result: 'success',
        }),
      ].join('\n');

      const results = LogParser.parseLogStream(jsonlContent);

      expect(results).toHaveLength(3);
      // Should preserve stream order, not timestamp order
      expect(results[0]!.timestamp).toBe('2024-01-01T10:02:00.000Z');
      expect(results[1]!.timestamp).toBe('2024-01-01T10:00:00.000Z');
      expect(results[2]!.timestamp).toBe('2024-01-01T10:01:00.000Z');
    });

    it('should respect maxEntries option', () => {
      const jsonlContent = [
        JSON.stringify({
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Edit',
          parameters: {
            file_path: '/file1.ts',
            old_string: 'old',
            new_string: 'new',
          },
          result: 'success',
        }),
        JSON.stringify({
          timestamp: '2024-01-01T10:01:00.000Z',
          tool: 'Write',
          parameters: { file_path: '/file2.ts', content: 'content' },
          result: 'success',
        }),
        JSON.stringify({
          timestamp: '2024-01-01T10:02:00.000Z',
          tool: 'Read',
          parameters: { file_path: '/file3.ts' },
          result: 'content',
        }),
      ].join('\n');

      const results = LogParser.parseLogStream(jsonlContent, { maxEntries: 2 });
      expect(results).toHaveLength(2);
    });

    it('should throw detailed errors when skipMalformed is false', () => {
      const jsonlContent = [
        JSON.stringify({
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Edit',
          parameters: {
            file_path: '/file.ts',
            old_string: 'old',
            new_string: 'new',
          },
          result: 'success',
        }),
        '{ invalid json }',
      ].join('\n');

      expect(() =>
        LogParser.parseLogStream(jsonlContent, { skipMalformed: false })
      ).toThrow(LogParseError);
    });
  });

  describe('parseLogStreamWithMetadata', () => {
    it('should return metadata about the parsing process', () => {
      const jsonlContent = [
        JSON.stringify({
          timestamp: '2024-01-01T10:00:00.000Z',
          tool: 'Edit',
          parameters: {
            file_path: '/file.ts',
            old_string: 'old',
            new_string: 'new',
          },
          result: 'success',
        }),
        '{ invalid json }',
        JSON.stringify({
          timestamp: '2024-01-01T10:01:00.000Z',
          tool: 'Write',
          parameters: { file_path: '/file2.ts', content: 'content' },
          result: 'success',
        }),
      ].join('\n');

      const result = LogParser.parseLogStreamWithMetadata(jsonlContent);

      expect(result!.operations).toHaveLength(2);
      expect(result!.skippedCount).toBe(1);
      expect(result!.totalProcessed).toBe(3);
    });
  });

  describe('utility methods', () => {
    const sampleOperations = [
      {
        id: '1',
        timestamp: '2024-01-01T10:00:00.000Z',
        tool: 'Edit',
        filePath: '/file1.ts',
        summary: 'Edit file1',
        changeType: ChangeType.UPDATE,
      },
      {
        id: '2',
        timestamp: '2024-01-01T11:00:00.000Z',
        tool: 'Write',
        filePath: '/file2.ts',
        summary: 'Write file2',
        changeType: ChangeType.CREATE,
      },
      {
        id: '3',
        timestamp: '2024-01-01T12:00:00.000Z',
        tool: 'Read',
        filePath: '/file1.ts',
        summary: 'Read file1',
        changeType: ChangeType.READ,
      },
      {
        id: '4',
        timestamp: '2024-01-01T13:00:00.000Z',
        tool: 'Bash',
        summary: 'Bash command',
        changeType: ChangeType.READ,
      },
    ];

    describe('filterByChangeType', () => {
      it('should filter operations by change type', () => {
        const updates = LogParser.filterByChangeType(
          sampleOperations,
          ChangeType.UPDATE
        );
        expect(updates).toHaveLength(1);
        expect(updates[0]!.tool).toBe('Edit');

        const reads = LogParser.filterByChangeType(
          sampleOperations,
          ChangeType.READ
        );
        expect(reads).toHaveLength(2);
      });
    });

    describe('groupByFilePath', () => {
      it('should group operations by file path', () => {
        const groups = LogParser.groupByFilePath(sampleOperations);

        expect(groups.has('/file1.ts')).toBe(true);
        expect(groups.has('/file2.ts')).toBe(true);
        expect(groups.has('<no-file>')).toBe(true);

        expect(groups.get('/file1.ts')).toHaveLength(2);
        expect(groups.get('/file2.ts')).toHaveLength(1);
        expect(groups.get('<no-file>')).toHaveLength(1);
      });
    });

    describe('filterByDateRange', () => {
      it('should filter operations by date range', () => {
        const start = new Date('2024-01-01T10:30:00.000Z');
        const end = new Date('2024-01-01T12:30:00.000Z');

        const filtered = LogParser.filterByDateRange(
          sampleOperations,
          start,
          end
        );
        expect(filtered).toHaveLength(2);
        expect(filtered[0]!.tool).toBe('Write');
        expect(filtered[1]!.tool).toBe('Read');
      });
    });
  });
});
