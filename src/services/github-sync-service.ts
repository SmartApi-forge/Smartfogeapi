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
  maxFiles?: number; // Maximum number of files to fetch (default: 100)
}

export class GitHubSyncService {
  // Binary file extensions to skip during pull operations
  private readonly BINARY_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  ];

  /**
   * Validates repository full name format (owner/repo)
   */
  private validateRepoFullName(repoFullName: string): { valid: boolean; owner?: string; repo?: string; error?: string } {
    if (!repoFullName || typeof repoFullName !== 'string') {
      return { valid: false, error: 'Invalid repository name format. Expected "owner/repo"' };
    }

    const parts = repoFullName.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { valid: false, error: 'Invalid repository name format. Expected "owner/repo"' };
    }

    return { valid: true, owner: parts[0], repo: parts[1] };
  }

  /**
   * Sanitizes error messages to prevent leaking sensitive information
   * Logs full error details server-side for debugging
   */
  private sanitizeError(error: any, context: string): string {
    // Log full error with stack trace for server-side debugging
    console.error(`[${context}] Full error details:`, {
      message: error?.message,
      stack: error?.stack,
      status: error?.status,
      response: error?.response?.data,
    });

    // Map known GitHub API errors to safe messages
    if (error?.status === 401) {
      return 'Authentication failed. Please check your GitHub credentials.';
    }
    if (error?.status === 403) {
      return 'Access denied. You may not have permission to access this resource.';
    }
    if (error?.status === 404) {
      return 'Resource not found. Please verify the repository or branch exists.';
    }
    if (error?.status === 422) {
      return 'Invalid request. Please check your input parameters.';
    }
    if (error?.message?.includes('rate limit')) {
      return 'GitHub API rate limit exceeded. Please try again later.';
    }

    // Return generic error for unknown cases
    return 'An error occurred while communicating with GitHub. Please try again.';
  }

  /**
   * Checks if a file is binary based on its extension
   */
  private isBinaryFile(path: string): boolean {
    const lowerPath = path.toLowerCase();
    return this.BINARY_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
  }
  /**
   * Push changes to GitHub repository
   * Automatically creates branch if it doesn't exist
   */
  async pushChangesToGithub(
    accessToken: string,
    options: PushOptions
  ): Promise<{ success: boolean; commitSha?: string; prUrl?: string; error?: string }> {
    // Validate repository name format
    const validation = this.validateRepoFullName(options.repoFullName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const octokit = new Octokit({ auth: accessToken });
    const owner = validation.owner!;
    const repo = validation.repo!;

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
      // Handle race conditions where branch might be created concurrently
      let branchSha: string;
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
          try {
            await octokit.git.createRef({
              owner,
              repo,
              ref: `refs/heads/${options.branchName}`,
              sha: baseCommitSha,
            });
            // Branch created successfully, it points to baseCommitSha
            branchSha = baseCommitSha;
          } catch (createError: any) {
            // Handle race condition: branch was created by another process
            if (createError.status === 422 || createError.message?.includes('Reference already exists')) {
              // Retry getRef to get the actual branch SHA
              const { data: retryBranchRef } = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${options.branchName}`,
              });
              branchSha = retryBranchRef.object.sha;
            } else {
              // Some other error, rethrow
              throw createError;
            }
          }
        } else {
          // Some other error during initial getRef, rethrow
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
      return {
        success: false,
        error: this.sanitizeError(error, 'pushChangesToGithub'),
      };
    }
  }

  /**
   * Pull latest changes from GitHub repository
   */
  async pullLatestChanges(
    accessToken: string,
    options: PullOptions
  ): Promise<{ 
    success: boolean; 
    files?: Record<string, string>; 
    errors?: Array<{ path: string; error: string }>;
    skippedBinaryFiles?: string[];
    error?: string;
  }> {
    // Validate repository name format
    const validation = this.validateRepoFullName(options.repoFullName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const octokit = new Octokit({ auth: accessToken });
    const owner = validation.owner!;
    const repo = validation.repo!;

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
      const fileErrors: Array<{ path: string; error: string }> = [];
      const skippedBinaryFiles: string[] = [];
      const filteredTree = options.path
        ? tree.tree.filter(item => item.path?.startsWith(options.path!))
        : tree.tree;

      // Fetch content for each file (limit to avoid rate limits)
      // Default to 100 files, but allow configuration via options
      const maxFiles = options.maxFiles ?? 100;
      const fileItems = filteredTree.filter(item => item.type === 'blob').slice(0, maxFiles);

      // Log if we're truncating results
      if (filteredTree.filter(item => item.type === 'blob').length > maxFiles) {
        console.warn(`Repository contains more than ${maxFiles} files. Only fetching first ${maxFiles} files. Increase maxFiles option if needed.`);
      }

      await Promise.all(
        fileItems.map(async (item) => {
          if (!item.sha || !item.path) return;

          // Skip binary files
          if (this.isBinaryFile(item.path)) {
            console.log(`Skipping binary file: ${item.path}`);
            skippedBinaryFiles.push(item.path);
            return;
          }

          try {
            const { data: blob } = await octokit.git.getBlob({
              owner,
              repo,
              file_sha: item.sha,
            });

            const content = Buffer.from(blob.content, 'base64').toString('utf-8');
            files[item.path] = content;
          } catch (error: any) {
            console.error(`Failed to fetch ${item.path}:`, error);
            fileErrors.push({
              path: item.path,
              error: 'Failed to fetch file content',
            });
          }
        })
      );

      return {
        success: true,
        files,
        errors: fileErrors.length > 0 ? fileErrors : undefined,
        skippedBinaryFiles: skippedBinaryFiles.length > 0 ? skippedBinaryFiles : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: this.sanitizeError(error, 'pullLatestChanges'),
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
      return {
        success: false,
        error: this.sanitizeError(error, 'createRepository'),
      };
    }
  }

  /**
   * Create a new branch in repository
   * Idempotent: returns success if branch already exists
   */
  async createBranch(
    accessToken: string,
    repoFullName: string,
    branchName: string,
    baseBranch: string = 'main'
  ): Promise<{ success: boolean; branchSha?: string; error?: string; alreadyExists?: boolean }> {
    // Validate repository name format
    const validation = this.validateRepoFullName(repoFullName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const octokit = new Octokit({ auth: accessToken });
    const owner = validation.owner!;
    const repo = validation.repo!;

    try {
      // Get base branch SHA
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });

      // Check if the target branch already exists
      try {
        const { data: existingBranch } = await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${branchName}`,
        });

        // Branch already exists, return success with existing SHA
        return {
          success: true,
          branchSha: existingBranch.object.sha,
          alreadyExists: true,
        };
      } catch (checkError: any) {
        // Branch doesn't exist (404), proceed to create it
        if (checkError.status !== 404) {
          // Some other error occurred while checking
          throw checkError;
        }
      }

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
        alreadyExists: false,
      };
    } catch (error: any) {
      return {
        success: false,
        error: this.sanitizeError(error, 'createBranch'),
      };
    }
  }

  /**
   * Record sync operation in database
   */
  async recordSyncHistory(
    repositoryId: string,
    projectId: string | null | undefined,
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
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('github_sync_history').insert({
        repository_id: repositoryId,
        project_id: projectId ?? null,
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
      
      if (error) {
        console.error('Failed to record sync history:', error);
        return { success: false, error: 'Failed to record sync history' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to record sync history:', error);
      return { 
        success: false, 
        error: 'Failed to record sync history'
      };
    }
  }

  /**
   * Get sync history for a repository
   */
  async getSyncHistory(
    repositoryId: string, 
    limit: number = 20
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('github_sync_history')
        .select('*')
        .eq('repository_id', repositoryId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch sync history:', error);
        return { success: false, error: 'Failed to fetch sync history' };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Failed to fetch sync history:', error);
      return {
        success: false,
        error: 'Failed to fetch sync history'
      };
    }
  }
}

export const githubSyncService = new GitHubSyncService();

