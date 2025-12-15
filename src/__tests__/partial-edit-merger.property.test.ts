/**
 * Property Tests: Partial Edit Merger
 * 
 * **Feature: v0-lovable-architecture, Property 28: Partial Edit Pattern Support**
 * **Validates: Requirements 16.5**
 * 
 * Property: For any file edit operation on existing files, the system SHALL 
 * correctly parse and merge `// ... existing code ...` markers with the 
 * original file content.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  mergePartialEdit,
  hasPartialEditMarkers,
  countPartialEditMarkers,
  partialEditMerger
} from '../services/partial-edit-merger';

/**
 * Generate a simple code line (no markers)
 */
const codeLineArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => !s.includes('...') && !s.includes('existing code'))
  .map(s => `const ${s.replace(/[^a-zA-Z0-9]/g, '')} = 1;`);

/**
 * Generate multiple code lines
 */
const codeLinesArb = fc.array(codeLineArb, { minLength: 1, maxLength: 10 })
  .map(lines => lines.join('\n'));

describe('Property 28: Partial Edit Pattern Support', () => {
  /**
   * Property: Content without markers SHALL be returned unchanged.
   */
  it('should return content unchanged when no markers present', () => {
    fc.assert(
      fc.property(
        codeLinesArb,
        codeLinesArb,
        (original, edit) => {
          // Ensure edit has no markers
          if (hasPartialEditMarkers(edit)) {
            return true; // Skip this case
          }

          const result = mergePartialEdit(original, edit);

          // Edit should replace original entirely
          expect(result.success).toBe(true);
          expect(result.markersProcessed).toBe(0);
          expect(result.content).toBe(edit);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Marker detection SHALL correctly identify markers.
   */
  it('should correctly detect partial edit markers', () => {
    const testCases = [
      { content: '// ... existing code ...', expected: true },
      { content: '/* ... existing code ... */', expected: true },
      { content: '# ... existing code ...', expected: true },
      { content: '<!-- ... existing code ... -->', expected: true },
      { content: '{/* ... existing code ... */}', expected: true },
      { content: 'const x = 1;', expected: false },
      { content: '// regular comment', expected: false },
      { content: '// ... some other text ...', expected: false },
    ];

    for (const { content, expected } of testCases) {
      expect(hasPartialEditMarkers(content)).toBe(expected);
    }
  });

  /**
   * Property: Marker count SHALL be accurate.
   */
  it('should correctly count markers', () => {
    const testCases = [
      { content: 'const x = 1;', expected: 0 },
      { content: '// ... existing code ...', expected: 1 },
      { content: '// ... existing code ...\nconst x = 1;\n// ... existing code ...', expected: 2 },
      { content: '/* ... existing code ... */\n# ... existing code ...', expected: 2 },
    ];

    for (const { content, expected } of testCases) {
      expect(countPartialEditMarkers(content)).toBe(expected);
    }
  });

  /**
   * Property: Single marker at start SHALL preserve content after marker position.
   */
  it('should handle marker at start of edit', () => {
    const original = `const a = 1;
const b = 2;
const c = 3;`;

    const edit = `// ... existing code ...
const d = 4;`;

    const result = mergePartialEdit(original, edit);

    expect(result.success).toBe(true);
    expect(result.markersProcessed).toBe(1);
    // The new line should be added
    expect(result.content).toContain('const d = 4;');
  });

  /**
   * Property: Single marker at end SHALL preserve content before marker position.
   */
  it('should handle marker at end of edit', () => {
    const original = `const a = 1;
const b = 2;
const c = 3;`;

    const edit = `const newFirst = 0;
// ... existing code ...`;

    const result = mergePartialEdit(original, edit);

    expect(result.success).toBe(true);
    expect(result.markersProcessed).toBe(1);
    // The new line should be at the start
    expect(result.content).toContain('const newFirst = 0;');
  });

  /**
   * Property: Marker in middle SHALL preserve content on both sides.
   */
  it('should handle marker in middle of edit', () => {
    const original = `import React from 'react';

function App() {
  return <div>Hello</div>;
}

export default App;`;

    const edit = `import React from 'react';
import { useState } from 'react';

// ... existing code ...

export default App;`;

    const result = mergePartialEdit(original, edit);

    expect(result.success).toBe(true);
    expect(result.markersProcessed).toBe(1);
    // New import should be present
    expect(result.content).toContain("import { useState } from 'react';");
    // Export should be preserved
    expect(result.content).toContain('export default App;');
  });

  /**
   * Property: Multiple markers SHALL all be processed.
   */
  it('should handle multiple markers', () => {
    const original = `// Header
const a = 1;
const b = 2;
const c = 3;
// Footer`;

    const edit = `// Header
// ... existing code ...
const newMiddle = 'inserted';
// ... existing code ...
// Footer`;

    const result = mergePartialEdit(original, edit);

    expect(result.success).toBe(true);
    expect(result.markersProcessed).toBe(2);
    expect(result.content).toContain('// Header');
    expect(result.content).toContain("const newMiddle = 'inserted';");
    expect(result.content).toContain('// Footer');
  });

  /**
   * Property: Different marker styles SHALL all be recognized.
   */
  it('should recognize different marker styles', () => {
    const markerStyles = [
      '// ... existing code ...',
      '/* ... existing code ... */',
      '# ... existing code ...',
    ];

    for (const marker of markerStyles) {
      expect(hasPartialEditMarkers(marker)).toBe(true);
      expect(countPartialEditMarkers(marker)).toBe(1);
    }
  });

  /**
   * Property: Empty original content SHALL work with markers.
   */
  it('should handle empty original content', () => {
    const original = '';
    const edit = `// ... existing code ...
const x = 1;`;

    const result = mergePartialEdit(original, edit);

    expect(result.success).toBe(true);
    expect(result.content).toContain('const x = 1;');
  });

  /**
   * Property: Empty edit SHALL return empty content.
   */
  it('should handle empty edit', () => {
    const original = 'const x = 1;';
    const edit = '';

    const result = mergePartialEdit(original, edit);

    expect(result.success).toBe(true);
    expect(result.content).toBe('');
    expect(result.markersProcessed).toBe(0);
  });

  /**
   * Property: Merge result SHALL always be successful for valid inputs.
   */
  it('should always succeed for valid inputs', () => {
    fc.assert(
      fc.property(
        codeLinesArb,
        fc.oneof(
          codeLinesArb,
          codeLinesArb.map(code => `// ... existing code ...\n${code}`),
          codeLinesArb.map(code => `${code}\n// ... existing code ...`),
          codeLinesArb.map(code => `// ... existing code ...\n${code}\n// ... existing code ...`)
        ),
        (original, edit) => {
          const result = mergePartialEdit(original, edit);
          expect(result.success).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Markers processed count SHALL match actual markers in edit.
   */
  it('should report correct number of markers processed', () => {
    fc.assert(
      fc.property(
        codeLinesArb,
        fc.integer({ min: 0, max: 3 }),
        (code, numMarkers) => {
          // Build edit with specified number of markers
          const editLines: string[] = [];
          
          // Add markers with some code between them
          for (let i = 0; i < numMarkers; i++) {
            editLines.push('// ... existing code ...');
            editLines.push(`const marker${i} = ${i};`);
          }
          
          // Add some final code
          editLines.push('const final = true;');

          const edit = editLines.join('\n');
          
          // Count actual markers in the edit
          const actualMarkerCount = countPartialEditMarkers(edit);
          
          const result = mergePartialEdit(code, edit);

          // Markers processed should match actual markers in edit
          expect(result.markersProcessed).toBe(actualMarkerCount);
          expect(result.markersProcessed).toBe(numMarkers);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Service interface SHALL expose all functions.
   */
  it('should expose all functions via service interface', () => {
    expect(typeof partialEditMerger.merge).toBe('function');
    expect(typeof partialEditMerger.hasMarkers).toBe('function');
    expect(typeof partialEditMerger.countMarkers).toBe('function');
  });
});
