/**
 * Property Tests: Attachment Context Integration
 * 
 * Tests that attachment content is properly included in AI context.
 * 
 * **Feature: chat-ux-improvements, Property 11: Attachment Content in Context**
 * **Validates: Requirements 5.8**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  processAttachmentsForContext,
  buildMessageContentWithAttachments,
  isTextBasedAttachment,
  isImageAttachment,
  isDocumentAttachment,
  formatTextAttachmentContent,
  formatDocumentAttachmentContent,
  buildTextAttachmentContext,
  extractImageUrls,
  validateAttachmentsForContext,
  summarizeAttachments,
  requiresVisionModel,
  type AttachmentContextResult,
  type MessageContentPart,
} from '../services/attachment-context-integration';
import type { Attachment, AttachmentType } from '../types/chat-ux';

/**
 * Arbitrary for generating valid attachment types
 */
const attachmentTypeArb = fc.constantFrom<AttachmentType>(
  'image', 'pdf', 'markdown', 'code', 'other'
);

/**
 * Arbitrary for generating valid filenames with extensions
 */
const filenameArb = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9_-]{0,15}$/),
  attachmentTypeArb
).map(([name, type]) => {
  const extensions: Record<AttachmentType, string> = {
    image: '.png',
    pdf: '.pdf',
    markdown: '.md',
    code: '.ts',
    other: '.txt',
  };
  return `${name}${extensions[type]}`;
});

/**
 * Arbitrary for generating text content
 */
const textContentArb = fc.string({ minLength: 1, maxLength: 500 });

/**
 * Arbitrary for generating valid URLs
 */
const urlArb = fc.webUrl();

/**
 * Arbitrary for generating file sizes (1 byte to 1MB)
 */
const fileSizeArb = fc.integer({ min: 1, max: 1024 * 1024 });

/**
 * Arbitrary for generating a complete Attachment object
 */
const attachmentArb = fc.record({
  id: fc.uuid(),
  name: filenameArb,
  type: attachmentTypeArb,
  size: fileSizeArb,
  url: urlArb,
  thumbnailUrl: fc.option(urlArb, { nil: undefined }),
  content: fc.option(textContentArb, { nil: undefined }),
  storagePath: fc.string({ minLength: 5, maxLength: 50 }),
  createdAt: fc.date(),
}) as fc.Arbitrary<Attachment>;

/**
 * Arbitrary for generating text-based attachments (with content)
 */
const textAttachmentArb = fc.record({
  id: fc.uuid(),
  name: fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9_-]{0,15}$/),
    fc.constantFrom<AttachmentType>('markdown', 'code', 'other')
  ).map(([name, type]) => {
    const ext = type === 'markdown' ? '.md' : type === 'code' ? '.ts' : '.txt';
    return `${name}${ext}`;
  }),
  type: fc.constantFrom<AttachmentType>('markdown', 'code', 'other'),
  size: fileSizeArb,
  url: urlArb,
  content: textContentArb, // Always has content
  storagePath: fc.string({ minLength: 5, maxLength: 50 }),
  createdAt: fc.date(),
}) as fc.Arbitrary<Attachment>;

/**
 * Arbitrary for generating image attachments
 */
const imageAttachmentArb = fc.record({
  id: fc.uuid(),
  name: fc.stringMatching(/^[a-z][a-z0-9_-]{0,15}$/).map(n => `${n}.png`),
  type: fc.constant<AttachmentType>('image'),
  size: fileSizeArb,
  url: urlArb,
  thumbnailUrl: fc.option(urlArb, { nil: undefined }),
  storagePath: fc.string({ minLength: 5, maxLength: 50 }),
  createdAt: fc.date(),
}) as fc.Arbitrary<Attachment>;

/**
 * Arbitrary for generating prompts
 */
const promptArb = fc.string({ minLength: 1, maxLength: 200 });

