/**
 * Right Sidebar Scroll Spy Test Script
 * 
 * This script tests the right sidebar scroll-spy functionality by:
 * 1. Testing heading extraction from various MDX files
 * 2. Verifying ID generation consistency with rehype-slug
 * 3. Testing edge cases (duplicates, special characters, long text)
 * 4. Validating the complete flow
 * 
 * Requirements tested: 1.1, 1.2, 2.1, 2.4, 3.1, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import GithubSlugger from 'github-slugger';
import { extractHeadingsForTOC } from '../lib/docs/heading-utils';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  requirement?: string;
}

const results: TestResult[] = [];

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name: string, passed: boolean, message: string, requirement?: string) {
  const icon = passed ? '✓' : '✗';
  const color = passed ? colors.green : colors.red;
  const reqText = requirement ? ` [Req: ${requirement}]` : '';
  log(`  ${icon} ${name}${reqText}`, color);
  if (message) {
    log(`    ${message}`, colors.cyan);
  }
  results.push({ name, passed, message, requirement });
}

/**
 * Test 1: Heading extraction from various documentation pages
 * Requirements: 2.1, 2.2
 */
async function testHeadingExtraction() {
  log('\n📝 Test 1: Heading Extraction from Documentation Pages', colors.blue);
  
  const testFiles = [
    'content/docs/getting-started/introduction.mdx',
    'content/docs/features/ai-generation.mdx',
    'content/docs/api-reference/overview.mdx',
  ];
  
  for (const filePath of testFiles) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const headings = extractHeadingsForTOC(content);
      
      // Test that headings were extracted
      const hasHeadings = headings.length > 0;
      logTest(
        `Extract headings from ${filePath.split('/').pop()}`,
        hasHeadings,
        `Found ${headings.length} headings`,
        '2.1'
      );
      
      // Test that all headings have required properties
      const allValid = headings.every(h => h.id && h.text && h.level >= 2 && h.level <= 4);
      logTest(
        `All headings have valid structure`,
        allValid,
        `All ${headings.length} headings have id, text, and level (2-4)`,
        '2.2'
      );
      
      // Test that heading text is preserved
      const textPreserved = headings.every(h => h.text.length > 0);
      logTest(
        `Heading text is preserved`,
        textPreserved,
        'All headings have non-empty text',
        '2.2'
      );
      
    } catch (error) {
      logTest(
        `Extract headings from ${filePath.split('/').pop()}`,
        false,
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        '2.1'
      );
    }
  }
}

/**
 * Test 2: ID generation consistency with rehype-slug
 * Requirements: 4.1, 5.4
 */
async function testIdGenerationConsistency() {
  log('\n🔗 Test 2: ID Generation Consistency with rehype-slug', colors.blue);
  
  const testCases = [
    { text: 'Getting Started', expected: 'getting-started' },
    { text: 'What is SmartAPIForge?', expected: 'what-is-smartapiforge' },
    { text: 'API Reference', expected: 'api-reference' },
    { text: 'Using the API', expected: 'using-the-api' },
    { text: 'Next.js Integration', expected: 'nextjs-integration' },
  ];
  
  const slugger = new GithubSlugger();
  
  for (const testCase of testCases) {
    const mdxContent = `## ${testCase.text}`;
    const headings = extractHeadingsForTOC(mdxContent);
    
    // Reset slugger for comparison
    const sluggerTest = new GithubSlugger();
    const expectedId = sluggerTest.slug(testCase.text);
    
    const matches = headings.length > 0 && headings[0].id === expectedId;
    logTest(
      `ID for "${testCase.text}"`,
      matches,
      `Generated: "${headings[0]?.id}", Expected: "${expectedId}"`,
      '4.1'
    );
  }
}

/**
 * Test 3: Duplicate heading handling
 * Requirements: 4.3
 */
async function testDuplicateHeadings() {
  log('\n🔄 Test 3: Duplicate Heading Handling', colors.blue);
  
  const mdxWithDuplicates = `
## Installation
Some content here.

## Features
More content.

## Installation
Duplicate heading.

## Installation
Another duplicate.
`;
  
  const headings = extractHeadingsForTOC(mdxWithDuplicates);
  
  // Test that all IDs are unique
  const ids = headings.map(h => h.id);
  const uniqueIds = new Set(ids);
  const allUnique = ids.length === uniqueIds.size;
  
  logTest(
    'All heading IDs are unique',
    allUnique,
    `Generated ${ids.length} headings with ${uniqueIds.size} unique IDs`,
    '4.3'
  );
  
  // Test that duplicates have numeric suffixes
  const installationHeadings = headings.filter(h => h.text === 'Installation');
  const hasSuffixes = installationHeadings.length === 3 &&
    installationHeadings[0].id === 'installation' &&
    installationHeadings[1].id === 'installation-1' &&
    installationHeadings[2].id === 'installation-2';
  
  logTest(
    'Duplicate headings have numeric suffixes',
    hasSuffixes,
    `IDs: ${installationHeadings.map(h => h.id).join(', ')}`,
    '4.3'
  );
}

