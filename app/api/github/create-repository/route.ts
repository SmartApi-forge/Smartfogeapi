import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Get user session from cookies
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('sb-access-token');
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify user session with Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(sessionCookie.value);
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get request body
    const { repositoryName, gitScope } = await request.json();

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
      return NextResponse.json({ error: 'GitHub integration not found. Please connect your GitHub account first.' }, { status: 400 });
    }

    // Initialize Octokit with user's access token
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
      // For organization repos, we need to get user's organizations first
      const orgsResponse = await octokit.orgs.listForAuthenticatedUser();
      
      if (orgsResponse.data.length === 0) {
        return NextResponse.json({ error: 'No organizations found for your account' }, { status: 400 });
      }

      // Use the first organization (in a real app, you'd let user choose)
      const orgName = orgsResponse.data[0].login;
      
      createRepoResponse = await octokit.repos.createInOrg({
        org: orgName,
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