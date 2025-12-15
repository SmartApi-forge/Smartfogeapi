/**
 * Attachment Preview Component
 * 
 * Displays attachment thumbnails in the prompt area with remove functionality.
 * 
 * Requirements: 5.2, 5.3, 5.6, 5.12
 * - Display thumbnail with filename in prompt area
 * - Show X mark on hover to remove
 * - Use file explorer icons for non-image files
 * - No purple or blue colors in styling
 */

'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { FileTypeIcon } from './file-type-icon';
import type { Attachment } from '@/src/types/chat-ux';

interface AttachmentPreviewProps {
  attachment: Attachment;
  onRemove: (id: string) => void;
  onClick: (attachment: Attachment) => void;
}

/**
 * Single attachment preview item - compact pill style like v0
 * Requirements: 5.2, 5.3, 5.6, 5.12
 */
export function AttachmentPreview({
  attachment,
  onRemove,
  onClick,
}: AttachmentPreviewProps) {
  const isImage = attachment.type === 'image';

  // Truncate filename for display (keep extension visible)
  const truncateName = (name: string, maxLen: number = 20): string => {
    if (name.length <= maxLen) return name;
    const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : '';
    const baseName = name.slice(0, name.lastIndexOf('.') > 0 ? name.lastIndexOf('.') : name.length);
    const truncatedBase = baseName.slice(0, maxLen - ext.length - 3) + '...';
    return truncatedBase + ext;
  };

  return (
    <div className="relative flex-shrink-0 group">
      <button
        type="button"
        onClick={() => onClick(attachment)}
        className="flex items-center gap-1.5 pl-2 pr-6 py-1 rounded-md border border-[#333] bg-[#1F1F1F] hover:bg-[#2A2A2A] transition-colors cursor-pointer h-7"
        aria-label={`View ${attachment.name}`}
      >
        {/* Thumbnail or Icon - smaller */}
        {isImage && attachment.thumbnailUrl ? (
          <div className="relative w-4 h-4 rounded-sm overflow-hidden flex-shrink-0">
            <Image
              src={attachment.thumbnailUrl}
              alt={attachment.name}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-400">
            <FileTypeIcon filename={attachment.name} size={14} className="[&_path]:fill-gray-400" />
          </div>
        )}

        {/* Filename only - white text */}
        <span className="text-xs text-white truncate max-w-[140px]">
          {truncateName(attachment.name)}
        </span>
      </button>

      {/* Remove button - always visible, positioned inside the pill */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(attachment.id);
        }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-gray-400 hover:text-white"
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

interface AttachmentListProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  onAttachmentClick: (attachment: Attachment) => void;
}

/**
 * Horizontal scrollable list of attachment previews
 * Requirements: 5.11 - Display attachments in horizontal scrollable list
 */
export function AttachmentList({
  attachments,
  onRemove,
  onAttachmentClick,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
      {attachments.map((attachment) => (
        <AttachmentPreview
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
          onClick={onAttachmentClick}
        />
      ))}
    </div>
  );
}
