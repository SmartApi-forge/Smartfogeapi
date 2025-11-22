/**
 * GitHub tRPC Router
 * Handles GitHub integration API endpoints
 */

import { z } from 'zod';
import { protectedProcedure, createTRPCRouter } from '../init';
import { TRPCError } from '@trpc/server';
import { getGitHubOAuthService } from '@/lib/github-oauth';
import { githubRepositoryService } from '@/src/services/github-repository-service';
import { githubSyncService } from '@/src/services/github-sync-service';
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

export const githubRouter = createTRPCRouter({
  /**
   * Check if user has GitHub integration
   */
  getIntegrationStatus: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const githubOAuth = getGitHubOAuthService();
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        return {
          connected: !!integration,
          username: integration?.provider_username,
          email: integration?.provider_email,
          avatar: integration?.metadata?.avatar_url,
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
   * Disconnect GitHub integration
   */
  disconnect: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const githubOAuth = getGitHubOAuthService();
        await githubOAuth.revokeIntegration(ctx.user.id);
        
        return {
          success: true,
          message: 'GitHub integration disconnected',
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
   * Get user's GitHub organizations
   */
  getUserOrgs: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const githubOAuth = getGitHubOAuthService();
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        if (!integration?.access_token) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub integration not found',
          });
        }

        const response = await fetch('https://api.github.com/user/orgs', {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${integration.access_token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'GitHub authentication failed. Please reconnect.',
            });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `GitHub API error: ${response.statusText}`,
          });
        }

        const orgs = await response.json();
        return orgs;
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to fetch GitHub organizations',
          cause: error,
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
        const githubOAuth = getGitHubOAuthService();
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
   * Connect a repository to a project
   */
  connectRepository: protectedProcedure
    .input(z.object({
      repositoryId: z.number(),
      repositoryFullName: z.string(),
      projectId: z.string().optional(),
      createProject: z.boolean().default(false),
      page: z.number().default(1),
      perPage: z.number().default(100),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const githubOAuth = getGitHubOAuthService();
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        if (!integration) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub not connected',
          });
        }

        // Fetch repository details with pagination
        const repositories = await githubRepositoryService.listUserRepositories(
          integration.access_token,
          input.page,
          input.perPage
        );
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
          const supabase = await getSupabaseClient();

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
   * Get user's connected repositories
   */
  getConnectedRepositories: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const repositories = await githubRepositoryService.getUserRepositories(ctx.user.id);
        return repositories;
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
        const githubOAuth = getGitHubOAuthService();
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
          const historyResult = await githubSyncService.recordSyncHistory(
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
          
          if (!historyResult.success) {
            console.warn('Failed to record sync history:', historyResult.error);
          }

          // Update project timestamps with ownership verification
          const supabase = await getSupabaseClient();

          const { error: projectUpdateError } = await supabase
            .from('projects')
            .update({
              last_push_at: new Date().toISOString(),
              has_local_changes: false,
            })
            .eq('id', input.projectId)
            .eq('user_id', ctx.user.id);

          if (projectUpdateError) {
            console.error('Failed to update project after push:', projectUpdateError);
            // Set repository to error state since project update failed
            await supabase
              .from('github_repositories')
              .update({
                sync_status: 'error',
                last_sync_at: new Date().toISOString(),
              })
              .eq('id', input.repositoryId)
              .eq('user_id', ctx.user.id);
            
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Push succeeded but failed to update project: ${projectUpdateError.message}`,
              cause: projectUpdateError,
            });
          }

          // Update repository sync status with ownership verification
          const { error: repoUpdateError } = await supabase
            .from('github_repositories')
            .update({
              last_sync_at: new Date().toISOString(),
              sync_status: 'idle',
            })
            .eq('id', input.repositoryId)
            .eq('user_id', ctx.user.id);

          if (repoUpdateError) {
            console.error('Failed to update repository sync status:', repoUpdateError);
            // Revert project state since repo update failed
            await supabase
              .from('projects')
              .update({
                has_local_changes: true,
              })
              .eq('id', input.projectId)
              .eq('user_id', ctx.user.id);
            
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Push succeeded but failed to update repository status: ${repoUpdateError.message}`,
              cause: repoUpdateError,
            });
          }
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
        const githubOAuth = getGitHubOAuthService();
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

        // Log any per-file errors that occurred during fetch
        if (result.errors && result.errors.length > 0) {
          console.warn(`Pull completed with ${result.errors.length} file fetch errors:`, result.errors);
        }

        // Record sync history for pull
        if (result.success && result.files) {
          const supabase = await getSupabaseClient();

          // Save pulled files to database (fragments table)
          if (repo.project_id) {
            // Verify project ownership before modifying
            const { data: projectOwnership, error: ownershipError } = await supabase
              .from('projects')
              .select('id')
              .eq('id', repo.project_id)
              .eq('user_id', ctx.user.id)
              .maybeSingle();

            if (ownershipError) {
              console.error('Failed to verify project ownership:', ownershipError);
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to verify project ownership: ${ownershipError.message}`,
                cause: ownershipError,
              });
            }

            if (!projectOwnership) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'You do not have permission to modify this project',
              });
            }

            // Get the latest version number for this project
            const { data: latestVersion, error: versionError } = await supabase
              .from('versions')
              .select('version_number')
              .eq('project_id', repo.project_id)
              .order('version_number', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (versionError) {
              console.error('Failed to fetch latest version:', versionError);
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to fetch version history: ${versionError.message}`,
                cause: versionError,
              });
            }

            const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

            // Create a new version with the pulled files
            const { error: versionInsertError } = await supabase
              .from('versions')
              .insert({
                project_id: repo.project_id,
                version_number: nextVersionNumber,
                files: result.files,
                status: 'complete',
                commit_message: `Pulled from GitHub branch: ${input.branchName || repo.default_branch}`,
              });

            if (versionInsertError) {
              console.error('Failed to create new version:', versionInsertError);
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to create version: ${versionInsertError.message}`,
                cause: versionInsertError,
              });
            }

            // Update project timestamps with ownership verification
            const { error: projectUpdateError } = await supabase
              .from('projects')
              .update({
                last_pull_at: new Date().toISOString(),
              })
              .eq('id', repo.project_id)
              .eq('user_id', ctx.user.id);

            if (projectUpdateError) {
              console.error('Failed to update project after pull:', projectUpdateError);
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to update project: ${projectUpdateError.message}`,
                cause: projectUpdateError,
              });
            }
          }

          // Record sync history (only if project_id exists)
          if (repo.project_id) {
            const historyResult = await githubSyncService.recordSyncHistory(
              input.repositoryId,
              repo.project_id,
              ctx.user.id,
              'pull',
              {
                branchName: input.branchName,
                filesChanged: Object.keys(result.files).length,
                status: 'completed',
              }
            );
            
            if (!historyResult.success) {
              console.warn('Failed to record sync history:', historyResult.error);
            }
          }

          // Update repository sync status with ownership verification
          const { error: repoUpdateError } = await supabase
            .from('github_repositories')
            .update({
              last_sync_at: new Date().toISOString(),
              sync_status: 'idle',
            })
            .eq('id', input.repositoryId)
            .eq('user_id', ctx.user.id);

          if (repoUpdateError) {
            console.error('Failed to update repository sync status after pull:', repoUpdateError);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Pull succeeded but failed to update repository status: ${repoUpdateError.message}`,
              cause: repoUpdateError,
            });
          }
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
        const githubOAuth = getGitHubOAuthService();
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
   * Get sync history for a repository
   */
  getSyncHistory: protectedProcedure
    .input(z.object({
      repositoryId: z.string().uuid(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const result = await githubSyncService.getSyncHistory(
          input.repositoryId,
          input.limit
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to fetch sync history',
          });
        }

        return result.data || [];
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
   * Get branches for a repository
   */
  getBranches: protectedProcedure
    .input(z.object({
      owner: z.string(),
      repo: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const githubOAuth = getGitHubOAuthService();
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
        const githubOAuth = getGitHubOAuthService();
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
        const supabase = await getSupabaseClient();

        const { data: repo } = await supabase
          .from('github_repositories')
          .select('id, project_id')
          .eq('repo_full_name', input.repoFullName)
          .eq('user_id', ctx.user.id)
          .single();

        // Only record sync history if project_id exists (not null/undefined)
        if (repo?.project_id) {
          const historyResult = await githubSyncService.recordSyncHistory(
            repo.id,
            repo.project_id,
            ctx.user.id,
            'create_branch',
            {
              branchName: input.branchName,
              status: 'completed',
            }
          );
          
          if (!historyResult.success) {
            console.warn('Failed to record sync history:', historyResult.error);
          }
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
        const githubOAuth = getGitHubOAuthService();
        const integration = await githubOAuth.getUserIntegration(ctx.user.id);
        
        if (!integration) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub not connected',
          });
        }

        // Validate repoFullName format
        const trimmedRepoFullName = input.repoFullName.trim();
        
        if (!trimmedRepoFullName) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Repository full name cannot be empty',
          });
        }

        const firstSlash = trimmedRepoFullName.indexOf('/');
        const lastSlash = trimmedRepoFullName.lastIndexOf('/');
        
        if (firstSlash === -1 || firstSlash !== lastSlash) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Repository full name must be in format "owner/repo"',
          });
        }

        const [owner, repo] = trimmedRepoFullName.split('/');
        
        if (!owner || !repo) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Both owner and repository name must be non-empty',
          });
        }

        // Store in github_repositories table
        const supabase = await getSupabaseClient();

        const { data: storedRepo, error: repoError } = await supabase
          .from('github_repositories')
          .insert({
            user_id: ctx.user.id,
            integration_id: integration.id,
            project_id: input.projectId,
            repo_id: input.repoId,
            repo_full_name: trimmedRepoFullName,
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
        const historyResult = await githubSyncService.recordSyncHistory(
          storedRepo.id,
          input.projectId,
          ctx.user.id,
          'create_repo',
          {
            branchName: input.defaultBranch,
            status: 'completed',
          }
        );
        
        if (!historyResult.success) {
          console.warn('Failed to record sync history:', historyResult.error);
        }

        return {
          success: true,
          repository: storedRepo,
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
   * Update project's active branch
   */
  updateActiveBranch: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      branchName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const supabase = await getSupabaseClient();

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
   * Get project's GitHub repository info
   */
  getProjectRepository: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const supabase = await getSupabaseClient();

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

export type GitHubRouter = typeof githubRouter;

