import { createTRPCRouter, baseProcedure } from '../../trpc/init';
import { VersionService } from './service';
import {
  createVersionSchema,
  updateVersionSchema,
  getVersionSchema,
  getVersionsSchema,
  getLatestVersionSchema,
} from './types';
import { z } from 'zod';

/**
 * Versions tRPC Router
 * Exposes version management endpoints
 */
export const versionsRouter = createTRPCRouter({
  /**
   * Create a new version
   */
  create: baseProcedure
    .input(createVersionSchema)
    .mutation(async ({ input }) => {
      return await VersionService.create(input);
    }),

  /**
   * Get a version by ID
   */
  getOne: baseProcedure
    .input(getVersionSchema)
    .query(async ({ input }) => {
      return await VersionService.getById(input);
    }),

  /**
   * Get all versions for a project
   */
  getMany: baseProcedure
    .input(getVersionsSchema)
    .query(async ({ input }) => {
      return await VersionService.getMany(input);
    }),

  /**
   * Get the latest version for a project
   */
  getLatest: baseProcedure
    .input(getLatestVersionSchema)
    .query(async ({ input }) => {
      return await VersionService.getLatest(input);
    }),

  /**
   * Update a version
   */
  update: baseProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        updates: updateVersionSchema,
      })
    )
    .mutation(async ({ input }) => {
      return await VersionService.update(input.id, input.updates);
    }),

  /**
   * Delete a version
   */
  delete: baseProcedure
    .input(getVersionSchema)
    .mutation(async ({ input }) => {
      await VersionService.delete(input);
      return { success: true };
    }),

  /**
   * Compare two versions
   */
  compare: baseProcedure
    .input(
      z.object({
        version1Id: z.string().uuid(),
        version2Id: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      return await VersionService.compare(input.version1Id, input.version2Id);
    }),

  /**
   * Get version count for a project
   */
  getCount: baseProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await VersionService.getCount(input.projectId);
    }),

  /**
   * Get version history chain
   */
  getHistory: baseProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await VersionService.getHistory(input.versionId);
    }),
});

