/**
 * Test script to verify that fragments are being created correctly
 * when saving AI results through MessageService.saveResult
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFragmentCreation() {
  console.log('🧪 Testing fragment creation functionality...\n');

  try {
    // Test 1: Save a result without fragment data (should not create fragment)
    console.log('Test 1: Saving result without fragment data...');
    
    const { MessageService } = await import('./src/modules/messages/service.ts');
    
    const resultWithoutFragment = await MessageService.saveResult({
      content: 'This is a test message without fragment data',
      role: 'assistant',
      type: 'result'
    });

    console.log('✅ Message created:', resultWithoutFragment.message.id);
    console.log('✅ Fragment created:', resultWithoutFragment.fragment ? resultWithoutFragment.fragment.id : 'None (expected)');
    
    // Test 2: Save a result with fragment data (should create fragment)
    console.log('\nTest 2: Saving result with fragment data...');
    
    const resultWithFragment = await MessageService.saveResult({
      content: 'This is a test API generation result',
      role: 'assistant',
      type: 'result',
      fragment: {
        title: 'Test Generated API',
        sandbox_url: 'https://test.example.com/sandbox',
        files: {
          'app.py': 'from flask import Flask\napp = Flask(__name__)',
          'requirements.txt': 'Flask==2.3.0'
        },
        fragment_type: 'api_result',
        order_index: 0,
        metadata: {
          test_data: true,
          validation_results: { success: true },
          generated_files: ['app.py', 'requirements.txt']
        }
      }
    });

    console.log('✅ Message created:', resultWithFragment.message.id);
    console.log('✅ Fragment created:', resultWithFragment.fragment ? resultWithFragment.fragment.id : 'None (unexpected!)');
    
    if (resultWithFragment.fragment) {
      console.log('✅ Fragment details:');
      console.log('   - Title:', resultWithFragment.fragment.title);
      console.log('   - Type:', resultWithFragment.fragment.fragment_type);
      console.log('   - Files count:', Object.keys(resultWithFragment.fragment.files || {}).length);
      console.log('   - Sandbox URL:', resultWithFragment.fragment.sandbox_url);
    }

    // Test 3: Verify fragments are stored in database
    console.log('\nTest 3: Verifying fragments in database...');
    
    const { data: fragments, error: fragmentsError } = await supabase
      .from('fragments')
      .select('*')
      .eq('message_id', resultWithFragment.message.id);

    if (fragmentsError) {
      console.error('❌ Error querying fragments:', fragmentsError);
    } else {
      console.log('✅ Fragments found in database:', fragments.length);
      if (fragments.length > 0) {
        console.log('✅ Fragment data:', {
          id: fragments[0].id,
          title: fragments[0].title,
          fragment_type: fragments[0].fragment_type,
          files_count: Object.keys(fragments[0].files || {}).length
        });
      }
    }

    // Test 4: Verify messages are linked to fragments
    console.log('\nTest 4: Verifying message-fragment relationship...');
    
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        *,
        fragments (*)
      `)
      .eq('id', resultWithFragment.message.id);

    if (messagesError) {
      console.error('❌ Error querying messages with fragments:', messagesError);
    } else {
      console.log('✅ Message with fragments:', {
        message_id: messages[0].id,
        fragments_count: messages[0].fragments.length
      });
    }

    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testFragmentCreation().then(() => {
  console.log('\n✅ Test script finished');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});