/**
 * Update existing projects with sandboxId from version metadata
 * Run this once to fix projects that were cloned before sandboxId was added to project metadata
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateProjectSandboxIds() {
  console.log('🔍 Finding projects without sandboxId in metadata...\n');

  // Get all projects
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, metadata, repo_url');

  if (projectsError) {
    console.error('Error fetching projects:', projectsError);
    return;
  }

  console.log(`Found ${projects?.length || 0} total projects\n`);

  let updatedCount = 0;

  for (const project of projects || []) {
    // Skip if already has sandboxId
    if (project.metadata?.sandboxId) {
      console.log(`✓ ${project.name} - Already has sandboxId: ${project.metadata.sandboxId}`);
      continue;
    }

    // Get the latest version for this project
    const { data: versions, error: versionsError } = await supabase
      .from('versions')
      .select('metadata')
      .eq('project_id', project.id)
      .order('version_number', { ascending: false })
      .limit(1);

    if (versionsError || !versions || versions.length === 0) {
      console.log(`⚠ ${project.name} - No versions found`);
      continue;
    }

    const sandboxId = versions[0].metadata?.sandbox_id;

    if (!sandboxId) {
      console.log(`⚠ ${project.name} - No sandboxId in version metadata`);
      continue;
    }

    // Update project metadata with sandboxId
    const updatedMetadata = {
      ...(project.metadata || {}),
      sandboxId,
    };

    const { error: updateError } = await supabase
      .from('projects')
      .update({ metadata: updatedMetadata })
      .eq('id', project.id);

    if (updateError) {
      console.log(`❌ ${project.name} - Failed to update: ${updateError.message}`);
    } else {
      console.log(`✅ ${project.name} - Updated with sandboxId: ${sandboxId}`);
      updatedCount++;
    }
  }

  console.log(`\n✨ Done! Updated ${updatedCount} projects`);
}

updateProjectSandboxIds().catch(console.error);
