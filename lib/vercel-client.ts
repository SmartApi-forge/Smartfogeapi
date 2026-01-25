/**
 * Vercel API Client
 * Wrapper for Vercel REST API using Platforms approach
 */

const VERCEL_API_URL = 'https://api.vercel.com';

export interface VercelFile {
  file: string;
  data: string;
  encoding?: 'base64' | 'utf-8';
}

export interface VercelDeployment {
  id: string;
  url: string;
  readyState: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  status: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  alias?: string[];
  meta?: Record<string, any>;
}

export interface VercelProject {
  id: string;
  name: string;
  framework?: string;
}

export class VercelClient {
  private accessToken: string;
  private teamId?: string;

  constructor(accessToken: string, teamId?: string) {
    if (!accessToken) {
      throw new Error('Vercel access token is required');
    }
    this.accessToken = accessToken;
    this.teamId = teamId;
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private getTeamQuery(): string {
    return this.teamId ? `?teamId=${this.teamId}` : '';
  }

  /**
   * Create a new Vercel project
   */
  async createProject(name: string, framework?: string): Promise<VercelProject> {
    const response = await fetch(
      `${VERCEL_API_URL}/v10/projects${this.getTeamQuery()}`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name,
          framework: framework || 'nextjs',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to create project: ${errorText}`;
      
      if (response.status === 401) {
        errorMessage = 'Vercel authentication failed. Please check your VERCEL_ACCESS_TOKEN is valid and has the correct permissions.';
      } else if (response.status === 403) {
        errorMessage = 'Vercel access denied. Your token may not have permission to create projects.';
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Deploy files to Vercel
   */
  async createDeployment(
    projectName: string,
    files: VercelFile[],
    options?: {
      buildCommand?: string;
      outputDirectory?: string;
      installCommand?: string;
      framework?: string;
      target?: 'production' | 'preview';
    }
  ): Promise<VercelDeployment> {
    const response = await fetch(
      `${VERCEL_API_URL}/v13/deployments${this.getTeamQuery()}`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: projectName,
          project: projectName,
          files,
          public: true, // Make deployment publicly accessible
          projectSettings: {
            framework: options?.framework || 'nextjs',
            buildCommand: options?.buildCommand || 'npm run build',
            outputDirectory: options?.outputDirectory || '.next',
            installCommand: options?.installCommand || 'npm install',
          },
          target: options?.target || 'production',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to create deployment: ${errorText}`;
      
      if (response.status === 401) {
        errorMessage = 'Vercel authentication failed. Please check your VERCEL_ACCESS_TOKEN is valid and has the correct permissions.';
      } else if (response.status === 403) {
        errorMessage = 'Vercel access denied. Your token may not have permission to create deployments.';
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Get deployment status
   */
  async getDeployment(deploymentId: string): Promise<VercelDeployment> {
    const response = await fetch(
      `${VERCEL_API_URL}/v13/deployments/${deploymentId}${this.getTeamQuery()}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get deployment: ${error}`);
    }

    return response.json();
  }

  /**
   * Get deployment events/logs
   * Returns all build logs and events from the deployment
   */
  async getDeploymentEvents(deploymentId: string): Promise<any[]> {
    const teamQuery = this.teamId ? `&teamId=${this.teamId}` : '';
    
    // Use builds=1 to get build logs, limit=-1 for all logs
    const response = await fetch(
      `${VERCEL_API_URL}/v3/deployments/${deploymentId}/events?builds=1&limit=-1${teamQuery}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get deployment events: ${error}`);
    }

    // Try parsing as JSON first (array response)
    try {
      const json = await response.json();
      if (Array.isArray(json)) {
        console.log(`Got ${json.length} events from Vercel API (JSON array)`);
        return json;
      }
      return [];
    } catch (jsonError) {
      // If JSON parsing fails, try NDJSON format
      const text = await response.text();
      
      if (!text || !text.trim()) {
        return [];
      }

      const events = text
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return null;
          }
        })
        .filter(Boolean);
      
      console.log(`Got ${events.length} events from Vercel API (NDJSON)`);
      return events;
    }
  }

  /**
   * Get deployment build logs
   * Returns raw Vercel build output with timestamps
   */
  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    try {
      const events = await this.getDeploymentEvents(deploymentId);
      const logs: string[] = [];

      console.log(`Processing ${events.length} events for deployment ${deploymentId}`);
      
      // Log first event structure for debugging
      if (events.length > 0) {
        console.log('Sample event structure:', JSON.stringify(events[0], null, 2).substring(0, 500));
      }

      for (const event of events) {
        // Format timestamp from event (milliseconds since epoch)
        const timestamp = event.created || event.payload?.created || event.payload?.date;
        let timeStr = '';
        
        if (timestamp) {
          const date = new Date(timestamp);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const seconds = date.getSeconds().toString().padStart(2, '0');
          const ms = date.getMilliseconds().toString().padStart(3, '0');
          timeStr = `${hours}:${minutes}:${seconds}.${ms}`;
        }

        // Handle different event types - keep raw output
        if (event.type === 'stdout' || event.type === 'stderr') {
          const text = event.payload?.text || event.text || '';
          if (text.trim()) {
            // Each line is a separate log entry
            const lines = text.split('\n');
            lines.forEach((line: string) => {
              if (line.trim()) {
                logs.push(timeStr ? `${timeStr} ${line}` : line);
              }
            });
          }
        } else if (event.type === 'command') {
          const command = event.payload?.text || event.text || '';
          if (command.trim()) {
            logs.push(timeStr ? `${timeStr} Running "${command}"` : `Running "${command}"`);
          }
        } else if (event.type === 'delimiter') {
          // Delimiter events contain important state changes
          const text = event.payload?.text || event.text || '';
          if (text.trim()) {
            logs.push(timeStr ? `${timeStr} ${text}` : text);
          }
        }
      }

      console.log(`Extracted ${logs.length} log lines from ${events.length} events`);
      return logs;
    } catch (error) {
      console.error('Failed to parse deployment logs:', error);
      return [];
    }
  }

  /**
   * Create a project transfer request (for user to claim)
   */
  async createProjectTransfer(projectId: string): Promise<{
    code: string;
    claimUrl: string;
  }> {
    const response = await fetch(
      `${VERCEL_API_URL}/v9/projects/${projectId}/transfer-request${this.getTeamQuery()}`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create transfer request: ${error}`);
    }

    const data = await response.json();
    const claimUrl = `https://vercel.com/claim-deployment?code=${data.code}`;

    return {
      code: data.code,
      claimUrl,
    };
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    const response = await fetch(
      `${VERCEL_API_URL}/v13/deployments/${deploymentId}${this.getTeamQuery()}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      // If deployment is already deleted or not found (404), treat as success
      if (response.status === 404) {
        console.log(`Deployment ${deploymentId} already deleted or not found`);
        return;
      }
      
      const error = await response.text();
      throw new Error(`Failed to delete deployment: ${error}`);
    }
  }

  /**
   * Disable deployment protection for a project
   */
  async disableDeploymentProtection(projectNameOrId: string): Promise<void> {
    const response = await fetch(
      `${VERCEL_API_URL}/v9/projects/${projectNameOrId}${this.getTeamQuery()}`,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          ssoProtection: null, // Disable deployment protection
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to disable deployment protection: ${error}`);
      // Don't throw - deployment protection is not critical
      // The deployment itself succeeded, just protection settings didn't update
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    const response = await fetch(
      `${VERCEL_API_URL}/v9/projects/${projectId}${this.getTeamQuery()}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete project: ${error}`);
    }
  }
}

/**
 * Create a singleton Vercel client
 */
export function createVercelClient(): VercelClient {
  const accessToken = process.env.VERCEL_ACCESS_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!accessToken) {
    throw new Error('VERCEL_ACCESS_TOKEN environment variable is required');
  }

  return new VercelClient(accessToken, teamId);
}

