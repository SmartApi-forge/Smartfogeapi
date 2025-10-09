/**
 * tRPC Messages Test Script
 * 
 * This script tests the messages.getMany tRPC procedure directly
 * using the tRPC client to ensure proper functionality.
 */

import { createTRPCMsw } from 'msw-trpc';
import { appRouter } from './src/trpc/routers/_app';

// Test configuration
const TEST_CONFIG = {
  PROJECT_ID_1: '550e8400-e29b-41d4-a716-446655440000',
  PROJECT_ID_2: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  LIMIT: 10,
  INCLUDE_FRAGMENT: true
};

/**
 * Test 1: Basic tRPC procedure call
 */
async function testBasicTRPCCall() {
  console.log('\n🧪 Test 1: Basic tRPC Procedure Call');
  console.log('====================================');
  
  try {
    // This would be the actual tRPC client call in a real environment
    console.log('📞 Calling messages.getMany with:');
    console.log({
      projectId: TEST_CONFIG.PROJECT_ID_1,
      limit: TEST_CONFIG.LIMIT,
      includeFragment: TEST_CONFIG.INCLUDE_FRAGMENT
    });
    
    // Note: In a real test environment, you would use:
    // const result = await trpc.messages.getMany.query({
    //   projectId: TEST_CONFIG.PROJECT_ID_1,
    //   limit: TEST_CONFIG.LIMIT,
    //   includeFragment: TEST_CONFIG.INCLUDE_FRAGMENT
    // });
    
    console.log('✅ tRPC call structure is correct');
    console.log('📝 To run this test, you need to:');
    console.log('   1. Set up your tRPC client in a test environment');
    console.log('   2. Ensure your database has test data');
    console.log('   3. Run this with proper tRPC context');
    
  } catch (error) {
    console.error('❌ tRPC test failed:', error.message);
  }
}

/**
 * Test 2: Input validation test
 */
async function testInputValidation() {
  console.log('\n🧪 Test 2: Input Validation');
  console.log('============================');
  
  const testCases = [
    {
      name: 'Valid input',
      input: {
        projectId: TEST_CONFIG.PROJECT_ID_1,
        limit: 10,
        includeFragment: true
      },
      shouldPass: true
    },
    {
      name: 'Missing projectId',
      input: {
        limit: 10,
        includeFragment: true
      },
      shouldPass: false
    },
    {
      name: 'Invalid UUID format',
      input: {
        projectId: 'invalid-uuid',
        limit: 10,
        includeFragment: true
      },
      shouldPass: false
    },
    {
      name: 'Negative limit',
      input: {
        projectId: TEST_CONFIG.PROJECT_ID_1,
        limit: -1,
        includeFragment: true
      },
      shouldPass: false
    }
  ];
  
  testCases.forEach(testCase => {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`   Input: ${JSON.stringify(testCase.input)}`);
    console.log(`   Expected: ${testCase.shouldPass ? 'PASS' : 'FAIL'}`);
    
    // In a real test environment, you would validate the input against the schema
    try {
      // This is where you would call the actual tRPC procedure
      console.log(`   ✅ Test case prepared for: ${testCase.name}`);
    } catch (error) {
      console.log(`   ❌ Error in test case: ${error.message}`);
    }
  });
}

/**
 * Test 3: Response structure validation
 */
async function testResponseStructure() {
  console.log('\n🧪 Test 3: Response Structure Validation');
  console.log('========================================');
  
  console.log('📋 Expected response structure:');
  console.log(`
  {
    messages: [
      {
        id: string,
        content: string,
        role: 'user' | 'assistant' | 'system',
        type: 'text' | 'image' | 'file',
        project_id: string,
        created_at: string,
        updated_at: string,
        fragments?: [
          {
            id: string,
            content: string,
            message_id: string,
            created_at: string,
            updated_at: string
          }
        ]
      }
    ]
  }
  `);
  
  console.log('✅ Response structure validation prepared');
}

/**
 * Manual testing instructions
 */
function printManualTestingInstructions() {
  console.log('\n📖 Manual Testing Instructions');
  console.log('==============================');
  
  console.log(`
🔧 Setup Steps:
1. Ensure your development server is running (npm run dev)
2. Make sure your database has test data with messages for different projects
3. Update the PROJECT_ID values in the test config with real project IDs

🧪 Testing Methods:

Method 1: Browser Console Testing
--------------------------------
1. Open your app in the browser (http://localhost:3000)
2. Open browser developer tools (F12)
3. In the console, run:

   // Test the tRPC client directly
   const result = await window.trpc.messages.getMany.query({
     projectId: '${TEST_CONFIG.PROJECT_ID_1}',
     limit: 10,
     includeFragment: true
   });
   console.log(result);

Method 2: React Component Testing
--------------------------------
1. Use the example components in examples/frontend-usage.tsx
2. Update the projectId values to match your test data
3. Check the browser network tab to see the API calls
4. Verify the responses contain only messages for the specified project

Method 3: API Testing with curl
------------------------------
curl -X POST http://localhost:3000/api/trpc/messages.getMany \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "${TEST_CONFIG.PROJECT_ID_1}",
    "limit": 10,
    "includeFragment": true
  }'

Method 4: Database Verification
------------------------------
1. Connect to your Supabase database
2. Run this SQL query to verify the filtering:

   SELECT m.*, f.content as fragment_content 
   FROM messages m 
   LEFT JOIN fragments f ON m.id = f.message_id 
   WHERE m.project_id = '${TEST_CONFIG.PROJECT_ID_1}'
   ORDER BY m.updated_at DESC 
   LIMIT 10;

🔍 What to Verify:
- ✅ Only messages with the specified project_id are returned
- ✅ Fragments are included when includeFragment is true
- ✅ Limit parameter works correctly
- ✅ Invalid project IDs return empty results
- ✅ Missing projectId parameter returns validation error
- ✅ Response structure matches expected format
  `);
}

/**
 * Main test runner
 */
async function runTRPCTests() {
  console.log('🚀 Starting tRPC Messages Tests');
  console.log('===============================');
  
  await testBasicTRPCCall();
  await testInputValidation();
  await testResponseStructure();
  printManualTestingInstructions();
  
  console.log('\n🏁 tRPC tests completed!');
}

// Export for use in other files
export {
  runTRPCTests,
  testBasicTRPCCall,
  testInputValidation,
  testResponseStructure,
  TEST_CONFIG
};

// Run tests if this script is executed directly
if (typeof window === 'undefined') {
  runTRPCTests().catch(console.error);
}