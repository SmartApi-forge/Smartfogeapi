import { inngest } from './src/inngest/client.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testInngestTrigger() {
  console.log('Testing Inngest API generation trigger...');
  
  try {
    // Send the api/generate event
    const result = await inngest.send({
      name: "api/generate",
      data: {
        jobId: "test-job-" + Date.now(),
        projectId: "test-project-123",
        prompt: "Create a simple REST API for managing users with CRUD operations",
        framework: "express",
        advanced: false,
        template: "basic",
        userId: "test-user-123"
      }
    });
    
    console.log('Inngest event sent successfully:', result);
    console.log('Event ID:', result.ids);
    
    // Wait a moment to see if the function starts processing
    console.log('Waiting 5 seconds to check for processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Test completed. Check the server logs for function execution.');
    
  } catch (error) {
    console.error('Error triggering Inngest function:', error);
    console.error('Error details:', error.message);
  }
}

testInngestTrigger();