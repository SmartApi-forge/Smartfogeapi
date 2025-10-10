/**
 * Projects API Test Script
 * 
 * This script tests the new projects.getOne and projects.getMany tRPC procedures
 * to ensure proper functionality and error handling.
 */

import { createTRPCMsw } from 'msw-trpc';
import { appRouter } from './src/trpc/routers/_app.js';

// Test configuration
const TEST_CONFIG = {
  VALID_PROJECT_ID: '550e8400-e29b-41d4-a716-446655440000',
  INVALID_PROJECT_ID: '00000000-0000-0000-0000-000000000000',
  USER_ID: 'test-user-id'
};

console.log('🧪 Starting Projects API Tests...\n');

// Mock authentication context
const mockContext = {
  user: { id: TEST_CONFIG.USER_ID }
};

async function testProjectsGetOne() {
  console.log('📋 Testing projects.getOne procedure...');
  
  try {
    // Test with valid project ID
    console.log('  ✅ Testing with valid project ID...');
    const validResult = await appRouter
      .createCaller(mockContext)
      .projects.getOne({ id: TEST_CONFIG.VALID_PROJECT_ID });
    
    console.log('  ✅ Valid project result:', {
      id: validResult.id,
      name: validResult.name,
      status: validResult.status
    });
    
  } catch (error) {
    console.log('  ⚠️  Valid project test result:', error.message);
  }
  
  try {
    // Test with invalid project ID (should return NOT_FOUND)
    console.log('  🔍 Testing with invalid project ID (expecting NOT_FOUND)...');
    await appRouter
      .createCaller(mockContext)
      .projects.getOne({ id: TEST_CONFIG.INVALID_PROJECT_ID });
    
    console.log('  ❌ ERROR: Should have thrown NOT_FOUND error');
    
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      console.log('  ✅ Correctly returned NOT_FOUND error:', error.message);
    } else {
      console.log('  ❌ Unexpected error:', error.message);
    }
  }
  
  console.log('');
}

async function testProjectsGetMany() {
  console.log('📋 Testing projects.getMany procedure...');
  
  try {
    // Test with default pagination
    console.log('  ✅ Testing with default pagination...');
    const defaultResult = await appRouter
      .createCaller(mockContext)
      .projects.getMany({});
    
    console.log('  ✅ Default pagination result:', {
      count: defaultResult.length,
      firstProject: defaultResult[0] ? {
        id: defaultResult[0].id,
        name: defaultResult[0].name
      } : 'No projects found'
    });
    
    // Test with custom pagination
    console.log('  ✅ Testing with custom pagination...');
    const customResult = await appRouter
      .createCaller(mockContext)
      .projects.getMany({ limit: 5, offset: 0 });
    
    console.log('  ✅ Custom pagination result:', {
      count: customResult.length,
      maxExpected: 5
    });
    
  } catch (error) {
    console.log('  ❌ Error in getMany test:', error.message);
  }
  
  console.log('');
}

async function testMessagesGetMany() {
  console.log('📋 Testing messages.getMany procedure (existing functionality)...');
  
  try {
    // Test with project ID and fragments
    console.log('  ✅ Testing with projectId and includeFragment...');
    const result = await appRouter
      .createCaller(mockContext)
      .messages.getMany({ 
        projectId: TEST_CONFIG.VALID_PROJECT_ID,
        includeFragment: true,
        limit: 10
      });
    
    console.log('  ✅ Messages with fragments result:', {
      count: result.length,
      hasFragments: result.some(msg => msg.fragments && msg.fragments.length > 0)
    });
    
  } catch (error) {
    console.log('  ❌ Error in messages.getMany test:', error.message);
  }
  
  console.log('');
}

async function runAllTests() {
  try {
    await testProjectsGetOne();
    await testProjectsGetMany();
    await testMessagesGetMany();
    
    console.log('🎉 All tests completed!');
    console.log('\n📝 Test Summary:');
    console.log('  - projects.getOne: Tests valid/invalid project IDs and NOT_FOUND error handling');
    console.log('  - projects.getMany: Tests pagination with default and custom parameters');
    console.log('  - messages.getMany: Tests existing functionality with projectId filtering and fragments');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the tests
runAllTests();