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

          // Update project timestamps
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          await supabase
            .from('projects')
            .update({
              last_push_at: new Date().toISOString(),
              has_local_changes: false,
            })
            .eq('id', input.projectId);

          // Update repository sync status
          await supabase
            .from('github_repositories')
            .update({
              last_sync_at: new Date().toISOString(),
              sync_status: 'idle',
            })
            .eq('id', input.repositoryId);
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

        // Record sync history for pull
        if (result.success && result.files) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Save pulled files to database (fragments table)
          if (repo.project_id) {
            // First, get the latest version number for this project
            const { data: latestVersion } = await supabase
              .from('versions')
              .select('version_number')
              .eq('project_id', repo.project_id)
              .order('version_number', { ascending: false })
              .limit(1)
              .single();

            const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

            // Create a new version with the pulled files
            await supabase
              .from('versions')
              .insert({
                project_id: repo.project_id,
                version_number: nextVersionNumber,
                files: result.files,
                status: 'complete',
                commit_message: `Pulled from GitHub branch: ${input.branchName || repo.default_branch}`,
              });

            // Update project timestamps
            await supabase
              .from('projects')
              .update({
                last_pull_at: new Date().toISOString(),
              })
              .eq('id', repo.project_id);
          }

          // Record sync history
          await githubSyncService.recordSyncHistory(
            input.repositoryId,
            repo.project_id || '',
            ctx.user.id,
            'pull',
            {
              branchName: input.branchName,
              filesChanged: Object.keys(result.files).length,
              status: 'completed',
            }
          );

          // Update repository sync status
          await supabase
            .from('github_repositories')
            .update({
              last_sync_at: new Date().toISOString(),
              sync_status: 'idle',
            })
            .eq('id', input.repositoryId);
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
   * Create a new GitHub repository
   */
  createRepository: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      isPrivate: z.boolean().default(true),
      description: z.string().optional(),
      owner: z.string().optional(), // Organization or username
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

        // Determine if owner is an organization or personal account
        const isOrg = input.owner && input.owner !== integration.provider_username;

        const result = await githubSyncService.createRepository(
          integration.access_token,
          input.name,
          input.isPrivate,
          input.description,
          isOrg ? input.owner : undefined
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

  /**
   * Create a new branch in a repository
   */
  createBranch: protectedProcedure
    .input(z.object({
      repoFullName: z.string(),
      branchName: z.string(),
      baseBranch: z.string().default('main'),
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

        const result = await githubSyncService.createBranch(
          integration.access_token,
          input.repoFullName,
          input.branchName,
          input.baseBranch
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to create branch',
          });
        }

        // Find the repository in database to record sync history
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: repo } = await supabase
          .from('github_repositories')
          .select('id, project_id')
          .eq('repo_full_name', input.repoFullName)
          .eq('user_id', ctx.user.id)
          .single();

        if (repo) {
          await githubSyncService.recordSyncHistory(
            repo.id,
            repo.project_id || '',
            ctx.user.id,
            'create_branch',
            {
              branchName: input.branchName,
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
   * Store created repository in database and link to project
   */
  storeRepository: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      repoFullName: z.string(),
      repoUrl: z.string(),
      repoId: z.number(),
      defaultBranch: z.string().default('main'),
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

        const [owner, repo] = input.repoFullName.split('/');

        // Store in github_repositories table
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: storedRepo, error: repoError } = await supabase
          .from('github_repositories')
          .insert({
            user_id: ctx.user.id,
            integration_id: integration.id,
            project_id: input.projectId,
            repo_id: input.repoId,
            repo_full_name: input.repoFullName,
            repo_name: repo,
            repo_owner: owner,
            repo_url: input.repoUrl,
            default_branch: input.defaultBranch,
            is_private: input.isPrivate,
            description: input.description,
            last_sync_at: new Date().toISOString(),
            sync_status: 'idle',
          })
          .select()
          .single();

        if (repoError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to store repository: ${repoError.message}`,
          });
        }

        // Update project with GitHub info
        const { error: projectError } = await supabase
          .from('projects')
          .update({
            github_repo_id: storedRepo.id,
            github_mode: true,
            repo_url: input.repoUrl,
            active_branch: input.defaultBranch,
          })
          .eq('id', input.projectId);

        if (projectError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update project: ${projectError.message}`,
          });
        }

        // Record repository creation in sync history
        await githubSyncService.recordSyncHistory(
          storedRepo.id,
          input.projectId,
          ctx.user.id,
          'create_repo',
          {
            branchName: input.defaultBranch,
            status: 'completed',
          }
        );

        return {
          success: true,
          repository: storedRepo,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Update project's active branch
   */
  updateActiveBranch: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      branchName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error } = await supabase
          .from('projects')
          .update({
            active_branch: input.branchName,
          })
          .eq('id', input.projectId)
          .eq('user_id', ctx.user.id);

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update active branch: ${error.message}`,
          });
        }

        return { success: true };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get project's GitHub repository info
   */
  getProjectRepository: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get project with GitHub info
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('github_repo_id, repo_url, active_branch, github_mode')
          .eq('id', input.projectId)
          .eq('user_id', ctx.user.id)
          .single();

        if (projectError || !project) {
          return null;
        }

        // If no GitHub repo linked, return null
        if (!project.github_repo_id && !project.repo_url) {
          return null;
        }

        // Get full repository details if we have repo_id
        if (project.github_repo_id) {
          const { data: repo } = await supabase
            .from('github_repositories')
            .select('*')
            .eq('id', project.github_repo_id)
            .single();

          return {
            ...repo,
            active_branch: project.active_branch,
          };
        }

        // Otherwise just return the basic info
        return {
          repo_url: project.repo_url,
          active_branch: project.active_branch || 'main',
          github_mode: project.github_mode,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),
});

export type GitHubRouter = typeof githubRouter;

