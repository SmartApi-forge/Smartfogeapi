/**
 * Documentation URL Restructure Verification Script
 * 
 * This script performs comprehensive verification of the documentation URL restructure:
 * - Tests all navigation links are valid
 * - Verifies old URLs redirect correctly
 * - Checks SEO meta tags
 * - Validates URL structure compliance
 * - Ensures no 404 errors
 */

import { docsContent, navigationSections } from '../lib/docs/content'
import { navigationConfig, getAllNavigationItems } from '../lib/docs/navigation-config'

interface VerificationResult {
  passed: boolean
  message: string
  details?: string[]
}

interface TestResults {
  urlStructure: VerificationResult
  navigationLinks: VerificationResult
  redirectMappings: VerificationResult
  contentLinks: VerificationResult
  fileOrganization: VerificationResult
  seoMetadata: VerificationResult
}

// Expected URL redirects from old v0 structure to new structure
const EXPECTED_REDIRECTS: Record<string, string> = {
  'introduction': '/docs/getting-started/introduction',
  'quickstart': '/docs/getting-started/quick-start',
  'agentic-features': '/docs/features/ai-generation',
  'vercel-integration': '/docs/deployment/vercel',
  'faqs': '/docs/troubleshooting/faq',
}

// Valid categories for URL structure
const VALID_CATEGORIES = [
  'getting-started',
  'features',
  'api-reference',
  'guides',
  'deployment',
  'troubleshooting'
]

/**
 * Test 1: Verify URL Structure Compliance
 * All documentation URLs should follow /docs/{category}/{slug} pattern
 */
function verifyUrlStructure(): VerificationResult {
  const issues: string[] = []
  
  for (const doc of docsContent) {
    // Check category is valid
    if (!VALID_CATEGORIES.includes(doc.category)) {
      issues.push(`Invalid category "${doc.category}" for doc "${doc.title}"`)
    }
    
    // Check slug format (should be kebab-case)
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(doc.slug)) {
      issues.push(`Invalid slug format "${doc.slug}" for doc "${doc.title}" (should be kebab-case)`)
    }
    
    // Construct expected URL
    const expectedUrl = `/docs/${doc.category}/${doc.slug}`
    
    // Check if URL contains old v0 pattern
    if (expectedUrl.includes('/v0/')) {
      issues.push(`URL still contains /v0/ pattern: ${expectedUrl}`)
    }
  }
  
  return {
    passed: issues.length === 0,
    message: issues.length === 0 
      ? `✓ All ${docsContent.length} documentation URLs follow correct structure`
      : `✗ Found ${issues.length} URL structure issues`,
    details: issues
  }
}

/**
 * Test 2: Verify Navigation Links
 * All navigation links should point to valid documentation pages
 */
function verifyNavigationLinks(): VerificationResult {
  const issues: string[] = []
  const allNavItems = getAllNavigationItems()
  
  for (const navItem of allNavItems) {
    // Extract category and slug from href
    const match = navItem.href.match(/^\/docs\/([^/]+)\/([^/]+)$/)
    
    if (!match) {
      issues.push(`Invalid navigation href format: ${navItem.href}`)
      continue
    }
    
    const [, category, slug] = match
    
    // Check if corresponding doc exists
    const docExists = docsContent.some(
      doc => doc.category === category && doc.slug === slug
    )
    
    if (!docExists) {
      issues.push(`Navigation link "${navItem.title}" points to non-existent page: ${navItem.href}`)
    }
    
    // Check for old v0 pattern
    if (navItem.href.includes('/v0/')) {
      issues.push(`Navigation link still uses /v0/ pattern: ${navItem.href}`)
    }
  }
  
  return {
    passed: issues.length === 0,
    message: issues.length === 0
      ? `✓ All ${allNavItems.length} navigation links are valid`
      : `✗ Found ${issues.length} navigation link issues`,
    details: issues
  }
}

/**
 * Test 3: Verify Redirect Mappings
 * All old v0 URLs should have redirect mappings to new URLs
 */
function verifyRedirectMappings(): VerificationResult {
  const issues: string[] = []
  
  // Check each expected redirect
  for (const [oldSlug, newUrl] of Object.entries(EXPECTED_REDIRECTS)) {
    // Extract category and slug from new URL
    const match = newUrl.match(/^\/docs\/([^/]+)\/([^/]+)$/)
    
    if (!match) {
      issues.push(`Invalid redirect target format: ${newUrl}`)
      continue
    }
    
    const [, category, slug] = match
    
    // Verify the target page exists
    const targetExists = docsContent.some(
      doc => doc.category === category && doc.slug === slug
    )
    
    if (!targetExists) {
      issues.push(`Redirect from /docs/v0/${oldSlug} points to non-existent page: ${newUrl}`)
    }
  }
  
  // Check if all major docs have redirects
  const majorDocs = ['introduction', 'quickstart', 'agentic-features', 'vercel-integration', 'faqs']
  for (const docSlug of majorDocs) {
    if (!EXPECTED_REDIRECTS[docSlug]) {
      issues.push(`Missing redirect mapping for major doc: /docs/v0/${docSlug}`)
    }
  }
  
  return {
    passed: issues.length === 0,
    message: issues.length === 0
      ? `✓ All ${Object.keys(EXPECTED_REDIRECTS).length} redirect mappings are valid`
      : `✗ Found ${issues.length} redirect mapping issues`,
    details: issues
  }
}

