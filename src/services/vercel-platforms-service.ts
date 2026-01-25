/**
 * Vercel Platforms Deployment Service
 * Handles deployment using Vercel's Platforms API (no OAuth required)
 */

import { createVercelClient, VercelFile } from '@/lib/vercel-client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Map Vercel deployment status to database status
 * Vercel statuses: QUEUED, BUILDING, READY, ERROR, CANCELED
 * Database allows: building, ready, error, canceled
 */
function mapVercelStatus(vercelStatus: string): string {
  const statusMap: Record<string, string> = {
    'QUEUED': 'building',
    'BUILDING': 'building',
    'READY': 'ready',
    'ERROR': 'error',
    'CANCELED': 'canceled',
  };
  
  return statusMap[vercelStatus] || 'building';
}

export interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  projectId?: string;
  url?: string;
  claimUrl?: string;
  error?: string;
}

export interface DeploymentStatus {
  status: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  url?: string;
  error?: string;
}

class VercelPlatformsService {
  /**
   * Helper to detect if file is binary based on extension
   */
  private isBinaryFile(filename: string): boolean {
    const binaryExtensions = [
      // Images
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
      // Fonts
      '.woff', '.woff2', '.ttf', '.otf', '.eot',
      // Other binary
      '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mp3', '.wav',
    ];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return binaryExtensions.includes(ext);
  }

  /**
   * Package project files for deployment
   */
  private packageFiles(files: Record<string, string>, framework: string): VercelFile[] {
    const vercelFiles: VercelFile[] = [];

    // Add all project files
    for (const [path, content] of Object.entries(files)) {
      const isBinary = this.isBinaryFile(path);
      vercelFiles.push({
        file: path,
        data: content,
        encoding: isBinary ? 'base64' : undefined,
      });
    }

    // Ensure package.json exists
    if (!files['package.json']) {
      vercelFiles.push({
        file: 'package.json',
        data: JSON.stringify({
          name: 'smartforge-project',
          version: '0.1.0',
          private: true,
          scripts: {
            dev: framework === 'nextjs' ? 'next dev' : 'vite',
            build: framework === 'nextjs' ? 'next build' : 'vite build',
            start: framework === 'nextjs' ? 'next start' : 'vite preview',
          },
          dependencies:
            framework === 'nextjs'
              ? {
                  next: 'latest',
                  react: 'latest',
                  'react-dom': 'latest',
                }
              : {
                  react: 'latest',
                  'react-dom': 'latest',
                },
        }, null, 2),
      });
    }

    return vercelFiles;
  }

  /**
   * Deploy a project to Vercel
   */
  async deployProject(
    userId: string,
    projectId: string,
    files: Record<string, string>,
    framework: string = 'nextjs'
  ): Promise<DeploymentResult> {
    try {
      // Check if Vercel token is configured
      if (!process.env.VERCEL_ACCESS_TOKEN) {
        return {
          success: false,
          error: 'VERCEL_ACCESS_TOKEN is not set. Please add it to your environment variables.',
        };
      }

      const vercelClient = createVercelClient();

      // Generate unique project name
      const projectName = `smartforge-${projectId.substring(0, 8)}-${Date.now()}`;

      // Create Vercel project
      console.log('Creating Vercel project:', projectName);
      const project = await vercelClient.createProject(projectName, framework);

      // Package files for deployment
      const vercelFiles = this.packageFiles(files, framework);
      
      // Log file breakdown
      const binaryFiles = vercelFiles.filter(f => f.encoding === 'base64');
      const textFiles = vercelFiles.filter(f => !f.encoding || f.encoding === 'utf-8');
      
      console.log(`📦 Packaging ${vercelFiles.length} files for Vercel deployment:`);
      console.log(`   - ${textFiles.length} text files`);
      console.log(`   - ${binaryFiles.length} binary files (base64 encoded)`);

      // Create deployment
      console.log('Creating deployment...');
      const deployment = await vercelClient.createDeployment(projectName, vercelFiles, {
        framework,
        buildCommand: framework === 'nextjs' ? 'npm run build' : 'vite build',
        outputDirectory: framework === 'nextjs' ? '.next' : 'dist',
        installCommand: 'npm install',
        target: 'production',
      });

      // Disable deployment protection to make it publicly accessible
      console.log('Disabling deployment protection...');
      await vercelClient.disableDeploymentProtection(projectName);

      // Create transfer code for user to claim
      console.log('Creating transfer request for project:', project.id);
      const transfer = await vercelClient.createProjectTransfer(project.id);

      // Save to database with mapped status
      const { error: dbError } = await supabase.from('deployments').insert({
        user_id: userId,
        project_id: projectId,
        vercel_project_id: project.id,
        vercel_deployment_id: deployment.id,
        deployment_url: `https://${deployment.url}`,
        status: mapVercelStatus(deployment.readyState),
        transfer_code: transfer.code,
        claim_url: transfer.claimUrl,
      });

      if (dbError) {
        console.error('Failed to save deployment to database:', dbError);
      }

      return {
        success: true,
        deploymentId: deployment.id,
        projectId: project.id,
        url: `https://${deployment.url}`,
        claimUrl: transfer.claimUrl,
      };
    } catch (error: any) {
      console.error('Deployment error:', error);
      return {
        success: false,
        error: error.message || 'Failed to deploy project',
      };
    }
  }

  /**
   * Get deployment status (without logs - logs are streamed via SSE)
   */
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus> {
    try {
      const vercelClient = createVercelClient();

      // Get deployment status
      const deployment = await vercelClient.getDeployment(deploymentId);

      // Update database with mapped status
      await supabase
        .from('deployments')
        .update({
          status: mapVercelStatus(deployment.readyState),
          updated_at: new Date().toISOString(),
        })
        .eq('vercel_deployment_id', deploymentId);

      return {
        status: deployment.readyState,
        url: deployment.url ? `https://${deployment.url}` : undefined,
      };
    } catch (error: any) {
      console.error('Failed to get deployment status:', error);
      return {
        status: 'ERROR',
        error: error.message,
      };
    }
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(deploymentId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const vercelClient = createVercelClient();

      // Get deployment from database
      const { data: deployment } = await supabase
        .from('deployments')
        .select('*')
        .eq('vercel_deployment_id', deploymentId)
        .eq('user_id', userId)
        .single();

      if (!deployment) {
        return { success: false, error: 'Deployment not found' };
      }

      // Delete from Vercel
      await vercelClient.deleteDeployment(deploymentId);

      // Optionally delete the project if no other deployments
      if (deployment.vercel_project_id) {
        try {
          await vercelClient.deleteProject(deployment.vercel_project_id);
        } catch (error) {
          console.warn('Failed to delete project (might have other deployments):', error);
        }
      }

      // Delete from database (not just mark as canceled)
      const { error: deleteError } = await supabase
        .from('deployments')
        .delete()
        .eq('vercel_deployment_id', deploymentId);

      if (deleteError) {
        console.error('Failed to delete deployment from database:', deleteError);
        throw new Error('Failed to delete deployment from database');
      }

      return { success: true };
    } catch (error: any) {
      console.error('Failed to delete deployment:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete deployment',
      };
    }
  }

  /**
   * Get user's deployments
   */
  async getUserDeployments(userId: string, projectId?: string) {
    const query = supabase
      .from('deployments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (projectId) {
      query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch deployments: ${error.message}`);
    }

    return data;
  }
}

export const vercelPlatformsService = new VercelPlatformsService();

