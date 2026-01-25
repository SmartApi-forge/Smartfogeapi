/**
 * SEO Configuration for SmartAPIForge
 * Centralized SEO settings and utilities
 */

export const siteConfig = {
  name: 'SmartAPIForge',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://smartfogeapi.vercel.app',
  ogImage: '/ai-code-generation-interface.png',
  description: 'Transform ideas into production-ready APIs instantly with AI-powered no-code platform.',
  links: {
    twitter: 'https://twitter.com/smartapiforge',
    github: 'https://github.com/smartapiforge',
  },
};

/**
 * Generate page-specific metadata
 */
export function generatePageMetadata({
  title,
  description,
  image,
  noIndex = false,
}: {
  title: string;
  description: string;
  image?: string;
  noIndex?: boolean;
}) {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image || siteConfig.ogImage }],
    },
    twitter: {
      title,
      description,
      images: [image || siteConfig.ogImage],
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}

/**
 * High-converting SEO keywords by category
 */
export const seoKeywords = {
  primary: [
    'API builder',
    'no-code API',
    'AI API generator',
    'REST API builder',
    'API development platform',
  ],
  secondary: [
    'automated API creation',
    'API documentation generator',
    'low-code development',
    'backend as a service',
    'API deployment',
  ],
  longTail: [
    'build REST API without coding',
    'AI powered API development',
    'automatic API documentation',
    'deploy API in minutes',
    'no-code backend builder',
    'generate API from description',
    'instant API creation tool',
  ],
  competitors: [
    'postman alternative',
    'swagger alternative',
    'firebase alternative',
    'supabase alternative',
  ],
};

/**
 * Structured data templates for rich snippets
 */
export const structuredData = {
  faqPage: (faqs: Array<{ question: string; answer: string }>) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }),

  howTo: (steps: Array<{ name: string; text: string }>) => ({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Build an API with SmartAPIForge',
    description: 'Step-by-step guide to creating a production-ready API using AI',
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  }),

  product: {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'SmartAPIForge',
    description: 'AI-powered no-code API builder',
    brand: {
      '@type': 'Brand',
      name: 'SmartAPIForge',
    },
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '99',
      priceCurrency: 'USD',
      offerCount: '3',
    },
  },
};
