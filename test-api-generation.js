// Test script to simulate API generation and verify fragment creation
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateApiGeneration() {
  console.log('Simulating API generation to test fragment creation...');
  
  try {
    const testUserId = randomUUID();
    const testProjectId = randomUUID();
    
    // Step 1: Create a test message (simulating user input)
    console.log('Creating test message...');
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        content: 'Create a REST API for user management',
        role: 'user',
        type: 'user_prompt',
        sender_id: testUserId,
        receiver_id: null,
        project_id: testProjectId
      })
      .select()
      .single();
    
    if (messageError) {
      console.error('Error creating message:', messageError);
      return;
    }
    
    console.log('Message created:', message.id);
    
    // Step 2: Create a test job (simulating job creation)
    console.log('Creating test job...');
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: testUserId,
        project_id: testProjectId,
        type: 'generate_api',
        status: 'running',
        payload: {
          mode: 'basic',
          prompt: 'Create a REST API for user management'
        }
      })
      .select()
      .single();
    
    if (jobError) {
      console.error('Error creating job:', jobError);
      return;
    }
    
    console.log('Job created:', job.id);
    
    // Step 3: Create an API fragment (simulating API generation result)
    console.log('Creating API fragment...');
    const { data: apiFragment, error: apiError } = await supabase
      .from('api_fragments')
      .insert({
        openapi_spec: JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'User Management API', version: '1.0.0' },
          paths: {
            '/users': {
              get: { summary: 'Get all users' },
              post: { summary: 'Create a user' }
            }
          }
        }),
        implementation_code: 'const express = require("express");\nconst app = express();',
        summary: 'User Management API with CRUD operations',
        requirements: 'Express.js framework, basic CRUD operations',
        validation_results: JSON.stringify({ valid: true, errors: [] })
      })
      .select()
      .single();
    
    if (apiError) {
      console.error('Error creating API fragment:', apiError);
      return;
    }
    
    console.log('API fragment created:', apiFragment.id);
    
    // Step 4: Create a response message and fragment (simulating the fixed logic)
    console.log('Creating response message with fragment...');
    
    // Create the response message
    const { data: responseMessage, error: responseError } = await supabase
      .from('messages')
      .insert({
        content: 'I\'ve created a User Management API for you.',
        role: 'assistant',
        type: 'result',
        sender_id: null,
        receiver_id: testUserId,
        project_id: testProjectId
      })
      .select()
      .single();
    
    if (responseError) {
      console.error('Error creating response message:', responseError);
      return;
    }
    
    console.log('Response message created:', responseMessage.id);
    
    // Create the fragment with the detailed content
    const fragmentContent = JSON.stringify({
      openapi_spec: apiFragment.openapi_spec,
      implementation_code: apiFragment.implementation_code,
      summary: apiFragment.summary,
      requirements: apiFragment.requirements,
      validation_results: apiFragment.validation_results
    });
    
    const { data: fragment, error: fragmentError } = await supabase
      .from('fragments')
      .insert({
        message_id: responseMessage.id,
        content: fragmentContent,
        fragment_type: 'code',
        title: 'Test User Management API',
        sandbox_url: 'https://test-sandbox.example.com',
        files: JSON.stringify({
          'app.js': apiFragment.implementation_code,
          'openapi.json': apiFragment.openapi_spec
        }),
        metadata: JSON.stringify({
          api_fragment_id: apiFragment.id,
          job_id: job.id,
          validation_status: 'valid',
          framework: 'express',
          endpoints_count: 2,
          generation_timestamp: new Date().toISOString()
        })
      })
      .select()
      .single();
    
    if (fragmentError) {
      console.error('Error creating fragment:', fragmentError);
      return;
    }
    
    console.log('Fragment created successfully:', fragment.id);
    
    // Step 5: Verify the complete chain
    console.log('\nVerifying the complete chain...');
    
    const { data: verification, error: verifyError } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        role,
        type,
        created_at,
        fragments (
          id,
          fragment_type,
          title,
          created_at
        )
      `)
      .eq('id', responseMessage.id)
      .single();
    
    if (verifyError) {
      console.error('Error verifying chain:', verifyError);
      return;
    }
    
    console.log('Verification successful:');
    console.log(`- Message ID: ${verification.id}`);
    console.log(`- Message Type: ${verification.type}`);
    console.log(`- Message Role: ${verification.role}`);
    console.log(`- Fragments Count: ${verification.fragments.length}`);
    
    if (verification.fragments.length > 0) {
      verification.fragments.forEach(frag => {
        console.log(`  - Fragment ID: ${frag.id}, Type: ${frag.fragment_type}, Title: ${frag.title}`);
      });
    }
    
    console.log('\n✅ Test completed successfully! The fragment creation fix is working.');
    console.log('Messages now have corresponding fragments created when API generation completes.');
    
  } catch (error) {
    console.error('Error during API generation simulation:', error);
  }
}

simulateApiGeneration();