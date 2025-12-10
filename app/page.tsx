import { Suspense } from 'react';
import { HeroHeader } from '@/components/header';
import { HeroSectionClient } from '@/components/hero-section-client';
import { AuthDialogClient } from '@/components/auth-dialog-client';
import { AnimatedSectionWrapper, AnimatedFooterWrapper } from '@/components/animated-section-wrapper';
import FeaturesSection from '@/components/features-section';
import IntegrationsSection from '@/components/integrations-section';
import ContentSection from '@/components/content-section';
import PricingSection from '@/components/pricing-section';
import FAQSection from '@/components/faq-section';
import Footer from '@/components/footer';
import NewsletterCTA from '@/components/newsletter-cta';
import BelowFooterBanner from '@/components/below-footer-banner';

/**
 * Homepage - Server Component with ISR enabled.
 * Static content is rendered on the server, interactive elements are client component islands.
 * 
 * Requirements: 1.1, 3.1, 3.5 - Render static content as Server Components with ISR caching
 */

// ISR: regenerate every hour (3600 seconds)
export const revalidate = 3600;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      <HeroHeader />

      <main className="pt-0">
        {/* Hero section with animations - Client Component */}
        <HeroSectionClient />

        {/* Features section with scroll animation */}
        <AnimatedSectionWrapper>
          <FeaturesSection />
        </AnimatedSectionWrapper>

        {/* Integrations section with scroll animation */}
        <AnimatedSectionWrapper>
          <IntegrationsSection />
        </AnimatedSectionWrapper>

        {/* Content section with scroll animation */}
        <AnimatedSectionWrapper>
          <ContentSection />
        </AnimatedSectionWrapper>

        {/* Pricing section with scroll animation */}
        <AnimatedSectionWrapper>
          <PricingSection />
        </AnimatedSectionWrapper>
        
        {/* FAQ section with scroll animation */}
        <AnimatedSectionWrapper>
          <FAQSection />
        </AnimatedSectionWrapper>
        
        {/* Newsletter CTA with scroll animation */}
        <AnimatedSectionWrapper>
          <NewsletterCTA />
        </AnimatedSectionWrapper>
        
        {/* Footer with smaller animation */}
        <AnimatedFooterWrapper>
          <Footer />
        </AnimatedFooterWrapper>
        
        {/* Below Footer Banner - static content */}
        <BelowFooterBanner />
        
        {/* Auth Dialog - lazy loaded client component */}
        <Suspense fallback={null}>
          <AuthDialogClient />
        </Suspense>
      </main>
    </div>
  );
}