/**
 * Test 4: Special characters in headings
 * Requirements: 2.4, 4.4
 */
async function testSpecialCharacters() {
  log('\n🔤 Test 4: Special Characters in Headings', colors.blue);
  
  const testCases = [
    { text: 'What is tRPC?', shouldContainOnlyValid: true },
    { text: 'Using @decorators', shouldContainOnlyValid: true },
    { text: 'Error: 404 Not Found', shouldContainOnlyValid: true },
    { text: 'C++ Integration', shouldContainOnlyValid: true },
    { text: 'React & Vue.js', shouldContainOnlyValid: true },
  ];
  
  for (const testCase of testCases) {
    const mdxContent = `## ${testCase.text}`;
    const headings = extractHeadingsForTOC(mdxContent);
    
    if (headings.length > 0) {
      const id = headings[0].id;
      // Valid slug format: lowercase alphanumeric and hyphens only
      const isValidSlug = /^[a-z0-9-]+$/.test(id);
      
      logTest(
        `Valid slug for "${testCase.text}"`,
        isValidSlug,
        `Generated ID: "${id}"`,
        '4.4'
      );
      
      // Test that text is preserved (cleaned but readable)
      const hasText = headings[0].text.length > 0;
      logTest(
        `Text preserved for "${testCase.text}"`,
        hasText,
        `Text: "${headings[0].text}"`,
        '2.4'
      );
    }
  }
}

/**
 * Test 5: Very long heading text
 * Requirements: 2.4
 */
async function testLongHeadings() {
  log('\n📏 Test 5: Very Long Heading Text', colors.blue);
  
  const longHeading = 'This is a very long heading that contains many words and should still be processed correctly by the heading extraction function without any issues or errors';
  const mdxContent = `## ${longHeading}`;
  
  const headings = extractHeadingsForTOC(mdxContent);
  
  const extracted = headings.length > 0;
  logTest(
    'Long heading extracted successfully',
    extracted,
    `Extracted ${headings.length} heading(s)`,
    '2.4'
  );
  
  if (extracted) {
    const hasValidId = headings[0].id.length > 0;
    logTest(
      'Long heading has valid ID',
      hasValidId,
      `ID length: ${headings[0].id.length} characters`,
      '4.4'
    );
    
    const textPreserved = headings[0].text === longHeading;
    logTest(
      'Long heading text preserved',
      textPreserved,
      textPreserved ? 'Text matches original' : 'Text was modified',
      '2.4'
    );
  }
}

/**
 * Test 6: Heading hierarchy (h2, h3, h4)
 * Requirements: 2.1, 2.3
 */
async function testHeadingHierarchy() {
  log('\n📊 Test 6: Heading Hierarchy', colors.blue);
  
  const mdxWithHierarchy = `
## Level 2 Heading
### Level 3 Heading
#### Level 4 Heading
### Another Level 3
## Another Level 2
`;
  
  const headings = extractHeadingsForTOC(mdxWithHierarchy);
  
  // Test that all levels are captured
  const hasLevel2 = headings.some(h => h.level === 2);
  const hasLevel3 = headings.some(h => h.level === 3);
  const hasLevel4 = headings.some(h => h.level === 4);
  
  logTest(
    'All heading levels extracted (h2, h3, h4)',
    hasLevel2 && hasLevel3 && hasLevel4,
    `Found: h2=${hasLevel2}, h3=${hasLevel3}, h4=${hasLevel4}`,
    '2.1'
  );
  
  // Test that hierarchy is maintained
  const levels = headings.map(h => h.level);
  const hierarchyMaintained = levels.length === 5 &&
    levels[0] === 2 && levels[1] === 3 && levels[2] === 4 &&
    levels[3] === 3 && levels[4] === 2;
  
  logTest(
    'Heading hierarchy maintained',
    hierarchyMaintained,
    `Order: ${levels.join(' → ')}`,
    '2.3'
  );
}

/**
 * Test 7: Empty and edge cases
 * Requirements: 2.1, 5.5
 */
