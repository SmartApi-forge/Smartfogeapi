/**
 * GitHub Sync Service
 * Handles two-way synchronization: push/pull changes to/from GitHub
 */

import { Octokit } from '@octokit/rest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PushOptions {
  repoFullName: string;
  branchName: string;
  files: Record<string, string>; // filename -> content
  commitMessage: string;
  baseBranch?: string;
  createPR?: boolean;
  prTitle?: string;
  prBody?: string;
}

export interface PullOptions {
  repoFullName: string;
  branchName?: string;
  path?: string;
}

export class GitHubSyncService {
  /**
   * Push changes to GitHub repository
   * Automatically creates branch if it doesn't exist
   */
  async pushChangesToGithub(
    accessToken: string,
    options: PushOptions
  ): Promise<{ success: boolean; commitSha?: string; prUrl?: string; error?: string }> {
    const octokit = new Octokit({ auth: accessToken });
    const [owner, repo] = options.repoFullName.split('/');

    try {
      // Get the default branch's latest commit
      const baseBranch = options.baseBranch || 'main';
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });

      const baseCommitSha = refData.object.sha;

      // Check if feature branch exists, create if not
      let branchSha = baseCommitSha;
      try {
        const { data: branchRef } = await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${options.branchName}`,
        });
        branchSha = branchRef.object.sha;
      } catch (error: any) {
        // Branch doesn't exist, create it
        if (error.status === 404) {
          await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${options.branchName}`,
            sha: baseCommitSha,
          });
        } else {
          throw error;
        }
      }

      // Get the tree of the branch
      const { data: commitData } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: branchSha,
      });

      // Create blobs for each file
      const blobs = await Promise.all(
        Object.entries(options.files).map(async ([path, content]) => {
          const { data: blob } = await octokit.git.createBlob({
            owner,
            repo,
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64',
          });

          return {
            path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        })
      );

      // Create new tree
      const { data: tree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: commitData.tree.sha,
        tree: blobs,
      });

      // Create commit
      const { data: commit } = await octokit.git.createCommit({
        owner,
        repo,
        message: options.commitMessage,
        tree: tree.sha,
        parents: [branchSha],
      });

      // Update branch reference
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${options.branchName}`,
        sha: commit.sha,
      });

      // Create PR if requested
      let prUrl: string | undefined;
      if (options.createPR) {
        const { data: pr } = await octokit.pulls.create({
          owner,
          repo,
          title: options.prTitle || options.commitMessage,
          body: options.prBody || 'Auto-generated changes from SmartForge',
          head: options.branchName,
          base: baseBranch,
        });

        prUrl = pr.html_url;
      }

      return {
        success: true,
        commitSha: commit.sha,
        prUrl,
      };
    } catch (error: any) {
      console.error('GitHub push error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Pull latest changes from GitHub repository
   */
  async pullLatestChanges(
    accessToken: string,
    options: PullOptions
  ): Promise<{ success: boolean; files?: Record<string, string>; error?: string }> {
    const octokit = new Octokit({ auth: accessToken });
    const [owner, repo] = options.repoFullName.split('/');

    try {
      // Get repository info to find default branch
      const { data: repoData } = await octokit.repos.get({
        owner,
        repo,
      });

      const branch = options.branchName || repoData.default_branch;

      // Get the tree recursively
      const { data: branchData } = await octokit.repos.getBranch({
        owner,
        repo,
        branch,
      });

      const treeSha = branchData.commit.commit.tree.sha;

      const { data: tree } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: treeSha,
        recursive: 'true',
      });

      // Filter files if path is specified
      const files: Record<string, string> = {};
      const filteredTree = options.path
        ? tree.tree.filter(item => item.path?.startsWith(options.path!))
        : tree.tree;

      // Fetch content for each file (limit to avoid rate limits)
      const fileItems = filteredTree.filter(item => item.type === 'blob').slice(0, 100);

      await Promise.all(
        fileItems.map(async (item) => {
          if (!item.sha || !item.path) return;

          try {
            const { data: blob } = await octokit.git.getBlob({
              owner,
              repo,
              file_sha: item.sha,
            });

            const content = Buffer.from(blob.content, 'base64').toString('utf-8');
            files[item.path] = content;
          } catch (error) {
            console.error(`Failed to fetch ${item.path}:`, error);
          }
        })
      );

      return {
        success: true,
        files,
      };
    } catch (error: any) {
      console.error('GitHub pull error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new GitHub repository
   */
  async createRepository(
    accessToken: string,
    name: string,
    isPrivate: boolean = true,
    description?: string,
    org?: string // Optional organization name
  ): Promise<{ success: boolean; repoUrl?: string; repoFullName?: string; repoId?: number; error?: string }> {
    const octokit = new Octokit({ auth: accessToken });

    try {
      let repo;
      
      if (org) {
        // Create repository in organization
        const { data } = await octokit.repos.createInOrg({
          org,
          name,
          private: isPrivate,
          description: description || `Created by SmartForge`,
          auto_init: true, // Initialize with README
        });
        repo = data;
      } else {
        // Create repository for authenticated user
        const { data } = await octokit.repos.createForAuthenticatedUser({
          name,
          private: isPrivate,
          description: description || `Created by SmartForge`,
          auto_init: true, // Initialize with README
        });
        repo = data;
      }

      return {
        success: true,
        repoUrl: repo.html_url,
        repoFullName: repo.full_name,
        repoId: repo.id,
      };
    } catch (error: any) {
      console.error('GitHub create repository error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new branch in repository
   */
  async createBranch(
    accessToken: string,
    repoFullName: string,
    branchName: string,
    baseBranch: string = 'main'
  ): Promise<{ success: boolean; branchSha?: string; error?: string }> {
    const octokit = new Octokit({ auth: accessToken });
    const [owner, repo] = repoFullName.split('/');

    try {
      // Get base branch SHA
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });

      // Create new branch
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha,
      });

      return {
        success: true,
        branchSha: refData.object.sha,
      };
    } catch (error: any) {
      console.error('GitHub create branch error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Record sync operation in database
   */
  async recordSyncHistory(
    repositoryId: string,
    projectId: string,
    userId: string,
    operation: 'push' | 'pull' | 'clone' | 'create_repo' | 'create_branch' | 'create_pr',
    metadata: {
      branchName?: string;
      commitSha?: string;
      commitMessage?: string;
      prNumber?: number;
      prUrl?: string;
      filesChanged?: number;
      status: 'completed' | 'failed';
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      await supabase.from('github_sync_history').insert({
        repository_id: repositoryId,
        project_id: projectId,
        user_id: userId,
        operation_type: operation,
        branch_name: metadata.branchName,
        commit_sha: metadata.commitSha,
        commit_message: metadata.commitMessage,
        pr_number: metadata.prNumber,
        pr_url: metadata.prUrl,
        files_changed: metadata.filesChanged,
        status: metadata.status,
        error_message: metadata.errorMessage,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to record sync history:', error);
    }
  }

  /**
   * Get sync history for a repository
   */
  async getSyncHistory(repositoryId: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabase
      .from('github_sync_history')
      .select('*')
      .eq('repository_id', repositoryId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch sync history: ${error.message}`);
    }

    return data || [];
  }
}

export const githubSyncService = new GitHubSyncService();

