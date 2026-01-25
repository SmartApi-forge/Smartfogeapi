/**
 * Attachment Upload API Route
 * 
 * Handles file uploads for chat attachments with validation and storage.
 * 
 * Requirements: 5.9
 * - Handle file upload to storage
 * - Generate thumbnails for images
 * - Return attachment metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  validateAttachment,
  getAttachmentType,
  ATTACHMENT_SIZE_LIMITS,
} from '@/src/services/attachment-handler';
import type { Attachment, AttachmentType } from '@/src/types/chat-ux';

// Generate unique ID for attachments
function generateId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Create Supabase client for server-side operations
async function createSupabaseClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

/**
 * POST /api/attachments
 * Upload a file attachment
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Validate the file
    const validation = validateAttachment(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, maxSize: validation.maxSize },
        { status: 400 }
      );
    }

    const attachmentId = generateId();
    const attachmentType = getAttachmentType(file);
    const fileExtension = file.name.split('.').pop() || '';
    const storagePath = `${projectId}/${attachmentId}.${fileExtension}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('attachments')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // For images, generate thumbnail (using same URL for now - could add image processing)
    let thumbnailUrl: string | undefined;
    if (attachmentType === 'image') {
      // In production, you'd use an image processing service
      // For now, use the same URL with transform parameters if supported
      thumbnailUrl = publicUrl;
    }

    // Create attachment record
    const attachment: Attachment = {
      id: attachmentId,
      name: file.name,
      type: attachmentType,
      size: file.size,
      url: publicUrl,
      storagePath,
      thumbnailUrl,
      createdAt: new Date(),
    };

    return NextResponse.json({
      success: true,
      attachment,
    });
  } catch (error) {
    console.error('Attachment upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attachments
 * Delete an attachment
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const storagePath = searchParams.get('storagePath');

    if (!storagePath) {
      return NextResponse.json(
        { error: 'Storage path is required' },
        { status: 400 }
      );
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from('attachments')
      .remove([storagePath]);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete file' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Attachment delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
