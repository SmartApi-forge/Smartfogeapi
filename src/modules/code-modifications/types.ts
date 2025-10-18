import { z } from "zod";

// Enums
export const ModificationTypeSchema = z.enum(["edit", "create", "delete"]);

// Code modification schema
export const CodeModificationSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  message_id: z.string().uuid(),
  file_path: z.string(),
  old_content: z.string().nullable(),
  new_content: z.string(),
  line_start: z.number().int().nullable(),
  line_end: z.number().int().nullable(),
  modification_type: ModificationTypeSchema,
  reason: z.string().nullable(),
  applied: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Input schemas
export const CreateCodeModificationSchema = z.object({
  project_id: z.string().uuid(),
  message_id: z.string().uuid(),
  file_path: z.string().min(1, "File path is required"),
  old_content: z.string().optional(),
  new_content: z.string().min(1, "New content is required"),
  line_start: z.number().int().optional(),
  line_end: z.number().int().optional(),
  modification_type: ModificationTypeSchema,
  reason: z.string().optional(),
});

export const UpdateCodeModificationSchema = z.object({
  id: z.string().uuid(),
  applied: z.boolean().optional(),
  new_content: z.string().optional(),
});

export const GetCodeModificationSchema = z.object({
  id: z.string().uuid(),
});

export const GetCodeModificationsByProjectSchema = z.object({
  project_id: z.string().uuid(),
  applied: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50).optional(),
});

export const ApplyCodeModificationSchema = z.object({
  id: z.string().uuid(),
});

export const RejectCodeModificationSchema = z.object({
  id: z.string().uuid(),
});

// Bulk operations
export const ApplyMultipleModificationsSchema = z.object({
  modification_ids: z.array(z.string().uuid()).min(1),
});

// AI request/response schemas
export const CodeEditRequestSchema = z.object({
  project_id: z.string().uuid(),
  message_id: z.string().uuid(),
  user_request: z.string().min(1),
  conversation_history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export const FileChangeSchema = z.object({
  lineStart: z.number().int(),
  lineEnd: z.number().int(),
  oldContent: z.string(),
  newContent: z.string(),
  reason: z.string(),
});

export const FileModificationSchema = z.object({
  file: z.string(),
  changes: z.array(FileChangeSchema),
});

export const AICodeEditResponseSchema = z.object({
  modifications: z.array(FileModificationSchema),
  summary: z.string(),
});

// TypeScript types
export type ModificationType = z.infer<typeof ModificationTypeSchema>;
export type CodeModification = z.infer<typeof CodeModificationSchema>;
export type CreateCodeModification = z.infer<
  typeof CreateCodeModificationSchema
>;
export type UpdateCodeModification = z.infer<
  typeof UpdateCodeModificationSchema
>;
export type GetCodeModification = z.infer<typeof GetCodeModificationSchema>;
export type GetCodeModificationsByProject = z.infer<
  typeof GetCodeModificationsByProjectSchema
>;
export type ApplyCodeModification = z.infer<typeof ApplyCodeModificationSchema>;
export type RejectCodeModification = z.infer<
  typeof RejectCodeModificationSchema
>;
export type ApplyMultipleModifications = z.infer<
  typeof ApplyMultipleModificationsSchema
>;

export type CodeEditRequest = z.infer<typeof CodeEditRequestSchema>;
export type FileChange = z.infer<typeof FileChangeSchema>;
export type FileModification = z.infer<typeof FileModificationSchema>;
export type AICodeEditResponse = z.infer<typeof AICodeEditResponseSchema>;
