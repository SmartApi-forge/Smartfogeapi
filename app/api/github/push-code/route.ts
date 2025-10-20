import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, repoFullName, branch, files } = body;

    if (!projectId || !repoFullName || !branch || !files) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get auth token from cookies
    const cookieStore = await cookies();
    const authToken = cookieStore.get('sb-access-token')?.value || 
                     cookieStore.get('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0] + '-auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized - No auth token found' },
        { status: 401 }
      );
    }

    // Create Supabase client with service role for querying
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify auth token and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(authToken);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Get GitHub access token from user_integrations table (NOT github_integrations)
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'github')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration?.access_token) {
      console.error('Failed to get GitHub integration:', integrationError);
      return NextResponse.json(
        { error: 'GitHub not connected. Please reconnect your GitHub account.' },
        { status: 401 }
      );
    }

    const [owner, repo] = repoFullName.split('/');
    const accessToken = integration.access_token;

    // Get the latest commit SHA for the branch
    const branchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!branchResponse.ok) {
      throw new Error('Failed to fetch branch info');
    }

    const branchData = await branchResponse.json();
    const latestCommitSha = branchData.object.sha;

    // Get the tree SHA from the latest commit
    const commitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`,
      {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each file
    const tree = await Promise.all(
      Object.entries(files).map(async ([path, content]) => {
        const blobResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
              encoding: 'utf-8',
            }),
          }
        );

        const blobData = await blobResponse.json();

        return {
          path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blobData.sha,
        };
      })
    );

    // Create a new tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree,
        }),
      }
    );

    const treeData = await treeResponse.json();

    // Create a new commit
    const newCommitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Push code from SmartAPIForge project`,
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      }
    );

    const newCommitData = await newCommitResponse.json();

    // Update the branch reference
    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: newCommitData.sha,
          force: false,
        }),
      }
    );

    if (!updateRefResponse.ok) {
      throw new Error('Failed to update branch');
    }

    return NextResponse.json({
      success: true,
      commitSha: newCommitData.sha,
      message: `Code pushed to ${branch} branch`,
    });

  } catch (error: any) {
    console.error('Error pushing code to GitHub:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to push code' },
      { status: 500 }
    );
  }
}
