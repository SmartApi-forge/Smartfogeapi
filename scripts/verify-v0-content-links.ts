/**
 * Verification script to ensure content.ts has been updated with new links
 */

import { docsContent, navigationSections } from '../lib/docs/content'

interface LinkCheck {
  link: string
  hasOldFormat: boolean
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

function hasOldV0Format(link: string): boolean {
  return link.includes('/docs/v0/')
}

function checkContentLinks(): LinkCheck[] {
  const results: LinkCheck[] = []

  docsContent.forEach(doc => {
    const links = extractLinksFromMarkdown(doc.content)
    links.forEach(link => {
      results.push({
        link,
        hasOldFormat: hasOldV0Format(link),
        source: `${doc.id} content`
      })
    })
  })

  return results
}

function checkNavigationLinks(): LinkCheck[] {
  const results: LinkCheck[] = []

  navigationSections.forEach(section => {
    section.items.forEach(item => {
      results.push({
        link: item.href,
        hasOldFormat: hasOldV0Format(item.href),
        source: `Navigation: ${section.title} > ${item.title}`
      })
    })
  })

  return results
}

function main() {
  console.log('🔍 Checking content.ts for old /docs/v0/ links...\n')

  const contentResults = checkContentLinks()
  const navResults = checkNavigationLinks()
  const allResults = [...contentResults, ...navResults]

  const oldFormatLinks = allResults.filter(r => r.hasOldFormat)

  if (oldFormatLinks.length === 0) {
    console.log('✅ No old /docs/v0/ links found in content.ts!')
    console.log(`   Total links checked: ${allResults.length}`)
    console.log('\n📋 All links use new format:')
    allResults.forEach(result => {
      console.log(`   - ${result.link} (from ${result.source})`)
    })
  } else {
    console.log('❌ Found old /docs/v0/ format links:\n')
    oldFormatLinks.forEach(result => {
      console.log(`   Link: ${result.link}`)
      console.log(`   Source: ${result.source}`)
      console.log()
    })
    process.exit(1)
  }
}

main()
