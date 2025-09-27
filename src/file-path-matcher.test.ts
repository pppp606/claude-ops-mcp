import { FilePathMatcher } from './file-path-matcher';
import * as path from 'path';

describe('FilePathMatcher', () => {
  const workspaceRoot = '/Users/test/project';
  let matcher: FilePathMatcher;

  beforeEach(() => {
    matcher = new FilePathMatcher(workspaceRoot);
  });

  describe('isMatch', () => {
    describe('absolute path matching', () => {
      it('should match exact absolute path', () => {
        const filePath = '/Users/test/project/src/index.ts';
        const pattern = '/Users/test/project/src/index.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(true);
      });

      it('should not match different absolute paths', () => {
        const filePath = '/Users/test/project/src/index.ts';
        const pattern = '/Users/test/project/src/other.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(false);
      });
    });

    describe('relative path matching', () => {
      it('should match relative path from workspace root', () => {
        const filePath = '/Users/test/project/src/index.ts';
        const pattern = 'src/index.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(true);
      });

      it('should match relative path with ./ prefix', () => {
        const filePath = '/Users/test/project/src/index.ts';
        const pattern = './src/index.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(true);
      });

      it('should not match incorrect relative paths', () => {
        const filePath = '/Users/test/project/src/index.ts';
        const pattern = 'lib/index.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(false);
      });
    });

    describe('partial path matching', () => {
      it('should match filename only', () => {
        const filePath = '/Users/test/project/src/utils/helpers.ts';
        const pattern = 'helpers.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(true);
      });

      it('should match partial path segments', () => {
        const filePath = '/Users/test/project/src/utils/helpers.ts';
        const pattern = 'utils/helpers.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(true);
      });

      it('should match middle path segments', () => {
        const filePath = '/Users/test/project/src/components/ui/Button.tsx';
        const pattern = 'components/ui';
        expect(matcher.isMatch(filePath, pattern)).toBe(true);
      });

      it('should not match non-existent segments', () => {
        const filePath = '/Users/test/project/src/index.ts';
        const pattern = 'nonexistent';
        expect(matcher.isMatch(filePath, pattern)).toBe(false);
      });
    });

    describe('case sensitivity', () => {
      it('should be case sensitive by default', () => {
        const filePath = '/Users/test/project/src/Index.ts';
        const pattern = 'index.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle empty pattern', () => {
        const filePath = '/Users/test/project/src/index.ts';
        const pattern = '';
        expect(matcher.isMatch(filePath, pattern)).toBe(false);
      });

      it('should handle empty file path', () => {
        const filePath = '';
        const pattern = 'index.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(false);
      });

      it('should handle paths with trailing slashes', () => {
        const filePath = '/Users/test/project/src/utils/';
        const pattern = 'src/utils';
        expect(matcher.isMatch(filePath, pattern)).toBe(true);
      });

      it('should handle paths with multiple slashes', () => {
        const filePath = '/Users/test/project//src//index.ts';
        const pattern = 'src/index.ts';
        expect(matcher.isMatch(filePath, pattern)).toBe(true);
      });

      it('should handle Windows-style paths', () => {
        const windowsMatcher = new FilePathMatcher('C:\\Users\\test\\project');
        const filePath = 'C:\\Users\\test\\project\\src\\index.ts';
        const pattern = 'src\\index.ts';
        expect(windowsMatcher.isMatch(filePath, pattern)).toBe(true);
      });
    });
  });

  describe('normalizePath', () => {
    it('should normalize paths with multiple slashes', () => {
      const input = '/Users//test///project//src/index.ts';
      const expected = '/Users/test/project/src/index.ts';
      expect(matcher.normalizePath(input)).toBe(expected);
    });

    it('should handle Windows paths', () => {
      const windowsMatcher = new FilePathMatcher('C:\\Users\\test\\project');
      const input = 'C:\\Users\\test\\project\\src\\index.ts';
      const expected = 'C:/Users/test/project/src/index.ts';
      expect(windowsMatcher.normalizePath(input)).toBe(expected);
    });

    it('should remove trailing slashes', () => {
      const input = '/Users/test/project/src/';
      const expected = '/Users/test/project/src';
      expect(matcher.normalizePath(input)).toBe(expected);
    });
  });

  describe('getRelativePath', () => {
    it('should get relative path from workspace root', () => {
      const absolutePath = '/Users/test/project/src/index.ts';
      const expected = 'src/index.ts';
      expect(matcher.getRelativePath(absolutePath)).toBe(expected);
    });

    it('should return null for paths outside workspace', () => {
      const absolutePath = '/Users/other/project/src/index.ts';
      expect(matcher.getRelativePath(absolutePath)).toBeNull();
    });

    it('should handle workspace root itself', () => {
      const absolutePath = '/Users/test/project';
      const expected = '.';
      expect(matcher.getRelativePath(absolutePath)).toBe(expected);
    });

    it('should handle similar path prefixes correctly', () => {
      // Test case where workspace is /Users/test/project
      // but path is /Users/test/project-other (should return null)
      const similarPath = '/Users/test/project-other/src/index.ts';
      expect(matcher.getRelativePath(similarPath)).toBeNull();
    });

    it('should handle nested similar prefixes', () => {
      // Test workspace /Users/test/project/sub
      // with path /Users/test/project/sub-other (should return null)
      const nestedMatcher = new FilePathMatcher('/Users/test/project/sub');
      const similarPath = '/Users/test/project/sub-other/file.ts';
      expect(nestedMatcher.getRelativePath(similarPath)).toBeNull();
    });

    it('should correctly identify paths that go outside workspace using .. notation', () => {
      // Test path that would resolve to outside workspace using relative navigation
      const matcher = new FilePathMatcher('/Users/test/project');
      const outsidePath = '/Users/test/other-project/file.ts';
      expect(matcher.getRelativePath(outsidePath)).toBeNull();
    });

    it('should handle symlink-like path scenarios', () => {
      // Test paths that might be confusing due to similar naming
      const matcher = new FilePathMatcher('/Users/test/my-project');
      const confusingPath = '/Users/test/my-project-backup/src/file.ts';
      expect(matcher.getRelativePath(confusingPath)).toBeNull();
    });
  });
});