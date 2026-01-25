/**
 * Attachment Handler Service
 * 
 * Manages file attachments for chat prompts with validation and storage.
 * 
 * Requirements: 5.1, 5.10
 * - Implement addAttachment with file validation
 * - Implement removeAttachment
 * - Validate size limits (10MB images, 1MB code/docs)
 */

import type {
  Attachment,
  AttachmentType,
  AttachmentValidationResult,
} from '../types/chat-ux';

// Size limits in bytes
export const ATTACHMENT_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB for images
  pdf: 1 * 1024 * 1024,    // 1MB for PDFs
  markdown: 1 * 1024 * 1024, // 1MB for markdown
  code: 1 * 1024 * 1024,   // 1MB for code files
  other: 1 * 1024 * 1024,  // 1MB for other files
} as const;

// MIME type to attachment type mapping
const MIME_TYPE_MAP: Record<string, AttachmentType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'application/pdf': 'pdf',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/plain': 'other',
  'application/json': 'code',
  'text/javascript': 'code',
  'application/javascript': 'code',
  'text/typescript': 'code',
  'text/css': 'code',
  'text/html': 'code',
};

// File extension to attachment type mapping (fallback)
const EXTENSION_TYPE_MAP: Record<string, AttachmentType> = {
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.svg': 'image',
  '.pdf': 'pdf',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.js': 'code',
  '.jsx': 'code',
  '.ts': 'code',
  '.tsx': 'code',
  '.css': 'code',
  '.html': 'code',
  '.json': 'code',
  '.py': 'code',
  '.rb': 'code',
  '.go': 'code',
  '.rs': 'code',
  '.java': 'code',
  '.c': 'code',
  '.cpp': 'code',
  '.h': 'code',
  '.hpp': 'code',
};


/**
 * Determines the attachment type from a file
 */
export function getAttachmentType(file: File): AttachmentType {
  // First try MIME type
  const mimeType = MIME_TYPE_MAP[file.type];
  if (mimeType) {
    return mimeType;
  }

  // Fallback to extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  const extType = EXTENSION_TYPE_MAP[extension];
  if (extType) {
    return extType;
  }

  return 'other';
}

/**
 * Gets the size limit for an attachment type
 */
export function getSizeLimit(type: AttachmentType): number {
  return ATTACHMENT_SIZE_LIMITS[type];
}

/**
 * Validates an attachment file
 * Requirements: 5.10 - Validate size limits (10MB images, 1MB code/docs)
 */
export function validateAttachment(file: File): AttachmentValidationResult {
  const type = getAttachmentType(file);
  const maxSize = getSizeLimit(type);

  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File exceeds size limit of ${maxSizeMB}MB for ${type} files`,
      maxSize,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty',
    };
  }

  return {
    valid: true,
    maxSize,
  };
}

/**
 * Generates a unique ID for attachments
 */
function generateId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates an Attachment object from a File
 */
export function createAttachmentFromFile(
  file: File,
  url: string,
  storagePath: string,
  thumbnailUrl?: string
): Attachment {
  return {
    id: generateId(),
    name: file.name,
    type: getAttachmentType(file),
    size: file.size,
    url,
    storagePath,
    thumbnailUrl,
    createdAt: new Date(),
  };
}

/**
 * AttachmentHandlerService class
 * Manages attachments in memory with validation
 */
export class AttachmentHandlerService {
  private attachments: Map<string, Attachment> = new Map();
  private previewAttachment: Attachment | null = null;
  private isPreviewOpen: boolean = false;

  /**
   * Validates and adds an attachment
   * Requirements: 5.1, 5.10
   */
  async addAttachment(file: File): Promise<Attachment> {
    const validation = validateAttachment(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Create a local URL for preview (in real implementation, this would upload to storage)
    const url = URL.createObjectURL(file);
    const storagePath = `attachments/${generateId()}/${file.name}`;
    
    // For images, the URL can serve as thumbnail; for others, no thumbnail
    const type = getAttachmentType(file);
    const thumbnailUrl = type === 'image' ? url : undefined;

    const attachment = createAttachmentFromFile(file, url, storagePath, thumbnailUrl);
    this.attachments.set(attachment.id, attachment);

    return attachment;
  }

  /**
   * Removes an attachment by ID
   */
  removeAttachment(id: string): void {
    const attachment = this.attachments.get(id);
    if (attachment) {
      // Revoke the object URL to free memory
      if (attachment.url.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.url);
      }
      this.attachments.delete(id);
    }
  }

  /**
   * Opens the preview modal for an attachment
   */
  openPreview(attachment: Attachment): void {
    this.previewAttachment = attachment;
    this.isPreviewOpen = true;
  }

  /**
   * Closes the preview modal
   */
  closePreview(): void {
    this.previewAttachment = null;
    this.isPreviewOpen = false;
  }

  /**
   * Gets all current attachments
   */
  getAttachments(): Attachment[] {
    return Array.from(this.attachments.values());
  }

  /**
   * Gets an attachment by ID
   */
  getAttachment(id: string): Attachment | undefined {
    return this.attachments.get(id);
  }

  /**
   * Gets the current preview state
   */
  getPreviewState(): { isOpen: boolean; attachment: Attachment | null } {
    return {
      isOpen: this.isPreviewOpen,
      attachment: this.previewAttachment,
    };
  }

  /**
   * Validates an attachment without adding it
   */
  validateAttachment(file: File): AttachmentValidationResult {
    return validateAttachment(file);
  }

  /**
   * Clears all attachments
   */
  clearAll(): void {
    for (const attachment of this.attachments.values()) {
      if (attachment.url.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.url);
      }
    }
    this.attachments.clear();
    this.closePreview();
  }

  /**
   * Gets the count of attachments
   */
  getCount(): number {
    return this.attachments.size;
  }
}

/**
 * Factory function to create an AttachmentHandlerService
 */
export function createAttachmentHandler(): AttachmentHandlerService {
  return new AttachmentHandlerService();
}
