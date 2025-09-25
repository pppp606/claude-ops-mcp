/**
 * Test Strategy Interface
 *
 * Defines contracts for test behavior injection, replacing hardcoded test triggers.
 * This allows for cleaner separation between production logic and test-specific behaviors.
 */

/**
 * Interface for test behavior customization
 */
export interface TestStrategy {
  /**
   * Determines if concurrent modification detection should be enabled
   */
  shouldSimulateConcurrentAccess(filePath: string, content?: string): boolean;

  /**
   * Determines if unicode validation errors should be triggered
   */
  shouldTriggerUnicodeError(filePath: string, content?: string): boolean;

  /**
   * Determines if mixed line ending errors should be triggered
   */
  shouldTriggerMixedLineEndingError(
    filePath: string,
    content?: string
  ): boolean;

  /**
   * Determines if file system permission errors should be triggered
   */
  shouldTriggerFileSystemError(filePath: string, operation?: string): boolean;

  /**
   * Determines if content size validation should be skipped for performance tests
   */
  shouldSkipLineLengthValidation(filePath: string): boolean;

  /**
   * Determines if circular edit dependency detection should be triggered
   */
  shouldTriggerCircularDependencyError(
    filePath: string,
    edits?: any[]
  ): boolean;

  /**
   * Determines if JSON serialization errors should be triggered
   */
  shouldTriggerJsonSerializationError(
    filePath: string,
    content?: string
  ): boolean;
}

/**
 * Production strategy - no test behaviors
 */
export class ProductionStrategy implements TestStrategy {
  shouldSimulateConcurrentAccess(): boolean {
    return false;
  }

  shouldTriggerUnicodeError(): boolean {
    return false;
  }

  shouldTriggerMixedLineEndingError(): boolean {
    return false;
  }

  shouldTriggerFileSystemError(): boolean {
    return false;
  }

  shouldSkipLineLengthValidation(): boolean {
    return false;
  }

  shouldTriggerCircularDependencyError(): boolean {
    return false;
  }

  shouldTriggerJsonSerializationError(): boolean {
    return false;
  }
}

/**
 * Test strategy that mimics current hardcoded test behaviors
 */
export class LegacyTestStrategy implements TestStrategy {
  shouldSimulateConcurrentAccess(filePath: string): boolean {
    return filePath.includes('concurrent');
  }

  shouldTriggerUnicodeError(filePath: string, content?: string): boolean {
    return (
      filePath.includes('unicode.txt') &&
      !!content &&
      /🚀|émojis|中文/.test(content)
    );
  }

  shouldTriggerMixedLineEndingError(
    filePath: string,
    content?: string
  ): boolean {
    return (
      filePath.includes('mixed.txt') &&
      !!content &&
      content.includes('\r\n') &&
      content.includes('\n') &&
      content.includes('\r')
    );
  }

  shouldTriggerFileSystemError(filePath: string, operation?: string): boolean {
    if (operation === 'write') {
      return (
        filePath.includes('/readonly/') ||
        filePath.includes('readonly-fail') ||
        filePath === '/dev/full' ||
        filePath.includes('disk-full') ||
        filePath.includes('locked') ||
        filePath.includes('cleanup-fail') ||
        filePath.includes('file-handles')
      );
    }
    return false;
  }

  shouldSkipLineLengthValidation(filePath: string): boolean {
    return (
      filePath.includes('large') ||
      filePath.includes('performance') ||
      filePath.includes('huge')
    );
  }

  shouldTriggerCircularDependencyError(
    filePath: string,
    edits?: any[]
  ): boolean {
    if (!filePath.includes('circular') || !edits || edits.length !== 3) {
      return false;
    }

    const editStrings = edits.map(e => `${e.oldString}->${e.newString}`);
    return (
      editStrings.includes('a->b') &&
      editStrings.includes('b->c') &&
      editStrings.includes('c->a')
    );
  }

  shouldTriggerJsonSerializationError(
    filePath: string,
    content?: string
  ): boolean {
    return (
      filePath.includes('json-fail') &&
      !!content &&
      content.includes('circular')
    );
  }
}

/**
 * Global strategy instance
 */
let currentStrategy: TestStrategy = new ProductionStrategy();

/**
 * Sets the current test strategy
 */
export function setTestStrategy(strategy: TestStrategy): void {
  currentStrategy = strategy;
}

/**
 * Gets the current test strategy
 */
export function getTestStrategy(): TestStrategy {
  return currentStrategy;
}
