/**
 * GitHub Repository Management Service
 * Handles repository operations: list, clone, install dependencies, detect framework
 */

import { Octokit } from '@octokit/rest';
import type { Sandbox } from '../lib/daytona-client';
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
   * Clone repository to Daytona sandbox using git operations
   */
  async cloneToSandbox(
    repoUrl: string,
    accessToken: string,
    sandbox: Sandbox
  ): Promise<{ success: boolean; path: string; error?: string }> {
    try {
      // Clone repository with authentication using Daytona's git API
      // Daytona path: workspace/repo (relative to sandbox home)
      await sandbox.git.clone(
        repoUrl,
        'workspace/repo',
        undefined, // branch (optional)
        undefined, // depth (optional)
        'git', // username for GitHub  
        accessToken // personal access token
      );

      return {
        success: true,
        path: 'workspace/repo', // Daytona uses relative paths from home
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
  async detectFramework(sandbox: Sandbox, repoPath: string = 'workspace/repo'): Promise<FrameworkDetection> {
    try {
      console.log('🔍 Starting framework detection...');
      
      // PRIORITY 1: Check for React/Node.js projects first (package.json)
      // Daytona: Use fs.downloadFile to read package.json
      console.log(`📄 Attempting to read: ${repoPath}/package.json`);
      const packageJsonContent = await sandbox.fs.downloadFile(`${repoPath}/package.json`);
      const packageJsonText = packageJsonContent.toString('utf-8');

      if (packageJsonText && packageJsonText.trim() !== '') {
        const packageJson = JSON.parse(packageJsonText);
        
        // Detect package manager using Daytona fs.findFiles
        let packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm';
        const files = await sandbox.fs.findFiles(repoPath, '*lock*');
        const fileNames = files;
        
        if (fileNames.includes('pnpm-lock.yaml')) {
          packageManager = 'pnpm';
        } else if (fileNames.includes('yarn.lock')) {
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
      // Use Daytona fs.findFiles to check for Python files
      const reqFiles = await sandbox.fs.findFiles(repoPath, 'requirements.txt');
      const pyFiles = await sandbox.fs.findFiles(repoPath, 'pyproject.toml');
      const hasRequirements = reqFiles.length > 0;
      const hasPyproject = pyFiles.length > 0;

      if (hasRequirements || hasPyproject) {
        const packageManager = hasPyproject ? 'poetry' : 'pip';
        
        // Check for FastAPI - search in Python files using process.executeCommand
        const fastapiCheck = await sandbox.process.executeCommand(
          `grep -l "FastAPI\\|from fastapi" ${repoPath}/*.py 2>/dev/null || echo "not_found"`
        );
        if (!fastapiCheck.result.includes('not_found')) {
          return {
            framework: 'fastapi',
            packageManager,
            startCommand: 'uvicorn main:app --reload --host 0.0.0.0',
            port: 8000,
          };
        }
        
        // Check for Flask
        const flaskCheck = await sandbox.process.executeCommand(
          `grep -l "Flask\\|from flask" ${repoPath}/*.py 2>/dev/null || echo "not_found"`
        );
        if (!flaskCheck.result.includes('not_found')) {
          return {
            framework: 'flask',
            packageManager,
            startCommand: 'flask run --host=0.0.0.0',
            port: 5000,
          };
        }
        
        // Check for Django - check if manage.py exists
        const djangoFiles = await sandbox.fs.findFiles(repoPath, 'manage.py');
        const hasDjango = djangoFiles.length > 0;
        if (hasDjango) {
          return {
            framework: 'django',
            packageManager,
            startCommand: 'python manage.py runserver 0.0.0.0:8000',
            port: 8000,
          };
        }
        
        // Generic Python project - try to find main entry point
        const mainPyFiles = await sandbox.fs.findFiles(repoPath, 'main.py');
        const appPyFiles = await sandbox.fs.findFiles(repoPath, 'app.py');
        const hasMainPy = mainPyFiles.length > 0;
        const hasAppPy = appPyFiles.length > 0;
        
        if (hasMainPy || hasAppPy) {
          const entryPoint = hasMainPy ? 'main.py' : 'app.py';
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
    repoPath: string = 'workspace/repo'
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
      
      // Use Daytona process.executeCommand with increased memory
      let result: any;
      try {
        result = await sandbox.process.executeCommand(
          installCommand,
          repoPath,
          { NODE_OPTIONS: '--max-old-space-size=6144' }, // 6GB Node.js memory (within 8GB workspace)
          600 // 10 minutes timeout in seconds
        );

        // If successful, return immediately
        if (result.exitCode === 0) {
          console.log('✅ Dependencies installed successfully');
          return {
            success: true,
            output: result.result,
          };
        }
      } catch (cmdError: any) {
        console.error('❌ Command failed with exception:', cmdError.message);
        console.error('📄 Command output:', cmdError.result || 'No output');
        
        // Extract output from the error if available
        result = {
          exitCode: cmdError.exitCode || 1,
          result: cmdError.result || '',
        };
      }

      // If failed, log the error details
      const errorDetails = result.result || 'Unknown error';
      console.error('❌ Installation failed:', errorDetails);

      // Try fallback for npm if available
      if (fallbackCommand && packageManager === 'npm') {
        console.log(`🔄 Retrying with fallback: ${fallbackCommand}`);
        
        try {
          const fallbackResult = await sandbox.process.executeCommand(
            fallbackCommand,
            repoPath,
            { NODE_OPTIONS: '--max-old-space-size=6144' },
            600 // 10 minutes
          );

          if (fallbackResult.exitCode === 0) {
            console.log('✅ Dependencies installed successfully with --legacy-peer-deps');
            return {
              success: true,
              output: fallbackResult.result,
              fallbackUsed: true,
            };
          }

          // Fallback completed but failed
          const fallbackError = fallbackResult.result || 'Unknown error';
          console.error('❌ Fallback also failed:', fallbackError);
          
          return {
            success: false,
            output: result.result + '\n\n--- Fallback attempt ---\n' + fallbackResult.result,
            error: `Primary: ${errorDetails}\n\nFallback (--legacy-peer-deps): ${fallbackError}`,
          };
        } catch (fallbackError: any) {
          console.error('❌ Fallback threw exception:', fallbackError.message);
          
          return {
            success: false,
            output: result.result + '\n\n--- Fallback attempt ---\n' + (fallbackError.result || ''),
            error: `Primary: ${errorDetails}\n\nFallback exception: ${fallbackError.message}`,
          };
        }
      }

      // No fallback available or not npm
      return {
        success: false,
        output: result.result || '',
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
   * Start preview server in Daytona sandbox
   */
  async startPreviewServer(
    sandbox: Sandbox,
    framework: FrameworkDetection,
    repoPath: string = 'workspace/repo',
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

      // Step 2: Start the dev server in background using Daytona sessions
      const sessionId = `dev-server-${Date.now()}`;
      const packageManager = framework.packageManager || 'npm';
      
      // Determine start command based on package manager
      let startCmd: string;
      switch (packageManager) {
        case 'pnpm':
          startCmd = 'pnpm run dev';
          break;
        case 'yarn':
          startCmd = 'yarn dev';
          break;
        case 'pip':
        case 'poetry':
          startCmd = framework.startCommand || 'python main.py';
          break;
        default:
          startCmd = 'npm run dev';
      }
      
      // Create session for background process
      await sandbox.process.createSession(sessionId);
      
      console.log(`🚀 Starting dev server in ${repoPath} with command: ${startCmd}`);
      console.log(`📍 Working directory: ${repoPath}`);
      
      // Start server in background from the repository directory
      // Use full command with cd to ensure we're in the right directory
      const fullCommand = `cd ${repoPath} && ${startCmd}`;
      console.log(`📝 Full command: ${fullCommand}`);
      
      const command = await sandbox.process.executeSessionCommand(sessionId, {
        command: fullCommand,
        runAsync: true, // Don't wait for completion
      });
      
      console.log(`✅ Command started with ID: ${command.cmdId}`);

      console.log(`⏳ Waiting for dev server to start...`);
      
      // Wait longer for Next.js apps (30 seconds)
      // They need time to compile and start
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Check if process is still running
      console.log(`🔍 Checking if server process is running...`);
      const checkProcess = await sandbox.process.executeCommand(
        `ps aux | grep -E "${startCmd.split(' ')[0]}" | grep -v grep || echo "no_process"`
      );
      
      if (checkProcess.result.includes('no_process')) {
        console.error('❌ Dev server process not found');
      } else {
        console.log('✅ Dev server process is running');
        console.log('Process info:', checkProcess.result.substring(0, 200));
      }
      
      // Get session command logs for debugging
      try {
        console.log(`📜 Getting command logs for command ID: ${command.cmdId}`);
        const logs = await sandbox.process.getSessionCommandLogs(sessionId, command.cmdId);
        console.log('📝 STDOUT:', logs.stdout?.substring(0, 500));
        console.log('🔴 STDERR:', logs.stderr?.substring(0, 500));
        
        // Check for common errors
        if (logs.stderr && logs.stderr.includes('EADDRINUSE')) {
          console.error('⚠️ Port already in use!');
        }
        if (logs.stderr && logs.stderr.includes('Cannot find module')) {
          console.error('⚠️ Missing dependencies!');
        }
      } catch (logError) {
        console.error('Could not get session logs:', logError);
      }
      
      // Get Daytona preview URL using SDK method
      console.log(`🔗 Getting preview link for port ${port}...`);
      const previewLink = await sandbox.getPreviewLink(port);
      console.log(`📡 Preview URL: ${previewLink.url}`);
      
      // Check if port is actually listening
      const portCheck = await sandbox.process.executeCommand(
        `netstat -tuln | grep :${port} || ss -tuln | grep :${port} || echo "port_not_listening"`
      );
      
      if (portCheck.result.includes('port_not_listening')) {
        console.warn(`⚠️ Port ${port} is not listening yet`);
      } else {
        console.log(`✅ Port ${port} is listening`);
      }
      
      return {
        success: true,
        port,
        url: previewLink.url,
      };
    } catch (error: any) {
      console.error('Preview server start error:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to start preview server',
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

  /**
   * Get branches for a repository
   */
  async getBranches(accessToken: string, owner: string, repo: string): Promise<any[]> {
    const octokit = new Octokit({ auth: accessToken });

    try {
      const response = await octokit.repos.listBranches({
        owner,
        repo,
        per_page: 100, // Get up to 100 branches
      });

      return response.data.map(branch => ({
        name: branch.name,
        sha: branch.commit.sha,
        protected: branch.protected,
      }));
    } catch (error: any) {
      console.error('Failed to fetch GitHub branches:', error);
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }
}

export const githubRepositoryService = new GitHubRepositoryService();

