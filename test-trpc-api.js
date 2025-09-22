/**
 * tRPC API Test
 * Tests the tRPC message endpoints specifically
 */

const BASE_URL = 'http://localhost:3000';

async function testTRPCMessageCreate() {
  console.log('🧪 Testing tRPC Message Create Endpoint...');
  
  try {
    const testMessage = {
      content: 'Test message via tRPC API',
      role: 'user',
      type: 'result'
    };
    
    console.log('📤 Sending request to:', `${BASE_URL}/api/trpc/messages.create`);
    console.log('📤 Request body:', JSON.stringify({ json: testMessage }, null, 2));
    
    const response = await fetch(`${BASE_URL}/api/trpc/messages.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: testMessage
      })
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📥 Response body (raw):', responseText);
    
    if (!response.ok) {
      console.error('❌ tRPC Create failed with status:', response.status);
      return false;
    }
    
    try {
      const result = JSON.parse(responseText);
      console.log('✅ tRPC Create successful:', result);
      return result;
    } catch (parseError) {
      console.error('❌ Failed to parse response JSON:', parseError);
      return false;
    }
    
  } catch (error) {
    console.error('❌ tRPC Create test error:', error);
    return false;
  }
}

async function testTRPCMessageGetAll() {
  console.log('\n🧪 Testing tRPC Message GetAll Endpoint...');
  
  try {
    const queryParams = encodeURIComponent(JSON.stringify({
      json: { limit: 5 }
    }));
    
    const url = `${BASE_URL}/api/trpc/messages.getAll?input=${queryParams}`;
    console.log('📤 Sending request to:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('📥 Response status:', response.status);
    
    const responseText = await response.text();
    console.log('📥 Response body (raw):', responseText);
    
    if (!response.ok) {
      console.error('❌ tRPC GetAll failed with status:', response.status);
      return false;
    }
    
    try {
      const result = JSON.parse(responseText);
      console.log('✅ tRPC GetAll successful:', result);
      return result;
    } catch (parseError) {
      console.error('❌ Failed to parse response JSON:', parseError);
      return false;
    }
    
  } catch (error) {
    console.error('❌ tRPC GetAll test error:', error);
    return false;
  }
}

async function testTRPCHealth() {
  console.log('\n🏥 Testing tRPC Health...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/trpc`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('📥 tRPC base endpoint status:', response.status);
    
    const responseText = await response.text();
    console.log('📥 tRPC base endpoint response:', responseText);
    
    return response.status < 500;
    
  } catch (error) {
    console.error('❌ tRPC Health test error:', error);
    return false;
  }
}

async function runTRPCTests() {
  console.log('🚀 Starting tRPC API Tests');
  console.log('============================\n');
  
  // Test tRPC health first
  const healthOk = await testTRPCHealth();
  console.log(`🏥 tRPC Health: ${healthOk ? 'OK' : 'FAILED'}`);
  
  // Test message creation
  const createResult = await testTRPCMessageCreate();
  
  // Test message retrieval
  const getAllResult = await testTRPCMessageGetAll();
  
  console.log('\n📊 tRPC Test Results Summary');
  console.log('==============================');
  console.log(`🏥 Health Check: ${healthOk ? 'PASSED' : 'FAILED'}`);
  console.log(`📝 Create Message: ${createResult ? 'PASSED' : 'FAILED'}`);
  console.log(`📋 Get All Messages: ${getAllResult ? 'PASSED' : 'FAILED'}`);
  
  if (healthOk && createResult && getAllResult) {
    console.log('\n🎉 All tRPC tests passed!');
  } else {
    console.log('\n⚠️ Some tRPC tests failed. Check the server logs for details.');
  }
}

// Run the tests
runTRPCTests().catch(console.error);