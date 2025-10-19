/**
 * GitHub tRPC Router
 * Handles GitHub integration API endpoints
 */

import { z } from 'zod';
import { protectedProcedure, createTRPCRouter } from '../init';
import { TRPCError } from '@trpc/server';
import { githubOAuth } from '@/lib/github-oauth';
import { githubRepositoryService } from '@/src/services/github-repository-service';
import { githubSyncService } from '@/src/services/github-sync-service';

export const githubRouter = createTRPCRouter({
  /**
   * Check if user has GitHub integration
   */
  getIntegrationStatus: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        return {
          connected: !!integration,
          username: integration?.provider_username,
          email: integration?.provider_email,
          avatar: integration?.metadata?.avatar_url,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Disconnect GitHub integration
   */
  disconnect: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        await githubOAuth.revokeIntegration(ctx.user.id);
        
        return {
          success: true,
          message: 'GitHub integration disconnected',
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * List user's GitHub repositories
   */
  listRepositories: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      perPage: z.number().default(30),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        if (!integration) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub not connected',
          });
        }

        const repositories = await githubRepositoryService.listUserRepositories(
          integration.access_token,
          input.page,
          input.perPage
        );

        return repositories;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Connect a repository to a project
   */
  connectRepository: protectedProcedure
    .input(z.object({
      repositoryId: z.number(),
      repositoryFullName: z.string(),
      projectId: z.string().optional(),
      createProject: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        if (!integration) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub not connected',
          });
        }

        // Fetch repository details
        const repositories = await githubRepositoryService.listUserRepositories(integration.access_token);
        const repo = repositories.find(r => r.id === input.repositoryId);

        if (!repo) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Repository not found',
          });
        }

        let projectId = input.projectId;

        // Create project if requested
        if (input.createProject) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Create project
          const { data: project, error: projectError } = await supabase
            .from('projects')
            .insert({
              user_id: ctx.user.id,
              name: repo.name,
              description: repo.description || `Connected from GitHub: ${repo.full_name}`,
              prompt: `Clone and preview GitHub repository: ${repo.full_name}`,
              framework: 'express', // Will be detected during clone
              status: 'generating',
              github_mode: true,
            })
            .select()
            .single();

          if (projectError) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to create project: ${projectError.message}`,
            });
          }

          projectId = project.id;
        }

        // Save repository connection
        const savedRepo = await githubRepositoryService.connectRepository(
          ctx.user.id,
          integration.id,
          repo,
          projectId
        );

        // Trigger clone and preview workflow
        if (input.createProject && projectId) {
          const { inngest } = await import('../../inngest/client');
          
          await inngest.send({
            name: 'github/clone-and-preview',
            data: {
              projectId,
              repoUrl: repo.html_url,
              repoFullName: repo.full_name,
              githubRepoId: savedRepo.id,
              userId: ctx.user.id,
            },
          });
        }

        return {
          success: true,
          repository: savedRepo,
          projectId,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get user's connected repositories
   */
  getConnectedRepositories: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const repositories = await githubRepositoryService.getUserRepositories(ctx.user.id);
        return repositories;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Push changes to GitHub
   */
  pushChanges: protectedProcedure
    .input(z.object({
      repositoryId: z.string().uuid(),
      projectId: z.string().uuid(),
      branchName: z.string(),
      files: z.record(z.string()), // filename -> content
      commitMessage: z.string(),
      createPR: z.boolean().default(true),
      prTitle: z.string().optional(),
      prBody: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        if (!integration) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub not connected',
          });
        }

        // Get repository details
        const repos = await githubRepositoryService.getUserRepositories(ctx.user.id);
        const repo = repos.find(r => r.id === input.repositoryId);

        if (!repo) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Repository not found',
          });
        }

        // Push changes
        const result = await githubSyncService.pushChangesToGithub(
          integration.access_token,
          {
            repoFullName: repo.repo_full_name,
            branchName: input.branchName,
            files: input.files,
            commitMessage: input.commitMessage,
            createPR: input.createPR,
            prTitle: input.prTitle,
            prBody: input.prBody,
          }
        );

        // Record sync history
        if (result.success) {
          await githubSyncService.recordSyncHistory(
            input.repositoryId,
            input.projectId,
            ctx.user.id,
            input.createPR ? 'create_pr' : 'push',
            {
              branchName: input.branchName,
              commitSha: result.commitSha,
              commitMessage: input.commitMessage,
              prUrl: result.prUrl,
              filesChanged: Object.keys(input.files).length,
              status: 'completed',
            }
          );
        }

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Pull latest changes from GitHub
   */
  pullChanges: protectedProcedure
    .input(z.object({
      repositoryId: z.string().uuid(),
      branchName: z.string().optional(),
      path: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        if (!integration) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub not connected',
          });
        }

        // Get repository details
        const repos = await githubRepositoryService.getUserRepositories(ctx.user.id);
        const repo = repos.find(r => r.id === input.repositoryId);

        if (!repo) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Repository not found',
          });
        }

        // Pull changes
        const result = await githubSyncService.pullLatestChanges(
          integration.access_token,
          {
            repoFullName: repo.repo_full_name,
            branchName: input.branchName,
            path: input.path,
          }
        );

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Create a new GitHub repository
   */
  createRepository: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      isPrivate: z.boolean().default(true),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        if (!integration) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub not connected',
          });
        }

        const result = await githubSyncService.createRepository(
          integration.access_token,
          input.name,
          input.isPrivate,
          input.description
        );

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get sync history for a repository
   */
  getSyncHistory: protectedProcedure
    .input(z.object({
      repositoryId: z.string().uuid(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const history = await githubSyncService.getSyncHistory(
          input.repositoryId,
          ctx.user.id,
          input.limit
        );

        return history;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get branches for a repository
   */
  getBranches: protectedProcedure
    .input(z.object({
      owner: z.string(),
      repo: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        if (!integration) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub not connected',
          });
        }

        const branches = await githubRepositoryService.getBranches(
          integration.access_token,
          input.owner,
          input.repo
        );

        return branches;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),
});

export type GitHubRouter = typeof githubRouter;

