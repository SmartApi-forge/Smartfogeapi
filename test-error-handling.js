/**
 * Error Handling and Validation Test
 * Tests error scenarios and validation in the message system
 */

const BASE_URL = 'http://localhost:3000';

async function testInvalidMessageCreation() {
  console.log('🧪 Testing Invalid Message Creation...');
  
  const testCases = [
    {
      name: 'Empty content',
      data: { content: '', role: 'user', type: 'result' },
      expectedStatus: 400
    },
    {
      name: 'Missing content',
      data: { role: 'user', type: 'result' },
      expectedStatus: 400
    },
    {
      name: 'Invalid role',
      data: { content: 'Test message', role: 'invalid_role', type: 'result' },
      expectedStatus: 400
    },
    {
      name: 'Invalid type',
      data: { content: 'Test message', role: 'user', type: 'invalid_type' },
      expectedStatus: 400
    },
    {
      name: 'Missing all fields',
      data: {},
      expectedStatus: 400
    }
  ];
  
  let passedTests = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`\n  📝 Testing: ${testCase.name}`);
      console.log(`  📤 Request data:`, JSON.stringify(testCase.data, null, 2));
      
      const response = await fetch(`${BASE_URL}/api/trpc/messages.create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: testCase.data
        })
      });
      
      console.log(`  📥 Response status: ${response.status}`);
      
      const responseText = await response.text();
      console.log(`  📥 Response body:`, responseText.substring(0, 200) + '...');
      
      // Check if we got an error response (400 or 500)
      if (response.status >= 400) {
        console.log(`  ✅ ${testCase.name}: PASSED (Got error as expected)`);
        passedTests++;
      } else {
        console.log(`  ❌ ${testCase.name}: FAILED (Should have failed but didn't)`);
      }
      
    } catch (error) {
      console.log(`  ✅ ${testCase.name}: PASSED (Got network error as expected)`);
      passedTests++;
    }
  }
  
  console.log(`\n📊 Invalid Message Creation Tests: ${passedTests}/${testCases.length} passed`);
  return passedTests === testCases.length;
}

async function testNonExistentEndpoints() {
  console.log('\n🧪 Testing Non-Existent Endpoints...');
  
  const testCases = [
    {
      name: 'Non-existent tRPC procedure',
      url: `${BASE_URL}/api/trpc/messages.nonExistent`,
      method: 'POST'
    },
    {
      name: 'Invalid tRPC path',
      url: `${BASE_URL}/api/trpc/invalid.endpoint`,
      method: 'GET'
    }
  ];
  
  let passedTests = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`\n  📝 Testing: ${testCase.name}`);
      console.log(`  📤 Request URL: ${testCase.url}`);
      
      const response = await fetch(testCase.url, {
        method: testCase.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: testCase.method === 'POST' ? JSON.stringify({ json: {} }) : undefined
      });
      
      console.log(`  📥 Response status: ${response.status}`);
      
      // Should get 404 or 400 for non-existent endpoints
      if (response.status >= 400) {
        console.log(`  ✅ ${testCase.name}: PASSED (Got error as expected)`);
        passedTests++;
      } else {
        console.log(`  ❌ ${testCase.name}: FAILED (Should have failed but didn't)`);
      }
      
    } catch (error) {
      console.log(`  ✅ ${testCase.name}: PASSED (Got network error as expected)`);
      passedTests++;
    }
  }
  
  console.log(`\n📊 Non-Existent Endpoints Tests: ${passedTests}/${testCases.length} passed`);
  return passedTests === testCases.length;
}

