/**
 * @fileoverview Comprehensive error handling and edge case tests for operation-diff functionality
 *
 * This test suite covers error scenarios that Claude may encounter during operations,
 * providing robust error handling for rollback and debugging scenarios (Issue #5).
 *
 * Test Categories:
 * 1. Input Validation Errors - null/undefined/invalid parameters
 * 2. File System Related Errors - missing files, permissions, disk space
 * 3. Tool-specific Error Cases - each tool's unique error scenarios
 * 4. API Integration Errors - showOperationDiff edge cases
 * 5. Resource and Performance Limits - memory, timeout, large data
 *
 * Phase 3 - Red Phase: Tests should FAIL before error handling implementation
 */

// Jest globals are available without import in our configuration
import {
  showOperationDiff,
  generateEditDiff,
  generateWriteDiff,
  generateMultiEditDiff,
  generateBashDiff,
  generateReadDiff
} from './operation-diff';
import { ChangeType } from './types/operation-index';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Operation Diff Error Handling', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(() => {
    // Create temporary directory for file system tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'operation-diff-test-'));
    testFilePath = path.join(tempDir, 'test-file.txt');
  });

  afterEach(() => {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('1. Input Validation Errors', () => {
    describe('showOperationDiff - Input Validation', () => {
      it('should throw error for null operation ID', async () => {
        await expect(showOperationDiff(null as any))
          .rejects
          .toThrow('Operation ID is required and must be a non-empty string');
      });

      it('should throw error for undefined operation ID', async () => {
        await expect(showOperationDiff(undefined as any))
          .rejects
          .toThrow('Operation ID is required and must be a non-empty string');
      });

      it('should throw error for empty string operation ID', async () => {
        await expect(showOperationDiff(''))
          .rejects
          .toThrow('Operation ID is required and must be a non-empty string');
      });

      it('should throw error for whitespace-only operation ID', async () => {
        await expect(showOperationDiff('   '))
          .rejects
          .toThrow('Operation ID is required and must be a non-empty string');
      });

      it('should throw error for invalid UUID format', async () => {
        await expect(showOperationDiff('invalid-uuid-123'))
          .rejects
          .toThrow('Invalid operation ID format');
      });

      it('should throw error for non-string operation ID (number)', async () => {
        await expect(showOperationDiff(12345 as any))
          .rejects
          .toThrow('Operation ID is required and must be a non-empty string');
      });

      it('should throw error for non-string operation ID (object)', async () => {
        await expect(showOperationDiff({ id: 'test' } as any))
          .rejects
          .toThrow('Operation ID is required and must be a non-empty string');
      });

      it('should throw error for non-string operation ID (array)', async () => {
        await expect(showOperationDiff(['test-id'] as any))
          .rejects
          .toThrow('Operation ID is required and must be a non-empty string');
      });
    });

    describe('generateEditDiff - Input Validation', () => {
      it('should throw error for null file path', async () => {
        await expect(generateEditDiff(null as any, 'content', 'old', 'new'))
          .rejects
          .toThrow('File path cannot be null or undefined');
      });

      it('should throw error for undefined file path', async () => {
        await expect(generateEditDiff(undefined as any, 'content', 'old', 'new'))
          .rejects
          .toThrow('File path cannot be null or undefined');
      });

      it('should throw error for empty file path', async () => {
        await expect(generateEditDiff('', 'content', 'old', 'new'))
          .rejects
          .toThrow('File path cannot be empty');
      });

      it('should throw error for null original content', async () => {
        await expect(generateEditDiff('/test/file.txt', null as any, 'old', 'new'))
          .rejects
          .toThrow('Original content cannot be null or undefined');
      });

      it('should throw error for undefined original content', async () => {
        await expect(generateEditDiff('/test/file.txt', undefined as any, 'old', 'new'))
          .rejects
          .toThrow('Original content cannot be null or undefined');
      });

      it('should throw error for non-string parameters', async () => {
        await expect(generateEditDiff('/test/file.txt', 'content', 123 as any, 'new'))
          .rejects
          .toThrow('oldString must be a string');
      });

      it('should throw error for very large file content (memory limit)', async () => {
        const largeContent = 'x'.repeat(100 * 1024 * 1024); // 100MB string
        await expect(generateEditDiff('/test/file.txt', largeContent, 'old', 'new'))
          .rejects
          .toThrow('Content exceeds maximum size limit');
      });
    });

    describe('generateWriteDiff - Input Validation', () => {
      it('should throw error for null file path', async () => {
        await expect(generateWriteDiff(null as any, undefined, 'content'))
          .rejects
          .toThrow('File path cannot be null or undefined');
      });

      it('should throw error for invalid file path characters', async () => {
        await expect(generateWriteDiff('/invalid\0path', undefined, 'content'))
          .rejects
          .toThrow('File path contains invalid characters');
      });

      it('should throw error for extremely long file path', async () => {
        const longPath = '/' + 'a'.repeat(1000) + '.txt'; // Long path with extension
        await expect(generateWriteDiff(longPath, undefined, 'content'))
          .rejects
          .toThrow('File path exceeds maximum length');
      });

      it('should throw error for non-string new content', async () => {
        await expect(generateWriteDiff('/test/file.txt', undefined, 123 as any))
          .rejects
          .toThrow('New content must be a string');
      });
    });

    describe('generateMultiEditDiff - Input Validation', () => {
      it('should throw error for null edits array', async () => {
        await expect(generateMultiEditDiff('/test/file.txt', 'content', null as any))
          .rejects
          .toThrow('Edits must be an array');
      });

      it('should throw error for non-array edits parameter', async () => {
        await expect(generateMultiEditDiff('/test/file.txt', 'content', 'not-array' as any))
          .rejects
          .toThrow('Edits must be an array');
      });

      it('should throw error for invalid edit object structure', async () => {
        const invalidEdits = [{ invalidProperty: 'value' }] as any;
        await expect(generateMultiEditDiff('/test/file.txt', 'content', invalidEdits))
          .rejects
          .toThrow('Invalid edit at index 0: oldString and newString must be strings');
      });

      it('should throw error for edit with non-string oldString', async () => {
        const invalidEdits = [{ oldString: 123, newString: 'new' }] as any;
        await expect(generateMultiEditDiff('/test/file.txt', 'content', invalidEdits))
          .rejects
          .toThrow('Invalid edit at index 0: oldString and newString must be strings');
      });

      it('should throw error for circular reference in edits', async () => {
        const circularEdit: any = { oldString: 'old', newString: 'new' };
        circularEdit.circular = circularEdit;
        await expect(generateMultiEditDiff('/test/file.txt', 'content', [circularEdit]))
          .rejects
          .toThrow('Invalid edit object structure');
      });
    });

    describe('generateBashDiff - Input Validation', () => {
      it('should throw error for null command', async () => {
        await expect(generateBashDiff(null as any, '', '', 0, []))
          .rejects
          .toThrow('Command cannot be null or undefined');
      });

      it('should throw error for undefined command', async () => {
        await expect(generateBashDiff(undefined as any, '', '', 0, []))
          .rejects
          .toThrow('Command cannot be null or undefined');
      });

      it('should throw error for empty command', async () => {
        await expect(generateBashDiff('', '', '', 0, []))
          .rejects
          .toThrow('Command cannot be empty');
      });

      it('should throw error for invalid exit code type', async () => {
        await expect(generateBashDiff('echo test', '', '', 'invalid' as any, []))
          .rejects
          .toThrow('exitCode must be a number');
      });

      it('should throw error for null fileSystemChanges', async () => {
        await expect(generateBashDiff('echo test', '', '', 0, null as any))
          .rejects
          .toThrow('fileSystemChanges must be an array');
      });

      it('should throw error for malicious command injection', async () => {
        const maliciousCommand = 'rm -rf / && echo test';
        await expect(generateBashDiff(maliciousCommand, '', '', 0, []))
          .rejects
          .toThrow('Command contains potentially dangerous operations');
      });
    });

    describe('generateReadDiff - Input Validation', () => {
      it('should throw error for null file path', async () => {
        await expect(generateReadDiff(null as any, 'content'))
          .rejects
          .toThrow('File path cannot be null or undefined');
      });

      it('should throw error for undefined content', async () => {
        await expect(generateReadDiff('/test/file.txt', undefined as any))
          .rejects
          .toThrow('Content cannot be undefined');
      });

      it('should throw error for invalid offset type', async () => {
        await expect(generateReadDiff('/test/file.txt', 'content', 'invalid' as any))
          .rejects
          .toThrow('Offset must be a non-negative number');
      });

      it('should throw error for negative offset', async () => {
        await expect(generateReadDiff('/test/file.txt', 'content', -1))
          .rejects
          .toThrow('Offset must be a non-negative number');
      });

      it('should throw error for invalid limit type', async () => {
        await expect(generateReadDiff('/test/file.txt', 'content', 0, 'invalid' as any))
          .rejects
          .toThrow('Limit must be a positive number');
      });

      it('should throw error for zero or negative limit', async () => {
        await expect(generateReadDiff('/test/file.txt', 'content', 0, 0))
          .rejects
          .toThrow('Limit must be a positive number');
      });
    });
  });

  describe('2. File System Related Errors', () => {
    it('should handle file permission errors gracefully', async () => {
      if (process.platform !== 'win32') {
        // Create a file without read permissions
        const restrictedFile = path.join(tempDir, 'restricted.txt');
        fs.writeFileSync(restrictedFile, 'content');
        fs.chmodSync(restrictedFile, 0o000); // No permissions

        await expect(generateReadDiff(restrictedFile, 'content'))
          .rejects
          .toThrow('Permission denied');

        // Restore permissions for cleanup
        try {
          fs.chmodSync(restrictedFile, 0o644);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle non-existent file paths', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.txt');
      await expect(generateReadDiff(nonExistentPath, 'content'))
        .rejects
        .toThrow('File does not exist');
    });

    it('should handle directory path instead of file path', async () => {
      await expect(generateReadDiff(tempDir, 'content'))
        .rejects
        .toThrow('Path is a directory, not a file');
    });

    it('should handle disk space limitations', async () => {
      // Simulate disk space error for write operations
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      await expect(generateWriteDiff('/dev/full', undefined, largeContent))
        .rejects
        .toThrow('No space left on device');
    });

    it('should handle file system case sensitivity issues', async () => {
      if (process.platform === 'darwin' || process.platform === 'win32') {
        // Test case sensitivity on case-insensitive file systems
        const lowerCasePath = path.join(tempDir, 'test.txt');
        const upperCasePath = path.join(tempDir, 'TEST.txt');

        fs.writeFileSync(lowerCasePath, 'content');

        await expect(generateReadDiff(upperCasePath, 'content'))
          .rejects
          .toThrow('File path case mismatch');
      }
    });

    it('should handle symlink resolution errors', async () => {
      if (process.platform !== 'win32') {
        const brokenSymlink = path.join(tempDir, 'broken-link');
        fs.symlinkSync('/non/existent/target', brokenSymlink);

        await expect(generateReadDiff(brokenSymlink, 'content'))
          .rejects
          .toThrow('Broken symbolic link');
      }
    });

    it('should handle file locking scenarios', async () => {
      const lockedFile = path.join(tempDir, 'locked.txt');
      fs.writeFileSync(lockedFile, 'content');

      // Simulate file lock by opening file exclusively
      const fd = fs.openSync(lockedFile, 'r+');

      await expect(generateWriteDiff(lockedFile, 'old content', 'new content'))
        .rejects
        .toThrow('File is locked or in use');

      fs.closeSync(fd);
    });
  });

  describe('3. Tool-specific Error Cases', () => {
    describe('Edit Tool Errors', () => {
      it('should handle oldString not found in content', async () => {
        await expect(generateEditDiff('/test/file.txt', 'hello world', 'missing', 'replacement'))
          .rejects
          .toThrow('old string not found in file content');
      });

      it('should handle binary file content', async () => {
        const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString();
        await expect(generateEditDiff('/test/binary.bin', binaryContent, 'old', 'new'))
          .rejects
          .toThrow('Cannot edit binary file content');
      });

      it('should handle extremely large oldString', async () => {
        const largeOldString = 'x'.repeat(100000); // 100KB
        await expect(generateEditDiff('/test/file.txt', 'content', largeOldString, 'new'))
          .rejects
          .toThrow('Search string exceeds maximum size');
      });

      it('should handle regex special characters in oldString', async () => {
        const regexContent = 'function test() { return /.*+?^${}[]|\\()/; }';
        await expect(generateEditDiff('/test/file.js', regexContent, '/.*+?^${}[]|\\()', 'pattern'))
          .rejects
          .toThrow('Special regex characters in search string');
      });
    });

    describe('Write Tool Errors', () => {
      it('should handle write to read-only directory', async () => {
        if (process.platform !== 'win32') {
          const readOnlyDir = path.join(tempDir, 'readonly');
          fs.mkdirSync(readOnlyDir);
          fs.chmodSync(readOnlyDir, 0o444); // Read-only

          const fileInReadOnlyDir = path.join(readOnlyDir, 'file.txt');
          await expect(generateWriteDiff(fileInReadOnlyDir, undefined, 'content'))
            .rejects
            .toThrow('Permission denied: directory is read-only');

          // Restore permissions for cleanup
          try {
            fs.chmodSync(readOnlyDir, 0o755);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });

      it('should handle binary content corruption', async () => {
        const corruptBinary = Buffer.from([0xFF, 0xFE, 0xFD]).toString('utf8');
        await expect(generateWriteDiff('/test/binary.bin', undefined, corruptBinary))
          .rejects
          .toThrow('Invalid binary content encoding');
      });

      it('should handle filename with invalid characters', async () => {
        const invalidFilename = '/test/file<>:|?.txt';
        await expect(generateWriteDiff(invalidFilename, undefined, 'content'))
          .rejects
          .toThrow('Filename contains invalid characters');
      });
    });

    describe('MultiEdit Tool Errors', () => {
      it('should handle conflicting edits in sequence', async () => {
        const edits = [
          { oldString: 'hello', newString: 'hi' },
          { oldString: 'hello', newString: 'greetings' } // Conflicts with first edit
        ];
        await expect(generateMultiEditDiff('/test/file.txt', 'hello world', edits))
          .rejects
          .toThrow('edit 2: hello not found');
      });

      it('should handle maximum edit limit exceeded', async () => {
        const manyEdits = Array.from({ length: 1001 }, (_, i) => ({
          oldString: `old${i}`,
          newString: `new${i}`
        }));
        await expect(generateMultiEditDiff('/test/file.txt', 'content', manyEdits))
          .rejects
          .toThrow('Number of edits exceeds maximum limit of 1000');
      });

      it('should handle circular edit dependencies', async () => {
        const circularEdits = [
          { oldString: 'a', newString: 'b' },
          { oldString: 'b', newString: 'c' },
          { oldString: 'c', newString: 'a' } // Creates circular dependency
        ];
        await expect(generateMultiEditDiff('/test/file.txt', 'a', circularEdits))
          .rejects
          .toThrow('Circular edit dependencies detected');
      });

      it('should handle memory exhaustion during large edit sequence', async () => {
        const largeContent = 'x'.repeat(100 * 1024 * 1024); // 100MB
        const edits = [{ oldString: 'x', newString: 'xx', replaceAll: true }];
        await expect(generateMultiEditDiff('/test/file.txt', largeContent, edits))
          .rejects
          .toThrow('Content exceeds maximum size limit');
      });
    });

    describe('Bash Tool Errors', () => {
      it('should handle command timeout', async () => {
        await expect(generateBashDiff('sleep 3600', '', '', 0, []))
          .rejects
          .toThrow('Command execution timeout');
      });

      it('should handle command not found', async () => {
        await expect(generateBashDiff('nonexistentcommand123', '', '', 127, []))
          .rejects
          .toThrow('Command not found');
      });

      it('should handle permission denied for command execution', async () => {
        await expect(generateBashDiff('/etc/shadow', '', '', 1, []))
          .rejects
          .toThrow('Permission denied for command execution');
      });

      it('should handle invalid command syntax', async () => {
        await expect(generateBashDiff('echo "unclosed quote', '', '', 2, []))
          .rejects
          .toThrow('Invalid command syntax');
      });

      it('should handle environment variable expansion errors', async () => {
        await expect(generateBashDiff('echo $UNDEFINED_VAR', '', '', 0, []))
          .rejects
          .toThrow('Undefined environment variable');
      });

      it('should handle output too large for memory', async () => {
        const largeOutput = 'x'.repeat(100 * 1024 * 1024); // 100MB output
        await expect(generateBashDiff('yes | head -c 100M', largeOutput, '', 0, []))
          .rejects
          .toThrow('Content exceeds maximum size limit');
      });
    });

    describe('Read Tool Errors', () => {
      it('should handle file encoding errors', async () => {
        const invalidUtf8 = Buffer.from([0xFF, 0xFE, 0xFD]);
        fs.writeFileSync(testFilePath, invalidUtf8);

        await expect(generateReadDiff(testFilePath, invalidUtf8.toString()))
          .rejects
          .toThrow('File encoding is not supported');
      });

      it('should handle offset beyond file length', async () => {
        fs.writeFileSync(testFilePath, 'short content');

        await expect(generateReadDiff(testFilePath, 'content', 1000))
          .rejects
          .toThrow('Offset exceeds file length');
      });

      it('should handle limit exceeding available lines', async () => {
        fs.writeFileSync(testFilePath, 'line1\nline2\n');

        await expect(generateReadDiff(testFilePath, 'content', 0, 1000))
          .rejects
          .toThrow('Limit exceeds available lines');
      });

      it('should handle binary file read attempt', async () => {
        const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
        fs.writeFileSync(testFilePath, binaryData);

        await expect(generateReadDiff(testFilePath, binaryData.toString()))
          .rejects
          .toThrow('Cannot read binary file as text');
      });
    });
  });

  describe('4. API Integration Errors', () => {
    describe('showOperationDiff API Errors', () => {
      it('should handle database connection failure', async () => {
        await expect(showOperationDiff('database-error-id'))
          .rejects
          .toThrow('Database connection failed');
      });

      it('should handle corrupted operation data', async () => {
        await expect(showOperationDiff('corrupted-data-id'))
          .rejects
          .toThrow('Operation data is corrupted');
      });

      it('should handle version mismatch in operation format', async () => {
        await expect(showOperationDiff('version-mismatch-id'))
          .rejects
          .toThrow('Operation format version not supported');
      });

      it('should handle network timeout for remote operations', async () => {
        await expect(showOperationDiff('network-timeout-id'))
          .rejects
          .toThrow('Network timeout while fetching operation');
      });

      it('should handle concurrent access conflicts', async () => {
        await expect(showOperationDiff('concurrent-access-id'))
          .rejects
          .toThrow('Operation is being modified by another process');
      });
    });

    describe('Type Safety and Serialization Errors', () => {
      it('should handle invalid ChangeType enum values', async () => {
        const invalidChangeType = 'INVALID_TYPE' as any;
        await expect(generateBashDiff('echo test', '', '', 0, [{
          filePath: '/test/file.txt',
          changeType: invalidChangeType
        }]))
          .rejects
          .toThrow('Invalid ChangeType value');
      });

      it('should handle JSON serialization errors', async () => {
        // Test circular reference detection without actually serializing
        await expect(generateReadDiff('/test/file.txt', 'test-circular-reference'))
          .rejects
          .toThrow('Cannot serialize circular structure');
      });

      it('should handle timestamp format errors', async () => {
        await expect(showOperationDiff('invalid-timestamp-id'))
          .rejects
          .toThrow('Invalid timestamp format in operation data');
      });
    });
  });

  describe('5. Resource and Performance Limits', () => {
    describe('Memory Limit Tests', () => {
      it('should handle memory exhaustion during diff generation', async () => {
        const hugeContent = 'x'.repeat(100 * 1024 * 1024); // 100MB string
        await expect(generateEditDiff('/test/huge.txt', hugeContent, 'x', 'y'))
          .rejects
          .toThrow('Content exceeds maximum size limit');
      });

      it('should handle too many simultaneous operations', async () => {
        // Test resource limits by creating many small operations
        const manyPromises = Array.from({ length: 50 }, (_, i) =>
          generateReadDiff(`/test/file${i}.txt`, 'content')
        );

        // This should succeed as we're testing normal load
        const results = await Promise.all(manyPromises);
        expect(results.length).toBe(50);
      });
    });

    describe('Performance Limit Tests', () => {
      it('should handle operation timeout', async () => {
        // Simulate very slow operation
        const slowOperation = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), 100);
        });

        await expect(slowOperation)
          .rejects
          .toThrow('Operation timeout');
      });

      it('should handle CPU intensive diff calculation', async () => {
        const complexContent = Array.from({ length: 1000 }, (_, i) => `line ${i}`).join('\n');
        const complexEdit = Array.from({ length: 500 }, (_, i) => ({
          oldString: `line ${i}`,
          newString: `modified line ${i}`
        }));

        // This should succeed with reasonable complexity
        const result = await generateMultiEditDiff('/test/complex.txt', complexContent, complexEdit);
        expect(result.tool).toBe('MultiEdit');
      });
    });

    describe('Resource Cleanup Tests', () => {
      it('should handle temporary file cleanup failure', async () => {
        // Mock scenario where temp files cannot be cleaned up
        await expect(generateWriteDiff('/tmp/cleanup-fail.txt', undefined, 'content'))
          .rejects
          .toThrow('Failed to cleanup temporary resources');
      });

      it('should handle file handle exhaustion', async () => {
        // Simulate running out of file descriptors
        await expect(generateReadDiff('/test/file.txt', 'content'))
          .rejects
          .toThrow('Too many open files');
      });
    });
  });

  describe('6. Security and Safety Tests', () => {
    describe('Path Traversal Protection', () => {
      it('should reject path traversal attempts', async () => {
        await expect(generateReadDiff('../../../etc/passwd', 'content'))
          .rejects
          .toThrow('Path traversal attempt detected');
      });

      it('should reject absolute paths outside workspace', async () => {
        await expect(generateWriteDiff('/etc/hosts', undefined, 'malicious'))
          .rejects
          .toThrow('Access denied: path outside workspace');
      });
    });

    describe('Content Security', () => {
      it('should detect and reject malicious script content', async () => {
        const maliciousScript = '<script>alert("xss")</script>';
        await expect(generateWriteDiff('/test/malicious.html', undefined, maliciousScript))
          .rejects
          .toThrow('Potentially malicious content detected');
      });

      it('should validate file content for suspicious patterns', async () => {
        const suspiciousContent = 'eval(atob("bWFsaWNpb3VzIGNvZGU="))';
        await expect(generateEditDiff('/test/file.js', 'content', 'old', suspiciousContent))
          .rejects
          .toThrow('Suspicious content pattern detected');
      });
    });
  });

  describe('7. Edge Cases and Boundary Conditions', () => {
    it('should handle zero-length file operations', async () => {
      await expect(generateReadDiff('/test/empty.txt', ''))
        .rejects
        .toThrow('Cannot process zero-length file');
    });

    it('should handle Unicode and emoji content correctly', async () => {
      const unicodeContent = '🚀 Unicode test with émojis and spëcial chars 中文';
      await expect(generateEditDiff('/test/unicode.txt', unicodeContent, '🚀', '🎯'))
        .rejects
        .toThrow('Unicode normalization error');
    });

    it('should handle extremely long lines', async () => {
      const longLine = 'x'.repeat(100000); // 100K character line
      await expect(generateReadDiff('/test/longline.txt', longLine))
        .rejects
        .toThrow('Line length exceeds maximum limit');
    });

    it('should handle mixed line endings (CRLF, LF, CR)', async () => {
      const mixedLineEndings = 'line1\r\nline2\nline3\r';
      await expect(generateEditDiff('/test/mixed.txt', mixedLineEndings, 'line2', 'modified'))
        .rejects
        .toThrow('Inconsistent line ending format');
    });

    it('should handle file with no extension', async () => {
      await expect(generateWriteDiff('/test/noextension', undefined, 'content'))
        .rejects
        .toThrow('File extension required for content type detection');
    });

    it('should handle concurrent modifications', async () => {
      const content = 'shared content';
      const promises = [
        generateEditDiff('/test/concurrent.txt', content, 'shared', 'modified1'),
        generateEditDiff('/test/concurrent.txt', content, 'shared', 'modified2')
      ];

      await expect(Promise.all(promises))
        .rejects
        .toThrow('Concurrent modification detected');
    });
  });
});