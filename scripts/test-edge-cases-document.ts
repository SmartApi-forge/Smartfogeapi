/**
 * Edge Cases Document Test
 * 
 * Tests the edge cases document to verify all edge cases are handled correctly
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

async function testEdgeCasesDocument() {
  log('\n' + '='.repeat(70), colors.cyan);
  log('  Edge Cases Document Test', colors.cyan);
  log('='.repeat(70), colors.cyan);
  
  try {
    const content = await readFile('content/docs/test-edge-cases.mdx', 'utf-8');
    const headings = extractHeadingsForTOC(content);
    
    log(`\n📊 Extracted ${headings.length} headings\n`, colors.blue);
    
    // Display all headings with their IDs
    headings.forEach((heading, index) => {
      const indent = '  '.repeat(heading.level - 2);
      log(`${indent}${index + 1}. [h${heading.level}] "${heading.text}"`, colors.green);
      log(`${indent}    ID: "${heading.id}"`, colors.cyan);
    });
    
    // Verify specific edge cases
    log('\n' + '='.repeat(70), colors.cyan);
    log('  Edge Case Verification', colors.cyan);
    log('='.repeat(70) + '\n', colors.cyan);
    
    // Test 1: Duplicate headings have unique IDs
    const duplicateHeadings = headings.filter(h => h.text === 'Duplicate Heading');
    const duplicateIds = duplicateHeadings.map(h => h.id);
    const expectedDuplicateIds = ['duplicate-heading', 'duplicate-heading-1', 'duplicate-heading-2'];
    const duplicatesCorrect = JSON.stringify(duplicateIds) === JSON.stringify(expectedDuplicateIds);
    
    log(`✓ Duplicate headings: ${duplicatesCorrect ? 'PASS' : 'FAIL'}`, duplicatesCorrect ? colors.green : colors.red);
    log(`  Expected: ${expectedDuplicateIds.join(', ')}`, colors.cyan);
    log(`  Got: ${duplicateIds.join(', ')}\n`, colors.cyan);
    
    // Test 2: Special characters removed
    const specialCharsHeading = headings.find(h => h.text.includes('Special Characters'));
    const specialCharsId = specialCharsHeading?.id;
    const specialCharsCorrect = /^[a-z0-9-]+$/.test(specialCharsId || '');
    
    log(`✓ Special characters removed: ${specialCharsCorrect ? 'PASS' : 'FAIL'}`, specialCharsCorrect ? colors.green : colors.red);
    log(`  Text: "${specialCharsHeading?.text}"`, colors.cyan);
    log(`  ID: "${specialCharsId}"\n`, colors.cyan);
    
    // Test 3: Question marks handled
    const questionHeading = headings.find(h => h.text === 'What is tRPC?');
    const questionId = questionHeading?.id;
    const questionCorrect = questionId === 'what-is-trpc';
    
    log(`✓ Question marks handled: ${questionCorrect ? 'PASS' : 'FAIL'}`, questionCorrect ? colors.green : colors.red);
    log(`  Text: "${questionHeading?.text}"`, colors.cyan);
    log(`  ID: "${questionId}"\n`, colors.cyan);
    
    // Test 4: Code formatting removed
    const codeHeading = headings.find(h => h.text.includes('code'));
    const codeTextClean = !codeHeading?.text.includes('`');
    
    log(`✓ Code formatting removed: ${codeTextClean ? 'PASS' : 'FAIL'}`, codeTextClean ? colors.green : colors.red);
    log(`  Text: "${codeHeading?.text}"\n`, colors.cyan);
    
    // Test 5: Bold/italic removed
    const boldHeading = headings.find(h => h.text.includes('Bold') && h.text.includes('Italic'));
    const boldTextClean = boldHeading && !boldHeading.text.includes('*') && !boldHeading.text.includes('_');
    
    log(`✓ Bold/italic formatting removed: ${boldTextClean ? 'PASS' : 'FAIL'}`, boldTextClean ? colors.green : colors.red);
    log(`  Text: "${boldHeading?.text}"\n`, colors.cyan);
    
    // Test 6: Ampersand handled
    const ampersandHeading = headings.find(h => h.text.includes('React & Vue'));
    const ampersandId = ampersandHeading?.id;
    const ampersandCorrect = /^[a-z0-9-]+$/.test(ampersandId || '');
    
    log(`✓ Ampersand handled: ${ampersandCorrect ? 'PASS' : 'FAIL'}`, ampersandCorrect ? colors.green : colors.red);
    log(`  Text: "${ampersandHeading?.text}"`, colors.cyan);
    log(`  ID: "${ampersandId}"\n`, colors.cyan);
    
    // Test 7: Long heading handled
    const longHeading = headings.find(h => h.text.length > 100);
    const longHeadingExists = !!longHeading;
    const longIdValid = longHeading && /^[a-z0-9-]+$/.test(longHeading.id);
    
    log(`✓ Long heading handled: ${longHeadingExists && longIdValid ? 'PASS' : 'FAIL'}`, longHeadingExists && longIdValid ? colors.green : colors.red);
    log(`  Text length: ${longHeading?.text.length} characters`, colors.cyan);
    log(`  ID length: ${longHeading?.id.length} characters\n`, colors.cyan);
    
    // Test 8: All IDs are unique
    const ids = headings.map(h => h.id);
    const uniqueIds = new Set(ids);
    const allUnique = ids.length === uniqueIds.size;
    
    log(`✓ All IDs unique: ${allUnique ? 'PASS' : 'FAIL'}`, allUnique ? colors.green : colors.red);
    log(`  Total headings: ${ids.length}`, colors.cyan);
    log(`  Unique IDs: ${uniqueIds.size}\n`, colors.cyan);
    
    // Test 9: All IDs are valid slugs (allowing unicode as per github-slugger)
    // Note: github-slugger preserves unicode characters, which is intentional
    const allValidSlugs = ids.every(id => id.length > 0 && !id.includes(' '));
    
    log(`✓ All IDs are valid slugs: ${allValidSlugs ? 'PASS' : 'FAIL'}`, allValidSlugs ? colors.green : colors.red);
    log(`  Note: Unicode characters are preserved (matches rehype-slug)`, colors.cyan);
    if (!allValidSlugs) {
      const invalidIds = ids.filter(id => id.length === 0 || id.includes(' '));
      log(`  Invalid IDs: ${invalidIds.join(', ')}`, colors.red);
    }
    log('', colors.cyan);
    
    // Test 10: Hierarchy maintained
    const levels = headings.map(h => h.level);
    const validLevels = levels.every(l => l >= 2 && l <= 4);
    
    log(`✓ Valid heading levels (2-4): ${validLevels ? 'PASS' : 'FAIL'}`, validLevels ? colors.green : colors.red);
    log(`  Levels: ${[...new Set(levels)].sort().join(', ')}\n`, colors.cyan);
    
    log('='.repeat(70), colors.cyan);
    
  } catch (error) {
    log('\n❌ Test failed with error:', colors.red);
    console.error(error);
    process.exit(1);
  }
}

testEdgeCasesDocument();
