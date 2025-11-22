import { z } from 'zod'

export const EventTypeSchema = z.enum([
  'file:generating',
  'file:complete',
  'validation:start',
  'validation:complete',
  'step:start',
  'complete',
  'error'
])

export const IconTypeSchema = z.enum([
  'generating',
  'complete',
  'processing',
  'error'
])

export const CreateGenerationEventSchema = z.object({
  project_id: z.string().uuid(),
  event_type: EventTypeSchema,
  filename: z.string().optional(),
  message: z.string(),
  icon: IconTypeSchema,
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
})

export const GetGenerationEventsSchema = z.object({
  projectId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(50).optional(),
})

export type CreateGenerationEventInput = z.infer<typeof CreateGenerationEventSchema>
export type GetGenerationEventsInput = z.infer<typeof GetGenerationEventsSchema>