async function testEdgeCases() {
  log('\n⚠️  Test 7: Edge Cases', colors.blue);
  
  // Test empty content
  const emptyHeadings = extractHeadingsForTOC('');
  logTest(
    'Empty content returns empty array',
    emptyHeadings.length === 0,
    `Returned ${emptyHeadings.length} headings`,
    '2.1'
  );
  
  // Test content with no headings
  const noHeadingsContent = 'This is just regular text without any headings.';
  const noHeadings = extractHeadingsForTOC(noHeadingsContent);
  logTest(
    'Content without headings returns empty array',
    noHeadings.length === 0,
    `Returned ${noHeadings.length} headings`,
    '2.1'
  );
  
  // Test content with only h1 (should be ignored)
  const h1Content = '# This is H1\n## This is H2';
  const h1Headings = extractHeadingsForTOC(h1Content);
  const onlyH2 = h1Headings.length === 1 && h1Headings[0].level === 2;
  logTest(
    'H1 headings are ignored (only h2-h4)',
    onlyH2,
    `Extracted ${h1Headings.length} heading(s) at level ${h1Headings[0]?.level}`,
    '2.1'
  );
  
  // Test heading with markdown formatting
  const formattedContent = '## **Bold** and *italic* and `code`';
  const formattedHeadings = extractHeadingsForTOC(formattedContent);
  const cleanedText = formattedHeadings[0]?.text === 'Bold and italic and code';
  logTest(
    'Markdown formatting removed from heading text',
    cleanedText,
    `Text: "${formattedHeadings[0]?.text}"`,
    '2.4'
  );
}

/**
 * Test 8: Real documentation pages
 * Requirements: 1.1, 1.2, 2.1, 3.1, 4.2
 */
async function testRealDocumentationPages() {
  log('\n📚 Test 8: Real Documentation Pages', colors.blue);
  
  const pages = [
    { path: 'content/docs/getting-started/introduction.mdx', minHeadings: 5 },
    { path: 'content/docs/features/ai-generation.mdx', minHeadings: 10 },
    { path: 'content/docs/api-reference/overview.mdx', minHeadings: 15 },
  ];
  
  for (const page of pages) {
    try {
      const content = await readFile(page.path, 'utf-8');
      const headings = extractHeadingsForTOC(content);
      
      const hasEnoughHeadings = headings.length >= page.minHeadings;
      logTest(
        `${page.path.split('/').pop()} has sufficient headings`,
        hasEnoughHeadings,
        `Found ${headings.length} headings (expected ≥${page.minHeadings})`,
        '2.1'
      );
      
      // Test that all IDs are unique
      const ids = headings.map(h => h.id);
      const uniqueIds = new Set(ids);
      const allUnique = ids.length === uniqueIds.size;
      logTest(
        `All IDs unique in ${page.path.split('/').pop()}`,
        allUnique,
        `${ids.length} headings, ${uniqueIds.size} unique IDs`,
        '4.3'
      );
      
      // Test that all IDs are valid slugs
      const allValidSlugs = ids.every(id => /^[a-z0-9-]+$/.test(id));
      logTest(
        `All IDs are valid slugs in ${page.path.split('/').pop()}`,
        allValidSlugs,
        allValidSlugs ? 'All IDs valid' : 'Some IDs invalid',
        '4.4'
      );
      
    } catch (error) {
      logTest(
        `Process ${page.path.split('/').pop()}`,
        false,
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        '2.1'
      );
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n' + '='.repeat(70), colors.cyan);
  log('  Right Sidebar Scroll Spy - Comprehensive Test Suite', colors.cyan);
  log('='.repeat(70), colors.cyan);
  
  try {
    await testHeadingExtraction();
    await testIdGenerationConsistency();
    await testDuplicateHeadings();
    await testSpecialCharacters();
    await testLongHeadings();
    await testHeadingHierarchy();
    await testEdgeCases();
    await testRealDocumentationPages();
    
    // Summary
    log('\n' + '='.repeat(70), colors.cyan);
    log('  Test Summary', colors.cyan);
    log('='.repeat(70), colors.cyan);
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    const passRate = ((passed / total) * 100).toFixed(1);
    
    log(`\n  Total Tests: ${total}`, colors.blue);
    log(`  Passed: ${passed}`, colors.green);
    log(`  Failed: ${failed}`, failed > 0 ? colors.red : colors.green);
    log(`  Pass Rate: ${passRate}%`, failed > 0 ? colors.yellow : colors.green);
    
    if (failed > 0) {
      log('\n  Failed Tests:', colors.red);
      results.filter(r => !r.passed).forEach(r => {
        log(`    ✗ ${r.name}`, colors.red);
        log(`      ${r.message}`, colors.cyan);
      });
    }
    
    log('\n' + '='.repeat(70), colors.cyan);
    
    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    log('\n❌ Test suite failed with error:', colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests();