describe('Property 11: Attachment Content in Context', () => {
  /**
   * Property: For any prompt with attachments, the AI context SHALL include
   * the attachment content.
   * 
   * **Feature: chat-ux-improvements, Property 11: Attachment Content in Context**
   * **Validates: Requirements 5.8**
   */

  describe('Text-based attachment content inclusion', () => {
    it('should include text attachment content in context', () => {
      fc.assert(
        fc.property(
          fc.array(textAttachmentArb, { minLength: 1, maxLength: 5 }),
          (attachments) => {
            const result = processAttachmentsForContext(attachments);

            // All text attachments with content should be included
            for (const attachment of attachments) {
              if (attachment.content) {
                expect(result.textContent).toContain(attachment.content);
                expect(result.textContent).toContain(attachment.name);
              }
            }

            expect(result.attachmentCount).toBe(attachments.length);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format text attachments with proper headers and footers', () => {
      fc.assert(
        fc.property(
          textAttachmentArb,
          (attachment) => {
            const formatted = formatTextAttachmentContent(attachment);

            if (attachment.content) {
              expect(formatted).toContain(`--- Attached File: ${attachment.name} ---`);
              expect(formatted).toContain(`--- End of ${attachment.name} ---`);
              expect(formatted).toContain(attachment.content);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Image attachment handling', () => {
    it('should extract image URLs for vision API', () => {
      fc.assert(
        fc.property(
          fc.array(imageAttachmentArb, { minLength: 1, maxLength: 5 }),
          (attachments) => {
            const result = processAttachmentsForContext(attachments);

            // All image URLs should be extracted
            expect(result.imageUrls.length).toBe(attachments.length);
            expect(result.requiresVision).toBe(true);

            for (const attachment of attachments) {
              expect(result.imageUrls).toContain(attachment.url);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should set requiresVision flag when images are present', () => {
      fc.assert(
        fc.property(
          fc.array(imageAttachmentArb, { minLength: 1, maxLength: 3 }),
          (imageAttachments) => {
            const result = processAttachmentsForContext(imageAttachments);
            expect(result.requiresVision).toBe(true);
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not set requiresVision flag when no images are present', () => {
      fc.assert(
        fc.property(
          fc.array(textAttachmentArb, { minLength: 1, maxLength: 3 }),
          (textAttachments) => {
            const result = processAttachmentsForContext(textAttachments);
            expect(result.requiresVision).toBe(false);
            expect(result.imageUrls.length).toBe(0);
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Mixed attachment handling', () => {
    it('should handle mixed text and image attachments', () => {
      fc.assert(
        fc.property(
          fc.array(textAttachmentArb, { minLength: 1, maxLength: 3 }),
          fc.array(imageAttachmentArb, { minLength: 1, maxLength: 3 }),
          (textAttachments, imageAttachments) => {
            const allAttachments = [...textAttachments, ...imageAttachments];
            const result = processAttachmentsForContext(allAttachments);

            // Should include both text content and image URLs
            expect(result.requiresVision).toBe(true);
            expect(result.imageUrls.length).toBe(imageAttachments.length);
            expect(result.attachmentCount).toBe(allAttachments.length);

            // Text content should be included
            for (const textAtt of textAttachments) {
              if (textAtt.content) {
                expect(result.textContent).toContain(textAtt.content);
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Message content building', () => {
    it('should return string for prompts without attachments', () => {
      fc.assert(
        fc.property(
          promptArb,
          (prompt) => {
            const content = buildMessageContentWithAttachments(prompt, []);
            expect(typeof content).toBe('string');
            expect(content).toBe(prompt);
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return string with context for text-only attachments', () => {
      fc.assert(
        fc.property(
          promptArb,
          fc.array(textAttachmentArb, { minLength: 1, maxLength: 3 }),
          (prompt, attachments) => {
            const content = buildMessageContentWithAttachments(prompt, attachments);
            
            // Should be a string (not array) since no images
            expect(typeof content).toBe('string');
            
            // Should contain the prompt
            expect(content as string).toContain(prompt);
            
            // Should contain attachment content
            for (const att of attachments) {
              if (att.content) {
                expect(content as string).toContain(att.content);
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return content parts array for image attachments', () => {
      fc.assert(
        fc.property(
          promptArb,
          fc.array(imageAttachmentArb, { minLength: 1, maxLength: 3 }),
          (prompt, attachments) => {
            const content = buildMessageContentWithAttachments(prompt, attachments);
            
            // Should be an array for vision API
            expect(Array.isArray(content)).toBe(true);
            
            const parts = content as MessageContentPart[];
            
            // First part should be text with prompt
            expect(parts[0].type).toBe('text');
            expect((parts[0] as { type: 'text'; text: string }).text).toContain(prompt);
            
            // Should have image_url parts for each image
            const imageParts = parts.filter(p => p.type === 'image_url');
            expect(imageParts.length).toBe(attachments.length);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Empty and edge cases', () => {
    it('should handle empty attachment array', () => {
      const result = processAttachmentsForContext([]);
      
      expect(result.textContent).toBe('');
      expect(result.imageUrls).toEqual([]);
      expect(result.requiresVision).toBe(false);
      expect(result.attachmentCount).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    it('should calculate total size correctly', () => {
      fc.assert(
        fc.property(
          fc.array(attachmentArb, { minLength: 1, maxLength: 5 }),
          (attachments) => {
            const result = processAttachmentsForContext(attachments);
            const expectedSize = attachments.reduce((sum, att) => sum + att.size, 0);
            expect(result.totalSize).toBe(expectedSize);
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Attachment type classification', () => {
    it('should correctly identify text-based attachments', () => {
      const textTypes: AttachmentType[] = ['code', 'markdown', 'other'];
      const nonTextTypes: AttachmentType[] = ['image', 'pdf'];

      for (const type of textTypes) {
        expect(isTextBasedAttachment(type)).toBe(true);
      }

      for (const type of nonTextTypes) {
        expect(isTextBasedAttachment(type)).toBe(false);
      }
    });

    it('should correctly identify image attachments', () => {
      expect(isImageAttachment('image')).toBe(true);
      expect(isImageAttachment('pdf')).toBe(false);
      expect(isImageAttachment('code')).toBe(false);
      expect(isImageAttachment('markdown')).toBe(false);
      expect(isImageAttachment('other')).toBe(false);
    });

    it('should correctly identify document attachments', () => {
      expect(isDocumentAttachment('pdf')).toBe(true);
      expect(isDocumentAttachment('image')).toBe(false);
      expect(isDocumentAttachment('code')).toBe(false);
      expect(isDocumentAttachment('markdown')).toBe(false);
      expect(isDocumentAttachment('other')).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate attachments have required content', () => {
      fc.assert(
        fc.property(
          fc.array(textAttachmentArb, { minLength: 1, maxLength: 3 }),
          (attachments) => {
            const validation = validateAttachmentsForContext(attachments);
            
            // All text attachments have content, so should be valid
            expect(validation.valid).toBe(true);
            expect(validation.missingContent).toEqual([]);
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should detect missing content in text attachments', () => {
      const attachmentWithoutContent: Attachment = {
        id: 'test-id',
        name: 'test.ts',
        type: 'code',
        size: 100,
        url: 'https://example.com/test.ts',
        storagePath: 'attachments/test.ts',
        createdAt: new Date(),
        // content is undefined
      };

      const validation = validateAttachmentsForContext([attachmentWithoutContent]);
      
      expect(validation.valid).toBe(false);
      expect(validation.missingContent).toContain('test.ts');
    });
  });

  describe('Summary generation', () => {
    it('should generate accurate summary', () => {
      fc.assert(
        fc.property(
          fc.array(attachmentArb, { minLength: 1, maxLength: 5 }),
          (attachments) => {
            const summary = summarizeAttachments(attachments);
            
            // Should contain count
            expect(summary).toContain(`${attachments.length} attachment`);
            
            // Should contain size in MB
            expect(summary).toContain('MB');
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle empty attachments', () => {
      const summary = summarizeAttachments([]);
      expect(summary).toBe('No attachments');
    });
  });

  describe('Vision model detection', () => {
    it('should detect when vision model is required', () => {
      // String content doesn't require vision
      expect(requiresVisionModel('Hello world')).toBe(false);
      
      // Content parts with only text don't require vision
      const textOnlyParts: MessageContentPart[] = [
        { type: 'text', text: 'Hello world' }
      ];
      expect(requiresVisionModel(textOnlyParts)).toBe(false);
      
      // Content parts with images require vision
      const withImageParts: MessageContentPart[] = [
        { type: 'text', text: 'Hello world' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ];
      expect(requiresVisionModel(withImageParts)).toBe(true);
    });
  });
});
