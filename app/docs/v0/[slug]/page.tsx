import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

/**
 * URL redirect mapping from old v0 paths to new category-based paths
 * This ensures backward compatibility for bookmarked links and external references
 */
const URL_REDIRECTS: Record<string, string> = {
  'introduction': '/docs/getting-started/introduction',
  'quickstart': '/docs/getting-started/quick-start',
  'agentic-features': '/docs/features/ai-generation',
  'vercel-integration': '/docs/deployment/vercel',
  'faqs': '/docs/troubleshooting/faq',
}

/**
 * Redirect handler for deprecated /docs/v0/ URLs
 * Implements 301 permanent redirects to new URL structure
 */
export default async function V0RedirectPage({ params }: PageProps) {
  const { slug } = await params
  const newUrl = URL_REDIRECTS[slug]
  
  if (newUrl) {
    // 301 permanent redirect to new URL structure
    redirect(newUrl)
  }
  
  // Fallback redirect to main docs page for unmapped URLs
  redirect('/docs/getting-started/introduction')
}
