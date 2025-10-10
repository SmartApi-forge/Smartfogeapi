import { z } from 'zod'

// Base project schema
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  framework: z.enum(['fastapi', 'express']),
  status: z.enum(['generating', 'testing', 'deploying', 'deployed', 'failed']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deploy_url: z.string().url().optional(),
  swagger_url: z.string().url().optional(),
  openapi_spec: z.record(z.string(), z.any()).optional(),
  code_url: z.string().url().optional(),
  prompt: z.string().optional(),
  advanced: z.boolean().default(false),
})

// Input schemas for TRPC procedures
export const GetProjectSchema = z.object({
  id: z.string().uuid(),
})

export const GetProjectsSchema = z.object({
  limit: z.number().min(1).max(100).default(20).optional(),
  offset: z.number().min(0).default(0).optional(),
})

// TypeScript types
export type Project = z.infer<typeof ProjectSchema>
export type GetProjectInput = z.infer<typeof GetProjectSchema>
export type GetProjectsInput = z.infer<typeof GetProjectsSchema>