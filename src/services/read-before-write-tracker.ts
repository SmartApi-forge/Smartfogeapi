/**
 * Read-Before-Write Tracker Service
 * 
 * Tracks which files have been read in the current conversation turn
 * to enforce the read-before-write pattern.
 * 
 * Requirements: 17.1, 17.4
 * - Track which files have been read in current turn
 * - Warn or block writes to unread files
 * - Support parallel tool execution for efficiency
 */

/**
 * Tracking state for a single conversation turn
 */
export interface TurnTrackingState {
  turnIndex: number;
  readFiles: Set<string>;
  writtenFiles: Set<string>;
  warnings: string[];
  startTime: number;
}

/**
 * Result of a write validation check
 */
export interface WriteValidationResult {
  allowed: boolean;
  warning?: string;
  suggestion?: string;
}

/**
 * ReadBeforeWriteTracker class
 * Manages file read/write tracking for a conversation turn
 */
export class ReadBeforeWriteTracker {
  private projectId: string;
  private state: TurnTrackingState;
  private strictMode: boolean;

  constructor(projectId: string, turnIndex: number, strictMode: boolean = false) {
    this.projectId = projectId;
    this.strictMode = strictMode;
    this.state = {
      turnIndex,
      readFiles: new Set(),
      writtenFiles: new Set(),
      warnings: [],
      startTime: Date.now(),
    };
  }

  /**
   * Record that a file has been read
   * 
   * @param filePath - Path of the file that was read
   */
  recordRead(filePath: string): void {
    this.state.readFiles.add(this.normalizePath(filePath));
  }

  /**
   * Record multiple files as read (for parallel tool execution)
   * 
   * Requirement 17.4: Support parallel tool execution for efficiency
   * 
   * @param filePaths - Array of file paths that were read
   */
  recordReads(filePaths: string[]): void {
    for (const filePath of filePaths) {
      this.recordRead(filePath);
    }
  }

  /**
   * Check if a file has been read in this turn
   * 
   * @param filePath - Path of the file to check
   * @returns true if the file has been read
   */
  hasBeenRead(filePath: string): boolean {
    return this.state.readFiles.has(this.normalizePath(filePath));
  }

  /**
   * Validate if a write operation is allowed
   * 
   * Requirement 17.1: Require reading the file first before allowing writes
   * 
   * @param filePath - Path of the file to write
   * @param isNewFile - Whether this is a new file being created
   * @returns Validation result with allowed status and optional warning
   */
  validateWrite(filePath: string, isNewFile: boolean = false): WriteValidationResult {
    const normalizedPath = this.normalizePath(filePath);
    
    // New files don't need to be read first
    if (isNewFile) {
      return { allowed: true };
    }
    
    // Check if file was read
    if (this.hasBeenRead(normalizedPath)) {
      return { allowed: true };
    }
    
    // File wasn't read - generate warning
    const warning = `Warning: Attempting to modify "${filePath}" without reading it first. ` +
      `Use ReadFile or SearchRepo to understand the file before making changes.`;
    
    this.state.warnings.push(warning);
    
    // In strict mode, block the write
    if (this.strictMode) {
      return {
        allowed: false,
        warning,
        suggestion: `Please read "${filePath}" first using ReadFile tool before modifying it.`,
      };
    }
    
    // In non-strict mode, allow with warning
    return {
      allowed: true,
      warning,
      suggestion: `Consider reading "${filePath}" first to ensure accurate modifications.`,
    };
  }

  /**
   * Record that a file has been written
   * 
   * @param filePath - Path of the file that was written
   */
  recordWrite(filePath: string): void {
    this.state.writtenFiles.add(this.normalizePath(filePath));
  }

  /**
   * Get all files that were read in this turn
   * 
   * @returns Array of file paths that were read
   */
  getReadFiles(): string[] {
    return Array.from(this.state.readFiles);
  }

