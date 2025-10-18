import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "../../lib/trpc";
import { TRPCError } from "@trpc/server";

// Input schemas
const generateApiSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  framework: z.enum(["fastapi", "express"]).default("fastapi"),
  advanced: z.boolean().default(false),
  name: z.string().optional(),
});

const projectSchema = z.object({
  id: z.string().uuid(),
});

export const apiRouter = createTRPCRouter({
  // Generate a new API from prompt
  generate: protectedProcedure
    .input(generateApiSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, supabase } = ctx;

      try {
        // Create a new project record (without storing prompt here)
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .insert({
            user_id: user.id,
            name: input.name || `API from "${input.prompt.slice(0, 30)}..."`,
            framework: input.framework,
            advanced: input.advanced,
            status: "generating",
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (projectError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create project",
            cause: projectError,
          });
        }

        // Store user prompt in messages table
        const { data: message, error: messageError } = await supabase
          .from("messages")
          .insert({
            content: input.prompt,
            role: "user",
            type: "text",
            project_id: project.id,
            sender_id: user.id,
          })
          .select()
          .single();

        if (messageError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to store user message",
            cause: messageError,
          });
        }

        // Create a job record for tracking
        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .insert({
            project_id: project.id,
            user_id: user.id,
            type: "generate_api",
            status: "pending",
            payload: {
              prompt: input.prompt,
              framework: input.framework,
              advanced: input.advanced,
            },
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (jobError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create job",
            cause: jobError,
          });
        }

        // TODO: Trigger Inngest workflow here
        // await inngest.send({ name: 'api/generate', data: { jobId: job.id } });

        return {
          projectId: project.id,
          jobId: job.id,
          status: "started",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate API",
          cause: error,
        });
      }
    }),

  // Get project details
  getProject: protectedProcedure
    .input(projectSchema)
    .query(async ({ ctx, input }) => {
      const { user, supabase } = ctx;

      const { data: project, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", input.id)
        .eq("user_id", user.id)
        .single();

      if (error || !project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      return project;
    }),

  // List user's projects
  listProjects: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user, supabase } = ctx;

      const { data: projects, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch projects",
          cause: error,
        });
      }

      return projects || [];
    }),

  // Get job status
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { user, supabase } = ctx;

      const { data: job, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", input.jobId)
        .eq("user_id", user.id)
        .single();

      if (error || !job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found",
        });
      }

      return job;
    }),

  // Delete project
  deleteProject: protectedProcedure
    .input(projectSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, supabase } = ctx;

      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", input.id)
        .eq("user_id", user.id);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete project",
          cause: error,
        });
      }

      return { success: true };
    }),
});
