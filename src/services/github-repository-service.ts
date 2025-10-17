/**
 * GitHub Repository Management Service
 * Handles repository operations: list, clone, install dependencies, detect framework
 */

import { Octokit } from '@octokit/rest';
import { Sandbox } from 'e2b';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
}

export interface FrameworkDetection {
  framework: 'nextjs' | 'react' | 'vue' | 'angular' | 'express' | 'fastapi' | 'unknown';
  version?: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'unknown';
  buildCommand?: string;
  startCommand?: string;
  port?: number;
}

export class GitHubRepositoryService {
  /**
   * List user's GitHub repositories
   */
  async listUserRepositories(accessToken: string, page: number = 1, perPage: number = 30): Promise<Repository[]> {
    const octokit = new Octokit({ auth: accessToken });

    try {
      const response = await octokit.repos.listForAuthenticatedUser({
        page,
        per_page: perPage,
        sort: 'updated',
        direction: 'desc',
      });

      return response.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: repo.owner.login,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        default_branch: repo.default_branch,
        language: repo.language,
      }));
    } catch (error: any) {
      console.error('Failed to list GitHub repositories:', error);
      throw new Error(`Failed to list repositories: ${error.message}`);
    }
  }

  /**
   * Save repository connection to database
   */
  async connectRepository(
    userId: string,
    integrationId: string,
    repository: Repository,
    projectId?: string
  ): Promise<any> {
    const { data, error } = await supabase
      .from('github_repositories')
      .upsert({
        user_id: userId,
        integration_id: integrationId,
        project_id: projectId,
        repo_id: repository.id,
        repo_full_name: repository.full_name,
        repo_name: repository.name,
        repo_owner: repository.owner,
        repo_url: repository.html_url,
        default_branch: repository.default_branch,
        is_private: repository.private,
        description: repository.description,
        language: repository.language,
        sync_status: 'idle',
      }, {
        onConflict: 'user_id,repo_full_name',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save repository: ${error.message}`);
    }

    return data;
  }

  /**
   * Clone repository to E2B sandbox
   */
  async cloneToSandbox(
    repoUrl: string,
    accessToken: string,
    sandboxId: string
  ): Promise<{ success: boolean; path: string; error?: string }> {
    let sandbox: Sandbox | null = null;

    try {
      // Get or create sandbox
      sandbox = await Sandbox.create(sandboxId);

      // Clone repository with authentication
      const authUrl = repoUrl.replace('https://github.com/', `https://${accessToken}@github.com/`);
      const cloneCommand = `git clone ${authUrl} /home/user/repo`;

      const result = await sandbox.commands.run(cloneCommand);

      if (result.exitCode !== 0) {
        throw new Error(`Git clone failed: ${result.stderr || result.stdout}`);
      }

      return {
        success: true,
        path: '/home/user/repo',
      };
    } catch (error: any) {
      console.error('Repository clone error:', error);
      return {
        success: false,
        path: '',
        error: error.message,
      };
    }
  }

  /**
   * Detect framework from repository contents
   */
  async detectFramework(sandbox: Sandbox, repoPath: string = '/home/user/repo'): Promise<FrameworkDetection> {
    try {
      // Check for package.json (JavaScript/TypeScript projects)
      const packageJsonResult = await sandbox.commands.run(`cat ${repoPath}/package.json 2>/dev/null || echo "not_found"`);

      if (!packageJsonResult.stdout.includes('not_found')) {
        const packageJson = JSON.parse(packageJsonResult.stdout);
        
        // Detect package manager
        let packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm';
        const lockFileCheck = await sandbox.commands.run(`cd ${repoPath} && ls -1 | grep -E "yarn.lock|pnpm-lock.yaml|package-lock.json"`);
        
        if (lockFileCheck.stdout.includes('pnpm-lock.yaml')) {
          packageManager = 'pnpm';
        } else if (lockFileCheck.stdout.includes('yarn.lock')) {
          packageManager = 'yarn';
        }

        // Detect framework
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.next || packageJson.scripts?.dev?.includes('next')) {
          return {
            framework: 'nextjs',
            packageManager,
            buildCommand: 'npm run build',
            startCommand: 'npm run dev',
            port: 3000,
            version: deps.next,
          };
        }
        
        if (deps.react && !deps.next) {
          return {
            framework: 'react',
            packageManager,
            buildCommand: 'npm run build',
            startCommand: packageJson.scripts?.dev || packageJson.scripts?.start || 'npm start',
            port: deps.vite ? 5173 : 3000,
            version: deps.react,
          };
        }
        
        if (deps.vue) {
          return {
            framework: 'vue',
            packageManager,
            buildCommand: 'npm run build',
            startCommand: 'npm run dev',
            port: 5173,
            version: deps.vue,
          };
        }
        
        if (deps['@angular/core']) {
          return {
            framework: 'angular',
            packageManager,
            buildCommand: 'npm run build',
            startCommand: 'npm start',
            port: 4200,
            version: deps['@angular/core'],
          };
        }
        
        if (deps.express) {
          return {
            framework: 'express',
            packageManager,
            startCommand: packageJson.scripts?.start || 'node index.js',
            port: 3000,
            version: deps.express,
          };
        }
      }

      // Check for Python projects
      const requirementsCheck = await sandbox.commands.run(`test -f ${repoPath}/requirements.txt && echo "found" || echo "not_found"`);
      const pyprojectCheck = await sandbox.commands.run(`test -f ${repoPath}/pyproject.toml && echo "found" || echo "not_found"`);

      if (requirementsCheck.stdout.includes('found') || pyprojectCheck.stdout.includes('found')) {
        const mainPyCheck = await sandbox.commands.run(`grep -l "FastAPI\\|from fastapi" ${repoPath}/*.py 2>/dev/null || echo "not_found"`);
        
        if (!mainPyCheck.stdout.includes('not_found')) {
          return {
            framework: 'fastapi',
            packageManager: pyprojectCheck.stdout.includes('found') ? 'poetry' : 'pip',
            startCommand: 'uvicorn main:app --reload',
            port: 8000,
          };
        }
      }

      return {
        framework: 'unknown',
        packageManager: 'unknown',
      };
    } catch (error: any) {
      console.error('Framework detection error:', error);
      return {
        framework: 'unknown',
        packageManager: 'unknown',
      };
    }
  }

  /**
   * Install dependencies in sandbox
   */
  async installDependencies(
    sandbox: Sandbox,
    repoPath: string = '/home/user/repo',
    packageManager: string = 'npm'
  ): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      let installCommand: string;
      
      switch (packageManager) {
        case 'pnpm':
          installCommand = 'pnpm install';
          break;
        case 'yarn':
          installCommand = 'yarn install';
          break;
        case 'pip':
          installCommand = 'pip install -r requirements.txt';
          break;
        case 'poetry':
          installCommand = 'poetry install';
          break;
        default:
          installCommand = 'npm install';
      }

      const result = await sandbox.commands.run(`cd ${repoPath} && ${installCommand}`, {
        timeoutMs: 300000, // 5 minutes timeout
      });

      if (result.exitCode !== 0) {
        return {
          success: false,
          output: result.stdout,
          error: result.stderr,
        };
      }

      return {
        success: true,
        output: result.stdout,
      };
    } catch (error: any) {
      console.error('Dependency installation error:', error);
      return {
        success: false,
        output: '',
        error: error.message,
      };
    }
  }

  /**
   * Start preview server in sandbox using helper script
   */
  async startPreviewServer(
    sandbox: Sandbox,
    framework: FrameworkDetection,
    repoPath: string = '/home/user/repo'
  ): Promise<{ success: boolean; url?: string; port?: number; error?: string }> {
    try {
      const port = framework.port || 3000;

      console.log(`🚀 Starting preview server for ${framework.framework} on port ${port}...`);

      // Use the compile_fullstack.sh script to start server in background
      const startCommand = `source /usr/local/bin/compile_fullstack.sh && start_server_background "${repoPath}" ${port} /tmp/server.log`;
      
      const result = await sandbox.commands.run(startCommand, {
        timeoutMs: 90000, // 90 seconds timeout for installation + startup
      });

      // Check if start was successful
      if (result.exitCode === 0) {
        console.log('✅ Preview server started successfully');
        
        return {
          success: true,
          port,
          url: `http://localhost:${port}`,
        };
      } else {
        // Get server logs for debugging
        const logs = await sandbox.commands.run('cat /tmp/server.log 2>/dev/null || echo "No logs available"');
        
        console.error('❌ Preview server failed to start:', result.stderr);
        console.error('Server logs:', logs.stdout);
        
        return {
          success: false,
          error: `Server failed to start: ${result.stderr || 'Unknown error'}`,
        };
      }
    } catch (error: any) {
      console.error('Preview server start error:', error);
      
      // Try to get logs for debugging
      try {
        const logs = await sandbox.commands.run('cat /tmp/server.log 2>/dev/null || echo "No logs available"');
        console.error('Server logs:', logs.stdout);
      } catch (logError) {
        console.error('Could not retrieve server logs');
      }
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user's connected repositories from database
   */
  async getUserRepositories(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('github_repositories')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user repositories: ${error.message}`);
    }

    return data || [];
  }
}

export const githubRepositoryService = new GitHubRepositoryService();

