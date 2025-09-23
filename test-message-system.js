/**
 * Simple Message System Test
 * Tests direct Supabase connection and message creation
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://sinhvngpqugldmqivbxe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpbmh2bmdwcXVnbGRtcWl2YnhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5OTk3OCwiZXhwIjoyMDcxOTc1OTc4fQ.ACmddgMgI1vvCQIjYN1BZwJNx_VIJsQL8QwHrfz3c4g'
);

async function testSupabaseConnection() {
  console.log('🔗 Testing Supabase Connection...');
  
  try {
    // Test 1: Check if we can connect to the database
    const { data, error } = await supabase
      .from('messages')
      .select('count', { count: 'exact' });
    
    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful. Current message count:', data);
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    return false;
  }
}

async function testMessageCreation() {
  console.log('\n📝 Testing Direct Message Creation...');
  
  try {
    const testMessage = {
      content: 'Test message from direct Supabase client',
      role: 'user',
      type: 'result'
    };
    
    const { data, error } = await supabase
      .from('messages')
      .insert(testMessage)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Message creation failed:', error);
      return null;
    }
    
    console.log('✅ Message created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Message creation error:', error);
    return null;
  }
}

async function testMessageRetrieval(messageId) {
  console.log('\n🔍 Testing Message Retrieval...');
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (error) {
      console.error('❌ Message retrieval failed:', error);
      return false;
    }
    
    console.log('✅ Message retrieved successfully:', data);
    return true;
  } catch (error) {
    console.error('❌ Message retrieval error:', error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Simple Message System Test');
  console.log('============================================\n');
  
  // Test Supabase connection
  const connectionSuccess = await testSupabaseConnection();
  if (!connectionSuccess) {
    console.log('\n❌ Tests failed - Cannot connect to Supabase');
    return;
  }
  
  // Test message creation
  const createdMessage = await testMessageCreation();
  if (!createdMessage) {
    console.log('\n❌ Tests failed - Cannot create message');
    return;
  }
  
  // Test message retrieval
  const retrievalSuccess = await testMessageRetrieval(createdMessage.id);
  
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  console.log('✅ Supabase Connection: PASSED');
  console.log(`${createdMessage ? '✅' : '❌'} Message Creation: ${createdMessage ? 'PASSED' : 'FAILED'}`);
  console.log(`${retrievalSuccess ? '✅' : '❌'} Message Retrieval: ${retrievalSuccess ? 'PASSED' : 'FAILED'}`);
  
  if (connectionSuccess && createdMessage && retrievalSuccess) {
    console.log('\n🎉 All tests passed! The message system is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the implementation.');
  }
}

// Run the tests
runTests().catch(console.error);