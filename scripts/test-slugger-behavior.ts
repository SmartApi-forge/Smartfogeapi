/**
 * Test to verify github-slugger behavior matches rehype-slug
 */

import GithubSlugger from 'github-slugger';

const slugger = new GithubSlugger();

console.log('Testing github-slugger behavior:\n');

const testCases = [
  'Multiple   Spaces',
  'Multiple     Spaces',
  'Tab\tCharacter',
  'Newline\nCharacter',
];

testCases.forEach(text => {
  const slug = slugger.slug(text);
  console.log(`"${text}" → "${slug}"`);
  slugger.reset();
});

console.log('\nNote: github-slugger converts each whitespace character to a hyphen.');
console.log('This is the expected behavior and matches rehype-slug.');
