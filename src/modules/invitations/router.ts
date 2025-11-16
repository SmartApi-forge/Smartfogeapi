import { createTRPCRouter, protectedProcedure, baseProcedure } from '../../trpc/init';
import { TRPCError } from '@trpc/server';
import { InvitationService } from './service';
import {
  CreateInviteLinkSchema,
  SendEmailInviteSchema,
  GetProjectInvitationsSchema,
  GetInvitationByTokenSchema,
  AcceptInvitationSchema,
  DeclineInvitationSchema,
  DeleteInvitationSchema,
} from './types';

export const invitationsRouter = createTRPCRouter({
  /**
   * Create an invite link for a project
   */
  createInviteLink: protectedProcedure
    .input(CreateInviteLinkSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await InvitationService.createInviteLink(input, ctx.user.id);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create invite link',
          cause: error,
        });
      }
    }),

  /**
   * Send email invitation
   */
  sendEmailInvite: protectedProcedure
    .input(SendEmailInviteSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await InvitationService.sendEmailInvite(input, ctx.user.id);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send email invite',
          cause: error,
        });
      }
    }),

  /**
   * Get all invitations for a project
   */
  getProjectInvitations: protectedProcedure
    .input(GetProjectInvitationsSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await InvitationService.getProjectInvitations(input, ctx.user.id);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch invitations',
          cause: error,
        });
      }
    }),

  /**
   * Get invitation details by token (public - for invitation page)
   */
  getInvitationByToken: baseProcedure
    .input(GetInvitationByTokenSchema)
    .query(async ({ input }) => {
      try {
        return await InvitationService.getInvitationByToken(input);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch invitation',
          cause: error,
        });
      }
    }),

  /**
   * Accept an invitation
   */
  acceptInvitation: protectedProcedure
    .input(AcceptInvitationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await InvitationService.acceptInvitation(input, ctx.user.id);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to accept invitation',
          cause: error,
        });
      }
    }),

  /**
   * Decline an invitation
   */
  declineInvitation: protectedProcedure
    .input(DeclineInvitationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await InvitationService.declineInvitation(input, ctx.user.id);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to decline invitation',
          cause: error,
        });
      }
    }),

  /**
   * Delete an invitation
   */
  deleteInvitation: protectedProcedure
    .input(DeleteInvitationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await InvitationService.deleteInvitation(input, ctx.user.id);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete invitation',
          cause: error,
        });
      }
    }),
});
