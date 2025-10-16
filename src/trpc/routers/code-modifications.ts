import { z } from 'zod'
import { createTRPCRouter, baseProcedure, protectedProcedure } from '../init'
import { TRPCError } from '@trpc/server'
import { CodeModificationService } from '../../modules/code-modifications/service'
import {
  CreateCodeModificationSchema,
  UpdateCodeModificationSchema,
  GetCodeModificationSchema,
  GetCodeModificationsByProjectSchema,
  ApplyCodeModificationSchema,
  RejectCodeModificationSchema,
  ApplyMultipleModificationsSchema,
} from '../../modules/code-modifications/types'

export const codeModificationsRouter = createTRPCRouter({
  /**
   * Create a new code modification
   */
  create: protectedProcedure
    .input(CreateCodeModificationSchema)
    .mutation(async ({ input }) => {
      try {
        return await CodeModificationService.create(input)
      } catch (error) {
        console.error('Error in create procedure:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create code modification',
          cause: error
        })
      }
    }),

  /**
   * Get code modification by ID
   */
  getById: baseProcedure
    .input(GetCodeModificationSchema)
    .query(async ({ input }) => {
      try {
        const modification = await CodeModificationService.getById(input.id)
        if (!modification) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Code modification not found'
          })
        }
        return modification
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error in getById procedure:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch code modification',
          cause: error
        })
      }
    }),

  /**
   * Get code modifications by project
   */
  getByProject: baseProcedure
    .input(GetCodeModificationsByProjectSchema)
    .query(async ({ input }) => {
      try {
        return await CodeModificationService.getByProject(input)
      } catch (error) {
        console.error('Error in getByProject procedure:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch code modifications',
          cause: error
        })
      }
    }),

  /**
   * Get code modifications by message ID
   */
  getByMessage: baseProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        return await CodeModificationService.getByMessage(input.messageId)
      } catch (error) {
        console.error('Error in getByMessage procedure:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch code modifications',
          cause: error
        })
      }
    }),

  /**
   * Update a code modification
   */
  update: protectedProcedure
    .input(UpdateCodeModificationSchema)
    .mutation(async ({ input }) => {
      try {
        return await CodeModificationService.update(input)
      } catch (error) {
        console.error('Error in update procedure:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update code modification',
          cause: error
        })
      }
    }),

  /**
   * Apply a code modification (marks as applied and updates api_fragments)
   */
  apply: protectedProcedure
    .input(ApplyCodeModificationSchema)
    .mutation(async ({ input }) => {
      try {
        return await CodeModificationService.apply(input.id)
      } catch (error) {
        console.error('Error in apply procedure:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to apply code modification',
          cause: error
        })
      }
    }),

  /**
   * Apply multiple code modifications
   */
  applyMultiple: protectedProcedure
    .input(ApplyMultipleModificationsSchema)
    .mutation(async ({ input }) => {
      try {
        return await CodeModificationService.applyMultiple(input)
      } catch (error) {
        console.error('Error in applyMultiple procedure:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to apply code modifications',
          cause: error
        })
      }
    }),

  /**
   * Reject (delete) a code modification
   */
  reject: protectedProcedure
    .input(RejectCodeModificationSchema)
    .mutation(async ({ input }) => {
      try {
        await CodeModificationService.delete(input.id)
        return { success: true }
      } catch (error) {
        console.error('Error in reject procedure:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reject code modification',
          cause: error
        })
      }
    }),

  /**
   * Get unapplied modifications count for a project
   */
  getUnappliedCount: baseProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        return await CodeModificationService.getUnappliedCount(input.projectId)
      } catch (error) {
        console.error('Error in getUnappliedCount procedure:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get unapplied count',
          cause: error
        })
      }
    }),
})


