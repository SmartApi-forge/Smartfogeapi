/**
 * Debug script to test scroll spy behavior
 */

import { extractHeadingsForTOC } from '../lib/docs/heading-utils';
import { readFileSync } from 'fs';
import { join } from 'path';

const mdxPath = join(process.cwd(), 'content/docs/getting-started/introduction.mdx');
const content = readFileSync(mdxPath, 'utf-8');

console.log('📄 Testing heading extraction from introduction.mdx\n');
console.log('=' .repeat(60));

const headings = extractHeadingsForTOC(content);

console.log(`\n✓ Extracted ${headings.length} headings:\n`);

headings.forEach((heading, index) => {
  const indent = '  '.repeat(heading.level - 2);
  console.log(`${index + 1}. ${indent}[h${heading.level}] ${heading.text}`);
  console.log(`   ${indent}ID: #${heading.id}`);
});

console.log('\n' + '='.repeat(60));
console.log('\nHeadings JSON:');
console.log(JSON.stringify(headings, null, 2));
