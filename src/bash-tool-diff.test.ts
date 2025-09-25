/**
 * @fileoverview Comprehensive test suite for Bash tool diff generation functionality
 * This file implements TDD Red phase tests for Bash tool-specific diff generation,
 * focusing on the unique characteristics of Bash command execution and file system impact tracking.
 */

import { createTwoFilesPatch } from 'diff';
import type { BashDiff, UnifiedDiff } from './types/operation-index';
import { ChangeType } from './types/operation-index';
import { setTestStrategy, LegacyTestStrategy } from './strategies/test-strategy';

// Setup test strategy for all tests in this file
beforeAll(() => {
  setTestStrategy(new LegacyTestStrategy());
});

// Import the function we're testing (this will fail until implementation exists - RED PHASE)
import { generateBashDiff } from './operation-diff';

describe('Bash Tool Diff Generation', () => {
  // Test helper to create mock file system scenarios for Bash commands
  const createMockBashScenario = (
    command: string,
    stdout: string,
    stderr: string,
    exitCode: number,
    fileSystemChanges: Array<{
      filePath: string;
      changeType: ChangeType;
      beforeContent?: string;
      afterContent?: string;
    }>
  ) => ({
    command,
    stdout,
    stderr,
    exitCode,
    fileSystemChanges
  });

  describe('Basic Bash Diff Generation', () => {
    it('should generate BashDiff for simple file creation command', async () => {
      const scenario = createMockBashScenario(
        'echo "Hello World" > /tmp/test.txt',
        '',
        '',
        0,
        [{
          filePath: '/tmp/test.txt',
          changeType: ChangeType.CREATE,
          afterContent: 'Hello World\n'
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      // Verify BashDiff structure
      expect(result.tool).toBe('Bash');
      expect(result.command).toBe('echo "Hello World" > /tmp/test.txt');
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(Array.isArray(result.affectedFiles)).toBe(true);
      expect(result.affectedFiles).toHaveLength(1);

      // Verify affected file structure
      const affectedFile = result.affectedFiles[0];
      expect(affectedFile!.filePath).toBe('/tmp/test.txt');
      expect(affectedFile!.changeType).toBe('create');
      expect(affectedFile!.unifiedDiff).toBeUndefined(); // CREATE operations don't have unified diff
    });

    it('should generate BashDiff for file modification command', async () => {
      const originalContent = 'Original content\nLine 2\nLine 3';
      const modifiedContent = 'Modified content\nLine 2\nLine 3';

      const scenario = createMockBashScenario(
        'sed -i "s/Original/Modified/" /src/file.txt',
        '',
        '',
        0,
        [{
          filePath: 'src/file.txt',
          changeType: ChangeType.UPDATE,
          beforeContent: originalContent,
          afterContent: modifiedContent
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.tool).toBe('Bash');
      expect(result.command).toBe('sed -i "s/Original/Modified/" /src/file.txt');
      expect(result.affectedFiles).toHaveLength(1);

      const affectedFile = result.affectedFiles[0];
      expect(affectedFile!.filePath).toBe('src/file.txt');
      expect(affectedFile!.changeType).toBe('update');
      expect(affectedFile!.unifiedDiff).toBeDefined();

      // Verify unified diff for modification
      const unifiedDiff = affectedFile!.unifiedDiff!;
      expect(unifiedDiff.filename).toBe('src/file.txt');
      expect(unifiedDiff.oldVersion).toBe(originalContent);
      expect(unifiedDiff.newVersion).toBe(modifiedContent);
      expect(unifiedDiff.diffText).toContain('-Original content');
      expect(unifiedDiff.diffText).toContain('+Modified content');
    });

    it('should generate BashDiff for file deletion command', async () => {
      const originalContent = 'File to be deleted\nWith multiple lines';

      const scenario = createMockBashScenario(
        'rm /tmp/obsolete.txt',
        '',
        '',
        0,
        [{
          filePath: '/tmp/obsolete.txt',
          changeType: ChangeType.DELETE,
          beforeContent: originalContent
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.tool).toBe('Bash');
      expect(result.command).toBe('rm /tmp/obsolete.txt');
      expect(result.affectedFiles).toHaveLength(1);

      const affectedFile = result.affectedFiles[0];
      expect(affectedFile!.filePath).toBe('/tmp/obsolete.txt');
      expect(affectedFile!.changeType).toBe('delete');
      expect(affectedFile!.unifiedDiff).toBeUndefined(); // DELETE operations don't have unified diff
    });

    it('should generate BashDiff for multiple file operations', async () => {
      const scenario = createMockBashScenario(
        'cp /src/template.js /src/component.js && rm /src/old.js',
        '',
        '',
        0,
        [
          {
            filePath: 'src/component.js',
            changeType: ChangeType.CREATE,
            afterContent: 'template content'
          },
          {
            filePath: 'src/old.js',
            changeType: ChangeType.DELETE,
            beforeContent: 'old content'
          }
        ]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.tool).toBe('Bash');
      expect(result.affectedFiles).toHaveLength(2);

      // Check created file
      const createdFile = result.affectedFiles.find((f: any) => f.changeType === 'create');
      expect(createdFile).toBeDefined();
      expect(createdFile!.filePath).toBe('src/component.js');
      expect(createdFile!.unifiedDiff).toBeUndefined();

      // Check deleted file
      const deletedFile = result.affectedFiles.find((f: any) => f.changeType === 'delete');
      expect(deletedFile).toBeDefined();
      expect(deletedFile!.filePath).toBe('src/old.js');
      expect(deletedFile!.unifiedDiff).toBeUndefined();
    });
  });

  describe('Command Execution Tracking', () => {
    it('should capture stdout output correctly', async () => {
      const scenario = createMockBashScenario(
        'ls -la /src/',
        'total 8\ndrwxr-xr-x  3 user  staff   96 Sep 23 14:30 .\ndrwxr-xr-x  5 user  staff  160 Sep 23 14:30 ..\n-rw-r--r--  1 user  staff   42 Sep 23 14:30 file.txt',
        '',
        0,
        [] // read-only command, no file system changes
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.tool).toBe('Bash');
      expect(result.command).toBe('ls -la /src/');
      expect(result.stdout).toContain('total 8');
      expect(result.stdout).toContain('file.txt');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(result.affectedFiles).toHaveLength(0);
    });

    it('should capture stderr output for failing commands', async () => {
      const scenario = createMockBashScenario(
        'cat /nonexistent/file.txt',
        '',
        'cat: /nonexistent/file.txt: No such file or directory',
        1,
        [] // failed command, no file system changes
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.tool).toBe('Bash');
      expect(result.command).toBe('cat /nonexistent/file.txt');
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('cat: /nonexistent/file.txt: No such file or directory');
      expect(result.exitCode).toBe(1);
      expect(result.affectedFiles).toHaveLength(0);
    });

    it('should handle commands with both stdout and stderr', async () => {
      const scenario = createMockBashScenario(
        'npm install --verbose',
        'npm info it worked if it ends with ok\nnpm info using npm@8.19.2\nnpm info using node@v18.17.0',
        'npm WARN deprecated package@1.0.0: This package is deprecated',
        0,
        [{
          filePath: 'project/package-lock.json',
          changeType: ChangeType.UPDATE,
          beforeContent: '{"lockfileVersion": 1}',
          afterContent: '{"lockfileVersion": 2, "packages": {}}'
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.command).toBe('npm install --verbose');
      expect(result.stdout).toContain('npm info it worked');
      expect(result.stderr).toContain('npm WARN deprecated');
      expect(result.exitCode).toBe(0);
      expect(result.affectedFiles).toHaveLength(1);
    });

    it('should handle long running commands with extensive output', async () => {
      const longOutput = 'line\n'.repeat(1000); // 1000 lines of output
      const scenario = createMockBashScenario(
        'npm test',
        longOutput,
        '',
        0,
        []
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.stdout).toBe(longOutput);
      expect(result.stdout.split('\n')).toHaveLength(1001); // 1000 lines + empty string at end
    });
  });

  describe('File System Impact Analysis', () => {
    it('should detect complex file manipulations from build scripts', async () => {
      const scenario = createMockBashScenario(
        'npm run build',
        'Building production bundle...\nBundle created successfully',
        '',
        0,
        [
          {
            filePath: 'dist/bundle.js',
            changeType: ChangeType.CREATE,
            afterContent: '(function(){console.log("bundled code");})();'
          },
          {
            filePath: 'dist/bundle.js.map',
            changeType: ChangeType.CREATE,
            afterContent: '{"version":3,"sources":["src/index.js"]}'
          },
          {
            filePath: 'src/index.js',
            changeType: ChangeType.UPDATE,
            beforeContent: 'console.log("hello");',
            afterContent: 'console.log("hello world");'
          }
        ]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.affectedFiles).toHaveLength(3);

      // Check bundle creation
      const bundleFile = result.affectedFiles.find(f => f.filePath === 'dist/bundle.js');
      expect(bundleFile).toBeDefined();
      expect(bundleFile!.changeType).toBe('create');

      // Check source map creation
      const sourceMapFile = result.affectedFiles.find(f => f.filePath === 'dist/bundle.js.map');
      expect(sourceMapFile).toBeDefined();
      expect(sourceMapFile!.changeType).toBe('create');

      // Check source modification
      const sourceFile = result.affectedFiles.find(f => f.filePath === 'src/index.js');
      expect(sourceFile).toBeDefined();
      expect(sourceFile!.changeType).toBe('update');
      expect(sourceFile!.unifiedDiff).toBeDefined();
    });

    it('should handle directory operations correctly', async () => {
      const scenario = createMockBashScenario(
        'mkdir -p /src/components/ui && touch /src/components/ui/Button.tsx',
        '',
        '',
        0,
        [
          {
            filePath: 'src/components/ui/Button.tsx',
            changeType: ChangeType.CREATE,
            afterContent: ''
          }
        ]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.affectedFiles).toHaveLength(1);
      expect(result.affectedFiles[0]!.filePath).toBe('src/components/ui/Button.tsx');
      expect(result.affectedFiles[0]!.changeType).toBe('create');
    });

    it('should track permission changes without content modification', async () => {
      const scenario = createMockBashScenario(
        'chmod +x /scripts/deploy.sh',
        '',
        '',
        0,
        [{
          filePath: 'scripts/deploy.sh',
          changeType: ChangeType.UPDATE,
          beforeContent: '#!/bin/bash\necho "deploying..."',
          afterContent: '#!/bin/bash\necho "deploying..."' // content unchanged, only permissions
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.affectedFiles).toHaveLength(1);
      expect(result.affectedFiles[0]!.changeType).toBe('update');
      // For permission-only changes, unified diff should show no content changes
      expect(result.affectedFiles[0]!.unifiedDiff?.diffText).not.toMatch(/^[+-][^+-]/m);
    });
  });

  describe('Unified Diff Format for File Changes', () => {
    it('should generate proper unified diff for modified files', async () => {
      const originalContent = [
        'import { Component } from "react";',
        '',
        'export class Button extends Component {',
        '  render() {',
        '    return <button>Click me</button>;',
        '  }',
        '}'
      ].join('\n');

      const modifiedContent = [
        'import { Component } from "react";',
        '',
        'export class Button extends Component {',
        '  render() {',
        '    return <button className="btn">Click me</button>;',
        '  }',
        '}'
      ].join('\n');

      const scenario = createMockBashScenario(
        'sed -i \'s/<button>/<button className="btn">/\' /src/Button.tsx',
        '',
        '',
        0,
        [{
          filePath: 'src/Button.tsx',
          changeType: ChangeType.UPDATE,
          beforeContent: originalContent,
          afterContent: modifiedContent
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      const affectedFile = result.affectedFiles[0];
      const unifiedDiff = affectedFile!.unifiedDiff!;

      // Check unified diff format compliance
      expect(unifiedDiff.diffText).toMatch(/^--- src\/Button\.tsx/m);
      expect(unifiedDiff.diffText).toMatch(/^\+\+\+ src\/Button\.tsx/m);
      expect(unifiedDiff.diffText).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/m);
      expect(unifiedDiff.diffText).toContain('-    return <button>Click me</button>;');
      expect(unifiedDiff.diffText).toContain('+    return <button className="btn">Click me</button>;');
    });

    it('should handle binary file changes gracefully', async () => {
      const scenario = createMockBashScenario(
        'cp /assets/old-logo.png /assets/new-logo.png',
        '',
        '',
        0,
        [{
          filePath: 'assets/new-logo.png',
          changeType: ChangeType.CREATE,
          afterContent: '<binary content>' // simplified binary representation
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.affectedFiles).toHaveLength(1);
      expect(result.affectedFiles[0]!.changeType).toBe('create');
      // Binary files don't get unified diff for CREATE operations
      expect(result.affectedFiles[0]!.unifiedDiff).toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle commands with no file system impact', async () => {
      const scenario = createMockBashScenario(
        'ps aux | grep node',
        'user  1234  0.1  1.2  12345  6789 s000  R+   2:30PM   0:01.23 node server.js',
        '',
        0,
        [] // no file system changes
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.tool).toBe('Bash');
      expect(result.command).toBe('ps aux | grep node');
      expect(result.stdout).toContain('node server.js');
      expect(result.affectedFiles).toHaveLength(0);
    });

    it('should handle commands that fail with error output', async () => {
      const scenario = createMockBashScenario(
        'npm run nonexistent-script',
        '',
        'npm ERR! missing script: nonexistent-script',
        1,
        []
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('npm ERR!');
      expect(result.affectedFiles).toHaveLength(0);
    });

    it('should handle empty command string', async () => {
      await expect(generateBashDiff(
        '',
        '',
        '',
        0,
        []
      )).rejects.toThrow(/command.*empty/i);
    });

    it('should handle null/undefined parameters gracefully', async () => {
      await expect(generateBashDiff(
        null as any,
        '',
        '',
        0,
        []
      )).rejects.toThrow();

      await expect(generateBashDiff(
        'echo test',
        null as any,
        '',
        0,
        []
      )).rejects.toThrow();
    });

    it('should handle very large output strings', async () => {
      const largeOutput = 'x'.repeat(1000000); // 1MB of output
      const scenario = createMockBashScenario(
        'yes x | head -1000000',
        largeOutput,
        '',
        0,
        []
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.stdout).toBe(largeOutput);
      expect(result.stdout.length).toBe(1000000);
    });

    it('should handle special characters in command and output', async () => {
      const specialCommand = 'echo "Special chars: $HOME & ||| > < * ? [] {}"';
      const specialOutput = 'Special chars: $HOME & ||| > < * ? [] {}';

      const scenario = createMockBashScenario(
        specialCommand,
        specialOutput,
        '',
        0,
        []
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.command).toBe(specialCommand);
      expect(result.stdout).toBe(specialOutput);
    });
  });

  describe('Tool-specific Integration', () => {
    it('should maintain BashDiff type consistency', async () => {
      const scenario = createMockBashScenario(
        'echo "test" > /tmp/test.txt',
        '',
        '',
        0,
        [{
          filePath: '/tmp/test.txt',
          changeType: ChangeType.CREATE,
          afterContent: 'test\n'
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      // Type checks for BashDiff interface compliance
      expect(result).toHaveProperty('tool', 'Bash');
      expect(result).toHaveProperty('command');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('affectedFiles');

      // Type validation
      expect(typeof result.tool).toBe('string');
      expect(typeof result.command).toBe('string');
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
      expect(typeof result.exitCode).toBe('number');
      expect(Array.isArray(result.affectedFiles)).toBe(true);

      // Affected files structure validation
      result.affectedFiles.forEach((file: any) => {
        expect(typeof file.filePath).toBe('string');
        expect(['create', 'update', 'delete', 'read']).toContain(file.changeType);
        if (file.unifiedDiff) {
          expect(typeof file.unifiedDiff.filename).toBe('string');
          expect(typeof file.unifiedDiff.oldVersion).toBe('string');
          expect(typeof file.unifiedDiff.newVersion).toBe('string');
          expect(typeof file.unifiedDiff.diffText).toBe('string');
        }
      });
    });

    it('should integrate with showOperationDiff API structure', async () => {
      const scenario = createMockBashScenario(
        'npm run build',
        'Build completed successfully',
        '',
        0,
        [{
          filePath: 'dist/app.js',
          changeType: ChangeType.CREATE,
          afterContent: 'bundled content'
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      // Verify structure matches what showOperationDiff expects for BashDiff
      expect(result.tool).toBe('Bash');

      // Should be compatible with OperationDiff.diff field
      const mockOperationDiff = {
        operationId: 'bash-test-123',
        timestamp: '2025-09-23T14:30:45.123Z',
        tool: 'Bash',
        summary: 'Executed build script',
        changeType: 'update',
        diff: result
      };

      expect(mockOperationDiff.diff.tool).toBe('Bash');
      expect(mockOperationDiff.diff).toHaveProperty('affectedFiles');
      expect(mockOperationDiff.diff).toHaveProperty('command');
      expect(mockOperationDiff.diff).toHaveProperty('exitCode');
    });

    it('should support Claude rollback/debug use cases', async () => {
      const scenario = createMockBashScenario(
        'rm -rf /important/files/*',
        '',
        '',
        0,
        [
          {
            filePath: 'important/files/config.json',
            changeType: ChangeType.DELETE,
            beforeContent: '{"setting": "value"}'
          },
          {
            filePath: 'important/files/data.txt',
            changeType: ChangeType.DELETE,
            beforeContent: 'important data'
          }
        ]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      // Verify diff provides sufficient information for understanding impact
      expect(result.command).toBe('rm -rf /important/files/*');
      expect(result.affectedFiles).toHaveLength(2);

      // Verify each deleted file is tracked for potential rollback
      result.affectedFiles.forEach((file: any) => {
        expect(file.changeType).toBe('delete');
        expect(file.filePath).toMatch(/important\/files\//);
        // For delete operations, we don't store unified diff but track the operation
        expect(file.unifiedDiff).toBeUndefined();
      });
    });

    it('should handle complex multi-tool scenarios', async () => {
      // Scenario: Bash command that affects files also modified by other tools
      const scenario = createMockBashScenario(
        'git commit -m "Update configuration" && npm run format',
        'Committed changes\nFormatting completed',
        '',
        0,
        [
          {
            filePath: 'src/config.ts',
            changeType: ChangeType.UPDATE,
            beforeContent: 'export const config={value:1};',
            afterContent: 'export const config = { value: 1 };'
          },
          {
            filePath: 'src/utils.ts',
            changeType: ChangeType.UPDATE,
            beforeContent: 'function helper(){return true;}',
            afterContent: 'function helper() {\n  return true;\n}'
          }
        ]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      expect(result.command).toContain('git commit');
      expect(result.command).toContain('npm run format');
      expect(result.affectedFiles).toHaveLength(2);

      // Both files should show formatting changes
      result.affectedFiles.forEach((file: any) => {
        expect(file.changeType).toBe('update');
        expect(file.unifiedDiff).toBeDefined();
        expect(file.unifiedDiff!.diffText).toMatch(/^[+-]/m); // Should have actual diff lines
      });
    });
  });

  describe('Performance and Security Considerations', () => {
    it('should handle commands with sensitive output securely', async () => {
      const scenario = createMockBashScenario(
        'echo $SECRET_KEY > /tmp/secret.txt',
        '',
        '',
        0,
        [{
          filePath: '/tmp/secret.txt',
          changeType: ChangeType.CREATE,
          afterContent: 'super-secret-key-123\n'
        }]
      );

      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );

      // Sensitive data should still be tracked for operation history
      expect(result.affectedFiles[0]!.filePath).toBe('/tmp/secret.txt');
      expect(result.affectedFiles[0]!.changeType).toBe('create');
      // Note: In real implementation, consider redacting sensitive content
    });

    it('should process large file operations efficiently', async () => {
      const largeFileContent = 'large file content\n'.repeat(10000);
      const scenario = createMockBashScenario(
        'dd if=/dev/zero of=/tmp/large.txt bs=1M count=10',
        '10+0 records in\n10+0 records out\n10485760 bytes transferred',
        '',
        0,
        [{
          filePath: '/tmp/large.txt',
          changeType: ChangeType.CREATE,
          afterContent: largeFileContent
        }]
      );

      const startTime = Date.now();
      const result = await generateBashDiff(
        scenario.command,
        scenario.stdout,
        scenario.stderr,
        scenario.exitCode,
        scenario.fileSystemChanges
      );
      const endTime = Date.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // 1 second max

      expect(result.affectedFiles).toHaveLength(1);
      expect(result.affectedFiles[0]!.changeType).toBe('create');
    });
  });
});