import { notFound } from "next/navigation"
import { Metadata } from "next"
import { docsContent } from "@/lib/docs/content"
import { DocsLayout } from "@/components/documentation/docs-layout"

interface PageProps {
  params: {
    category: string
    slug: string
  }
}

/**
 * Generate static paths for all documentation pages
 * This enables static generation at build time for optimal performance
 */
export async function generateStaticParams() {
  return docsContent.map((doc) => ({
    category: doc.category,
    slug: doc.slug,
  }))
}

/**
 * Documentation page component
 * Renders documentation content based on category and slug
 */
export default function DocPage({ params }: PageProps) {
  const doc = docsContent.find(
    (d) => d.category === params.category && d.slug === params.slug
  )

  if (!doc) {
    notFound()
  }

  return <DocsLayout doc={doc} />
}

/**
 * Generate SEO-friendly metadata for each documentation page
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const doc = docsContent.find(
    (d) => d.category === params.category && d.slug === params.slug
  )

  if (!doc) {
    return {
      title: "Not Found - SmartAPIForge Documentation",
      description: "The requested documentation page could not be found.",
    }
  }

  // Create a clean description from the first paragraph of content
  const firstParagraph = doc.content
    .split('\n\n')
    .find(p => p.trim() && !p.startsWith('#'))
    ?.replace(/[#*`]/g, '')
    .trim()
    .slice(0, 160)

  const description = firstParagraph || `Learn about ${doc.title.toLowerCase()} in SmartAPIForge`

  // Format category for display
  const categoryDisplay = params.category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return {
    title: `${doc.title} - ${categoryDisplay} | SmartAPIForge Documentation`,
    description,
    openGraph: {
      title: `${doc.title} - SmartAPIForge Documentation`,
      description,
      type: 'article',
      url: `/docs/${params.category}/${params.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${doc.title} - SmartAPIForge Documentation`,
      description,
    },
    alternates: {
      canonical: `/docs/${params.category}/${params.slug}`,
    },
  }
}
