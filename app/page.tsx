import { HeroHeader } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import FeaturesSection from "@/components/features-section"
import IntegrationsSection from "@/components/integrations-section"
import ContentSection from "@/components/content-section"
import PricingSection from "@/components/pricing-section"
import FAQSection from "@/components/faq-section"
import Footer from "@/components/footer"
import NewsletterCTA from "@/components/newsletter-cta"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      <HeroHeader />

      <main className="pt-4">
        <section className="relative border-b border-border/50 px-3 sm:px-0">
          {/* Background grid with vertical borders */}
          <div className="absolute inset-0 z-0 hero-grid hidden sm:grid">
            <div></div>
            <div className="border-x border-border/50"></div>
            <div></div>
          </div>

          {/* Gradient Background Effects */}
          <figure className="hero-gradient-main" />
          <figure className="hero-gradient-left" />
          <figure className="hero-gradient-right" />

          {/* Content layer with proper z-index */}
          <div className="relative z-10 min-h-[80svh] sm:grid sm:[grid-template-columns:clamp(80px,10vw,120px)_minmax(0,1fr)_clamp(80px,10vw,120px)]">
            <div className="hidden sm:block" />
            <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 flex flex-col items-center divide-y divide-border/50 h-full">
              {/* Trust signal section */}
              <div className="flex w-full flex-col md:flex-row items-center justify-center gap-2 text-center md:text-left text-xs sm:text-sm text-muted-foreground py-1 mt-2 sm:mt-3 mb-3 sm:mb-4 md:mb-6">
                <div className="flex -space-x-1 mb-1 md:mb-0">
                  <div className="h-6 w-6 rounded-full bg-blue-500 border-2 border-background"></div>
                  <div className="h-6 w-6 rounded-full bg-green-500 border-2 border-background"></div>
                  <div className="h-6 w-6 rounded-full bg-purple-500 border-2 border-background"></div>
                </div>
                <span className="block">Trusted by developers and non-developers alike</span>
              </div>

              {/* Main content area */}
              <div className="flex flex-col items-center justify-center py-4 sm:py-6 md:py-8 text-center space-y-4 sm:space-y-6 flex-1 w-full">
                {/* Hero headline with responsive clamp and single semantic H1 */}
                <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-6 text-center">
                  <h1 className="hero-text mx-auto max-w-[20ch] sm:max-w-[24ch] md:max-w-none text-foreground leading-tight tracking-tight text-balance mb-1 sm:mb-2">
                    <span className="md:whitespace-nowrap">Instantly Build and Deploy Secure</span>
                    <br className="hidden md:block" />
                    <span className="md:hidden"> </span>
                    <span className="md:whitespace-nowrap">APIs From a Simple Prompt</span>
                  </h1>
                </div>

                {/* AI Input Box */}
                <div className="w-full max-w-2xl mx-auto px-0">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <Input
                      className="flex-1 rounded-lg border border-border bg-background px-3 sm:px-4 py-3 sm:py-4 h-11 sm:h-12 input-text input-placeholder focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base"
                      placeholder="Describe your API: e.g. 'CRUD for a product catalog'"
                    />
                    <Button
                      variant="default"
                      className="rounded-lg px-4 sm:px-6 h-11 sm:h-12 sm:w-auto w-full text-sm sm:text-base"
                    >
                      Generate API
                    </Button>
                  </div>
                </div>

                {/* Supporting text with precise line breaks */}
                <div className="max-w-3xl mx-auto space-y-1 mt-1 px-2 sm:px-0">
                  <p className="text-muted-foreground text-sm sm:text-base md:text-lg text-balance">
                    Go from user story to production-ready, documented API in seconds. No setup, no coding,
                  </p>
                  <p className="text-muted-foreground text-sm sm:text-base md:text-lg text-balance">no hassle.</p>
                </div>

                {/* CTA Buttons with sophisticated styling */}
                <div className="hero-button-container">
                  <div className="hero-button-wrapper">
                    <div className="flex w-full flex-col gap-3">
                      <Button className="hero-primary-button">Get Started Free</Button>
                      <Button className="hero-secondary-button">View Demo</Button>
                    </div>

                    {/* Footer text */}
                    <p className="text-xs sm:text-sm text-center text-muted-foreground mt-2 sm:mt-3 mb-1 sm:mb-2 px-2">
                      No signup required to try - Always free for students and hobbyists
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden sm:block" />
          </div>

          <FeaturesSection />
        </section>

        <IntegrationsSection />

        <ContentSection />

        <PricingSection />
        <FAQSection />
        <NewsletterCTA />
        <Footer />
      </main>
    </div>
  )
}
