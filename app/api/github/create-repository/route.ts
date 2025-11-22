import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';
import { githubOAuth } from '@/lib/github-oauth';

/**
 * Validate GitHub token by making a lightweight API call
 */
async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Create Supabase server client with cookies adapter
    const supabase = await createRouteHandlerClient();
    
    // Get user session - handled automatically by server client
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ 
        error: 'Not authenticated. Please sign in.',
        requiresAuth: true 
      }, { status: 401 });
    }

    // Get request body
    const { repositoryName, gitScope, organization } = await request.json();

    if (!repositoryName || !gitScope) {
      return NextResponse.json({ error: 'Repository name and git scope are required' }, { status: 400 });
    }

    // Get GitHub integration for access token
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'github')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json({ 
        error: 'GitHub integration not found. Please connect your GitHub account first.',
        requiresGitHubAuth: true 
      }, { status: 400 });
    }

    // Validate GitHub token before using it
    const isTokenValid = await validateGitHubToken(integration.access_token);
    
    if (!isTokenValid) {
      console.error('GitHub token validation failed for user:', user.id);
      
      // Attempt to use the githubOAuth service to validate/refresh
      // Note: GitHub OAuth doesn't support refresh tokens by default
      // If token is invalid, user needs to re-authenticate
      
      // Mark integration as inactive
      await supabase
        .from('user_integrations')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('provider', 'github');
      
      return NextResponse.json({ 
        error: 'GitHub token is invalid or expired. Please re-authenticate with GitHub.',
        requiresGitHubAuth: true,
        tokenExpired: true
      }, { status: 401 });
    }

    // Initialize Octokit with validated access token
    const octokit = new Octokit({ auth: integration.access_token });

    // Create repository based on git scope
    let createRepoResponse;
    
    if (gitScope === 'personal') {
      // Create repository for authenticated user
      createRepoResponse = await octokit.repos.createForAuthenticatedUser({
        name: repositoryName,
        private: true,
        description: `Repository created from SmartForge project`,
        auto_init: true,
      });
    } else if (gitScope === 'organization') {
      // For organization repos, require explicit organization selection
      if (!organization) {
        // Fetch user's organizations to present for selection
        const orgsResponse = await octokit.orgs.listForAuthenticatedUser();
        
        if (orgsResponse.data.length === 0) {
          return NextResponse.json({ error: 'No organizations found for your account' }, { status: 400 });
        }

        // Return organizations for client to present selection
        return NextResponse.json({ 
          error: 'Organization selection required',
          organizations: orgsResponse.data.map(org => ({
            login: org.login,
            id: org.id,
            avatar_url: org.avatar_url,
            description: org.description
          }))
        }, { status: 400 });
      }

      // Validate user has permissions in the specified organization
      try {
        const membership = await octokit.orgs.getMembershipForAuthenticatedUser({
          org: organization
        });

        // Check if user has admin or repo creation permissions
        if (membership.data.role !== 'admin' && membership.data.state !== 'active') {
          return NextResponse.json({ 
            error: `Insufficient permissions in organization '${organization}'. You need admin or repo creation permissions.` 
          }, { status: 403 });
        }
      } catch (orgError: any) {
        if (orgError.status === 404) {
          return NextResponse.json({ 
            error: `Organization '${organization}' not found or you are not a member.` 
          }, { status: 404 });
        }
        throw orgError;
      }
      
      createRepoResponse = await octokit.repos.createInOrg({
        org: organization,
        name: repositoryName,
        private: true,
        description: `Repository created from SmartForge project`,
        auto_init: true,
      });
    } else {
      return NextResponse.json({ error: 'Invalid git scope' }, { status: 400 });
    }

    const repository = createRepoResponse.data;

    // Save repository to database
    const { data: savedRepo, error: saveError } = await supabase
      .from('github_repositories')
      .insert({
        user_id: user.id,
        integration_id: integration.id,
        repo_id: repository.id,
        repo_full_name: repository.full_name,
        repo_name: repository.name,
        repo_owner: repository.owner.login,
        repo_url: repository.html_url,
        default_branch: repository.default_branch,
        is_private: repository.private,
        description: repository.description,
        language: repository.language,
        sync_status: 'idle',
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save repository to database:', saveError);
      // Don't fail the request if saving to DB fails
    }

    return NextResponse.json({
      success: true,
      repository: {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        html_url: repository.html_url,
        clone_url: repository.clone_url,
        ssh_url: repository.ssh_url,
      }
    });

  } catch (error: any) {
    console.error('GitHub repository creation error:', error);
    
    // Handle specific GitHub API errors
    if (error.status === 401) {
      // Log the authentication failure event
      console.error('GitHub API 401 error - token authentication failed:', {
        message: error.message,
        timestamp: new Date().toISOString(),
      });
      
      return NextResponse.json({ 
        error: 'Authentication failed: invalid or expired GitHub token. Please re-authenticate.',
        requiresGitHubAuth: true,
        tokenExpired: true
      }, { status: 401 });
    }
    
    if (error.status === 422) {
      return NextResponse.json({ 
        error: 'Repository name already exists or is invalid. Please choose a different name.' 
      }, { status: 400 });
    }
    
    if (error.status === 403) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to create repository. Please check your GitHub token permissions.' 
      }, { status: 403 });
    }

    return NextResponse.json({ 
      error: error.message || 'Failed to create repository' 
    }, { status: 500 });
  }
}