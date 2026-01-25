import { NextRequest, NextResponse } from 'next/server';
import { ReadinessChecker } from '@/src/services/readiness-checker';
import { EnvManager } from '@/src/services/env-manager';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/projects/[projectId]/readiness-check
 * 
 * Run production readiness check for a project.
 * 
 * Requirements: 17.1, 17.2, 17.3, 17.5, 17.6
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get project files from the latest version
    const { data: versions, error: versionsError } = await supabase
      .from('versions')
      .select('id, files')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1);

    if (versionsError) {
      console.error('Error fetching versions:', versionsError);
      return NextResponse.json(
        { error: 'Failed to fetch project files' },
        { status: 500 }
      );
    }

    if (!versions || versions.length === 0) {
      return NextResponse.json({
        report: {
          isReady: false,
          checks: [
            {
              name: 'Project Files',
              passed: false,
              message: 'No project files found',
              remediation: 'Generate some code first before running readiness checks.',
            },
          ],
          summary: 'Cannot run readiness check: No project files found.',
        },
      });
    }

    const files = versions[0].files as Record<string, string> || {};

    // Get set environment variables
    const envManager = new EnvManager();
    const envVariables = await envManager.getEnvVariables(projectId);
    const setEnvVariables = envVariables
      .filter(v => v.value && v.value.trim() !== '')
      .map(v => v.key);

    // Run readiness check
    const readinessChecker = new ReadinessChecker(envManager);
    const report = readinessChecker.checkReadiness({
      files,
      setEnvVariables,
    });

    return NextResponse.json({
      report,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error running readiness check:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run readiness check' },
      { status: 500 }
    );
  }
}
