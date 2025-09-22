/**
 * Inngest Integration Test
 * Tests the Inngest background job processing for message creation
 */

const BASE_URL = 'http://localhost:3000';

async function testInngestHealth() {
  console.log('🏥 Testing Inngest Health...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/inngest`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('📥 Inngest health status:', response.status);
    
    const responseText = await response.text();
    console.log('📥 Inngest health response:', responseText);
    
    return response.status === 200;
    
  } catch (error) {
    console.error('❌ Inngest Health test error:', error);
    return false;
  }
}

async function testInngestMessageProcessing() {
  console.log('\n🧪 Testing Inngest Message Processing...');
  
  try {
    // First, create a message via tRPC to trigger Inngest
    const testMessage = {
      content: 'Test message for Inngest processing',
      role: 'user',
      type: 'result'
    };
    
    console.log('📤 Creating message to trigger Inngest job...');
    const createResponse = await fetch(`${BASE_URL}/api/trpc/messages.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: testMessage
      })
    });
    
    console.log('📥 Message creation status:', createResponse.status);
    
    if (!createResponse.ok) {
      console.error('❌ Failed to create message for Inngest test');
      return false;
    }
    
    const createResult = await createResponse.json();
    console.log('✅ Message created for Inngest test:', createResult.result.data.json.id);
    
    // Wait a moment for Inngest to process
    console.log('⏳ Waiting for Inngest to process the message...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if Inngest endpoint is receiving events
    console.log('🔍 Checking Inngest event processing...');
    const inngestResponse = await fetch(`${BASE_URL}/api/inngest`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'message/created',
        data: {
          messageId: createResult.result.data.json.id,
          content: testMessage.content
        }
      })
    });
    
    console.log('📥 Inngest event processing status:', inngestResponse.status);
    
    const inngestResult = await inngestResponse.text();
    console.log('📥 Inngest event processing response:', inngestResult);
    
    return inngestResponse.status === 200;
    
  } catch (error) {
    console.error('❌ Inngest Message Processing test error:', error);
    return false;
  }
}

async function testInngestFunctionRegistration() {
  console.log('\n🔧 Testing Inngest Function Registration...');
  
  try {
    // Test the Inngest registration endpoint
    const response = await fetch(`${BASE_URL}/api/inngest`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Inngest/1.0'
      },
      body: JSON.stringify({
        type: 'function.register',
        functions: []
      })
    });
    
    console.log('📥 Function registration status:', response.status);
    
    const responseText = await response.text();
    console.log('📥 Function registration response:', responseText);
    
    return response.status === 200;
    
  } catch (error) {
    console.error('❌ Inngest Function Registration test error:', error);
    return false;
  }
}

async function runInngestTests() {
  console.log('🚀 Starting Inngest Integration Tests');
  console.log('=====================================\n');
  
  // Test Inngest health
  const healthOk = await testInngestHealth();
  
  // Test function registration
  const registrationOk = await testInngestFunctionRegistration();
  
  // Test message processing
  const processingOk = await testInngestMessageProcessing();
  
  console.log('\n📊 Inngest Test Results Summary');
  console.log('================================');
  console.log(`🏥 Health Check: ${healthOk ? 'PASSED' : 'FAILED'}`);
  console.log(`🔧 Function Registration: ${registrationOk ? 'PASSED' : 'FAILED'}`);
  console.log(`📝 Message Processing: ${processingOk ? 'PASSED' : 'FAILED'}`);
  
  if (healthOk && registrationOk && processingOk) {
    console.log('\n🎉 All Inngest tests passed!');
  } else {
    console.log('\n⚠️ Some Inngest tests failed. Check the server logs for details.');
  }
  
  return { healthOk, registrationOk, processingOk };
}

// Run the tests
runInngestTests().catch(console.error);