  /**
   * Get all files that were written in this turn
   * 
   * @returns Array of file paths that were written
   */
  getWrittenFiles(): string[] {
    return Array.from(this.state.writtenFiles);
  }

  /**
   * Get all warnings generated during this turn
   * 
   * @returns Array of warning messages
   */
  getWarnings(): string[] {
    return [...this.state.warnings];
  }

  /**
   * Get files that were written without being read first
   * 
   * @returns Array of file paths that were written without reading
   */
  getUnreadWrites(): string[] {
    const unreadWrites: string[] = [];
    for (const writtenFile of this.state.writtenFiles) {
      if (!this.state.readFiles.has(writtenFile)) {
        unreadWrites.push(writtenFile);
      }
    }
    return unreadWrites;
  }

  /**
   * Check if all written files were read first
   * 
   * @returns true if all writes followed read-before-write pattern
   */
  isCompliant(): boolean {
    return this.getUnreadWrites().length === 0;
  }

  /**
   * Get a summary of the tracking state
   * 
   * @returns Summary object with counts and compliance status
   */
  getSummary(): {
    turnIndex: number;
    readCount: number;
    writeCount: number;
    unreadWriteCount: number;
    warningCount: number;
    isCompliant: boolean;
    durationMs: number;
  } {
    return {
      turnIndex: this.state.turnIndex,
      readCount: this.state.readFiles.size,
      writeCount: this.state.writtenFiles.size,
      unreadWriteCount: this.getUnreadWrites().length,
      warningCount: this.state.warnings.length,
      isCompliant: this.isCompliant(),
      durationMs: Date.now() - this.state.startTime,
    };
  }

  /**
   * Reset the tracker for a new turn
   * 
   * @param newTurnIndex - The new turn index
   */
  reset(newTurnIndex: number): void {
    this.state = {
      turnIndex: newTurnIndex,
      readFiles: new Set(),
      writtenFiles: new Set(),
      warnings: [],
      startTime: Date.now(),
    };
  }

  /**
   * Normalize a file path for consistent comparison
   * 
   * @param filePath - Path to normalize
   * @returns Normalized path
   */
  private normalizePath(filePath: string): string {
    // Remove leading ./ or /
    let normalized = filePath.replace(/^\.?\//, '');
    // Normalize path separators
    normalized = normalized.replace(/\\/g, '/');
    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');
    return normalized;
  }
}

/**
 * Factory function to create a ReadBeforeWriteTracker
 * 
 * @param projectId - The project ID
 * @param turnIndex - The current turn index
 * @param strictMode - Whether to block writes to unread files (default: false)
 * @returns ReadBeforeWriteTracker instance
 */
export function createReadBeforeWriteTracker(
  projectId: string,
  turnIndex: number,
  strictMode: boolean = false
): ReadBeforeWriteTracker {
  return new ReadBeforeWriteTracker(projectId, turnIndex, strictMode);
}

/**
 * Global tracker instances by project ID
 * Used for maintaining state across tool calls within a turn
 */
const trackerInstances = new Map<string, ReadBeforeWriteTracker>();

/**
 * Get or create a tracker for a project
 * 
 * @param projectId - The project ID
 * @param turnIndex - The current turn index
 * @param strictMode - Whether to use strict mode
 * @returns ReadBeforeWriteTracker instance
 */
export function getOrCreateTracker(
  projectId: string,
  turnIndex: number,
  strictMode: boolean = false
): ReadBeforeWriteTracker {
  const key = projectId;
  let tracker = trackerInstances.get(key);
  
  if (!tracker || tracker.getSummary().turnIndex !== turnIndex) {
    tracker = createReadBeforeWriteTracker(projectId, turnIndex, strictMode);
    trackerInstances.set(key, tracker);
  }
  
  return tracker;
}

/**
 * Clear tracker for a project (call at end of turn)
 * 
 * @param projectId - The project ID
 */
export function clearTracker(projectId: string): void {
  trackerInstances.delete(projectId);
}
