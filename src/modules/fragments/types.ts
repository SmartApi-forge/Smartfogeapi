import { z } from "zod";

// Base fragment schema
export const FragmentSchema = z.object({
  id: z.string().uuid(),
  message_id: z.string().uuid(),
  content: z.string(),
  fragment_type: z.string().optional(),
  order_index: z.number(),
  metadata: z.record(z.string(), z.any()).optional(),
  sandbox_url: z.string().url().optional(),
  title: z.string().optional(),
  files: z.record(z.string(), z.any()).optional(),
  project_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Input schemas for TRPC procedures
export const CreateFragmentSchema = z.object({
  message_id: z.string().uuid(),
  content: z.string(),
  fragment_type: z.string().optional(),
  order_index: z.number(),
  metadata: z.record(z.string(), z.any()).optional(),
  sandbox_url: z.string().url(),
  title: z.string(),
  files: z.record(z.string(), z.any()),
  project_id: z.string().uuid().optional(),
});

export const UpdateFragmentSchema = z.object({
  id: z.string().uuid(),
  message_id: z.string().uuid().optional(),
  content: z.string().optional(),
  fragment_type: z.string().optional(),
  order_index: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  sandbox_url: z.string().url().optional(),
  title: z.string().optional(),
  files: z.record(z.string(), z.any()).optional(),
  project_id: z.string().uuid().optional(),
});

export const GetFragmentSchema = z.object({
  id: z.string().uuid(),
});

export const GetFragmentsByMessageSchema = z.object({
  message_id: z.string().uuid(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const GetFragmentsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  message_id: z.string().uuid().optional(),
});

// File-related schemas
export const FileContentSchema = z.object({
  name: z.string(),
  content: z.string(),
  type: z.string().optional(),
  path: z.string().optional(),
});

export const UpdateFragmentFilesSchema = z.object({
  id: z.string().uuid(),
  files: z.record(z.string(), z.any()),
});

// TypeScript types
export type Fragment = z.infer<typeof FragmentSchema>;
export type CreateFragmentInput = z.infer<typeof CreateFragmentSchema>;
export type UpdateFragmentInput = z.infer<typeof UpdateFragmentSchema>;
export type GetFragmentInput = z.infer<typeof GetFragmentSchema>;
export type GetFragmentsByMessageInput = z.infer<
  typeof GetFragmentsByMessageSchema
>;
export type GetFragmentsInput = z.infer<typeof GetFragmentsSchema>;
export type FileContent = z.infer<typeof FileContentSchema>;
export type UpdateFragmentFilesInput = z.infer<
  typeof UpdateFragmentFilesSchema
>;
