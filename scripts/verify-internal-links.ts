/**
 * Verification script to ensure all internal documentation links are valid
 */

import { docsContent, navigationSections } from '../lib/docs/content'

interface LinkValidation {
  link: string
  isValid: boolean
  source: string
}

function extractLinksFromMarkdown(markdown: string): string[] {
  const linkRegex = /\[([^\]]+)\]\(\/docs\/([^)]+)\)/g
  const links: string[] = []
  let match

  while ((match = linkRegex.exec(markdown)) !== null) {
    links.push(`/docs/${match[2]}`)
  }

  return links
}

function isValidDocLink(link: string): boolean {
  // Extract category and slug from link
  const match = link.match(/^\/docs\/([^/]+)\/([^/]+)$/)
  if (!match) return false

  const [, category, slug] = match
  
  // Check if a document exists with this category and slug
  return docsContent.some(
    doc => doc.category === category && doc.slug === slug
  )
}

function validateContentLinks(): LinkValidation[] {
  const results: LinkValidation[] = []

  // Check links in content
  docsContent.forEach(doc => {
    const links = extractLinksFromMarkdown(doc.content)
    links.forEach(link => {
      results.push({
        link,
        isValid: isValidDocLink(link),
        source: `${doc.category}/${doc.slug} content`
      })
    })
  })

  return results
}

function validateNavigationLinks(): LinkValidation[] {
  const results: LinkValidation[] = []

  navigationSections.forEach(section => {
    section.items.forEach(item => {
      results.push({
        link: item.href,
        isValid: isValidDocLink(item.href),
        source: `Navigation: ${section.title} > ${item.title}`
      })
    })
  })

  return results
}

function main() {
  console.log('🔍 Verifying internal documentation links...\n')

  const contentResults = validateContentLinks()
  const navResults = validateNavigationLinks()
  const allResults = [...contentResults, ...navResults]

  const invalidLinks = allResults.filter(r => !r.isValid)

  if (invalidLinks.length === 0) {
    console.log('✅ All internal links are valid!')
    console.log(`   Total links checked: ${allResults.length}`)
    
    // Show summary of valid links
    const uniqueLinks = new Set(allResults.map(r => r.link))
    console.log(`   Unique links: ${uniqueLinks.size}`)
    console.log('\n📋 Valid link structure:')
    uniqueLinks.forEach(link => console.log(`   - ${link}`))
  } else {
    console.log('❌ Found invalid links:\n')
    invalidLinks.forEach(result => {
      console.log(`   Link: ${result.link}`)
      console.log(`   Source: ${result.source}`)
      console.log()
    })
    process.exit(1)
  }
}

main()
