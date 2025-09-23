// Frontend Integration Test for Message System
// Tests the complete flow from frontend to backend

// Using Node.js built-in fetch (available in Node 18+)

const BASE_URL = 'http://localhost:3000';

// Test configuration
const testConfig = {
  timeout: 10000,
  retries: 3
};

// Helper function to make HTTP requests with retry logic
async function makeRequest(config, retries = testConfig.retries) {
  try {
    const response = await fetch(config.url, {
      method: config.method || 'GET',
      headers: config.headers || {},
      body: config.data ? JSON.stringify(config.data) : undefined,
      signal: AbortSignal.timeout(config.timeout || testConfig.timeout)
    });
    
    // Add data property for compatibility
    const responseData = await response.text();
    response.data = responseData;
    
    return response;
  } catch (error) {
    if (retries > 0 && (error.name === 'TypeError' || error.code === 'ECONNREFUSED')) {
      console.log(`Connection refused, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return makeRequest(config, retries - 1);
    }
    throw error;
  }
}

// Test 1: Frontend page loads correctly
async function testFrontendPageLoad() {
  console.log('\n🌐 Testing frontend page load...');
  
  try {
    const response = await makeRequest({
      method: 'GET',
      url: BASE_URL,
      timeout: testConfig.timeout
    });
    
    if (response.status === 200) {
      console.log('✅ Frontend page loads successfully');
      
      // Check if the page contains expected elements
      const html = response.data;
      const hasPromptBox = html.includes('PromptInputBox') || html.includes('prompt') || html.includes('message');
      const hasTitle = html.includes('Smart API Forge') || html.includes('SmartAPIForge');
      
      if (hasTitle) {
        console.log('✅ Page contains expected title');
      } else {
        console.log('⚠️  Page title not found in HTML');
      }
      
      return true;
    }
  } catch (error) {
    console.log('❌ Frontend page load failed:', error.message);
    return false;
  }
}

// Test 2: API Generation endpoint integration
async function testAPIGenerationEndpoint() {
  console.log('\n🔧 Testing API generation endpoint integration...');
  
  try {
    const testMessage = {
      text: "Create a simple user management API",
      mode: "direct",
      repoUrl: null
    };
    
    const response = await makeRequest({
      method: 'POST',
      url: `${BASE_URL}/api/trpc/apiGeneration.invoke`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: testMessage,
      timeout: testConfig.timeout
    });
    
    if (response.status === 200) {
      console.log('✅ API generation endpoint responds correctly');
      console.log('Response:', response.data);
      return true;
    }
  } catch (error) {
    if (!response.ok) {
      console.log('❌ API generation endpoint error:', response.status, response.statusText);
      console.log('Response data:', response.data);
    } else {
      console.log('❌ API generation endpoint failed:', error.message);
    }
    return false;
  }
}

// Test 3: Message creation via tRPC
async function testMessageCreationViaTRPC() {
  console.log('\n📝 Testing message creation via tRPC...');
  
  try {
    const testMessage = {
      content: "Test message from frontend integration test",
      role: "user",
      type: "text"
    };
    
    const response = await makeRequest({
      method: 'POST',
      url: `${BASE_URL}/api/trpc/messages.create`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: testMessage,
      timeout: testConfig.timeout
    });
    
    if (response.status === 200) {
      console.log('✅ Message creation via tRPC successful');
      const result = response.data;
      console.log('Created message ID:', result.id || 'No ID returned');
      return result;
    }
  } catch (error) {
    console.log('❌ Message creation via tRPC failed:', error.message);
    return null;
  }
}

// Test 4: Message retrieval and display
async function testMessageRetrieval() {
  console.log('\n📋 Testing message retrieval...');
  
  try {
    const response = await makeRequest({
      method: 'GET',
      url: `${BASE_URL}/api/trpc/messages.getAll`,
      timeout: testConfig.timeout
    });
    
    if (response.status === 200) {
      console.log('✅ Message retrieval successful');
      const messages = response.data;
      console.log(`Retrieved ${Array.isArray(messages) ? messages.length : 'unknown'} messages`);
      
      if (Array.isArray(messages) && messages.length > 0) {
        console.log('Sample message:', {
          id: messages[0].id,
          content: messages[0].content?.substring(0, 50) + '...',
          role: messages[0].role,
          createdAt: messages[0].createdAt
        });
      }
      
      return messages;
    }
  } catch (error) {
    console.log('❌ Message retrieval failed:', error.message);
    return null;
  }
}

// Test 5: Inngest health check
async function testInngestIntegration() {
  console.log('\n⚡ Testing Inngest integration...');
  
  try {
    const response = await makeRequest({
      method: 'GET',
      url: `${BASE_URL}/api/inngest`,
      timeout: testConfig.timeout
    });
    
    if (response.status === 200) {
      console.log('✅ Inngest endpoint accessible');
      return true;
    }
  } catch (error) {
    console.log('❌ Inngest integration failed:', error.message);
    return false;
  }
}

// Main test runner
async function runFrontendIntegrationTests() {
  console.log('🚀 Starting Frontend Integration Tests');
  console.log('=====================================');
  
  const results = {
    pageLoad: false,
    apiGeneration: false,
    messageCreation: false,
    messageRetrieval: false,
    inngestIntegration: false
  };
  
  // Run all tests
  results.pageLoad = await testFrontendPageLoad();
  results.apiGeneration = await testAPIGenerationEndpoint();
  results.messageCreation = await testMessageCreationViaTRPC();
  results.messageRetrieval = await testMessageRetrieval();
  results.inngestIntegration = await testInngestIntegration();
  
  // Summary
  console.log('\n📊 Frontend Integration Test Results');
  console.log('====================================');
  console.log(`Frontend Page Load: ${results.pageLoad ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`API Generation Endpoint: ${results.apiGeneration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Message Creation: ${results.messageCreation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Message Retrieval: ${results.messageRetrieval ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Inngest Integration: ${results.inngestIntegration ? '✅ PASS' : '❌ FAIL'}`);
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All frontend integration tests passed!');
  } else {
    console.log('⚠️  Some frontend integration tests failed. Check the logs above.');
  }
  
  return results;
}

// Run the tests
runFrontendIntegrationTests().catch(console.error);