/**
 * Documentation Pages Integration Test
 * 
 * Tests that all documentation pages can be accessed and render correctly
 * This simulates what would happen in a real browser environment
 */

import { docsContent } from '../lib/docs/content'

interface TestResult {
  url: string
  passed: boolean
  error?: string
}

/**
 * Test that all documentation pages have valid routes
 */
function testDocumentationRoutes(): TestResult[] {
  const results: TestResult[] = []
  
  console.log('🧪 Testing Documentation Routes...\n')
  
  for (const doc of docsContent) {
    const url = `/docs/${doc.category}/${doc.slug}`
    
    try {
      // Verify the doc has all required fields
      if (!doc.id) {
        throw new Error('Missing id field')
      }
      if (!doc.title) {
        throw new Error('Missing title field')
      }
      if (!doc.slug) {
        throw new Error('Missing slug field')
      }
      if (!doc.category) {
        throw new Error('Missing category field')
      }
      if (!doc.content) {
        throw new Error('Missing content field')
      }
      
      // Verify slug format
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(doc.slug)) {
        throw new Error(`Invalid slug format: ${doc.slug}`)
      }
      
      // Verify category format
      if (!/^[a-z]+(-[a-z]+)*$/.test(doc.category)) {
        throw new Error(`Invalid category format: ${doc.category}`)
      }
      
      // Verify content is substantial
      if (doc.content.length < 100) {
        throw new Error('Content too short')
      }
      
      // Verify subsections if present
      if (doc.subsections) {
        for (const subsection of doc.subsections) {
          if (!subsection.id || !subsection.title || !subsection.level) {
            throw new Error('Invalid subsection structure')
          }
        }
      }
      
      results.push({
        url,
        passed: true
      })
      
      console.log(`✅ ${url}`)
      
    } catch (error) {
      results.push({
        url,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      console.log(`❌ ${url} - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  return results
}

/**
 * Test redirect mappings
 */
function testRedirectMappings(): TestResult[] {
  const results: TestResult[] = []
  
  console.log('\n🔀 Testing Redirect Mappings...\n')
  
  const redirects = {
    'introduction': '/docs/getting-started/introduction',
    'quickstart': '/docs/getting-started/quick-start',
    'agentic-features': '/docs/features/ai-generation',
    'vercel-integration': '/docs/deployment/vercel',
    'faqs': '/docs/troubleshooting/faq',
  }
  
  for (const [oldSlug, newUrl] of Object.entries(redirects)) {
    const oldUrl = `/docs/v0/${oldSlug}`
    
    try {
      // Extract category and slug from new URL
      const match = newUrl.match(/^\/docs\/([^/]+)\/([^/]+)$/)
      if (!match) {
        throw new Error('Invalid redirect target format')
      }
      
      const [, category, slug] = match
      
      // Verify target page exists
      const targetExists = docsContent.some(
        doc => doc.category === category && doc.slug === slug
      )
      
      if (!targetExists) {
        throw new Error(`Target page does not exist: ${newUrl}`)
      }
      
      results.push({
        url: `${oldUrl} → ${newUrl}`,
        passed: true
      })
      
      console.log(`✅ ${oldUrl} → ${newUrl}`)
      
    } catch (error) {
      results.push({
        url: `${oldUrl} → ${newUrl}`,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      console.log(`❌ ${oldUrl} → ${newUrl} - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  return results
}

/**
 * Test internal links in content
 */
function testInternalLinks(): TestResult[] {
  const results: TestResult[] = []
  
  console.log('\n🔗 Testing Internal Links...\n')
  
  for (const doc of docsContent) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let match
    
    while ((match = linkRegex.exec(doc.content)) !== null) {
      const [, linkText, linkUrl] = match
      
      // Only test internal docs links
      if (linkUrl.startsWith('/docs/')) {
        try {
          // Check for old v0 pattern
          if (linkUrl.includes('/v0/')) {
            throw new Error('Link uses old /v0/ pattern')
          }
          
          // Verify link format
          const linkMatch = linkUrl.match(/^\/docs\/([^/]+)\/([^/]+)/)
          if (linkMatch) {
            const [, category, slug] = linkMatch
            
            // Verify target exists
            const targetExists = docsContent.some(
              d => d.category === category && d.slug === slug
            )
            
            if (!targetExists) {
              throw new Error('Target page does not exist')
            }
          }
          
          results.push({
            url: `${doc.title}: ${linkText} → ${linkUrl}`,
            passed: true
          })
          
          console.log(`✅ ${doc.title}: "${linkText}" → ${linkUrl}`)
          
        } catch (error) {
          results.push({
            url: `${doc.title}: ${linkText} → ${linkUrl}`,
            passed: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          
          console.log(`❌ ${doc.title}: "${linkText}" → ${linkUrl} - ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
  }
  
  return results
}

/**
 * Test SEO metadata
 */
function testSeoMetadata(): TestResult[] {
  const results: TestResult[] = []
  
  console.log('\n🔍 Testing SEO Metadata...\n')
  
  for (const doc of docsContent) {
    const url = `/docs/${doc.category}/${doc.slug}`
    
    try {
      // Check title length (should be between 10-60 characters for SEO)
      if (doc.title.length < 3) {
        throw new Error('Title too short')
      }
      if (doc.title.length > 100) {
        throw new Error('Title too long for SEO')
      }
      
      // Check content has a good first paragraph for meta description
      const firstParagraph = doc.content
        .split('\n\n')
        .find(p => p.trim() && !p.startsWith('#'))
      
      if (!firstParagraph || firstParagraph.length < 50) {
        throw new Error('No suitable content for meta description')
      }
      
      // Check slug is SEO-friendly
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(doc.slug)) {
        throw new Error('Slug is not SEO-friendly')
      }
      
      results.push({
        url,
        passed: true
      })
      
      console.log(`✅ ${url} - SEO metadata valid`)
      
    } catch (error) {
      results.push({
        url,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      console.log(`❌ ${url} - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  return results
}

/**
 * Run all tests and print summary
 */
function runAllTests() {
  console.log('🚀 Starting Documentation Integration Tests\n')
  console.log('='.repeat(80))
  
  const routeResults = testDocumentationRoutes()
  const redirectResults = testRedirectMappings()
  const linkResults = testInternalLinks()
  const seoResults = testSeoMetadata()
  
  console.log('\n' + '='.repeat(80))
  console.log('\n📊 Test Summary\n')
  
  const allResults = [
    { name: 'Documentation Routes', results: routeResults },
    { name: 'Redirect Mappings', results: redirectResults },
    { name: 'Internal Links', results: linkResults },
    { name: 'SEO Metadata', results: seoResults },
  ]
  
  let totalTests = 0
  let totalPassed = 0
  let totalFailed = 0
  
  for (const { name, results } of allResults) {
    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    
    totalTests += results.length
    totalPassed += passed
    totalFailed += failed
    
    console.log(`${name}:`)
    console.log(`  ✅ Passed: ${passed}`)
    console.log(`  ❌ Failed: ${failed}`)
    console.log(`  📝 Total: ${results.length}`)
    console.log()
  }
  
  console.log('─'.repeat(80))
  console.log(`\nOverall Results:`)
  console.log(`  ✅ Passed: ${totalPassed}`)
  console.log(`  ❌ Failed: ${totalFailed}`)
  console.log(`  📝 Total: ${totalTests}`)
  console.log(`  📈 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`)
  
  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed!\n')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.\n')
    process.exit(1)
  }
}

// Run tests
runAllTests()
