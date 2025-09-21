// Complete Workflow Test - AI Prompt → Inngest → E2B
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { Inngest } = require('inngest');

const inngest = new Inngest({ 
  id: "smart-forge-api",
  eventKey: process.env.INNGEST_EVENT_KEY
});

async function testCompleteWorkflow() {
  console.log('🚀 Testing Complete AI → Inngest → E2B Workflow\n');
  
  // Check environment variables
  const requiredEnvVars = ['E2B_API_KEY', 'OPENAI_API_KEY', 'INNGEST_EVENT_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:', missingVars.join(', '));
    console.log('💡 Please set these in your .env file\n');
    return;
  }
  
  console.log('✅ Environment variables configured\n');
  
  // Test different API generation scenarios
  const testCases = [
    {
      name: 'Simple Todo API',
      prompt: 'Create a REST API for a todo application with endpoints to create, read, update, and delete todos. Each todo should have an id, title, description, and completed status.',
      mode: 'standalone'
    },
    {
      name: 'User Management API',
      prompt: 'Create an API for user management with authentication, including endpoints for user registration, login, profile management, and password reset.',
      mode: 'standalone'
    },
    {
      name: 'GitHub Repository Analysis',
      prompt: 'Analyze this repository and create an API that fits the existing codebase structure',
      mode: 'github',
      repoUrl: 'https://github.com/vercel/next.js' // Example repo
    }
  ];
  
  console.log('📋 Available test cases:');
  testCases.forEach((testCase, index) => {
    console.log(`  ${index + 1}. ${testCase.name} (${testCase.mode} mode)`);
  });
  
  // For demo, we'll test the first case
  const selectedTest = testCases[0];
  console.log(`\n🎯 Testing: ${selectedTest.name}\n`);
  
  try {
    // Send event to trigger API generation
    console.log('📤 Sending event to Inngest...');
    const eventData = {
      name: "api/generate",
      data: {
        prompt: selectedTest.prompt,
        mode: selectedTest.mode,
        userId: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID for testing
        ...(selectedTest.repoUrl && { repoUrl: selectedTest.repoUrl })
      }
    };
    
    const result = await inngest.send(eventData);
    console.log('✅ Event sent successfully!');
    console.log('📊 Event ID:', result.ids?.[0] || 'N/A');
    
    console.log('\n🔍 What happens next:');
    console.log('1. 📡 Inngest receives the event');
    console.log('2. 🤖 OpenAI generates API specification and code');
    if (selectedTest.mode === 'github') {
      console.log('3. 📁 E2B sandbox analyzes the GitHub repository');
    }
    console.log('3. 🔧 E2B sandbox validates the generated code');
    console.log('4. ⚡ E2B sandbox executes and tests the API');
    console.log('5. 💾 Results are saved to the database');
    
    console.log('\n📈 Monitoring Options:');
    console.log('• Inngest Dashboard: https://app.inngest.com');
    console.log('• Local logs: Check your `npm run dev` terminal');
    console.log('• E2B Dashboard: https://e2b.dev/dashboard');
    
    console.log('\n⏱️  Expected completion time: 2-3 minutes');
    console.log('\n💡 To test other scenarios, modify the selectedTest variable in this script');
    
  } catch (error) {
    console.error('❌ Error sending event:', error.message);
    
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.log('\n🔑 Authentication issue detected:');
      console.log('• Check your INNGEST_EVENT_KEY in .env');
      console.log('• Verify your Inngest project configuration');
    }
    
    if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      console.log('\n🌐 Network issue detected:');
      console.log('• Check your internet connection');
      console.log('• Verify Inngest service status');
    }
  }
}

// Direct E2B sandbox test function
async function testE2BSandboxDirect() {
  console.log('\n🔧 Testing E2B Sandbox Directly...');
  
  if (!process.env.E2B_API_KEY) {
    console.log('❌ E2B_API_KEY not found in environment variables');
    return;
  }
  
  const { Sandbox } = require('e2b');
  let sandbox;
  
  try {
    console.log('📦 Creating sandbox with template: smart-forge-api-sandbox');
    sandbox = await Sandbox.create('smart-forge-api-sandbox');
    console.log('✅ Sandbox created successfully!');
    
    // Test basic commands
    console.log('\n🧪 Running basic tests...');
    
    const nodeVersion = await sandbox.commands.run('node --version');
    console.log('📋 Node.js version:', nodeVersion.stdout.trim());
    
    const npmVersion = await sandbox.commands.run('npm --version');
    console.log('📦 NPM version:', npmVersion.stdout.trim());
    
    // Test OpenAPI tools
    const swaggerCheck = await sandbox.commands.run('npx swagger-parser --version');
    console.log('🔍 Swagger Parser:', swaggerCheck.exitCode === 0 ? 'Available' : 'Not available');
    
    // Test TypeScript
    const tscCheck = await sandbox.commands.run('npx tsc --version');
    console.log('📝 TypeScript:', tscCheck.exitCode === 0 ? 'Available' : 'Not available');
    
    console.log('\n✅ E2B sandbox is ready for API generation and testing!');
    
  } catch (error) {
    console.error('❌ E2B sandbox error:', error.message);
    
    if (error.message.includes('template not found')) {
      console.log('\n🔨 Template issue detected:');
      console.log('• Run: e2b template build');
      console.log('• Verify e2b.toml configuration');
    }
    
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.log('\n🔑 Authentication issue:');
      console.log('• Check your E2B_API_KEY');
      console.log('• Run: e2b auth login');
    }
  } finally {
    if (sandbox) {
      await sandbox.kill();
      console.log('🧹 Sandbox cleaned up');
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--e2b-only')) {
    await testE2BSandboxDirect();
  } else if (args.includes('--workflow-only')) {
    await testCompleteWorkflow();
  } else {
    // Run both tests
    await testE2BSandboxDirect();
    await testCompleteWorkflow();
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testCompleteWorkflow,
  testE2BSandboxDirect
};