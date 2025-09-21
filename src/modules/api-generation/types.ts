import { z } from 'zod'

// Input schemas for API generation
export const generateAPISchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  framework: z.enum(['fastapi', 'express']).default('fastapi'),
  advanced: z.boolean().default(false),
  template: z.string().optional(),
})

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  framework: z.enum(['fastapi', 'express']),
  status: z.enum(['generating', 'testing', 'deploying', 'deployed', 'failed']),
  created_at: z.date(),
  updated_at: z.date(),
  deploy_url: z.string().optional(),
  swagger_url: z.string().optional(),
})

export const jobStatusSchema = z.object({
  jobId: z.string(),
})

export const projectIdSchema = z.object({
  id: z.string(),
})

// Type definitions
export type GenerateAPIInput = z.infer<typeof generateAPISchema>
export type ProjectInput = z.infer<typeof projectSchema>
export type JobStatusInput = z.infer<typeof jobStatusSchema>
export type ProjectIdInput = z.infer<typeof projectIdSchema>

export interface Project {
  id: string
  name: string
  description: string
  framework: 'fastapi' | 'express'
  status: 'generating' | 'testing' | 'deploying' | 'deployed' | 'failed'
  created_at: Date
  updated_at: Date
  deploy_url?: string
  swagger_url?: string
  openapi_spec?: any
  code_url?: string
  prompt?: string
  advanced?: boolean
}

export interface Job {
  id: string
  project_id: string
  user_id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  payload: any
  result?: any
  error_message?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface JobStatus {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  currentStep: string
  estimatedTimeRemaining: number
  error_message?: string
  result?: any
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface Template {
  id: string
  name: string
  description: string
  category: string
  framework: 'fastapi' | 'express'
  tags: string[]
  prompt_template: string
  estimatedTime: number
}

export interface GenerateAPIResponse {
  jobId: string
  projectId: string
  status: 'generating'
  message: string
  estimatedTime: number
}

export interface DeleteProjectResponse {
  success: boolean
  message: string
}