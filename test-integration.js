#!/usr/bin/env node

/**
 * Quick Integration Test for Smart Forge API
 * Run with: node test-integration.js
 */

require('dotenv').config();
const { Sandbox } = require('e2b');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSandboxTemplate() {
  log('blue', '\n🧪 Testing E2B Sandbox Template...');
  
  let sandbox = null;
  
  try {
    // Test sandbox creation
    log('yellow', '  Creating sandbox...');
    sandbox = await Sandbox.create('smart-forge-api-sandbox');
    log('green', '  ✅ Sandbox created successfully');
    
    // Test health check
    log('yellow', '  Testing health check...');
    const healthCheck = await sandbox.commands.run('health_check');
    if (healthCheck.exitCode === 0) {
      log('green', '  ✅ Health check passed');
    } else {
      log('red', '  ❌ Health check failed');
      console.log('    Output:', healthCheck.stdout || healthCheck.stderr);
    }
    
    // Test validation functions
    const functions = [
      { name: 'OpenAPI Validator', cmd: 'validate_openapi_spec --help' },
      { name: 'TypeScript Compiler', cmd: 'compile_typescript --help' },
      { name: 'ESLint', cmd: 'lint_code --help' },
      { name: 'Jest', cmd: 'run_tests --help' }
    ];
    
    for (const func of functions) {
      log('yellow', `  Testing ${func.name}...`);
      const result = await sandbox.commands.run(func.cmd);
      if (result.exitCode === 0) {
        log('green', `  ✅ ${func.name} available`);
      } else {
        log('red', `  ❌ ${func.name} not available`);
      }
    }
    
    // Test file operations
    log('yellow', '  Testing file operations...');
    await sandbox.files.write('/home/user/test.txt', 'Hello from test!');
    const content = await sandbox.files.read('/home/user/test.txt');
    if (content === 'Hello from test!') {
      log('green', '  ✅ File operations working');
    } else {
      log('red', '  ❌ File operations failed');
    }
    
    return true;
    
  } catch (error) {
    log('red', `  ❌ Sandbox test failed: ${error.message}`);
    return false;
  } finally {
    if (sandbox) {
      try {
        await sandbox.close();
        log('green', '  ✅ Sandbox cleaned up');
      } catch (cleanupError) {
        log('red', `  ⚠️  Cleanup warning: ${cleanupError.message}`);
      }
    }
  }
}

