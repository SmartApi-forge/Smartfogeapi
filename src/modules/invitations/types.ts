import { z } from 'zod';

// Input schemas
export const CreateInviteLinkSchema = z.object({
  projectId: z.string().uuid(),
  accessLevel: z.enum(['public', 'workspace', 'personal', 'business']).default('public'),
  expiresInDays: z.number().optional(), // Optional expiration in days
});

export const SendEmailInviteSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().email(),
  accessLevel: z.enum(['public', 'workspace', 'personal', 'business']).default('public'),
});

export const GetProjectInvitationsSchema = z.object({
  projectId: z.string().uuid(),
});

export const GetInvitationByTokenSchema = z.object({
  token: z.string(),
});

export const AcceptInvitationSchema = z.object({
  token: z.string(),
});

export const DeclineInvitationSchema = z.object({
  token: z.string(),
});

export const DeleteInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

export const GetProjectCollaboratorsSchema = z.object({
  projectId: z.string().uuid(),
});

// Type exports
export type CreateInviteLinkInput = z.infer<typeof CreateInviteLinkSchema>;
export type SendEmailInviteInput = z.infer<typeof SendEmailInviteSchema>;
export type GetProjectInvitationsInput = z.infer<typeof GetProjectInvitationsSchema>;
export type GetInvitationByTokenInput = z.infer<typeof GetInvitationByTokenSchema>;
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
export type DeclineInvitationInput = z.infer<typeof DeclineInvitationSchema>;
export type DeleteInvitationInput = z.infer<typeof DeleteInvitationSchema>;
export type GetProjectCollaboratorsInput = z.infer<typeof GetProjectCollaboratorsSchema>;
