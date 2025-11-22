/**
 * Vercel Deployment Service
 * Handles deployment operations to Vercel
 */

import { createClient } from '@supabase/supabase-js';

interface DeploymentConfig {
  projectName: string;
  files: Array<{ file: string; data: string }>;
  framework?: 'nextjs' | 'vite' | 'react' | 'vue' | 'express' | 'nuxt';
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
}

interface DeploymentResult {
  success: boolean;
  url?: string;
  deploymentId?: string;
  error?: string;
}

export class VercelDeployService {
  /**
   * Deploy project to Vercel
   */
  async deployToVercel(
    userId: string,
    projectId: string,
    config: DeploymentConfig
  ): Promise<DeploymentResult> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // 1. Get user's Vercel connection
      const { data: connection, error: connError } = await supabase
        .from('vercel_connections')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (connError || !connection) {
        return {
          success: false,
          error: 'Vercel not connected. Please connect your Vercel account first.',
        };
      }

      const { access_token, team_id } = connection;

      // 2. Check if project already has a Vercel project
      let vercelProjectId: string | null = null;

      const { data: existingDeployment } = await supabase
        .from('deployments')
        .select('vercel_project_id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingDeployment?.vercel_project_id) {
        vercelProjectId = existingDeployment.vercel_project_id;
      } else {
        // Create new Vercel project
        const projectResult = await this.createVercelProject(
          access_token,
          team_id,
          config.projectName,
          config.framework || 'nextjs'
        );

        if (!projectResult.success || !projectResult.projectId) {
          return {
            success: false,
            error: projectResult.error || 'Failed to create Vercel project',
          };
        }

        vercelProjectId = projectResult.projectId;
      }

      // 3. Create deployment
      const deploymentResult = await this.createDeployment(
        access_token,
        team_id,
        vercelProjectId,
        config
      );

      if (!deploymentResult.success) {
        return deploymentResult;
      }

      // 4. Store deployment in database
      const { error: insertError } = await supabase.from('deployments').insert({
        user_id: userId,
        project_id: projectId,
        vercel_project_id: vercelProjectId,
        vercel_deployment_id: deploymentResult.deploymentId!,
        deployment_url: deploymentResult.url!,
        status: 'building',
      });

      if (insertError) {
        console.error('Failed to store deployment:', insertError);
        // Deployment succeeded but failed to store in DB
        return {
          success: true,
          url: deploymentResult.url,
          deploymentId: deploymentResult.deploymentId,
        };
      }

      return deploymentResult;
    } catch (error: any) {
      console.error('Deployment error:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
      };
    }
  }

  /**
   * Create a new Vercel project
   */
  private async createVercelProject(
    accessToken: string,
    teamId: string | null,
    projectName: string,
    framework: string
  ): Promise<{ success: boolean; projectId?: string; error?: string }> {
    try {
      const baseUrl = teamId
        ? `https://api.vercel.com/v10/projects?teamId=${teamId}`
        : 'https://api.vercel.com/v10/projects';

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          framework: framework,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to create Vercel project:', errorText);
        return {
          success: false,
          error: `Failed to create Vercel project: ${response.statusText}`,
        };
      }

      const projectData = await response.json();
      return {
        success: true,
        projectId: projectData.id,
      };
    } catch (error: any) {
      console.error('Create Vercel project error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a deployment on Vercel
   */
  private async createDeployment(
    accessToken: string,
    teamId: string | null,
    projectId: string,
    config: DeploymentConfig
  ): Promise<DeploymentResult> {
    try {
      const deployUrl = teamId
        ? `https://api.vercel.com/v13/deployments?teamId=${teamId}`
        : 'https://api.vercel.com/v13/deployments';

      const response = await fetch(deployUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          files: config.files,
          projectSettings: {
            framework: config.framework || 'nextjs',
            buildCommand: config.buildCommand || 'npm run build',
            outputDirectory: config.outputDirectory || '.next',
            installCommand: config.installCommand || 'npm install',
          },
          target: 'production',
          project: projectId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Deployment failed:', errorText);
        return {
          success: false,
          error: `Deployment failed: ${response.statusText}`,
        };
      }

      const deploymentData = await response.json();
      const deploymentUrl = deploymentData.alias?.[0] || deploymentData.url;

      return {
        success: true,
        url: `https://${deploymentUrl}`,
        deploymentId: deploymentData.id,
      };
    } catch (error: any) {
      console.error('Create deployment error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get deployment status from Vercel
   */
  async getDeploymentStatus(
    userId: string,
    deploymentId: string
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // Get user's Vercel connection
      const { data: connection, error: connError } = await supabase
        .from('vercel_connections')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (connError || !connection) {
        return {
          success: false,
          error: 'Vercel not connected',
        };
      }

      const { access_token, team_id } = connection;

      const statusUrl = team_id
        ? `https://api.vercel.com/v13/deployments/${deploymentId}?teamId=${team_id}`
        : `https://api.vercel.com/v13/deployments/${deploymentId}`;

      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to get deployment status: ${response.statusText}`,
        };
      }

      const data = await response.json();
      
      // Update status in database
      await supabase
        .from('deployments')
        .update({
          status: data.readyState || data.state,
          updated_at: new Date().toISOString(),
        })
        .eq('vercel_deployment_id', deploymentId)
        .eq('user_id', userId);

      return {
        success: true,
        status: data.readyState || data.state,
      };
    } catch (error: any) {
      console.error('Get deployment status error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if user has Vercel connected
   */
  async isVercelConnected(userId: string): Promise<boolean> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('vercel_connections')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    return !!data && !error;
  }

  /**
   * Disconnect Vercel integration
   */
  async disconnectVercel(userId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const { error } = await supabase
        .from('vercel_connections')
        .delete()
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user's deployments
   */
  async getUserDeployments(
    userId: string,
    projectId?: string
  ): Promise<{ success: boolean; deployments?: any[]; error?: string }> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      let query = supabase
        .from('deployments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        deployments: data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export const vercelDeployService = new VercelDeployService();

