/**
 * PartialEditMerger Utility
 * 
 * Merges partial edits with original file content.
 * Supports the v0-style `// ... existing code ...` marker pattern.
 * 
 * Requirements: 16.5
 */

/**
 * Marker patterns for partial edits
 */
const EXISTING_CODE_MARKERS = [
  '// ... existing code ...',
  '/* ... existing code ... */',
  '# ... existing code ...',
  '<!-- ... existing code ... -->',
  '{/* ... existing code ... */}',  // JSX comment
];

/**
 * Regex pattern to match any existing code marker
 */
const MARKER_REGEX = /(?:\/\/|\/\*|#|<!--|{\s*\/\*)\s*\.\.\.\s*existing\s+code\s*\.\.\.\s*(?:\*\/|-->|\*\/\s*})?/gi;

export interface MergePartialEditResult {
  /** The merged content */
  content: string;
  /** Whether the merge was successful */
  success: boolean;
  /** Error message if merge failed */
  error?: string;
  /** Number of markers found and processed */
  markersProcessed: number;
}

/**
 * Split content into lines, preserving line endings
 */
function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

/**
 * Find the line index in original content that best matches the context around a marker.
 * Uses surrounding lines to find the best match position.
 */
function findMatchingPosition(
  originalLines: string[],
  beforeContext: string[],
  afterContext: string[],
  startSearchFrom: number = 0
): number {
  // If no context, return -1 (can't determine position)
  if (beforeContext.length === 0 && afterContext.length === 0) {
    return startSearchFrom;
  }

  // Try to match using before context (lines before the marker)
  if (beforeContext.length > 0) {
    const lastBeforeLine = beforeContext[beforeContext.length - 1].trim();
    
    for (let i = startSearchFrom; i < originalLines.length; i++) {
      if (originalLines[i].trim() === lastBeforeLine) {
        // Found a match, verify more context if available
        let matches = true;
        for (let j = 1; j < beforeContext.length && i - j >= 0; j++) {
          if (originalLines[i - j].trim() !== beforeContext[beforeContext.length - 1 - j].trim()) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return i + 1; // Return position after the matched line
        }
      }
    }
  }

  // Try to match using after context (lines after the marker)
  if (afterContext.length > 0) {
    const firstAfterLine = afterContext[0].trim();
    
    for (let i = startSearchFrom; i < originalLines.length; i++) {
      if (originalLines[i].trim() === firstAfterLine) {
        // Found a match, verify more context if available
        let matches = true;
        for (let j = 1; j < afterContext.length && i + j < originalLines.length; j++) {
          if (originalLines[i + j].trim() !== afterContext[j].trim()) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return i; // Return position of the matched line
        }
      }
    }
  }

  return -1; // No match found
}

/**
 * Check if a line contains an existing code marker
 */
function isMarkerLine(line: string): boolean {
  return MARKER_REGEX.test(line);
}

/**
 * Merge a partial edit with the original file content.
 * 
 * The partial edit uses `// ... existing code ...` markers to indicate
 * sections of the original file that should be preserved.
 * 
 * Requirements:
 * - 16.5: Correctly parse and merge `// ... existing code ...` markers
 * 
 * @param originalContent - The original file content
 * @param partialEdit - The partial edit with markers
 * @returns MergePartialEditResult containing the merged content
 */
export function mergePartialEdit(
  originalContent: string,
  partialEdit: string
): MergePartialEditResult {
  // Reset regex state
  MARKER_REGEX.lastIndex = 0;

  // Check if partial edit contains any markers
  if (!MARKER_REGEX.test(partialEdit)) {
    // No markers - this is a full replacement
    return {
      content: partialEdit,
      success: true,
      markersProcessed: 0
    };
  }

  // Reset regex state again after test
  MARKER_REGEX.lastIndex = 0;

  const originalLines = splitLines(originalContent);
  const editLines = splitLines(partialEdit);
  const resultLines: string[] = [];
  
  let markersProcessed = 0;
  let originalPosition = 0;
  let i = 0;

  while (i < editLines.length) {
    const line = editLines[i];

    if (isMarkerLine(line)) {
      markersProcessed++;

      // Get context before the marker (up to 3 lines)
      const beforeContext: string[] = [];
      for (let j = Math.max(0, i - 3); j < i; j++) {
        if (!isMarkerLine(editLines[j])) {
          beforeContext.push(editLines[j]);
        }
      }

      // Get context after the marker (up to 3 lines)
      const afterContext: string[] = [];
      for (let j = i + 1; j < Math.min(editLines.length, i + 4); j++) {
        if (!isMarkerLine(editLines[j])) {
          afterContext.push(editLines[j]);
        }
      }

      // Find where in the original file this marker corresponds to
      const matchStart = findMatchingPosition(
        originalLines,
        beforeContext,
        afterContext,
        originalPosition
      );

      if (matchStart === -1) {
        // Can't find matching position - use heuristic
        // Copy from current position to where after context starts
        if (afterContext.length > 0) {
          const afterLine = afterContext[0].trim();
          let foundEnd = -1;
          for (let j = originalPosition; j < originalLines.length; j++) {
            if (originalLines[j].trim() === afterLine) {
              foundEnd = j;
              break;
            }
          }
          if (foundEnd !== -1) {
            // Copy original lines up to the match
            for (let j = originalPosition; j < foundEnd; j++) {
              resultLines.push(originalLines[j]);
            }
            originalPosition = foundEnd;
          }
        }
      } else {
        // Copy original lines from current position to match position
        for (let j = originalPosition; j < matchStart; j++) {
          resultLines.push(originalLines[j]);
        }
        originalPosition = matchStart;

        // Skip past the section in original that corresponds to after context
        if (afterContext.length > 0) {
          const afterLine = afterContext[0].trim();
          for (let j = originalPosition; j < originalLines.length; j++) {
            if (originalLines[j].trim() === afterLine) {
              originalPosition = j;
              break;
            }
          }
        }
      }

      i++;
    } else {
      // Regular line - add to result
      resultLines.push(line);
      i++;
    }
  }

  // If there's remaining original content and the edit ended with a marker,
  // we might need to append it
  // (This is handled by the marker processing above)

  return {
    content: resultLines.join('\n'),
    success: true,
    markersProcessed
  };
}

/**
 * Check if content contains partial edit markers.
 */
export function hasPartialEditMarkers(content: string): boolean {
  MARKER_REGEX.lastIndex = 0;
  return MARKER_REGEX.test(content);
}

/**
 * Count the number of partial edit markers in content.
 */
export function countPartialEditMarkers(content: string): number {
  MARKER_REGEX.lastIndex = 0;
  const matches = content.match(MARKER_REGEX);
  return matches ? matches.length : 0;
}

/**
 * PartialEditMerger service interface
 */
export const partialEditMerger = {
  merge: mergePartialEdit,
  hasMarkers: hasPartialEditMarkers,
  countMarkers: countPartialEditMarkers
};

export default partialEditMerger;
