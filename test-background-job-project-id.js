#!/usr/bin/env node

/**
 * Test script to verify project_id preservation in background jobs
 * This script tests the database records to ensure project_id is properly stored
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testProjectIdPreservation() {
  console.log('🧪 Testing Project ID Preservation in Database Records\n');

  try {
    // Step 1: Get an existing project
    console.log('📋 Step 1: Checking existing projects...');
    
    const { data: existingProjects, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .limit(5);

    if (projectError) {
      console.error('❌ Error fetching projects:', projectError);
      return;
    }

    if (!existingProjects || existingProjects.length === 0) {
      console.log('   ⚠️  No existing projects found. Please create a project first.');
      return;
    }

    console.log(`   ✅ Found ${existingProjects.length} projects:`);
    existingProjects.forEach((project, index) => {
      console.log(`      ${index + 1}. ${project.name} (${project.id})`);
    });

    // Step 2: Check messages with project_id
    console.log('\n📨 Step 2: Checking messages with project_id...');
    
    const { data: messagesWithProject, error: messageError } = await supabase
      .from('messages')
      .select('id, content, role, type, project_id, created_at')
      .not('project_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (messageError) {
      console.error('❌ Error fetching messages:', messageError);
      return;
    }

    console.log(`   ✅ Found ${messagesWithProject?.length || 0} messages with project_id:`);
    if (messagesWithProject && messagesWithProject.length > 0) {
      messagesWithProject.forEach((msg, index) => {
        console.log(`      ${index + 1}. ${msg.role} (${msg.type}): ${msg.content.substring(0, 40)}...`);
        console.log(`         Project ID: ${msg.project_id}`);
        console.log(`         Created: ${new Date(msg.created_at).toLocaleString()}`);
      });
    }

    // Step 3: Check fragments with project_id (if column exists)
     console.log('\n🧩 Step 3: Checking fragments with project_id...');
     
     // First check if project_id column exists in fragments table
     const { data: fragmentColumns, error: columnError } = await supabase
       .rpc('get_table_columns', { table_name: 'fragments' })
       .then(result => ({ data: null, error: null })) // RPC might not exist
       .catch(() => ({ data: null, error: null }));

     // Try to query fragments with project_id
     let fragmentsWithProject = null;
     let fragmentError = null;
     
     try {
       const result = await supabase
         .from('fragments')
         .select('id, title, project_id, created_at')
         .not('project_id', 'is', null)
         .order('created_at', { ascending: false })
         .limit(10);
       
       fragmentsWithProject = result.data;
       fragmentError = result.error;
     } catch (error) {
       if (error.message && error.message.includes('project_id does not exist')) {
         console.log('   ⚠️  project_id column does not exist in fragments table yet');
         console.log('   💡 This indicates the migration 007_add_project_relations.sql has not been applied');
         
         // Check fragments without project_id filter
         const { data: allFragments, error: allFragError } = await supabase
           .from('fragments')
           .select('id, title, created_at')
           .order('created_at', { ascending: false })
           .limit(5);
         
         if (allFragError) {
           console.error('❌ Error fetching fragments:', allFragError);
         } else {
           console.log(`   📊 Total fragments found: ${allFragments?.length || 0}`);
           if (allFragments && allFragments.length > 0) {
             allFragments.forEach((fragment, index) => {
               console.log(`      ${index + 1}. ${fragment.title || 'Untitled'}`);
               console.log(`         Created: ${new Date(fragment.created_at).toLocaleString()}`);
             });
           }
         }
         fragmentsWithProject = [];
       } else {
         fragmentError = error;
       }
     }

     if (fragmentError && !fragmentError.message?.includes('project_id does not exist')) {
       console.error('❌ Error fetching fragments:', fragmentError);
       return;
     }

     if (fragmentsWithProject !== null) {
       console.log(`   ✅ Found ${fragmentsWithProject?.length || 0} fragments with project_id:`);
       if (fragmentsWithProject && fragmentsWithProject.length > 0) {
         fragmentsWithProject.forEach((fragment, index) => {
           console.log(`      ${index + 1}. ${fragment.title || 'Untitled'}`);
           console.log(`         Project ID: ${fragment.project_id}`);
           console.log(`         Created: ${new Date(fragment.created_at).toLocaleString()}`);
         });
       }
     }

    // Step 4: Check jobs with project_id
    console.log('\n💼 Step 4: Checking jobs with project_id...');
    
    const { data: jobsWithProject, error: jobError } = await supabase
      .from('jobs')
      .select('id, status, project_id, created_at')
      .not('project_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobError) {
      console.error('❌ Error fetching jobs:', jobError);
      return;
    }

    console.log(`   ✅ Found ${jobsWithProject?.length || 0} jobs with project_id:`);
    if (jobsWithProject && jobsWithProject.length > 0) {
      jobsWithProject.forEach((job, index) => {
        console.log(`      ${index + 1}. Job ${job.id} - Status: ${job.status}`);
        console.log(`         Project ID: ${job.project_id}`);
        console.log(`         Created: ${new Date(job.created_at).toLocaleString()}`);
      });
    }

    // Step 5: Check for orphaned records (without project_id)
     console.log('\n🔍 Step 5: Checking for orphaned records...');
     
     const { data: orphanedMessages, error: orphanError1 } = await supabase
       .from('messages')
       .select('id, content, role, created_at')
       .is('project_id', null)
       .limit(5);

     let orphanedFragments = null;
     let orphanError2 = null;
     
     // Only check for orphaned fragments if project_id column exists
     if (fragmentsWithProject !== null) {
       const result = await supabase
         .from('fragments')
         .select('id, title, created_at')
         .is('project_id', null)
         .limit(5);
       orphanedFragments = result.data;
       orphanError2 = result.error;
     }

     const { data: orphanedJobs, error: orphanError3 } = await supabase
       .from('jobs')
       .select('id, status, created_at')
       .is('project_id', null)
       .limit(5);

     if (orphanError1 || orphanError2 || orphanError3) {
       console.log('   ⚠️  Some errors occurred while checking orphaned records');
     }

     console.log(`   📊 Orphaned messages (no project_id): ${orphanedMessages?.length || 0}`);
     if (fragmentsWithProject !== null) {
       console.log(`   📊 Orphaned fragments (no project_id): ${orphanedFragments?.length || 0}`);
     } else {
       console.log(`   📊 Orphaned fragments (no project_id): N/A (column doesn't exist)`);
     }
     console.log(`   📊 Orphaned jobs (no project_id): ${orphanedJobs?.length || 0}`);

     if (orphanedMessages && orphanedMessages.length > 0) {
       console.log('   ⚠️  Found orphaned messages:');
       orphanedMessages.forEach((msg, index) => {
         console.log(`      ${index + 1}. ${msg.role}: ${msg.content.substring(0, 40)}... (${new Date(msg.created_at).toLocaleString()})`);
       });
     }

     // Step 6: Summary and recommendations
     console.log('\n📋 Summary:');
     console.log(`   ✅ Projects: ${existingProjects.length}`);
     console.log(`   ✅ Messages with project_id: ${messagesWithProject?.length || 0}`);
     if (fragmentsWithProject !== null) {
       console.log(`   ✅ Fragments with project_id: ${fragmentsWithProject?.length || 0}`);
     } else {
       console.log(`   ⚠️  Fragments: project_id column not yet migrated`);
     }
     console.log(`   ✅ Jobs with project_id: ${jobsWithProject?.length || 0}`);
     console.log(`   ⚠️  Orphaned messages: ${orphanedMessages?.length || 0}`);
     if (fragmentsWithProject !== null) {
       console.log(`   ⚠️  Orphaned fragments: ${orphanedFragments?.length || 0}`);
     }
     console.log(`   ⚠️  Orphaned jobs: ${orphanedJobs?.length || 0}`);

     const totalOrphaned = (orphanedMessages?.length || 0) + (orphanedFragments?.length || 0) + (orphanedJobs?.length || 0);
     
     if (fragmentsWithProject === null) {
       console.log('\n⚠️  Migration Status:');
       console.log('   - The fragments table does not have a project_id column yet');
       console.log('   - Migration 007_add_project_relations.sql needs to be applied');
       console.log('   - This explains why fragments cannot be associated with projects');
       console.log('\n💡 Recommendations:');
       console.log('   1. Apply the migration: npx supabase db push (after linking project)');
       console.log('   2. Or run the migration manually in your database');
       console.log('   3. Verify the migration was applied successfully');
     } else if (totalOrphaned === 0) {
       console.log('\n🎉 Excellent! All records have proper project_id associations.');
     } else {
       console.log('\n⚠️  Some records are missing project_id associations. This may indicate:');
       console.log('   - Legacy data from before project_id was implemented');
       console.log('   - Issues with background job event data');
       console.log('   - Problems with the message/fragment creation process');
     }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testProjectIdPreservation().catch(console.error);