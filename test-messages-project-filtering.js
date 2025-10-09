/**
 * Test script for Messages Project Filtering Functionality
 * 
 * This script tests the updated messages.getMany procedure to ensure
 * it correctly filters messages by project_id.
 */

// Test configuration
const TEST_CONFIG = {
  // Replace these with actual project IDs from your database
  PROJECT_ID_1: '550e8400-e29b-41d4-a716-446655440000',
  PROJECT_ID_2: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  PROJECT_ID_NONEXISTENT: '123e4567-e89b-12d3-a456-426614174000',
  
  // API endpoint (adjust based on your setup)
  API_BASE_URL: 'http://localhost:3000/api/trpc',
  
  // Test parameters
  LIMIT: 10,
  INCLUDE_FRAGMENT: true
};

/**
 * Test 1: Direct API endpoint test using fetch
 */
async function testDirectAPIEndpoint() {
  console.log('\n🧪 Test 1: Direct API Endpoint Test');
  console.log('=====================================');
  
  try {
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/messages.getMany`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: TEST_CONFIG.PROJECT_ID_1,
        limit: TEST_CONFIG.LIMIT,
        includeFragment: TEST_CONFIG.INCLUDE_FRAGMENT
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ API Response received');
    console.log('📊 Response data:', JSON.stringify(data, null, 2));
    
    // Validate response structure
    if (data.result && Array.isArray(data.result.data)) {
      console.log(`📈 Found ${data.result.data.length} messages for project ${TEST_CONFIG.PROJECT_ID_1}`);
      
      // Check if all messages belong to the correct project
      const allMessagesHaveCorrectProject = data.result.data.every(
        message => message.project_id === TEST_CONFIG.PROJECT_ID_1
      );
      
      if (allMessagesHaveCorrectProject) {
        console.log('✅ All messages belong to the correct project');
      } else {
        console.log('❌ Some messages belong to different projects');
      }
    } else {
      console.log('⚠️  Unexpected response structure');
    }
    
  } catch (error) {
    console.error('❌ Direct API test failed:', error.message);
  }
}

/**
 * Test 2: Test with different project IDs
 */
async function testMultipleProjects() {
  console.log('\n🧪 Test 2: Multiple Projects Test');
  console.log('==================================');
  
  const projectIds = [TEST_CONFIG.PROJECT_ID_1, TEST_CONFIG.PROJECT_ID_2];
  
  for (const projectId of projectIds) {
    try {
      console.log(`\n🔍 Testing project: ${projectId}`);
      
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/messages.getMany`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          limit: 5,
          includeFragment: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        const messageCount = data.result?.data?.length || 0;
        console.log(`✅ Project ${projectId}: Found ${messageCount} messages`);
      } else {
        console.log(`❌ Project ${projectId}: HTTP ${response.status}`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing project ${projectId}:`, error.message);
    }
  }
}

/**
 * Test 3: Test with non-existent project ID
 */
async function testNonExistentProject() {
  console.log('\n🧪 Test 3: Non-existent Project Test');
  console.log('====================================');
  
  try {
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/messages.getMany`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: TEST_CONFIG.PROJECT_ID_NONEXISTENT,
        limit: TEST_CONFIG.LIMIT,
        includeFragment: TEST_CONFIG.INCLUDE_FRAGMENT
      })
    });

    if (response.ok) {
      const data = await response.json();
      const messageCount = data.result?.data?.length || 0;
      console.log(`✅ Non-existent project returned ${messageCount} messages (should be 0)`);
      
      if (messageCount === 0) {
        console.log('✅ Correctly filtered out messages for non-existent project');
      } else {
        console.log('⚠️  Expected 0 messages for non-existent project');
      }
    } else {
      console.log(`❌ HTTP ${response.status} for non-existent project`);
    }
    
  } catch (error) {
    console.error('❌ Non-existent project test failed:', error.message);
  }
}

/**
 * Test 4: Test input validation
 */
async function testInputValidation() {
  console.log('\n🧪 Test 4: Input Validation Test');
  console.log('=================================');
  
  const invalidInputs = [
    { name: 'Missing projectId', input: { limit: 10, includeFragment: true } },
    { name: 'Invalid projectId format', input: { projectId: 'invalid-uuid', limit: 10 } },
    { name: 'Empty projectId', input: { projectId: '', limit: 10 } },
  ];
  
  for (const test of invalidInputs) {
    try {
      console.log(`\n🔍 Testing: ${test.name}`);
      
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/messages.getMany`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(test.input)
      });

      if (response.ok) {
        console.log(`⚠️  ${test.name}: Expected validation error but got success`);
      } else {
        console.log(`✅ ${test.name}: Correctly rejected with HTTP ${response.status}`);
      }
      
    } catch (error) {
      console.log(`✅ ${test.name}: Correctly threw error - ${error.message}`);
    }
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting Messages Project Filtering Tests');
  console.log('=============================================');
  
  await testDirectAPIEndpoint();
  await testMultipleProjects();
  await testNonExistentProject();
  await testInputValidation();
  
  console.log('\n🏁 All tests completed!');
  console.log('\n📝 Next Steps:');
  console.log('1. Check the console output above for any failures');
  console.log('2. Verify that messages are correctly filtered by project_id');
  console.log('3. Test the frontend integration using the examples');
  console.log('4. Check your database to ensure test data exists');
}

// Run tests if this script is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  const fetch = require('node-fetch');
  runAllTests().catch(console.error);
} else {
  // Browser environment
  console.log('Run runAllTests() in the browser console to execute tests');
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testDirectAPIEndpoint,
    testMultipleProjects,
    testNonExistentProject,
    testInputValidation,
    TEST_CONFIG
  };
}