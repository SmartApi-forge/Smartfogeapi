import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import Script from "next/script"
import { ThemeProvider } from "@/components/theme-provider"
import { TRPCReactProvider } from "@/src/trpc/client"
import { AuthInitializer } from "@/components/auth-initializer"
import { Toaster } from "@/components/ui/sonner"
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import "./globals.css"

// Viewport configuration for mobile optimization
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export const metadata: Metadata = {
  // Core metadata
  title: {
    default: 'SmartAPIForge - AI-Powered No-Code API Builder',
    template: '%s | SmartAPIForge',
  },
  description: 'Transform ideas into production-ready APIs instantly. SmartAPIForge uses AI to generate REST APIs, auto-documentation, and deploy in minutes. No coding required.',
  
  // Keywords for SEO
  keywords: [
    'API builder',
    'no-code API',
    'AI API generator',
    'REST API builder',
    'API development platform',
    'automated API creation',
    'API documentation generator',
    'low-code development',
    'backend as a service',
    'API deployment',
    'FastAPI generator',
    'Next.js API',
    'serverless API',
    'AI code generation',
    'developer tools',
  ],
  
  // Author and creator
  authors: [{ name: 'SmartAPIForge Team' }],
  creator: 'SmartAPIForge',
  publisher: 'SmartAPIForge',
  
  // Robots directives
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // Open Graph for social sharing
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://smartfogeapi.vercel.app',
    siteName: 'SmartAPIForge',
    title: 'SmartAPIForge - AI-Powered No-Code API Builder',
    description: 'Transform ideas into production-ready APIs instantly. Build REST APIs with AI, generate documentation automatically, and deploy in minutes.',
    images: [
      {
        url: '/ai-code-generation-interface.png',
        width: 1200,
        height: 630,
        alt: 'SmartAPIForge - AI-Powered API Builder Interface',
      },
    ],
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'SmartAPIForge - AI-Powered No-Code API Builder',
    description: 'Transform ideas into production-ready APIs instantly with AI. No coding required.',
    images: ['/ai-code-generation-interface.png'],
    creator: '@smartapiforge',
  },
  
  // Verification for search consoles
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || '',
    // yandex: 'your-yandex-verification',
    // bing: 'your-bing-verification',
  },
  
  // App metadata
  applicationName: 'SmartAPIForge',
  category: 'Developer Tools',
  
  // Alternate languages (if applicable)
  alternates: {
    canonical: 'https://smartfogeapi.vercel.app',
  },
  
  // Other metadata
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Structured Data - JSON-LD for rich snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'SmartAPIForge',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Web',
              description: 'AI-powered no-code platform to build production-ready REST APIs instantly. Generate documentation, deploy in minutes.',
              url: 'https://smartfogeapi.vercel.app',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                description: 'Free tier available',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '150',
              },
              featureList: [
                'AI-powered API generation',
                'Auto-generated documentation',
                'One-click deployment',
                'Real-time preview',
                'GitHub integration',
                'Vercel deployment',
              ],
            }),
          }}
        />
        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'SmartAPIForge',
              url: 'https://smartfogeapi.vercel.app',
              logo: 'https://smartfogeapi.vercel.app/placeholder-logo.png',
              sameAs: [
                'https://twitter.com/smartapiforge',
                'https://github.com/smartapiforge',
              ],
            }),
          }}
        />
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://vercel.com" />
      </head>
      <body className="font-sans">
        {/* Global tRPC client for browser console testing - loaded lazily */}
        <Script src="/trpc-console-helper.js" strategy="lazyOnload" />
        <TRPCReactProvider>
          <AuthInitializer />
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </TRPCReactProvider>
        <Analytics />
        <SpeedInsights />
        <Toaster />
      </body>
    </html>
  )
}
