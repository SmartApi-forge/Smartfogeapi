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
  framework: 'nextjs' | 'react' | 'vue' | 'angular' | 'express' | 'fastapi' | 'flask' | 'django' | 'python' | 'unknown';
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
    sandbox: Sandbox
  ): Promise<{ success: boolean; path: string; error?: string }> {
    try {
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
      // PRIORITY 1: Check for React/Node.js projects first (package.json)
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

      // PRIORITY 2: Check for Python projects (secondary to React/Node.js)
      const requirementsCheck = await sandbox.commands.run(`test -f ${repoPath}/requirements.txt && echo "found" || echo "not_found"`);
      const pyprojectCheck = await sandbox.commands.run(`test -f ${repoPath}/pyproject.toml && echo "found" || echo "not_found"`);

      if (requirementsCheck.stdout.includes('found') || pyprojectCheck.stdout.includes('found')) {
        const packageManager = pyprojectCheck.stdout.includes('found') ? 'poetry' : 'pip';
        
        // Check for FastAPI
        const fastapiCheck = await sandbox.commands.run(`grep -l "FastAPI\\|from fastapi" ${repoPath}/*.py 2>/dev/null || echo "not_found"`);
        if (!fastapiCheck.stdout.includes('not_found')) {
          return {
            framework: 'fastapi',
            packageManager,
            startCommand: 'uvicorn main:app --reload --host 0.0.0.0',
            port: 8000,
          };
        }
        
        // Check for Flask
        const flaskCheck = await sandbox.commands.run(`grep -l "Flask\\|from flask" ${repoPath}/*.py 2>/dev/null || echo "not_found"`);
        if (!flaskCheck.stdout.includes('not_found')) {
          return {
            framework: 'flask',
            packageManager,
            startCommand: 'flask run --host=0.0.0.0',
            port: 5000,
          };
        }
        
        // Check for Django
        const djangoCheck = await sandbox.commands.run(`test -f ${repoPath}/manage.py && echo "found" || echo "not_found"`);
        if (djangoCheck.stdout.includes('found')) {
          return {
            framework: 'django',
            packageManager,
            startCommand: 'python manage.py runserver 0.0.0.0:8000',
            port: 8000,
          };
        }
        
        // Generic Python project - try to find main entry point
        const mainPyCheck = await sandbox.commands.run(`test -f ${repoPath}/main.py && echo "main.py" || test -f ${repoPath}/app.py && echo "app.py" || echo "not_found"`);
        if (!mainPyCheck.stdout.includes('not_found')) {
          const entryPoint = mainPyCheck.stdout.trim();
          return {
            framework: 'python',
            packageManager,
            startCommand: `python ${entryPoint}`,
            port: 8000, // Default port for Python web apps
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
   * Install dependencies in sandbox with automatic fallback to --legacy-peer-deps
   */
  async installDependencies(
    sandbox: Sandbox,
    packageManager: string = 'npm',
    repoPath: string = '/home/user/repo'
  ): Promise<{ success: boolean; output: string; error?: string; fallbackUsed?: boolean }> {
    try {
      let installCommand: string;
      let fallbackCommand: string | null = null;
      
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
          fallbackCommand = 'npm install --legacy-peer-deps'; // Fallback for npm
      }

      console.log(`📦 Running: ${installCommand}`);
      const result = await sandbox.commands.run(`cd ${repoPath} && ${installCommand}`, {
        timeoutMs: 600000, // 10 minutes timeout (Next.js 15 can take long)
      });

      // If successful, return immediately
      if (result.exitCode === 0) {
        console.log('✅ Dependencies installed successfully');
        return {
          success: true,
          output: result.stdout,
        };
      }

      // If failed, log the error details
      const errorDetails = result.stderr || result.stdout || 'Unknown error';
      console.error('❌ Installation failed with error:', errorDetails);

      // Try fallback for npm if available
      if (fallbackCommand && packageManager === 'npm') {
        console.log(`🔄 Retrying with fallback: ${fallbackCommand}`);
        
        const fallbackResult = await sandbox.commands.run(`cd ${repoPath} && ${fallbackCommand}`, {
          timeoutMs: 600000, // 10 minutes timeout
        });

        if (fallbackResult.exitCode === 0) {
          console.log('✅ Dependencies installed successfully with --legacy-peer-deps');
          return {
            success: true,
            output: fallbackResult.stdout,
            fallbackUsed: true,
          };
        }

        // Both attempts failed
        const fallbackError = fallbackResult.stderr || fallbackResult.stdout || 'Unknown error';
        console.error('❌ Fallback also failed:', fallbackError);
        
        return {
          success: false,
          output: result.stdout + '\n\n--- Fallback attempt ---\n' + fallbackResult.stdout,
          error: `Primary: ${errorDetails}\n\nFallback (--legacy-peer-deps): ${fallbackError}`,
        };
      }

      // No fallback available or not npm
      return {
        success: false,
        output: result.stdout,
        error: errorDetails,
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
    repoPath: string = '/home/user/repo',
    skipInstall: boolean = false
  ): Promise<{ success: boolean; url?: string; port?: number; error?: string; installOutput?: string }> {
    try {
      const port = framework.port || 3000;

      console.log(`🚀 Starting preview server for ${framework.framework} on port ${port}...`);

      // Step 1: Install dependencies first (with generous timeout) - unless skipInstall is true
      if (!skipInstall) {
        console.log('📦 Installing dependencies...');
        const installResult = await this.installDependencies(sandbox, framework.packageManager, repoPath);
        
        if (!installResult.success) {
          console.error('❌ Dependency installation failed:', installResult.error);
          // Return detailed error for debugging
          return {
            success: false,
            error: installResult.error || 'Unknown installation error',
            installOutput: installResult.output, // Include npm output for debugging
          };
        }
        
        if (installResult.fallbackUsed) {
          console.log('⚠️ Dependencies installed using --legacy-peer-deps fallback');
        } else {
          console.log('✅ Dependencies installed successfully');
        }
      } else {
        console.log('⏭️  Skipping dependency installation (already done)');
      }

      // Step 2: Start the dev server in background (longer timeout for first build)
      // Note: Next.js 15 + Tailwind v4 can take 10-15 minutes for first build
      // The compile script itself waits 10 minutes (600s), so we give 20 mins total
      const startCommand = `source /usr/local/bin/compile_fullstack.sh && start_server_background "${repoPath}" ${port} /tmp/server.log`;
      
      const result = await sandbox.commands.run(startCommand, {
        timeoutMs: 1200000, // 20 minutes timeout for Next.js 15 first build + server startup
      });

      // Check if start was successful
      if (result.exitCode === 0) {
        console.log('✅ Preview server started successfully');
        
        // Get the E2B sandbox URL (not localhost!)
        const sandboxUrl = `https://${sandbox.getHost(port)}`;
        console.log(`📡 Preview URL: ${sandboxUrl}`);
        
        return {
          success: true,
          port,
          url: sandboxUrl,
        };
      } else {
        // Get server logs for debugging
        const logs = await sandbox.commands.run('cat /tmp/server.log 2>/dev/null | tail -100 || echo "No logs available"');
        
        // Combine all error information
        const errorParts = [];
        
        if (result.stderr && result.stderr.trim()) {
          errorParts.push(`Start command stderr: ${result.stderr.trim()}`);
        }
        
        if (result.stdout && result.stdout.trim()) {
          errorParts.push(`Start command stdout: ${result.stdout.trim()}`);
        }
        
        if (logs.stdout && logs.stdout.trim() !== 'No logs available') {
          errorParts.push(`Server logs (last 100 lines): ${logs.stdout.trim()}`);
        }
        
        const errorMessage = errorParts.length > 0 
          ? errorParts.join('\n\n')
          : `Server failed with exit code ${result.exitCode}`;
        
        console.error('❌ Preview server failed to start:');
        console.error(errorMessage);
        
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error: any) {
      console.error('Preview server start error:', error);
      
      // Try to get logs for debugging
      let serverLogs = '';
      try {
        const logs = await sandbox.commands.run('cat /tmp/server.log 2>/dev/null | tail -100 || echo "No logs available"');
        serverLogs = logs.stdout;
        console.error('Server logs:', serverLogs);
      } catch (logError) {
        console.error('Could not retrieve server logs');
      }
      
      const errorMessage = error.message + (serverLogs && serverLogs !== 'No logs available' 
        ? `\n\nServer logs:\n${serverLogs}` 
        : '');
      
      return {
        success: false,
        error: errorMessage,
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

