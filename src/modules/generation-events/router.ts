import { z } from 'zod'
import { createTRPCRouter, baseProcedure, protectedProcedure } from '../../trpc/init'
import { TRPCError } from '@trpc/server'
import { GenerationEventService } from './service'
import {
  CreateGenerationEventSchema,
  GetGenerationEventsSchema,
} from './types'

export const generationEventsRouter = createTRPCRouter({
  /**
   * Create a new generation event
   */
  create: baseProcedure
    .input(CreateGenerationEventSchema)
    .mutation(async ({ input }) => {
      try {
        return await GenerationEventService.create(input)
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create generation event',
          cause: error
        })
      }
    }),

  /**
   * Get all generation events for a project
   */
  getMany: baseProcedure
    .input(GetGenerationEventsSchema)
    .query(async ({ input }) => {
      try {
        return await GenerationEventService.getMany(input)
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch generation events',
          cause: error
        })
      }
    }),

  /**
   * Delete all generation events for a project
   */
  deleteByProject: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await GenerationEventService.deleteByProject(input.projectId)
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete generation events',
          cause: error
        })
      }
    }),
})

