/**
 * Attachment Context Integration Service
 * 
 * Integrates attachments into AI context for prompt generation.
 * Handles image attachments with vision API and text-based attachments as context.
 * 
 * Requirements: 5.8
 * - Include attachment content in prompt context
 * - Handle image attachments with vision API
 * - Handle text-based attachments as context
 */

import type { Attachment, AttachmentType } from '../types/chat-ux';
import type OpenAI from 'openai';

/**
 * Result of processing attachments for AI context
 */
export interface AttachmentContextResult {
  /** Text content to include in the prompt */
  textContent: string;
  /** Image URLs for vision API (base64 data URLs or remote URLs) */
  imageUrls: string[];
  /** Whether vision API should be used */
  requiresVision: boolean;
  /** Number of attachments processed */
  attachmentCount: number;
  /** Total size of processed attachments in bytes */
  totalSize: number;
}

/**
 * OpenAI message content part types for vision API
 */
export type MessageContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

/**
 * Checks if an attachment type is text-based
 */
export function isTextBasedAttachment(type: AttachmentType): boolean {
  return type === 'code' || type === 'markdown' || type === 'other';
}

/**
 * Checks if an attachment type is an image
 */
export function isImageAttachment(type: AttachmentType): boolean {
  return type === 'image';
}

/**
 * Checks if an attachment type is a document (PDF)
 */
export function isDocumentAttachment(type: AttachmentType): boolean {
  return type === 'pdf';
}

/**
 * Formats text-based attachment content for inclusion in prompt
 */
export function formatTextAttachmentContent(attachment: Attachment): string {
  if (!attachment.content) {
    return `[Attachment: ${attachment.name} - content not available]`;
  }

  const header = `--- Attached File: ${attachment.name} ---`;
  const footer = `--- End of ${attachment.name} ---`;
  
  return `${header}\n${attachment.content}\n${footer}`;
}

/**
 * Formats document attachment (PDF) for inclusion in prompt
 * Note: PDFs require text extraction which should be done during upload
 */
export function formatDocumentAttachmentContent(attachment: Attachment): string {
  if (!attachment.content) {
    return `[PDF Attachment: ${attachment.name} - text extraction required]`;
  }

  const header = `--- PDF Document: ${attachment.name} ---`;
  const footer = `--- End of ${attachment.name} ---`;
  
  return `${header}\n${attachment.content}\n${footer}`;
}

/**
 * Builds the text context from all text-based attachments
 */
export function buildTextAttachmentContext(attachments: Attachment[]): string {
  const textAttachments = attachments.filter(
    att => isTextBasedAttachment(att.type) || isDocumentAttachment(att.type)
  );

  if (textAttachments.length === 0) {
    return '';
  }

  const formattedContents = textAttachments.map(att => {
    if (isDocumentAttachment(att.type)) {
      return formatDocumentAttachmentContent(att);
    }
    return formatTextAttachmentContent(att);
  });

  return `\n\n=== ATTACHED FILES ===\n${formattedContents.join('\n\n')}\n=== END ATTACHED FILES ===\n`;
}

/**
 * Extracts image URLs from attachments for vision API
 */
export function extractImageUrls(attachments: Attachment[]): string[] {
  return attachments
    .filter(att => isImageAttachment(att.type))
    .map(att => att.url);
}

/**
 * Processes attachments and returns context for AI prompt
 * 
 * Requirements: 5.8
 * - Include attachment content in prompt context
 * - Handle image attachments with vision API
 * - Handle text-based attachments as context
 */
export function processAttachmentsForContext(
  attachments: Attachment[]
): AttachmentContextResult {
  if (!attachments || attachments.length === 0) {
    return {
      textContent: '',
      imageUrls: [],
      requiresVision: false,
      attachmentCount: 0,
      totalSize: 0,
    };
  }

  const textContent = buildTextAttachmentContext(attachments);
  const imageUrls = extractImageUrls(attachments);
  const totalSize = attachments.reduce((sum, att) => sum + att.size, 0);

  return {
    textContent,
    imageUrls,
    requiresVision: imageUrls.length > 0,
    attachmentCount: attachments.length,
    totalSize,
  };
}

/**
 * Builds OpenAI message content parts for a prompt with attachments
 * 
 * This creates the proper format for OpenAI's vision API when images are present,
 * or a simple text format when only text attachments are present.
 * 
 * Requirements: 5.8
 * - Handle image attachments with vision API
 */
export function buildMessageContentWithAttachments(
  prompt: string,
  attachments: Attachment[]
): string | MessageContentPart[] {
  const contextResult = processAttachmentsForContext(attachments);

  // If no attachments, return simple string
  if (contextResult.attachmentCount === 0) {
    return prompt;
  }

  // If no images, return text with attachment context
  if (!contextResult.requiresVision) {
    return `${prompt}${contextResult.textContent}`;
  }

  // Build content parts for vision API
  const contentParts: MessageContentPart[] = [];

  // Add text content first (prompt + text attachments)
  const textWithContext = contextResult.textContent
    ? `${prompt}${contextResult.textContent}`
    : prompt;
  
  contentParts.push({
    type: 'text',
    text: textWithContext,
  });

  // Add image URLs
  for (const imageUrl of contextResult.imageUrls) {
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: imageUrl,
        detail: 'auto', // Let OpenAI decide the detail level
      },
    });
  }

  return contentParts;
}

/**
 * Checks if the message content requires vision model
 */
export function requiresVisionModel(content: string | MessageContentPart[]): boolean {
  if (typeof content === 'string') {
    return false;
  }
  return content.some(part => part.type === 'image_url');
}

/**
 * Gets the appropriate model for the content
 * Returns vision-capable model if images are present
 */
export function getModelForContent(
  content: string | MessageContentPart[],
  defaultModel: string = 'gpt-4o'
): string {
  // gpt-4o supports vision, so we can use it for both
  // If a non-vision model is specified and vision is required, upgrade to gpt-4o
  if (requiresVisionModel(content)) {
    return 'gpt-4o'; // Vision-capable model
  }
  return defaultModel;
}

/**
 * Validates that attachments have content where required
 */
export function validateAttachmentsForContext(
  attachments: Attachment[]
): { valid: boolean; missingContent: string[] } {
  const missingContent: string[] = [];

  for (const attachment of attachments) {
    // Text-based attachments should have content
    if (isTextBasedAttachment(attachment.type) && !attachment.content) {
      missingContent.push(attachment.name);
    }
    // Images should have URL
    if (isImageAttachment(attachment.type) && !attachment.url) {
      missingContent.push(attachment.name);
    }
  }

  return {
    valid: missingContent.length === 0,
    missingContent,
  };
}

/**
 * Creates a summary of attachments for logging/debugging
 */
export function summarizeAttachments(attachments: Attachment[]): string {
  if (!attachments || attachments.length === 0) {
    return 'No attachments';
  }

  const byType: Record<string, number> = {};
  let totalSize = 0;

  for (const att of attachments) {
    byType[att.type] = (byType[att.type] || 0) + 1;
    totalSize += att.size;
  }

  const typeSummary = Object.entries(byType)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');

  const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

  return `${attachments.length} attachment(s): ${typeSummary} (${sizeMB}MB total)`;
}
