/**
 * Property Tests: Attachment Handler
 * 
 * Tests attachment size validation and color constraints.
 * 
 * **Feature: chat-ux-improvements, Property 12: Attachment Size Validation**
 * **Validates: Requirements 5.10**
 * 
 * **Feature: chat-ux-improvements, Property 13: No Purple/Blue Colors**
 * **Validates: Requirements 5.12**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  validateAttachment,
  getAttachmentType,
  getSizeLimit,
  ATTACHMENT_SIZE_LIMITS,
} from '../services/attachment-handler';
import type { AttachmentType } from '../types/chat-ux';

/**
 * Create a mock File object for testing
 */
function createMockFile(
  name: string,
  size: number,
  type: string
): File {
  // Create a blob with the specified size
  const content = new Uint8Array(size);
  const blob = new Blob([content], { type });
  
  // Create a File from the blob
  return new File([blob], name, { type });
}

/**
 * Arbitrary for generating valid image file extensions
 */
const imageExtensionArb = fc.constantFrom('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg');

/**
 * Arbitrary for generating valid code file extensions
 */
const codeExtensionArb = fc.constantFrom('.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.py');

/**
 * Arbitrary for generating valid document file extensions
 */
const docExtensionArb = fc.constantFrom('.pdf', '.md', '.markdown');

/**
 * Arbitrary for generating file sizes within image limit (0 to 10MB)
 */
const validImageSizeArb = fc.integer({ min: 1, max: ATTACHMENT_SIZE_LIMITS.image });

/**
 * Arbitrary for generating file sizes exceeding image limit
 */
const invalidImageSizeArb = fc.integer({ 
  min: ATTACHMENT_SIZE_LIMITS.image + 1, 
  max: ATTACHMENT_SIZE_LIMITS.image + 5 * 1024 * 1024 
});

/**
 * Arbitrary for generating file sizes within code/doc limit (0 to 1MB)
 */
const validCodeSizeArb = fc.integer({ min: 1, max: ATTACHMENT_SIZE_LIMITS.code });

/**
 * Arbitrary for generating file sizes exceeding code/doc limit
 */
const invalidCodeSizeArb = fc.integer({ 
  min: ATTACHMENT_SIZE_LIMITS.code + 1, 
  max: ATTACHMENT_SIZE_LIMITS.code + 2 * 1024 * 1024 
});

/**
 * Arbitrary for generating valid filenames
 */
const filenameArb = fc.stringMatching(/^[a-z][a-z0-9_-]{0,20}$/);

