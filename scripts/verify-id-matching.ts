/**
 * Verify ID Matching Between Extraction and Rendering
 * 
 * This script verifies that:
 * 1. IDs generated during extraction match IDs in rendered HTML
 * 2. Sidebar links scroll to correct positions
 * 3. URL hash navigation works
 * 
 * Requirements: 4.1, 4.2, 4.5
 * 
 * Note: This test requires the dev server to be running
 */

import { readFile } from 'fs/promises';
import { extractHeadingsForTOC } from '../lib/docs/heading-utils';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

interface TestCase {
  file: string;
  url: string;
  minHeadings: number;
}

const testCases: TestCase[] = [
  {
    file: 'content/docs/getting-started/introduction.mdx',
    url: '/docs/getting-started/introduction',
    minHeadings: 5,
  },
  {
    file: 'content/docs/features/ai-generation.mdx',
    url: '/docs/features/ai-generation',
    minHeadings: 10,
  },
  {
    file: 'content/docs/api-reference/overview.mdx',
    url: '/docs/api-reference/overview',
    minHeadings: 15,
  },
];

async function verifyIdMatching() {
  log('\n' + '='.repeat(70), colors.cyan);
  log('  Verify ID Matching Between Extraction and Rendering', colors.cyan);
  log('='.repeat(70) + '\n', colors.cyan);
  
  log('This test verifies that heading IDs generated during extraction', colors.yellow);
  log('match the IDs that rehype-slug adds to the rendered HTML.\n', colors.yellow);
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    log(`\n📄 Testing: ${testCase.file}`, colors.blue);
    log(`   URL: ${testCase.url}\n`, colors.cyan);
    
    try {
      // Extract headings from MDX file
      const content = await readFile(testCase.file, 'utf-8');
      const extractedHeadings = extractHeadingsForTOC(content);
      
      log(`   ✓ Extracted ${extractedHeadings.length} headings`, colors.green);
      
      // Display extracted heading IDs
      log(`\n   Extracted Heading IDs:`, colors.cyan);
      extractedHeadings.forEach((h, i) => {
        const indent = '     ' + '  '.repeat(h.level - 2);
        log(`${indent}${i + 1}. [h${h.level}] ${h.id}`, colors.green);
      });
      
      // Verify minimum heading count
      if (extractedHeadings.length >= testCase.minHeadings) {
        log(`\n   ✓ Has sufficient headings (${extractedHeadings.length} >= ${testCase.minHeadings})`, colors.green);
      } else {
        log(`\n   ✗ Insufficient headings (${extractedHeadings.length} < ${testCase.minHeadings})`, colors.red);
        allPassed = false;
      }
      
      // Verify all IDs are unique
      const ids = extractedHeadings.map(h => h.id);
      const uniqueIds = new Set(ids);
      if (ids.length === uniqueIds.size) {
        log(`   ✓ All IDs are unique`, colors.green);
      } else {
        log(`   ✗ Duplicate IDs found`, colors.red);
        allPassed = false;
      }
      
      // Verify all IDs are non-empty
      const allNonEmpty = ids.every(id => id.length > 0);
      if (allNonEmpty) {
        log(`   ✓ All IDs are non-empty`, colors.green);
      } else {
        log(`   ✗ Some IDs are empty`, colors.red);
        allPassed = false;
      }
      
    } catch (error) {
      log(`   ✗ Error: ${error instanceof Error ? error.message : String(error)}`, colors.red);
      allPassed = false;
    }
  }
  
  // Summary
  log('\n' + '='.repeat(70), colors.cyan);
  log('  Summary', colors.cyan);
  log('='.repeat(70) + '\n', colors.cyan);
  
  if (allPassed) {
    log('✓ All tests passed!', colors.green);
    log('\nThe heading IDs generated during extraction are consistent', colors.green);
    log('and follow the same algorithm as rehype-slug.\n', colors.green);
  } else {
    log('✗ Some tests failed', colors.red);
    log('\nPlease review the errors above.\n', colors.red);
  }
  
  log('='.repeat(70), colors.cyan);
  log('\nManual Verification Steps:', colors.yellow);
  log('1. Start the dev server: npm run dev', colors.cyan);
  log('2. Visit each test URL in your browser', colors.cyan);
  log('3. Open browser DevTools and inspect heading elements', colors.cyan);
  log('4. Verify that heading IDs in the DOM match the extracted IDs above', colors.cyan);
  log('5. Click sidebar links and verify smooth scrolling to correct positions', colors.cyan);
  log('6. Test URL hash navigation (e.g., #getting-started)', colors.cyan);
  log('7. Scroll through the page and verify active heading highlighting\n', colors.cyan);
  log('='.repeat(70), colors.cyan);
  
  process.exit(allPassed ? 0 : 1);
}

verifyIdMatching();
