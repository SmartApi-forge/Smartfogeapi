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
  openapi_spec: z.string().optional(),
  code_url: z.string().optional(),
  prompt: z.string().optional(),
  advanced: z.boolean().optional(),
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
  user_id: string
  name: string
  description: string | null
  prompt: string
  framework: 'fastapi' | 'express' | 'nextjs' | 'react' | 'vue' | 'angular' | 'unknown' | 'flask' | 'django' | 'python'
  advanced: boolean
  status: 'generating' | 'completed' | 'failed' | 'deployed'
  openapi_spec: any
  code_url: string | null
  deploy_url: string | null
  swagger_url: string | null
  created_at: string
  updated_at: string
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
  result?: Record<string, unknown> | unknown[] | null
  created_at: string | Date
  started_at?: string | Date
  completed_at?: string | Date
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