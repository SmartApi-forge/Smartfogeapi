import { MessageService } from './src/modules/messages/service.ts';

async function testFragmentCreation() {
  console.log('🧪 Testing MessageService.saveResult with fragment creation...');
  
  try {
    const testData = {
      content: JSON.stringify({
        openapi_spec: 'test openapi spec',
        implementation_code: { 'index.js': 'console.log("test")' },
        summary: 'Test API Generation',
        requirements: ['Test requirement'],
        validation_results: { overallValid: true }
      }),
      role: 'assistant',
      type: 'result',
      sender_id: null,
      receiver_id: 'a4d1d79e-0f26-4a61-8336-122b052e836d', // Use actual user ID from recent jobs
      project_id: '67b68700-7ac8-46c5-87be-664eab25a90f', // Use actual project ID from recent jobs
      fragment: {
        title: 'Test AI Generated API',
        sandbox_url: 'https://test-sandbox.example.com',
        files: {
          'openapi.json': '{"openapi": "3.0.0"}',
          'index.js': 'console.log("test")',
          'package.json': '{"name": "test-api"}'
        },
        fragment_type: 'code',
        order_index: 0,
        metadata: {
          api_fragment_id: 'test-api-id',
          job_id: 'test-job-id',
          validation_status: 'valid',
          framework: 'express',
          endpoints_count: 1,
          generation_timestamp: new Date().toISOString()
        }
      }
    };

    console.log('📤 Calling MessageService.saveResult...');
    const result = await MessageService.saveResult(testData);
    
    console.log('✅ MessageService.saveResult executed successfully');
    console.log('📝 Message created:', result.message?.id);
    console.log('🧩 Fragment created:', result.fragment?.id);
    
    if (result.fragment) {
      console.log('✅ Fragment creation successful!');
      console.log('Fragment details:', {
        id: result.fragment.id,
        message_id: result.fragment.message_id,
        title: result.fragment.title,
        fragment_type: result.fragment.fragment_type,
        sandbox_url: result.fragment.sandbox_url
      });
    } else {
      console.log('❌ Fragment was not created');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    if (error.cause) {
      console.error('Underlying cause:', error.cause);
    }
  }
}

testFragmentCreation();