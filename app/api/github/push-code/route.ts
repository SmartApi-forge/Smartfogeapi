import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, repoFullName, branch, files, commitMessage } = body;

    if (!projectId || !repoFullName || !branch || !files) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (typeof files !== 'object' || Array.isArray(files)) {
      return NextResponse.json(
        { error: 'Files must be an object with path-content pairs' },
        { status: 400 }
      );
    }

    if (typeof repoFullName !== 'string' || !repoFullName.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid repository format. Expected: owner/repo' },
        { status: 400 }
      );
    }

    // Create Supabase client with user's session
    const supabase = await createRouteHandlerClient();

    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
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

    // Validate and split repoFullName
    const parts = repoFullName.split('/');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      return NextResponse.json(
        { error: 'Invalid repository format. Expected: owner/repo with non-empty parts' },
        { status: 400 }
      );
    }
    const [owner, repo] = parts;
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
      const errorData = await branchResponse.json().catch(() => ({}));
      throw new Error(`Failed to fetch branch info: ${errorData.message || branchResponse.statusText}`);
    }

    const branchData = await branchResponse.json();
    if (!branchData.object?.sha) {
      throw new Error('Invalid branch response structure');
    }
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

    if (!commitResponse.ok) {
      const errorData = await commitResponse.json().catch(() => ({}));
      throw new Error(`Failed to fetch commit: ${errorData.message || commitResponse.statusText}`);
    }

    const commitData = await commitResponse.json();
    if (!commitData.tree?.sha) {
      throw new Error('Invalid commit response structure');
    }
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each file
    const tree = await Promise.all(
      Object.entries(files).map(async ([path, content]) => {
        // Convert content to base64
        const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        const base64Content = Buffer.from(contentString, 'utf-8').toString('base64');
        
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
              content: base64Content,
              encoding: 'base64',
            }),
          }
        );

        if (!blobResponse.ok) {
          const errorText = await blobResponse.text();
          throw new Error(
            `Failed to create blob for file "${path}": ${blobResponse.status} ${blobResponse.statusText}. Response: ${errorText}`
          );
        }

        const blobData = await blobResponse.json();
        
        if (!blobData.sha) {
          throw new Error(
            `Blob creation for file "${path}" succeeded but returned no SHA. Response: ${JSON.stringify(blobData)}`
          );
        }

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

    if (!treeResponse.ok) {
      const errorText = await treeResponse.text();
      throw new Error(
        `Failed to create Git tree: ${treeResponse.status} ${treeResponse.statusText}. Response: ${errorText}`
      );
    }

    const treeData = await treeResponse.json();
    
    if (!treeData.sha) {
      throw new Error(
        `Tree creation succeeded but returned no SHA. Response: ${JSON.stringify(treeData)}`
      );
    }

    // Create a new commit
    const defaultCommitMessage = `Update from SmartAPIForge (project: ${projectId})`;
    const finalCommitMessage = commitMessage || defaultCommitMessage;
    
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
          message: finalCommitMessage,
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      }
    );

    if (!newCommitResponse.ok) {
      const errorText = await newCommitResponse.text();
      throw new Error(
        `Failed to create commit: ${newCommitResponse.status} ${newCommitResponse.statusText}. Response: ${errorText}`
      );
    }

    const newCommitData = await newCommitResponse.json();
    
    if (!newCommitData.sha) {
      throw new Error(
        `Commit creation succeeded but returned no SHA. Response: ${JSON.stringify(newCommitData)}`
      );
    }

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
