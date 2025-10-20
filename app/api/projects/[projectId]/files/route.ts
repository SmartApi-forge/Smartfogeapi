import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Get the latest version for the project
    const { data: versions, error: versionsError } = await supabase
      .from('versions')
      .select('files')
      .eq('project_id', projectId)
      .eq('status', 'complete')
      .order('version_number', { ascending: false })
      .limit(1);

    if (versionsError) {
      throw new Error(`Failed to fetch versions: ${versionsError.message}`);
    }

    if (!versions || versions.length === 0) {
      // Try to get files from fragments if no versions exist
      const { data: fragments, error: fragmentsError } = await supabase
        .from('fragments')
        .select('files')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fragmentsError) {
        throw new Error(`Failed to fetch fragments: ${fragmentsError.message}`);
      }

      if (fragments && fragments.length > 0 && fragments[0].files) {
        return NextResponse.json(fragments[0].files);
      }

      return NextResponse.json({});
    }

    return NextResponse.json(versions[0].files || {});
  } catch (error: any) {
    console.error('Error fetching project files:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch project files' },
      { status: 500 }
    );
  }
}