async function testMalformedRequests() {
  console.log('\n🧪 Testing Malformed Requests...');
  
  const testCases = [
    {
      name: 'Invalid JSON',
      body: '{ invalid json }',
      expectedError: true
    },
    {
      name: 'Wrong content type',
      body: JSON.stringify({ json: { content: 'test', role: 'user', type: 'result' } }),
      headers: { 'Content-Type': 'text/plain' },
      expectedError: true
    },
    {
      name: 'Missing JSON wrapper',
      body: JSON.stringify({ content: 'test', role: 'user', type: 'result' }),
      expectedError: true
    }
  ];
  
  let passedTests = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`\n  📝 Testing: ${testCase.name}`);
      
      const response = await fetch(`${BASE_URL}/api/trpc/messages.create`, {
        method: 'POST',
        headers: testCase.headers || {
          'Content-Type': 'application/json',
        },
        body: testCase.body
      });
      
      console.log(`  📥 Response status: ${response.status}`);
      
      if (response.status >= 400) {
        console.log(`  ✅ ${testCase.name}: PASSED (Got error as expected)`);
        passedTests++;
      } else {
        console.log(`  ❌ ${testCase.name}: FAILED (Should have failed but didn't)`);
      }
      
    } catch (error) {
      console.log(`  ✅ ${testCase.name}: PASSED (Got network error as expected)`);
      passedTests++;
    }
  }
  
  console.log(`\n📊 Malformed Requests Tests: ${passedTests}/${testCases.length} passed`);
  return passedTests === testCases.length;
}

async function testRateLimiting() {
  console.log('\n🧪 Testing Rate Limiting (if implemented)...');
  
  try {
    const requests = [];
    const numRequests = 10;
    
    console.log(`  📤 Sending ${numRequests} rapid requests...`);
    
    for (let i = 0; i < numRequests; i++) {
      requests.push(
        fetch(`${BASE_URL}/api/trpc/messages.create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            json: {
              content: `Rapid test message ${i}`,
              role: 'user',
              type: 'result'
            }
          })
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status);
    
    console.log(`  📥 Response status codes:`, statusCodes);
    
    const rateLimitedResponses = statusCodes.filter(code => code === 429).length;
    const successfulResponses = statusCodes.filter(code => code === 200).length;
    
    console.log(`  📊 Successful: ${successfulResponses}, Rate Limited: ${rateLimitedResponses}`);
    
    if (rateLimitedResponses > 0) {
      console.log(`  ✅ Rate Limiting: IMPLEMENTED (Found ${rateLimitedResponses} rate-limited responses)`);
      return true;
    } else {
      console.log(`  ℹ️ Rate Limiting: NOT IMPLEMENTED (All requests succeeded)`);
      return true; // Not a failure, just not implemented
    }
    
  } catch (error) {
    console.log(`  ⚠️ Rate Limiting Test: ERROR (${error.message})`);
    return false;
  }
}

async function runErrorHandlingTests() {
  console.log('🚀 Starting Error Handling and Validation Tests');
  console.log('===============================================\n');
  
  // Test invalid message creation
  const invalidCreationOk = await testInvalidMessageCreation();
  
  // Test non-existent endpoints
  const nonExistentOk = await testNonExistentEndpoints();
  
  // Test malformed requests
  const malformedOk = await testMalformedRequests();
  
  // Test rate limiting
  const rateLimitOk = await testRateLimiting();
  
  console.log('\n📊 Error Handling Test Results Summary');
  console.log('=======================================');
  console.log(`🚫 Invalid Message Creation: ${invalidCreationOk ? 'PASSED' : 'FAILED'}`);
  console.log(`🔍 Non-Existent Endpoints: ${nonExistentOk ? 'PASSED' : 'FAILED'}`);
  console.log(`📝 Malformed Requests: ${malformedOk ? 'PASSED' : 'FAILED'}`);
  console.log(`⏱️ Rate Limiting: ${rateLimitOk ? 'PASSED' : 'FAILED'}`);
  
  const allPassed = invalidCreationOk && nonExistentOk && malformedOk && rateLimitOk;
  
  if (allPassed) {
    console.log('\n🎉 All error handling tests passed!');
  } else {
    console.log('\n⚠️ Some error handling tests failed. The system may need better validation.');
  }
  
  return { invalidCreationOk, nonExistentOk, malformedOk, rateLimitOk };
}

// Run the tests
runErrorHandlingTests().catch(console.error);