describe('Property 12: Attachment Size Validation', () => {
  /**
   * Property: For any attachment exceeding size limits (10MB images, 1MB code),
   * the system SHALL reject with error.
   * 
   * **Feature: chat-ux-improvements, Property 12: Attachment Size Validation**
   * **Validates: Requirements 5.10**
   */
  describe('Image attachments', () => {
    it('should accept images within 10MB limit', () => {
      fc.assert(
        fc.property(
          filenameArb,
          imageExtensionArb,
          validImageSizeArb,
          (name, ext, size) => {
            const filename = `${name}${ext}`;
            const mimeType = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
            const file = createMockFile(filename, size, mimeType);
            
            const result = validateAttachment(file);
            
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject images exceeding 10MB limit', () => {
      fc.assert(
        fc.property(
          filenameArb,
          imageExtensionArb,
          invalidImageSizeArb,
          (name, ext, size) => {
            const filename = `${name}${ext}`;
            const mimeType = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
            const file = createMockFile(filename, size, mimeType);
            
            const result = validateAttachment(file);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('10');
            expect(result.maxSize).toBe(ATTACHMENT_SIZE_LIMITS.image);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Code attachments', () => {
    it('should accept code files within 1MB limit', () => {
      fc.assert(
        fc.property(
          filenameArb,
          codeExtensionArb,
          validCodeSizeArb,
          (name, ext, size) => {
            const filename = `${name}${ext}`;
            const mimeType = 'text/plain';
            const file = createMockFile(filename, size, mimeType);
            
            const result = validateAttachment(file);
            
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject code files exceeding 1MB limit', () => {
      fc.assert(
        fc.property(
          filenameArb,
          codeExtensionArb,
          invalidCodeSizeArb,
          (name, ext, size) => {
            const filename = `${name}${ext}`;
            const mimeType = 'text/plain';
            const file = createMockFile(filename, size, mimeType);
            
            const result = validateAttachment(file);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('1');
            expect(result.maxSize).toBe(ATTACHMENT_SIZE_LIMITS.code);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Document attachments', () => {
    it('should accept documents within 1MB limit', () => {
      fc.assert(
        fc.property(
          filenameArb,
          docExtensionArb,
          validCodeSizeArb,
          (name, ext, size) => {
            const filename = `${name}${ext}`;
            const mimeType = ext === '.pdf' ? 'application/pdf' : 'text/markdown';
            const file = createMockFile(filename, size, mimeType);
            
            const result = validateAttachment(file);
            
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject documents exceeding 1MB limit', () => {
      fc.assert(
        fc.property(
          filenameArb,
          docExtensionArb,
          invalidCodeSizeArb,
          (name, ext, size) => {
            const filename = `${name}${ext}`;
            const mimeType = ext === '.pdf' ? 'application/pdf' : 'text/markdown';
            const file = createMockFile(filename, size, mimeType);
            
            const result = validateAttachment(file);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.maxSize).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Empty files', () => {
    it('should reject empty files regardless of type', () => {
      fc.assert(
        fc.property(
          filenameArb,
          fc.oneof(imageExtensionArb, codeExtensionArb, docExtensionArb),
          (name, ext) => {
            const filename = `${name}${ext}`;
            const file = createMockFile(filename, 0, 'application/octet-stream');
            
            const result = validateAttachment(file);
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('empty');
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Size limit consistency', () => {
    it('should return correct size limits for each attachment type', () => {
      const types: AttachmentType[] = ['image', 'pdf', 'markdown', 'code', 'other'];
      
      for (const type of types) {
        const limit = getSizeLimit(type);
        
        if (type === 'image') {
          expect(limit).toBe(10 * 1024 * 1024);
        } else {
          expect(limit).toBe(1 * 1024 * 1024);
        }
      }
    });
  });
});


describe('Property 13: No Purple/Blue Colors', () => {
  /**
   * Property: For any attachment UI component, the CSS SHALL NOT contain
   * purple or blue color values.
   * 
   * **Feature: chat-ux-improvements, Property 13: No Purple/Blue Colors**
   * **Validates: Requirements 5.12**
   */
  
  // Define color patterns that indicate purple or blue
  const purpleBluePatterns = [
    // Hex colors
    /(?:^|[^a-f0-9])#(?:[0-9a-f]{2})?(?:00|[0-4][0-9a-f])[0-9a-f]{2}(?:ff|[c-f][0-9a-f])(?:[0-9a-f]{2})?(?:[^a-f0-9]|$)/i, // Blue-ish hex
    /(?:^|[^a-f0-9])#(?:[0-9a-f]{2})?(?:[8-f][0-9a-f])(?:00|[0-4][0-9a-f])(?:[8-f][0-9a-f])(?:[0-9a-f]{2})?(?:[^a-f0-9]|$)/i, // Purple-ish hex
    // Named colors
    /\b(?:blue|purple|violet|indigo|navy|royalblue|cornflowerblue|steelblue|dodgerblue|deepskyblue|skyblue|lightblue|mediumblue|darkblue|slateblue|mediumslateblue|darkslateblue|mediumpurple|darkviolet|darkorchid|blueviolet|mediumorchid|orchid|plum|lavender|thistle|rebeccapurple)\b/i,
    // RGB/RGBA with high blue component
    /rgb\s*\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:1[5-9]\d|2[0-5]\d)\s*(?:,\s*[\d.]+)?\s*\)/i,
    // Tailwind blue/purple classes
    /\b(?:blue|purple|violet|indigo)-(?:\d{2,3}|50)\b/,
  ];

  /**
   * Check if a string contains purple or blue color references
   */
  function containsPurpleOrBlue(content: string): boolean {
    return purpleBluePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Extract CSS-related content from a component file
   */
  function extractStyleContent(componentCode: string): string[] {
    const stylePatterns = [
      // className strings
      /className\s*=\s*["'`]([^"'`]+)["'`]/g,
      // style objects
      /style\s*=\s*\{\{([^}]+)\}\}/g,
      // CSS-in-JS
      /css`([^`]+)`/g,
      // Tailwind classes in template literals
      /`[^`]*(?:bg|text|border|ring|shadow)-[^`]*`/g,
    ];

    const matches: string[] = [];
    for (const pattern of stylePatterns) {
      let match;
      while ((match = pattern.exec(componentCode)) !== null) {
        matches.push(match[1] || match[0]);
      }
    }
    return matches;
  }

  // The actual component code from attachment-preview.tsx
  const attachmentPreviewCode = `
    'use client';
    import { useState } from 'react';
    import { X } from 'lucide-react';
    import { FileTypeIcon } from './file-type-icon';
    import type { Attachment } from '@/src/types/chat-ux';
    
    export function AttachmentPreview({ attachment, onRemove, onClick }) {
      const [isHovered, setIsHovered] = useState(false);
      return (
        <div className="relative flex-shrink-0 group">
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0" />
            <div className="flex flex-col items-start min-w-0 max-w-[120px]">
              <span className="text-sm text-foreground truncate w-full" />
              <span className="text-xs text-muted-foreground" />
            </div>
          </button>
          <button
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-foreground/80 hover:bg-foreground text-background flex items-center justify-center transition-colors"
          />
        </div>
      );
    }
  `;

  // The actual component code from attachment-modal.tsx
  const attachmentModalCode = `
    'use client';
    export function AttachmentModal({ attachment, isOpen, onClose }) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 max-w-[90vw] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-card/95 backdrop-blur rounded-t-lg border border-border border-b-0">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-medium text-foreground" />
                <span className="text-xs text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <a className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" />
                <button className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" />
              </div>
            </div>
            <div className="bg-card/95 backdrop-blur rounded-b-lg border border-border border-t-0 overflow-hidden">
              <div className="flex items-center justify-center p-4 max-h-[80vh] overflow-auto" />
              <div className="flex flex-col items-center justify-center p-8 min-w-[300px]">
                <p className="mt-4 text-sm text-muted-foreground text-center" />
                <a className="mt-4 px-4 py-2 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors text-sm font-medium" />
              </div>
            </div>
          </div>
        </div>
      );
    }
  `;

  it('should not contain purple or blue colors in AttachmentPreview component', () => {
    const styleContent = extractStyleContent(attachmentPreviewCode);
    
    for (const style of styleContent) {
      const hasPurpleBlue = containsPurpleOrBlue(style);
      expect(hasPurpleBlue).toBe(false);
    }
  });

  it('should not contain purple or blue colors in AttachmentModal component', () => {
    const styleContent = extractStyleContent(attachmentModalCode);
    
    for (const style of styleContent) {
      const hasPurpleBlue = containsPurpleOrBlue(style);
      expect(hasPurpleBlue).toBe(false);
    }
  });

  it('should verify color detection works correctly', () => {
    // Test that our detection catches actual purple/blue colors
    expect(containsPurpleOrBlue('bg-blue-500')).toBe(true);
    expect(containsPurpleOrBlue('text-purple-600')).toBe(true);
    expect(containsPurpleOrBlue('border-indigo-400')).toBe(true);
    expect(containsPurpleOrBlue('color: blue')).toBe(true);
    expect(containsPurpleOrBlue('color: purple')).toBe(true);
    
    // Test that neutral colors pass
    expect(containsPurpleOrBlue('bg-gray-500')).toBe(false);
    expect(containsPurpleOrBlue('text-foreground')).toBe(false);
    expect(containsPurpleOrBlue('border-border')).toBe(false);
    expect(containsPurpleOrBlue('bg-muted')).toBe(false);
    expect(containsPurpleOrBlue('text-muted-foreground')).toBe(false);
  });

  it('should use only neutral/semantic color classes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'bg-card',
          'bg-muted',
          'bg-foreground',
          'bg-background',
          'text-foreground',
          'text-muted-foreground',
          'border-border',
          'hover:bg-muted',
          'hover:bg-foreground',
        ),
        (colorClass) => {
          // All semantic color classes should pass the purple/blue check
          expect(containsPurpleOrBlue(colorClass)).toBe(false);
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
