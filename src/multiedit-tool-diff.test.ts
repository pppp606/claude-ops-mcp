import type { MultiEditDiff, UnifiedDiff } from './types/operation-index';
import { generateMultiEditDiff } from './operation-diff';
import { setTestStrategy, LegacyTestStrategy } from './strategies/test-strategy';
import { _setTestWorkspaceRoot } from './utils/workspace-utils';

// Setup test strategy for all tests in this file
beforeAll(() => {
  setTestStrategy(new LegacyTestStrategy());
});

describe('generateMultiEditDiff - MultiEdit Tool Diff Generation', () => {
  // Test data for various scenarios
  const testFilePath = 'src/services/api.ts';

  const sampleOriginalContent = `import { HttpClient } from './http';

export class ApiService {
  constructor(private http: HttpClient) {}

  async getUsers() {
    return this.http.get('/api/users');
  }

  async createUser(data: any) {
    return this.http.post('/api/users', data);
  }

  async updateUser(id: string, data: any) {
    return this.http.put(\`/api/users/\${id}\`, data);
  }
}

export class ApiService2 {
  // Another ApiService instance for testing replaceAll: false
}`;

  describe('Basic MultiEdit Operations', () => {
    it('should generate diff for two sequential edits', async () => {
      const edits = [
        {
          oldString: 'getUsers',
          newString: 'fetchUsers',
          replaceAll: false
        },
        {
          oldString: 'createUser',
          newString: 'addUser',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff(testFilePath, sampleOriginalContent, edits);

      // Type verification
      expect(result.tool).toBe('MultiEdit');
      expect(Array.isArray(result.edits)).toBe(true);
      expect(result.edits).toHaveLength(2);

      // Individual edits should match input
      expect(result.edits[0]).toEqual(edits[0]);
      expect(result.edits[1]).toEqual(edits[1]);

      // Unified diff should reflect cumulative changes
      expect(result.unifiedDiff.filename).toBe(testFilePath);
      expect(result.unifiedDiff.oldVersion).toBe(sampleOriginalContent);
      expect(result.unifiedDiff.newVersion).toContain('fetchUsers');
      expect(result.unifiedDiff.newVersion).toContain('addUser');
      expect(result.unifiedDiff.diffText).toContain('-  async getUsers()');
      expect(result.unifiedDiff.diffText).toContain('+  async fetchUsers()');
      expect(result.unifiedDiff.diffText).toContain('-  async createUser(');
      expect(result.unifiedDiff.diffText).toContain('+  async addUser(');
    });

    it('should generate diff for three sequential edits with cumulative changes', async () => {
      const edits = [
        {
          oldString: 'HttpClient',
          newString: 'RestClient',
          replaceAll: true
        },
        {
          oldString: 'ApiService',
          newString: 'UserService',
          replaceAll: false
        },
        {
          oldString: '/api/users',
          newString: '/v2/users',
          replaceAll: true
        }
      ];

      const result = await generateMultiEditDiff(testFilePath, sampleOriginalContent, edits);

      expect(result.tool).toBe('MultiEdit');
      expect(result.edits).toHaveLength(3);

      // Final content should have all changes applied
      const finalContent = result.unifiedDiff.newVersion;
      expect(finalContent).toContain('RestClient'); // All HttpClient replaced
      expect(finalContent).toContain('UserService'); // First ApiService replaced
      expect(finalContent).toContain('ApiService2'); // Second ApiService should remain (replaceAll: false)
      expect(finalContent).toContain('/v2/users'); // All /api/users replaced
      expect(finalContent).not.toContain('HttpClient'); // Should be completely replaced
      expect(finalContent).not.toContain('/api/users'); // Should be completely replaced
    });

    it('should handle edit order dependency correctly', async () => {
      const originalContent = `function calculateTotal(items) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const tax = subtotal * 0.1;
  return subtotal + tax;
}`;

      // First edit creates content that second edit will modify
      const edits = [
        {
          oldString: 'calculateTotal',
          newString: 'calculateTotalWithTax',
          replaceAll: false
        },
        {
          oldString: 'calculateTotalWithTax(items)',
          newString: 'calculateTotalWithTax(items, taxRate = 0.1)',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff('test.js', originalContent, edits);

      expect(result.edits).toHaveLength(2);

      // Final content should have both changes
      const finalContent = result.unifiedDiff.newVersion;
      expect(finalContent).toContain('calculateTotalWithTax(items, taxRate = 0.1)');
      expect(finalContent).not.toContain('calculateTotal(items)');
    });
  });

  describe('Sequential Edit Processing', () => {
    it('should apply edits in sequence, each operating on result of previous', async () => {
      const originalContent = 'const value = "old_value_old";';

      const edits = [
        {
          oldString: 'old_value_old',
          newString: 'intermediate_value_old',
          replaceAll: false
        },
        {
          oldString: 'intermediate_value_old',
          newString: 'final_value_new',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff('test.js', originalContent, edits);

      // Final content should show the cumulative result
      expect(result.unifiedDiff.newVersion).toBe('const value = "final_value_new";');
      expect(result.unifiedDiff.oldVersion).toBe(originalContent);

      // Diff should show change from original to final
      expect(result.unifiedDiff.diffText).toContain('-const value = "old_value_old";');
      expect(result.unifiedDiff.diffText).toContain('+const value = "final_value_new";');
    });

    it('should track intermediate states for debugging purposes', async () => {
      const originalContent = 'step1 step2 step3';

      const edits = [
        {
          oldString: 'step1',
          newString: 'phase1',
          replaceAll: false
        },
        {
          oldString: 'step2',
          newString: 'phase2',
          replaceAll: false
        },
        {
          oldString: 'step3',
          newString: 'phase3',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff('test.js', originalContent, edits);

      // Should provide access to intermediate states (via additionalMetadata)
      expect(result).toHaveProperty('intermediateStates');
      expect(Array.isArray(result.intermediateStates)).toBe(true);
      expect(result.intermediateStates).toHaveLength(3); // One for each edit

      // Check intermediate states progression
      expect(result.intermediateStates![0]!.content).toBe('phase1 step2 step3');
      expect(result.intermediateStates![1]!.content).toBe('phase1 phase2 step3');
      expect(result.intermediateStates![2]!.content).toBe('phase1 phase2 phase3');

      // Each intermediate state should have its own diff from previous state
      expect(result.intermediateStates![0]!.diffFromPrevious).toBeDefined();
      expect(result.intermediateStates![1]!.diffFromPrevious).toBeDefined();
      expect(result.intermediateStates![2]!.diffFromPrevious).toBeDefined();
    });

    it('should handle cumulative replaceAll operations correctly', async () => {
      const originalContent = 'test test test other test';

      const edits = [
        {
          oldString: 'test',
          newString: 'exam',
          replaceAll: true // Replace all 'test' with 'exam'
        },
        {
          oldString: 'exam',
          newString: 'quiz',
          replaceAll: false // Replace only first 'exam' with 'quiz'
        }
      ];

      const result = await generateMultiEditDiff('test.js', originalContent, edits);

      // After first edit: 'exam exam exam other exam'
      // After second edit: 'quiz exam exam other exam'
      expect(result.unifiedDiff.newVersion).toBe('quiz exam exam other exam');
    });
  });

  describe('Unified Diff Format for Multiple Edits', () => {
    it('should generate single unified diff representing all changes', async () => {
      const originalContent = `line1
line2
line3
line4`;

      const edits = [
        {
          oldString: 'line1',
          newString: 'modified_line1',
          replaceAll: false
        },
        {
          oldString: 'line3',
          newString: 'modified_line3',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff('/test.txt', originalContent, edits);

      // Should have proper unified diff format
      const diffText = result.unifiedDiff.diffText;
      expect(diffText).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/); // Unified diff header
      expect(diffText).toContain('-line1');
      expect(diffText).toContain('+modified_line1');
      expect(diffText).toContain('-line3');
      expect(diffText).toContain('+modified_line3');
      expect(diffText).toContain(' line2'); // Unchanged context line
      expect(diffText).toContain(' line4'); // Unchanged context line
    });

    it('should maintain proper filename and versions in unified diff', async () => {
      const originalContent = 'original content';
      const edits = [
        {
          oldString: 'original',
          newString: 'modified',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff(testFilePath, originalContent, edits);

      expect(result.unifiedDiff.filename).toBe(testFilePath);
      expect(result.unifiedDiff.oldVersion).toBe(originalContent);
      expect(result.unifiedDiff.newVersion).toBe('modified content');
      expect(result.unifiedDiff.diffText).toContain(testFilePath);
    });

    it('should handle large number of edits efficiently', async () => {
      const originalContent = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n');
      const edits = Array.from({ length: 50 }, (_, i) => ({
        oldString: `line${i * 2}`,
        newString: `modified_line${i * 2}`,
        replaceAll: false
      }));

      const startTime = Date.now();
      const result = await generateMultiEditDiff('/large-test.txt', originalContent, edits);
      const endTime = Date.now();

      // Performance check - should complete within reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify all edits were applied
      expect(result.edits).toHaveLength(50);
      expect(result.unifiedDiff.newVersion).toContain('modified_line0');
      expect(result.unifiedDiff.newVersion).toContain('modified_line98');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty edits array', async () => {
      const edits: Array<{ oldString: string; newString: string; replaceAll: boolean }> = [];

      const result = await generateMultiEditDiff(testFilePath, sampleOriginalContent, edits);

      expect(result.tool).toBe('MultiEdit');
      expect(result.edits).toHaveLength(0);
      expect(result.unifiedDiff.oldVersion).toBe(sampleOriginalContent);
      expect(result.unifiedDiff.newVersion).toBe(sampleOriginalContent);
      expect(result.unifiedDiff.diffText).toBe(''); // No changes
    });

    it('should handle edits to the same location with conflicts', async () => {
      const originalContent = 'test content test';

      const edits = [
        {
          oldString: 'test',
          newString: 'first',
          replaceAll: false // Only replaces first occurrence
        },
        {
          oldString: 'test',
          newString: 'second',
          replaceAll: false // Tries to replace 'test' again, but first is gone
        }
      ];

      const result = await generateMultiEditDiff('test.js', originalContent, edits);

      // After first edit: 'first content test'
      // After second edit: 'first content second'
      expect(result.unifiedDiff.newVersion).toBe('first content second');
    });

    it('should handle edit where oldString is not found', async () => {
      const originalContent = 'existing content';

      const edits = [
        {
          oldString: 'nonexistent',
          newString: 'replacement',
          replaceAll: false
        }
      ];

      await expect(generateMultiEditDiff('/test.js', originalContent, edits))
        .rejects
        .toThrow(/old string not found/i);
    });

    it('should handle identical oldString and newString gracefully', async () => {
      const originalContent = 'test content';

      const edits = [
        {
          oldString: 'test',
          newString: 'test',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff('test.js', originalContent, edits);

      expect(result.unifiedDiff.oldVersion).toBe(originalContent);
      expect(result.unifiedDiff.newVersion).toBe(originalContent);
      expect(result.unifiedDiff.diffText).toBe(''); // No actual changes
    });

    it('should handle empty file content', async () => {
      const originalContent = '';

      const edits = [
        {
          oldString: '',
          newString: 'new content',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff('/empty.js', originalContent, edits);

      expect(result.unifiedDiff.oldVersion).toBe('');
      expect(result.unifiedDiff.newVersion).toBe('new content');
      expect(result.unifiedDiff.diffText).toContain('+new content');
    });

    it('should handle very large content efficiently', async () => {
      const largeContent = 'content '.repeat(10000); // 70KB of content

      const edits = [
        {
          oldString: 'content',
          newString: 'data',
          replaceAll: true
        }
      ];

      const startTime = Date.now();
      const result = await generateMultiEditDiff('/large.js', largeContent, edits);
      const endTime = Date.now();

      // Should handle large content efficiently
      expect(endTime - startTime).toBeLessThan(2000);
      expect(result.unifiedDiff.newVersion).toContain('data data data');
    });
  });

  describe('Tool-specific Integration', () => {
    it('should maintain MultiEditDiff type consistency', async () => {
      const edits = [
        {
          oldString: 'old',
          newString: 'new',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff(testFilePath, 'old content', edits);

      // Type guard checks
      expect(result.tool).toBe('MultiEdit');
      expect('edits' in result).toBe(true);
      expect('unifiedDiff' in result).toBe(true);

      // Should not have properties from other diff types
      expect('oldString' in result).toBe(false); // EditDiff property
      expect('isNewFile' in result).toBe(false); // WriteDiff property
      expect('command' in result).toBe(false); // BashDiff property
      expect('content' in result).toBe(false); // ReadDiff property
    });

    it('should provide rollback capability for each edit step', async () => {
      const originalContent = 'step1 step2 step3';

      const edits = [
        {
          oldString: 'step1',
          newString: 'phase1',
          replaceAll: false
        },
        {
          oldString: 'step2',
          newString: 'phase2',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff('test.js', originalContent, edits);

      // Should provide rollback information
      expect(result).toHaveProperty('rollbackSteps');
      expect(Array.isArray(result.rollbackSteps)).toBe(true);
      expect(result.rollbackSteps).toHaveLength(2);

      // Each rollback step should reverse the corresponding edit
      expect(result.rollbackSteps![0]).toEqual({
        editIndex: 0,
        reverseEdit: {
          oldString: 'phase1',
          newString: 'step1',
          replaceAll: false
        }
      });

      expect(result.rollbackSteps![1]).toEqual({
        editIndex: 1,
        reverseEdit: {
          oldString: 'phase2',
          newString: 'step2',
          replaceAll: false
        }
      });
    });

    it('should integrate with Claude operation history format', async () => {
      const edits = [
        {
          oldString: 'old',
          newString: 'new',
          replaceAll: false
        }
      ];

      const result = await generateMultiEditDiff(testFilePath, 'old content', edits);

      // Should be compatible with OperationDiff.diff format
      expect(result).toMatchObject({
        tool: 'MultiEdit',
        edits: expect.arrayContaining([
          expect.objectContaining({
            oldString: expect.any(String),
            newString: expect.any(String),
            replaceAll: expect.any(Boolean)
          })
        ]),
        unifiedDiff: expect.objectContaining({
          filename: expect.any(String),
          oldVersion: expect.any(String),
          newVersion: expect.any(String),
          diffText: expect.any(String)
        })
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid file path', async () => {
      const edits = [{ oldString: 'test', newString: 'new', replaceAll: false }];

      await expect(generateMultiEditDiff('', 'content', edits))
        .rejects
        .toThrow(/file path/i);
    });

    it('should throw error for null/undefined inputs', async () => {
      const edits = [{ oldString: 'test', newString: 'new', replaceAll: false }];

      await expect(generateMultiEditDiff(null as any, 'content', edits))
        .rejects
        .toThrow();

      await expect(generateMultiEditDiff('/test.js', null as any, edits))
        .rejects
        .toThrow();

      await expect(generateMultiEditDiff('/test.js', 'content', null as any))
        .rejects
        .toThrow();
    });

    it('should handle malformed edit objects gracefully', async () => {
      const malformedEdits = [
        { oldString: 'test' }, // Missing newString and replaceAll
        { newString: 'new' }, // Missing oldString and replaceAll
        { replaceAll: true } // Missing oldString and newString
      ] as any;

      await expect(generateMultiEditDiff('/test.js', 'content', malformedEdits))
        .rejects
        .toThrow(/invalid edit/i);
    });

    it('should provide detailed error messages for edit failures', async () => {
      const originalContent = 'test content';

      const edits = [
        {
          oldString: 'test',
          newString: 'modified',
          replaceAll: false
        },
        {
          oldString: 'nonexistent', // This will fail
          newString: 'replacement',
          replaceAll: false
        }
      ];

      await expect(generateMultiEditDiff('/test.js', originalContent, edits))
        .rejects
        .toThrow(/edit 2.*nonexistent.*not found/i);
    });
  });
});