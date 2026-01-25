/**
 * Vercel tRPC Router
 * Handles Vercel Platforms API endpoints
 */

import { z } from 'zod';
import { protectedProcedure, createTRPCRouter } from '../init';
import { TRPCError } from '@trpc/server';
import { vercelPlatformsService } from '@/src/services/vercel-platforms-service';
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
   * Deploy project to Vercel using Platforms API
   */
  deployProject: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      framework: z.enum(['nextjs', 'vite', 'react', 'vue', 'express', 'nuxt']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get project with latest version files
        const supabase = await getSupabaseClient();
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('id, name, framework, versions!inner(files)')
          .eq('id', input.projectId)
          .eq('user_id', ctx.user.id)
          .order('version_number', { foreignTable: 'versions', ascending: false })
          .limit(1, { foreignTable: 'versions' })
          .single();

        if (projectError || !project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }

        // Get latest version files
        const files = project.versions?.[0]?.files || {};

        if (Object.keys(files).length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No files to deploy',
          });
        }

        // Deploy to Vercel
        const result = await vercelPlatformsService.deployProject(
          ctx.user.id,
          input.projectId,
          files,
          input.framework || project.framework || 'nextjs'
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Deployment failed',
          });
        }

        return {
          success: true,
          deploymentId: result.deploymentId,
          url: result.url,
          claimUrl: result.claimUrl,
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
   * Get deployment status with logs
   */
  getDeploymentStatus: protectedProcedure
    .input(z.object({
      deploymentId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user owns this deployment
        const supabase = await getSupabaseClient();
        const { data: deployment } = await supabase
          .from('deployments')
          .select('id')
          .eq('vercel_deployment_id', input.deploymentId)
          .eq('user_id', ctx.user.id)
          .single();

        if (!deployment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deployment not found',
          });
        }

        const status = await vercelPlatformsService.getDeploymentStatus(input.deploymentId);

        return status;
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
        const deployments = await vercelPlatformsService.getUserDeployments(
          ctx.user.id,
          input.projectId
        );

        return deployments || [];
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

  /**
   * Delete a deployment
   */
  deleteDeployment: protectedProcedure
    .input(z.object({
      deploymentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await vercelPlatformsService.deleteDeployment(
          input.deploymentId,
          ctx.user.id
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to delete deployment',
          });
        }

        return {
          success: true,
          message: 'Deployment deleted successfully',
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
});

export type VercelRouter = typeof vercelRouter;
