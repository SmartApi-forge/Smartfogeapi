import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, baseProcedure } from "../../trpc/init";
import { FragmentService } from "./service";
import {
  CreateFragmentSchema,
  UpdateFragmentSchema,
  GetFragmentSchema,
  GetFragmentsByMessageSchema,
  GetFragmentsSchema,
  UpdateFragmentFilesSchema,
} from "./types";

export const fragmentsRouter = createTRPCRouter({
  /**
   * Create a new fragment
   */
  create: baseProcedure
    .input(CreateFragmentSchema)
    .mutation(async ({ input }) => {
      return await FragmentService.create(input);
    }),

  /**
   * Get a fragment by ID
   */
  getById: baseProcedure.input(GetFragmentSchema).query(async ({ input }) => {
    return await FragmentService.getById(input);
  }),

  /**
   * Get fragments by message ID
   */
  getByMessageId: baseProcedure
    .input(GetFragmentsByMessageSchema)
    .query(async ({ input }) => {
      return await FragmentService.getByMessageId(input);
    }),

  /**
   * Get all fragments with optional filtering
   */
  getAll: baseProcedure.input(GetFragmentsSchema).query(async ({ input }) => {
    return await FragmentService.getAll(input);
  }),

  /**
   * Update a fragment
   */
  update: baseProcedure
    .input(UpdateFragmentSchema)
    .mutation(async ({ input }) => {
      return await FragmentService.update(input);
    }),

  /**
   * Update fragment files
   */
  updateFiles: baseProcedure
    .input(UpdateFragmentFilesSchema)
    .mutation(async ({ input }) => {
      return await FragmentService.updateFiles(input);
    }),

  /**
   * Delete a fragment
   */
  delete: baseProcedure.input(GetFragmentSchema).mutation(async ({ input }) => {
    return await FragmentService.delete(input);
  }),

  /**
   * Get fragment count by message
   */
  getCountByMessage: baseProcedure
    .input(
      z.object({
        message_id: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return await FragmentService.getCountByMessage(input.message_id);
    }),

  /**
   * Get latest fragment by message
   */
  getLatestByMessage: baseProcedure
    .input(
      z.object({
        message_id: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return await FragmentService.getLatestByMessage(input.message_id);
    }),

  /**
   * Check if fragment exists
   */
  exists: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return await FragmentService.exists(input.id);
    }),

  /**
   * Get fragments by message ID with pagination
   */
  getByMessage: baseProcedure
    .input(
      z.object({
        message_id: z.string(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const params = {
        message_id: input.message_id,
        limit: input.limit ?? 10,
        offset: input.offset ?? 0,
      };
      return await FragmentService.getByMessageId(params);
    }),

  /**
   * Bulk create fragments with transaction support and error handling
   */
  bulkCreate: baseProcedure
    .input(z.array(CreateFragmentSchema))
    .mutation(async ({ input }) => {
      try {
        // Use the new bulkCreate service method for atomic transaction
        const fragments = await FragmentService.bulkCreate(input);
        return {
          success: true,
          fragments,
          count: fragments.length,
        };
      } catch (error) {
        console.error("Bulk create failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to bulk create fragments",
        });
      }
    }),

  /**
   * Search fragments by title with database-level filtering and pagination
   */
  searchByTitle: baseProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title search query is required"),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const params = {
          title: input.title,
          limit: input.limit ?? 10,
          offset: input.offset ?? 0,
        };
        // Use database-level search instead of client-side filtering
        return await FragmentService.searchByTitle(params);
      } catch (error) {
        console.error("Search by title failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to search fragments by title",
        });
      }
    }),
});
