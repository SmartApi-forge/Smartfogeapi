import { createTRPCRouter, protectedProcedure } from '../../trpc/init'
import { TRPCError } from '@trpc/server'
import { ProjectService } from './service'
import {
  GetProjectSchema,
  GetProjectsSchema,
} from './types'

export const projectsRouter = createTRPCRouter({
  /**
   * Get a project by ID
   * Uses findUnique pattern and returns NOT_FOUND error if project doesn't exist
   */
  getOne: protectedProcedure
    .input(GetProjectSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await ProjectService.getOne(input, ctx.user.id)
      } catch (error) {
        // Re-throw TRPCError if it's already a TRPCError
        if (error instanceof TRPCError) {
          throw error
        }
        
        // Otherwise wrap in TRPCError
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch project',
          cause: error
        })
      }
    }),

  /**
   * Get many projects with pagination
   */
  getMany: protectedProcedure
    .input(GetProjectsSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await ProjectService.getMany(input, ctx.user.id)
      } catch (error) {
        // Re-throw TRPCError if it's already a TRPCError
        if (error instanceof TRPCError) {
          throw error
        }
        
        // Otherwise wrap in TRPCError
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch projects',
          cause: error
        })
      }
    }),
})