async function testOpenAPIValidation() {
  log('blue', '\n🔍 Testing OpenAPI Validation...');
  
  let sandbox = null;
  
  try {
    sandbox = await Sandbox.create('smart-forge-api-sandbox');
    
    // Create a valid OpenAPI spec
    const validSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
        description: 'A test API for validation'
      },
      paths: {
        '/users': {
          get: {
            summary: 'Get all users',
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    await sandbox.files.write('/home/user/valid-spec.json', JSON.stringify(validSpec, null, 2));
    
    log('yellow', '  Validating OpenAPI spec...');
    const validation = await sandbox.commands.run('validate_openapi_spec /home/user/valid-spec.json');
    
    if (validation.exitCode === 0) {
      log('green', '  ✅ OpenAPI validation passed');
      return true;
    } else {
      log('red', '  ❌ OpenAPI validation failed');
      console.log('    Output:', validation.stdout || validation.stderr);
      return false;
    }
    
  } catch (error) {
    log('red', `  ❌ OpenAPI validation test failed: ${error.message}`);
    return false;
  } finally {
    if (sandbox) {
      await sandbox.close();
    }
  }
}

async function testTypeScriptCompilation() {
  log('blue', '\n📝 Testing TypeScript Compilation...');
  
  let sandbox = null;
  
  try {
    sandbox = await Sandbox.create('smart-forge-api-sandbox');
    
    // Create a simple TypeScript file
    const tsCode = `
import express from 'express';

const app = express();
const port = 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});

export default app;
`;
    
    await sandbox.files.write('/home/user/src/app.ts', tsCode);
    
    log('yellow', '  Compiling TypeScript...');
    const compilation = await sandbox.commands.run('compile_typescript /home/user/src');
    
    if (compilation.exitCode === 0) {
      log('green', '  ✅ TypeScript compilation passed');
      return true;
    } else {
      log('red', '  ❌ TypeScript compilation failed');
      console.log('    Output:', compilation.stdout || compilation.stderr);
      return false;
    }
    
  } catch (error) {
    log('red', `  ❌ TypeScript compilation test failed: ${error.message}`);
    return false;
  } finally {
    if (sandbox) {
      await sandbox.close();
    }
  }
}

async function testRepositoryCloning() {
  log('blue', '\n📂 Testing Repository Cloning...');
  
  let sandbox = null;
  
  try {
    sandbox = await Sandbox.create('smart-forge-api-sandbox');
    
    // Test cloning a small public repository
    log('yellow', '  Cloning test repository...');
    const cloneResult = await sandbox.commands.run(
      'git clone https://github.com/octocat/Hello-World.git /home/user/test-repo'
    );
    
    if (cloneResult.exitCode === 0) {
      log('green', '  ✅ Repository cloned successfully');
      
      // Test reading files
      log('yellow', '  Reading repository files...');
      const files = await sandbox.commands.run('ls -la /home/user/test-repo');
      if (files.exitCode === 0) {
        log('green', '  ✅ Repository files accessible');
        console.log('    Files:', files.stdout.split('\n').slice(0, 5).join('\n    '));
        return true;
      } else {
        log('red', '  ❌ Could not access repository files');
        return false;
      }
    } else {
      log('red', '  ❌ Repository cloning failed');
      console.log('    Error:', cloneResult.stderr);
      return false;
    }
    
  } catch (error) {
    log('red', `  ❌ Repository cloning test failed: ${error.message}`);
    return false;
  } finally {
    if (sandbox) {
      await sandbox.close();
    }
  }
}

async function testInngestEndpoint() {
  log('blue', '\n🔗 Testing Inngest Endpoint...');
  
  try {
    const response = await fetch('http://localhost:3000/api/inngest', {
      method: 'GET'
    });
    
    if (response.ok) {
      log('green', '  ✅ Inngest endpoint accessible');
      return true;
    } else {
      log('red', `  ❌ Inngest endpoint returned ${response.status}`);
      return false;
    }
  } catch (error) {
    log('red', `  ❌ Inngest endpoint test failed: ${error.message}`);
    log('yellow', '  💡 Make sure your dev server is running: npm run dev');
    return false;
  }
}

async function runAllTests() {
  log('blue', '🚀 Starting Smart Forge API Integration Tests\n');
  
  // Check environment variables
  const requiredEnvVars = ['E2B_API_KEY', 'OPENAI_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log('red', `❌ Missing environment variables: ${missingVars.join(', ')}`);
    log('yellow', '💡 Create a .env file with the required variables');
    process.exit(1);
  }
  
  const tests = [
    { name: 'Sandbox Template', fn: testSandboxTemplate },
    { name: 'OpenAPI Validation', fn: testOpenAPIValidation },
    { name: 'TypeScript Compilation', fn: testTypeScriptCompilation },
    { name: 'Repository Cloning', fn: testRepositoryCloning },
    { name: 'Inngest Endpoint', fn: testInngestEndpoint }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
  }
  
  // Summary
  log('blue', '\n📊 Test Results Summary:');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(color, `  ${icon} ${result.name}`);
  });
  
  log('blue', `\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    log('green', '🎉 All tests passed! Your Smart Forge API is ready to use.');
    log('blue', '\n💡 Next steps:');
    log('blue', '   1. Start your dev server: npm run dev');
    log('blue', '   2. Visit http://localhost:3000 to test the UI');
    log('blue', '   3. Try generating an API with a simple prompt');
  } else {
    log('red', '⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    log('red', `💥 Test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  testSandboxTemplate,
  testOpenAPIValidation,
  testTypeScriptCompilation,
  testRepositoryCloning,
  testInngestEndpoint,
  runAllTests
};