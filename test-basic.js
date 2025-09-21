// Basic test without API keys - tests the structure and imports
const fs = require('fs');
const path = require('path');

console.log('🚀 Running Basic Smart Forge API Tests\n');

// Test 1: Check if main files exist
function testFileStructure() {
  console.log('📁 Testing file structure...');
  
  const requiredFiles = [
    'src/inngest/functions.ts',
    'e2b.Dockerfile',
    'compile_page.sh',
    'package.json'
  ];
  
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`  ✅ ${file} exists`);
    } else {
      console.log(`  ❌ ${file} missing`);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

// Test 2: Check TypeScript compilation
function testTypeScriptCompilation() {
  console.log('\n🔧 Testing TypeScript compilation...');
  
  try {
    const { execSync } = require('child_process');
    execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
    console.log('  ✅ TypeScript compilation successful');
    return true;
  } catch (error) {
    console.log('  ❌ TypeScript compilation failed');
    console.log('  Error:', error.message.split('\n')[0]);
    return false;
  }
}

// Test 3: Check package.json dependencies
function testDependencies() {
  console.log('\n📦 Testing dependencies...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['e2b', 'inngest', 'openai', '@supabase/supabase-js'];
    
    let allDepsPresent = true;
    
    requiredDeps.forEach(dep => {
      if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
        console.log(`  ✅ ${dep} is installed`);
      } else {
        console.log(`  ❌ ${dep} is missing`);
        allDepsPresent = false;
      }
    });
    
    return allDepsPresent;
  } catch (error) {
    console.log('  ❌ Failed to read package.json');
    return false;
  }
}

// Test 4: Check Inngest function structure
function testInngestFunction() {
  console.log('\n⚡ Testing Inngest function structure...');
  
  try {
    const functionsContent = fs.readFileSync('src/inngest/functions.ts', 'utf8');
    
    const checks = [
      { name: 'E2B Sandbox import', pattern: /from ['"]e2b['"]/ },
      { name: 'generateAPI function', pattern: /export const generateAPI/ },
      { name: 'Repository analysis', pattern: /repoAnalysis.*=.*await step\.run.*analyze-repository/ },
      { name: 'Sandbox validation', pattern: /Sandbox\.create.*smart-forge-api-sandbox/ },
      { name: 'API execution testing', pattern: /executionResult/ }
    ];
    
    let allChecksPass = true;
    
    checks.forEach(check => {
      if (check.pattern.test(functionsContent)) {
        console.log(`  ✅ ${check.name} found`);
      } else {
        console.log(`  ❌ ${check.name} missing`);
        allChecksPass = false;
      }
    });
    
    return allChecksPass;
  } catch (error) {
    console.log('  ❌ Failed to read Inngest functions file');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const results = {
    fileStructure: testFileStructure(),
    typeScript: testTypeScriptCompilation(),
    dependencies: testDependencies(),
    inngestFunction: testInngestFunction()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  
  console.log('\n' + (allPassed ? '🎉 All tests passed!' : '⚠️  Some tests failed'));
  
  if (allPassed) {
    console.log('\n💡 Next steps:');
    console.log('1. Copy .env.example to .env and add your API keys');
    console.log('2. Build the e2b template: e2b template build');
    console.log('3. Run the full integration test: node test-integration.js');
    console.log('4. Start the development server: npm run dev');
  }
  
  return allPassed;
}

runAllTests().catch(console.error);