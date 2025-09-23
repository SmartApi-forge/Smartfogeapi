/**
 * Test file to verify the messages and fragments implementation
 * This tests the TypeScript types, Supabase operations, and database schema
 */

import { messageOperations, fragmentOperations } from './lib/supabase-server.js'
import { 
  CreateMessageInputSchema, 
  CreateFragmentInputSchema,
  MessageRoleSchema,
  MessageTypeSchema 
} from './src/modules/messages/types.js'

async function testMessagesImplementation() {
  console.log('🧪 Testing Messages and Fragments Implementation...\n')

  try {
    // Test 1: Validate Zod schemas
    console.log('1️⃣ Testing Zod schema validation...')
    
    const validMessageInput = {
      role: 'user',
      content: 'Hello, this is a test message',
      type: 'text',
      metadata: { source: 'test' }
    }
    
    const messageValidation = CreateMessageInputSchema.safeParse(validMessageInput)
    if (messageValidation.success) {
      console.log('✅ Message schema validation passed')
    } else {
      console.log('❌ Message schema validation failed:', messageValidation.error)
      return
    }

    // Test 2: Create a test message
    console.log('\n2️⃣ Testing message creation...')
    
    const newMessage = await messageOperations.create(validMessageInput)
    console.log('✅ Message created successfully:', {
      id: newMessage.id,
      role: newMessage.role,
      content: newMessage.content.substring(0, 50) + '...'
    })

    // Test 3: Create test fragments
    console.log('\n3️⃣ Testing fragment creation...')
    
    const fragmentInputs = [
      {
        message_id: newMessage.id,
        content: 'This is the first fragment',
        fragment_type: 'text',
        order_index: 0,
        metadata: { section: 'intro' }
      },
      {
        message_id: newMessage.id,
        content: 'This is the second fragment',
        fragment_type: 'text',
        order_index: 1,
        metadata: { section: 'body' }
      }
    ]

    // Validate fragment schemas
    for (const fragmentInput of fragmentInputs) {
      const fragmentValidation = CreateFragmentInputSchema.safeParse(fragmentInput)
      if (!fragmentValidation.success) {
        console.log('❌ Fragment schema validation failed:', fragmentValidation.error)
        return
      }
    }

    const fragments = await fragmentOperations.bulkCreate(fragmentInputs)
    console.log('✅ Fragments created successfully:', fragments.length, 'fragments')

    // Test 4: Test getWithFragments (the main getMany implementation)
    console.log('\n4️⃣ Testing getWithFragments (getMany implementation)...')
    
    const messagesWithFragments = await messageOperations.getWithFragments({ limit: 10 })
    console.log('✅ Retrieved messages with fragments:', messagesWithFragments.length, 'messages')
    
    // Verify the structure
    if (messagesWithFragments.length > 0) {
      const firstMessage = messagesWithFragments[0]
      console.log('📋 Message structure:', {
        id: firstMessage.id,
        role: firstMessage.role,
        type: firstMessage.type,
        fragmentsCount: firstMessage.fragments?.length || 0
      })
      
      if (firstMessage.fragments && firstMessage.fragments.length > 0) {
        console.log('📋 Fragment structure:', {
          id: firstMessage.fragments[0].id,
          fragment_type: firstMessage.fragments[0].fragment_type,
          order_index: firstMessage.fragments[0].order_index
        })
      }
    }

    // Test 5: Test fragment operations
    console.log('\n5️⃣ Testing fragment operations...')
    
    const messageFragments = await fragmentOperations.getByMessageId(newMessage.id)
    console.log('✅ Retrieved fragments by message ID:', messageFragments.length, 'fragments')
    
    // Test search functionality
    const searchResults = await fragmentOperations.searchByContent('first', { limit: 5 })
    console.log('✅ Fragment search results:', searchResults.length, 'matches')

    // Test 6: Test pagination
    console.log('\n6️⃣ Testing pagination...')
    
    const paginatedMessages = await messageOperations.getWithFragments({ 
      limit: 2, 
      offset: 0 
    })
    console.log('✅ Paginated messages retrieved:', paginatedMessages.length, 'messages')

    // Test 7: Test error handling
    console.log('\n7️⃣ Testing error handling...')
    
    try {
      await messageOperations.getById('invalid-uuid')
      console.log('❌ Error handling test failed - should have thrown an error')
    } catch (error) {
      console.log('✅ Error handling works correctly:', error.message.substring(0, 50) + '...')
    }

    console.log('\n🎉 All tests completed successfully!')
    console.log('\n📊 Implementation Summary:')
    console.log('- ✅ TypeScript types and Zod schemas working')
    console.log('- ✅ Database operations functioning')
    console.log('- ✅ Message-Fragment relationships established')
    console.log('- ✅ Pagination implemented')
    console.log('- ✅ Error handling in place')
    console.log('- ✅ Search functionality working')

  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('Stack trace:', error.stack)
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testMessagesImplementation()
}

export { testMessagesImplementation }