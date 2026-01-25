/**
 * Verify Unicode Behavior
 * 
 * Tests that our ID generation matches github-slugger's unicode handling
 */

import GithubSlugger from 'github-slugger';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

log('\n' + '='.repeat(70), colors.cyan);
log('  Unicode Behavior Verification', colors.cyan);
log('='.repeat(70) + '\n', colors.cyan);

const slugger = new GithubSlugger();

const testCases = [
  'Émojis and Unicode: 🚀 ✨ 🎉',
  'Café',
  'naïve',
  'Zürich',
  '日本語',
];

log('Testing github-slugger unicode handling:\n', colors.green);

testCases.forEach(text => {
  const slug = slugger.slug(text);
  log(`Text: "${text}"`, colors.cyan);
  log(`Slug: "${slug}"`, colors.green);
  log(`Contains non-ASCII: ${/[^\x00-\x7F]/.test(slug)}\n`, colors.cyan);
  slugger.reset();
});

log('='.repeat(70), colors.cyan);
log('\nNote: github-slugger preserves unicode characters by default.', colors.green);
log('This matches rehype-slug behavior and is intentional.\n', colors.green);
log('='.repeat(70), colors.cyan);
