import { createTRPCRouter, protectedProcedure } from '../../trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
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

  /**
   * Update project (for GitHub integration)
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      github_mode: z.boolean().optional(),
      github_repo_id: z.string().optional(),
      repo_url: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, ...updates } = input
        return await ProjectService.update(id, ctx.user.id, updates)
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update project',
          cause: error
        })
      }
    }),
})