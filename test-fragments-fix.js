/**
 * Test script to verify that AI responses are now being stored in the fragments table
 * This script simulates the API generation workflow to test our fix
 */

import { MessageService } from './src/modules/messages/service.js';

async function testFragmentStorage() {
  console.log('🧪 Testing fragment storage fix...');
  
  try {
    // Test the enhanced MessageService.saveResult method
    const testResult = await MessageService.saveResult({
      content: JSON.stringify({
        openapi_spec: 'openapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0',
        implementation_code: { 'index.js': 'console.log("Hello World");' },
        summary: 'Test API Generation',
        requirements: ['Create a simple API'],
        validation_results: { overallValid: true, tests: 'passed' }
      }),
      role: 'assistant',
      type: 'api_generation',
      sender_id: null,
      receiver_id: 'test-user-id',
      project_id: 'test-project-id',
      fragment: {
        fragment_type: 'api_generation',
        content: JSON.stringify({
          openapi_spec: 'openapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0',
          implementation_code: { 'index.js': 'console.log("Hello World");' },
          summary: 'Test API Generation',
          requirements: ['Create a simple API'],
          validation_results: { overallValid: true, tests: 'passed' }
        }),
        title: 'Test API Generation Result',
        sandbox_url: 'https://test-sandbox.example.com',
        files: { 'index.js': 'console.log("Hello World");' },
        order_index: 0,
        metadata: {
          test: true,
          validation_status: 'valid'
        }
      }
    });
    
    console.log('✅ MessageService.saveResult executed successfully');
    console.log('📝 Message created with ID:', testResult.message.id);
    
    if (testResult.fragment) {
      console.log('🎯 Fragment created with ID:', testResult.fragment.id);
      console.log('✅ Fix verified: AI responses are now stored in fragments table!');
    } else {
      console.log('❌ Fragment was not created - there might be an issue');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testFragmentStorage().catch(console.error);