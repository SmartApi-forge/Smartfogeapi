/**
 * Vercel tRPC Router
 * Handles Vercel integration API endpoints
 */

import { z } from 'zod';
import { protectedProcedure, createTRPCRouter } from '../init';
import { TRPCError } from '@trpc/server';
import { vercelDeployService } from '@/src/services/vercel-deploy-service';
import { createClient } from '@supabase/supabase-js';

/**
 * Helper function to create Supabase client with service role key
 */
async function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const vercelRouter = createTRPCRouter({
  /**
   * Check if user has Vercel connected
   */
  getConnectionStatus: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const isConnected = await vercelDeployService.isVercelConnected(ctx.user.id);
        
        if (!isConnected) {
          return {
            connected: false,
          };
        }

        // Get connection details
        const supabase = await getSupabaseClient();
        const { data: connection } = await supabase
          .from('vercel_connections')
          .select('team_id, created_at')
          .eq('user_id', ctx.user.id)
          .single();

        return {
          connected: true,
          teamId: connection?.team_id,
          connectedAt: connection?.created_at,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to check Vercel connection status',
          cause: error,
        });
      }
    }),

  /**
   * Disconnect Vercel integration
   */
  disconnect: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await vercelDeployService.disconnectVercel(ctx.user.id);
        
        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to disconnect Vercel',
          });
        }

        return {
          success: true,
          message: 'Vercel integration disconnected',
        };
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An unexpected error occurred',
          cause: error,
        });
      }
    }),

  /**
   * Deploy project to Vercel
   */
  deployProject: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      files: z.record(z.string()), // filename -> content
      framework: z.enum(['nextjs', 'vite', 'react', 'vue', 'express', 'nuxt']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify project ownership
        const supabase = await getSupabaseClient();
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('id, name')
          .eq('id', input.projectId)
          .eq('user_id', ctx.user.id)
          .single();

        if (projectError || !project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }

        // Convert files to Vercel format
        const vercelFiles = Object.entries(input.files).map(([path, content]) => ({
          file: path,
          data: content,
        }));

        // Deploy to Vercel
        const result = await vercelDeployService.deployToVercel(
          ctx.user.id,
          input.projectId,
          {
            projectName: project.name,
            files: vercelFiles,
            framework: input.framework || 'nextjs',
          }
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Deployment failed',
          });
        }

        return result;
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An unexpected error occurred',
          cause: error,
        });
      }
    }),

  /**
   * Get deployment status
   */
  getDeploymentStatus: protectedProcedure
    .input(z.object({
      deploymentId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const result = await vercelDeployService.getDeploymentStatus(
          ctx.user.id,
          input.deploymentId
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to get deployment status',
          });
        }

        return {
          status: result.status,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An unexpected error occurred',
          cause: error,
        });
      }
    }),

  /**
   * Get user's deployments
   */
  getDeployments: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const result = await vercelDeployService.getUserDeployments(
          ctx.user.id,
          input.projectId
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to get deployments',
          });
        }

        return result.deployments || [];
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An unexpected error occurred',
          cause: error,
        });
      }
    }),

  /**
   * Get project's latest deployment
   */
  getLatestDeployment: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const supabase = await getSupabaseClient();
        
        const { data: deployment, error } = await supabase
          .from('deployments')
          .select('*')
          .eq('project_id', input.projectId)
          .eq('user_id', ctx.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          });
        }

        return deployment;
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An unexpected error occurred',
          cause: error,
        });
      }
    }),
});

export type VercelRouter = typeof vercelRouter;

