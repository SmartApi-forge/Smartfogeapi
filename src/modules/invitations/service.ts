import { TRPCError } from '@trpc/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendInvitationEmail, sendInvitationEmailFallback } from '@/lib/email';
import type {
  CreateInviteLinkInput,
  SendEmailInviteInput,
  GetProjectInvitationsInput,
  GetInvitationByTokenInput,
  AcceptInvitationInput,
  DeclineInvitationInput,
  DeleteInvitationInput,
  GetProjectCollaboratorsInput,
} from './types';

// Environment validation
function validateEnvironmentVariables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  return { supabaseUrl, serviceRoleKey }
}

const { supabaseUrl, serviceRoleKey } = validateEnvironmentVariables()
const supabase = createClient(supabaseUrl, serviceRoleKey)

export class InvitationService {
  /**
   * Generate a random token for invite link
   */
  private static generateToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Create an invite link for a project
   */
  static async createInviteLink(input: CreateInviteLinkInput, userId: string) {

    // Verify user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', input.projectId)
      .single();

    if (projectError || !project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }

    if (project.user_id !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to create invites for this project',
      });
    }

    // Generate unique token
    const token = this.generateToken();
    
    // Calculate expiration if provided
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Create invitation
    console.log('[InvitationService] Creating invitation with token:', token);
    const { data: invitation, error } = await supabase
      .from('project_invitations')
      .insert({
        project_id: input.projectId,
        created_by: userId,
        token,
        access_level: input.accessLevel,
        expires_at: expiresAt,
        status: 'pending',
      })
      .select()
      .single();
    
    console.log('[InvitationService] Invitation created:', invitation?.id, 'Token:', invitation?.token);

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create invite link',
        cause: error,
      });
    }

    return invitation;
  }

  /**
   * Send email invitation with actual email delivery
   */
  static async sendEmailInvite(input: SendEmailInviteInput, userId: string) {

    // Verify user owns the project and get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, name')
      .eq('id', input.projectId)
      .single();

    if (projectError || !project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }

    if (project.user_id !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the project owner can send invitations',
      });
    }

    // Get inviter's profile and email
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select(`
        full_name,
        id
      `)
      .eq('id', userId)
      .single();

    // Get email from auth.users
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    
    // Use full_name if available and not empty, otherwise extract name from email
    let inviterName = inviterProfile?.full_name;
    if (!inviterName || inviterName.trim() === '') {
      const email = authUser?.user?.email || '';
      // Extract name from email (before @) and capitalize it
      inviterName = email.split('@')[0]
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'A collaborator';
    }

    // Generate unique token
    const token = this.generateToken();

    // Create invitation with email
    const { data: invitation, error } = await supabase
      .from('project_invitations')
      .insert({
        project_id: input.projectId,
        created_by: userId,
        token,
        email: input.email,
        access_level: input.accessLevel,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create invitation',
        cause: error,
      });
    }

    // Send email using Gmail SMTP or fallback
    let emailSent = false;
    let emailError: string | undefined;
    
    try {
      // Check if Gmail SMTP is configured
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        await sendInvitationEmail({
          to: input.email,
          projectName: project.name,
          inviterName,
          inviteToken: token,
          accessLevel: input.accessLevel,
          projectId: input.projectId,
        });
        console.log(`✅ Email sent to ${input.email} via Gmail SMTP`);
        emailSent = true;
      } else {
        // Development mode - just log
        console.log('⚠️  Gmail SMTP not configured - email not sent');
        await sendInvitationEmailFallback({
          to: input.email,
          projectName: project.name,
          inviterName,
          inviteToken: token,
        });
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      emailError = error instanceof Error ? error.message : 'Unknown error';
      // Don't fail the invitation if email fails - just log it
      // The user can still use the invite link
    }

    return { 
      ...invitation,
      emailSent,
      emailError,
    };
  }

  /**
   * Get all invitations for a project
   */
  static async getProjectInvitations(input: GetProjectInvitationsInput, userId: string) {

    // Verify user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', input.projectId)
      .single();

    if (projectError || !project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }

    if (project.user_id !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view invitations for this project',
      });
    }

    // Get all invitations
    const { data: invitations, error } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('project_id', input.projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch invitations',
        cause: error,
      });
    }

    return invitations || [];
  }

  /**
   * Get invitation details by token
   */
  static async getInvitationByToken(input: GetInvitationByTokenInput) {
    console.log('[InvitationService] Looking up invitation by token:', input.token);
    
    const { data: invitation, error } = await supabase
      .from('project_invitations')
      .select(`
        *,
        projects (
          id,
          name,
          description
        ),
        profiles:created_by (
          full_name
        )
      `)
      .eq('token', input.token)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      console.error('[InvitationService] Database error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch invitation',
        cause: error,
      });
    }
    
    if (!invitation) {
      console.log('[InvitationService] No invitation found for token');
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invitation not found or has expired',
      });
    }
    
    console.log('[InvitationService] Found invitation:', invitation.id);

    // Check if expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from('project_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This invitation has expired',
      });
    }

    return invitation;
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation(input: AcceptInvitationInput, userId: string) {

    // Get invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('token', input.token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invitation not found',
      });
    }

    // Check if expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from('project_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This invitation has expired',
      });
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('project_invitations')
      .update({
        status: 'accepted',
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to accept invitation',
        cause: updateError,
      });
    }

    // Add user as collaborator
    const accessLevel = invitation.access_level === 'business' ? 'edit' : 'view';
    const { error: collaboratorError } = await supabase
      .from('project_collaborators')
      .insert({
        project_id: invitation.project_id,
        user_id: userId,
        access_level: accessLevel,
        added_by: invitation.created_by,
      });

    if (collaboratorError) {
      // If user is already a collaborator, that's okay
      if (!collaboratorError.message.includes('duplicate')) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add collaborator',
          cause: collaboratorError,
        });
      }
    }

    return { success: true, projectId: invitation.project_id };
  }

  /**
   * Decline an invitation
   */
  static async declineInvitation(input: DeclineInvitationInput, userId: string) {

    const { error } = await supabase
      .from('project_invitations')
      .update({
        status: 'declined',
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq('token', input.token)
      .eq('status', 'pending');

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to decline invitation',
        cause: error,
      });
    }

    return { success: true };
  }

  /**
   * Get project collaborators
   */
  static async getProjectCollaborators(input: GetProjectCollaboratorsInput, userId: string) {
    // Verify user has access to the project (owner or collaborator)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', input.projectId)
      .single();

    if (projectError || !project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }

    const isOwner = project.user_id === userId;
    
    if (!isOwner) {
      // Check if user is a collaborator
      const { data: collaborator } = await supabase
        .from('project_collaborators')
        .select('id')
        .eq('project_id', input.projectId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!collaborator) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view collaborators for this project',
        });
      }
    }

    // Get all collaborators with their profile info
    const { data: collaborators, error } = await supabase
      .from('project_collaborators')
      .select(`
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('project_id', input.projectId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch collaborators',
        cause: error,
      });
    }

    // Get project owner info
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', project.user_id)
      .single();

    // Get owner's email from auth
    const { data: ownerAuth } = await supabase.auth.admin.getUserById(project.user_id);

    return {
      owner: {
        id: project.user_id,
        full_name: ownerProfile?.full_name || 'Owner',
        email: ownerAuth?.user?.email || '',
        avatar_url: ownerProfile?.avatar_url,
        role: 'owner' as const,
      },
      collaborators: collaborators || [],
    };
  }

  /**
   * Delete an invitation
   */
  static async deleteInvitation(input: DeleteInvitationInput, userId: string) {

    // Verify user owns the project
    const { data: invitation, error: inviteError } = await supabase
      .from('project_invitations')
      .select(`
        *,
        projects (
          user_id
        )
      `)
      .eq('id', input.invitationId)
      .single();

    if (inviteError || !invitation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invitation not found',
      });
    }

    if (invitation.projects.user_id !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete this invitation',
      });
    }

    // Delete invitation
    const { error } = await supabase
      .from('project_invitations')
      .delete()
      .eq('id', input.invitationId);

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete invitation',
        cause: error,
      });
    }

    return { success: true };
  }
}