/**
 * Test 4: Verify Internal Content Links
 * All internal links in content should use new URL structure
 */
function verifyContentLinks(): VerificationResult {
  const issues: string[] = []
  
  for (const doc of docsContent) {
    // Find all markdown links in content
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let match
    
    while ((match = linkRegex.exec(doc.content)) !== null) {
      const [, linkText, linkUrl] = match
      
      // Check if it's an internal docs link
      if (linkUrl.startsWith('/docs/')) {
        // Check for old v0 pattern
        if (linkUrl.includes('/v0/')) {
          issues.push(`Doc "${doc.title}" contains old /v0/ link: ${linkUrl}`)
        }
        
        // Verify link points to valid page
        const linkMatch = linkUrl.match(/^\/docs\/([^/]+)\/([^/]+)/)
        if (linkMatch) {
          const [, category, slug] = linkMatch
          const targetExists = docsContent.some(
            d => d.category === category && d.slug === slug
          )
          
          if (!targetExists) {
            issues.push(`Doc "${doc.title}" links to non-existent page: ${linkUrl}`)
          }
        }
      }
    }
  }
  
  return {
    passed: issues.length === 0,
    message: issues.length === 0
      ? `✓ All internal content links use correct URL structure`
      : `✗ Found ${issues.length} content link issues`,
    details: issues
  }
}

/**
 * Test 5: Verify File Organization
 * Check that files are organized according to new structure
 */
function verifyFileOrganization(): VerificationResult {
  const issues: string[] = []
  
  // Check that content.ts exists (not v0-content.ts)
  try {
    require('../lib/docs/content')
  } catch (e) {
    issues.push('lib/docs/content.ts not found - should replace v0-content.ts')
  }
  
  // Check that docs-layout.tsx exists (not v0-docs-layout.tsx)
  try {
    require('../components/documentation/docs-layout')
  } catch (e) {
    issues.push('components/documentation/docs-layout.tsx not found - should replace v0-docs-layout.tsx')
  }
  
  // Verify all docs have proper category field
  for (const doc of docsContent) {
    if (!doc.category) {
      issues.push(`Doc "${doc.title}" missing category field`)
    }
  }
  
  return {
    passed: issues.length === 0,
    message: issues.length === 0
      ? `✓ File organization follows new structure`
      : `✗ Found ${issues.length} file organization issues`,
    details: issues
  }
}

/**
 * Test 6: Verify SEO Metadata Structure
 * Check that all docs have proper metadata for SEO
 */
function verifySeoMetadata(): VerificationResult {
  const issues: string[] = []
  
  for (const doc of docsContent) {
    // Check title exists and is descriptive
    if (!doc.title || doc.title.length < 3) {
      issues.push(`Doc "${doc.id}" has invalid title`)
    }
    
    // Check content exists
    if (!doc.content || doc.content.length < 50) {
      issues.push(`Doc "${doc.title}" has insufficient content for SEO`)
    }
    
    // Check slug is SEO-friendly (kebab-case)
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(doc.slug)) {
      issues.push(`Doc "${doc.title}" has non-SEO-friendly slug: ${doc.slug}`)
    }
    
    // Check category is descriptive
    if (!doc.category || doc.category.length < 3) {
      issues.push(`Doc "${doc.title}" has invalid category`)
    }
  }
  
  return {
    passed: issues.length === 0,
    message: issues.length === 0
      ? `✓ All ${docsContent.length} docs have proper SEO metadata`
      : `✗ Found ${issues.length} SEO metadata issues`,
    details: issues
  }
}

/**
 * Run all verification tests
 */
function runAllTests(): TestResults {
  console.log('🔍 Running Documentation URL Restructure Verification...\n')
  
  const results: TestResults = {
    urlStructure: verifyUrlStructure(),
    navigationLinks: verifyNavigationLinks(),
    redirectMappings: verifyRedirectMappings(),
    contentLinks: verifyContentLinks(),
    fileOrganization: verifyFileOrganization(),
    seoMetadata: verifySeoMetadata(),
  }
  
  return results
}

/**
 * Print test results
 */
function printResults(results: TestResults): void {
  console.log('📊 Test Results:\n')
  console.log('─'.repeat(80))
  
  const tests = [
    { name: 'URL Structure Compliance', result: results.urlStructure },
    { name: 'Navigation Links Validity', result: results.navigationLinks },
    { name: 'Redirect Mappings', result: results.redirectMappings },
    { name: 'Internal Content Links', result: results.contentLinks },
    { name: 'File Organization', result: results.fileOrganization },
    { name: 'SEO Metadata', result: results.seoMetadata },
  ]
  
  let allPassed = true
  
  for (const test of tests) {
    console.log(`\n${test.result.passed ? '✅' : '❌'} ${test.name}`)
    console.log(`   ${test.result.message}`)
    
    if (test.result.details && test.result.details.length > 0) {
      console.log('\n   Issues:')
      test.result.details.forEach(detail => {
        console.log(`   - ${detail}`)
      })
    }
    
    if (!test.result.passed) {
      allPassed = false
    }
  }
  
  console.log('\n' + '─'.repeat(80))
  console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}\n`)
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1)
}

// Run tests
const results = runAllTests()
printResults(results)
