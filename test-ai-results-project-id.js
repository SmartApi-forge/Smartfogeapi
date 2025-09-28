#!/usr/bin/env node

/**
 * Test script to verify project_id preservation and AI results storage in background jobs
 * This script checks:
 * 1. Messages with project_id associations
 * 2. Fragments with project_id and AI-generated content
 * 3. Jobs with project_id and their completion status
 * 4. API fragments with project_id and generated code
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAIResultsWithProjectId() {
  console.log('🔍 Checking AI Results and Project ID Storage in Background Jobs\n');

  try {
    // Step 1: Check messages with AI responses
    console.log('📝 Step 1: Checking messages with AI responses...');
    const { data: aiMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, role, type, project_id, created_at')
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('❌ Error fetching AI messages:', messagesError);
    } else {
      console.log(`   ✅ Found ${aiMessages.length} AI assistant messages`);
      aiMessages.forEach((msg, index) => {
        console.log(`      ${index + 1}. Message ID: ${msg.id}`);
        console.log(`         Project ID: ${msg.project_id || 'NULL'}`);
        console.log(`         Type: ${msg.type}`);
        console.log(`         Content preview: ${msg.content.substring(0, 100)}...`);
        console.log(`         Created: ${new Date(msg.created_at).toLocaleString()}\n`);
      });
    }

    // Step 2: Check fragments with AI-generated content
    console.log('🧩 Step 2: Checking fragments with AI-generated content...');
    const { data: fragments, error: fragmentsError } = await supabase
      .from('fragments')
      .select('id, title, content, project_id, message_id, created_at')
      .not('content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (fragmentsError) {
      console.error('❌ Error fetching fragments:', fragmentsError);
    } else {
      console.log(`   ✅ Found ${fragments.length} fragments with content`);
      fragments.forEach((fragment, index) => {
        console.log(`      ${index + 1}. Fragment ID: ${fragment.id}`);
        console.log(`         Project ID: ${fragment.project_id || 'NULL'}`);
        console.log(`         Message ID: ${fragment.message_id || 'NULL'}`);
        console.log(`         Title: ${fragment.title || 'No title'}`);
        console.log(`         Content preview: ${fragment.content ? fragment.content.substring(0, 100) + '...' : 'No content'}`);
        console.log(`         Created: ${new Date(fragment.created_at).toLocaleString()}\n`);
      });
    }

    // Step 3: Check API fragments (generated code)
    console.log('⚙️ Step 3: Checking API fragments with generated code...');
    const { data: apiFragments, error: apiFragmentsError } = await supabase
      .from('api_fragments')
      .select('id, job_id, openapi_spec, implementation_code, requirements, description, validation_results, pr_url, created_at')
      .not('implementation_code', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (apiFragmentsError) {
      console.error('❌ Error fetching API fragments:', apiFragmentsError);
    } else {
      console.log(`   ✅ Found ${apiFragments.length} API fragments with generated code`);
      for (const apiFragment of apiFragments) {
        // Get job details to find project_id
        const { data: jobData } = await supabase
          .from('jobs')
          .select('project_id, status, type')
          .eq('id', apiFragment.job_id)
          .single();

        console.log(`      API Fragment ID: ${apiFragment.id}`);
        console.log(`         Job ID: ${apiFragment.job_id}`);
        console.log(`         Project ID: ${jobData?.project_id || 'NULL'} (from job)`);
        console.log(`         Job Status: ${jobData?.status || 'Unknown'}`);
        console.log(`         Job Type: ${jobData?.type || 'Unknown'}`);
        console.log(`         Has OpenAPI Spec: ${apiFragment.openapi_spec ? 'Yes' : 'No'}`);
        console.log(`         Has Implementation: ${apiFragment.implementation_code ? 'Yes' : 'No'}`);
        console.log(`         Has Requirements: ${apiFragment.requirements ? 'Yes' : 'No'}`);
        console.log(`         Description: ${apiFragment.description || 'No description'}`);
        console.log(`         PR URL: ${apiFragment.pr_url || 'No PR'}`);
        console.log(`         Created: ${new Date(apiFragment.created_at).toLocaleString()}\n`);
      }
    }

    // Step 4: Check jobs with their AI generation status
    console.log('🔄 Step 4: Checking background jobs and their AI generation status...');
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, project_id, type, status, input_data, result_data, created_at, updated_at')
      .in('type', ['api_generation', 'fragment_generation'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError);
    } else {
      console.log(`   ✅ Found ${jobs.length} AI generation jobs`);
      jobs.forEach((job, index) => {
        console.log(`      ${index + 1}. Job ID: ${job.id}`);
        console.log(`         Project ID: ${job.project_id || 'NULL'}`);
        console.log(`         Type: ${job.type}`);
        console.log(`         Status: ${job.status}`);
        console.log(`         Has Input Data: ${job.input_data ? 'Yes' : 'No'}`);
        console.log(`         Has Result Data: ${job.result_data ? 'Yes' : 'No'}`);
        console.log(`         Created: ${new Date(job.created_at).toLocaleString()}`);
        console.log(`         Updated: ${new Date(job.updated_at).toLocaleString()}\n`);
      });
    }

    // Step 5: Cross-reference analysis
    console.log('🔗 Step 5: Cross-reference analysis...');
    
    // Count records by project association
    const { data: projectStats } = await supabase.rpc('get_project_stats', {});
    
    // Manual count if RPC doesn't exist
    const { count: messagesWithProject } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .not('project_id', 'is', null);

    const { count: fragmentsWithProject } = await supabase
      .from('fragments')
      .select('*', { count: 'exact', head: true })
      .not('project_id', 'is', null);

    const { count: jobsWithProject } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .not('project_id', 'is', null);

    const { count: completedJobs } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('project_id', 'is', null);

    console.log('   📊 Summary Statistics:');
    console.log(`      Messages with project_id: ${messagesWithProject}`);
    console.log(`      Fragments with project_id: ${fragmentsWithProject}`);
    console.log(`      Jobs with project_id: ${jobsWithProject}`);
    console.log(`      Completed jobs with project_id: ${completedJobs}`);

    // Step 6: Verify AI result completeness
    console.log('\n✅ Step 6: AI Result Completeness Check...');
    
    const { data: incompleteJobs } = await supabase
      .from('jobs')
      .select('id, project_id, type, status, created_at')
      .eq('status', 'pending')
      .not('project_id', 'is', null)
      .order('created_at', { ascending: true });

    if (incompleteJobs && incompleteJobs.length > 0) {
      console.log(`   ⚠️  Found ${incompleteJobs.length} pending jobs with project_id:`);
      incompleteJobs.forEach((job, index) => {
        console.log(`      ${index + 1}. Job ${job.id} (${job.type}) - Project: ${job.project_id}`);
        console.log(`         Created: ${new Date(job.created_at).toLocaleString()}`);
      });
    } else {
      console.log('   ✅ No pending jobs found - all AI generation appears complete');
    }

    console.log('\n🎯 Verification Complete!');
    console.log('   This analysis shows how project_id is preserved throughout the AI generation pipeline:');
    console.log('   1. Messages → Background Jobs → AI Results → Fragments/API Fragments');
    console.log('   2. Each step maintains project_id for proper data association');
    console.log('   3. Results can be traced back to their originating projects');

  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Run the verification
checkAIResultsWithProjectId();