import { LogParser } from './log-parser';
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
          new_string: 'const x = 2;'
        },
        result: 'success'
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(result.timestamp).toBe('2024-01-01T10:00:00.000Z');
      expect(result.tool).toBe('Edit');
      expect(result.filePath).toBe('/path/to/file.ts');
      expect(result.summary).toBe('Edit operation on /path/to/file.ts');
      expect(result.changeType).toBe(ChangeType.UPDATE);
    });

    it('should parse a valid Write tool log entry', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:01:00.000Z',
        tool: 'Write',
        parameters: {
          file_path: '/path/to/new-file.ts',
          content: 'export const newFunction = () => {};'
        },
        result: 'success'
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBe('2024-01-01T10:01:00.000Z');
      expect(result.tool).toBe('Write');
      expect(result.filePath).toBe('/path/to/new-file.ts');
      expect(result.summary).toBe('Write operation on /path/to/new-file.ts');
      expect(result.changeType).toBe(ChangeType.CREATE);
    });

    it('should parse a valid Read tool log entry', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:02:00.000Z',
        tool: 'Read',
        parameters: {
          file_path: '/path/to/existing-file.ts'
        },
        result: 'file contents'
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result.timestamp).toBe('2024-01-01T10:02:00.000Z');
      expect(result.tool).toBe('Read');
      expect(result.filePath).toBe('/path/to/existing-file.ts');
      expect(result.summary).toBe('Read operation on /path/to/existing-file.ts');
      expect(result.changeType).toBe(ChangeType.READ);
    });

    it('should parse a valid Bash tool log entry without file path', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:03:00.000Z',
        tool: 'Bash',
        parameters: {
          command: 'npm install'
        },
        result: 'command output'
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result.timestamp).toBe('2024-01-01T10:03:00.000Z');
      expect(result.tool).toBe('Bash');
      expect(result.filePath).toBeUndefined();
      expect(result.summary).toBe('Bash command: npm install');
      expect(result.changeType).toBe(ChangeType.READ);
    });

    it('should parse a valid Grep tool log entry without file path', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:04:00.000Z',
        tool: 'Grep',
        parameters: {
          pattern: 'function.*test',
          path: '/src'
        },
        result: 'search results'
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result.timestamp).toBe('2024-01-01T10:04:00.000Z');
      expect(result.tool).toBe('Grep');
      expect(result.filePath).toBeUndefined();
      expect(result.summary).toBe('Grep search for pattern: function.*test');
      expect(result.changeType).toBe(ChangeType.READ);
    });

    it('should parse a valid MultiEdit tool log entry', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:05:00.000Z',
        tool: 'MultiEdit',
        parameters: {
          file_path: '/path/to/file.ts',
          edits: [
            { old_string: 'old1', new_string: 'new1' },
            { old_string: 'old2', new_string: 'new2' }
          ]
        },
        result: 'success'
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result.timestamp).toBe('2024-01-01T10:05:00.000Z');
      expect(result.tool).toBe('MultiEdit');
      expect(result.filePath).toBe('/path/to/file.ts');
      expect(result.summary).toBe('MultiEdit operation on /path/to/file.ts');
      expect(result.changeType).toBe(ChangeType.UPDATE);
    });

    it('should throw error for malformed JSON', () => {
      const malformedJson = '{ invalid json }';

      expect(() => LogParser.parseLogEntry(malformedJson)).toThrow('Invalid JSON format');
    });

    it('should throw error for missing required fields', () => {
      const incompleteEntry = JSON.stringify({
        tool: 'Edit'
        // missing timestamp and parameters
      });

      expect(() => LogParser.parseLogEntry(incompleteEntry)).toThrow('Missing required fields');
    });

    it('should handle log entry with unknown tool type', () => {
      const logEntry = JSON.stringify({
        timestamp: '2024-01-01T10:06:00.000Z',
        tool: 'UnknownTool',
        parameters: {},
        result: 'some result'
      });

      const result = LogParser.parseLogEntry(logEntry);

      expect(result).toBeDefined();
      expect(result.tool).toBe('UnknownTool');
      expect(result.filePath).toBeUndefined();
      expect(result.summary).toBe('UnknownTool operation');
      expect(result.changeType).toBe(ChangeType.READ);
    });
  });
});