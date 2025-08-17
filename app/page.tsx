import { HeroHeader } from "@/components/header"
import AuthDialog from "@/components/auth-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AiInput } from "@/components/ui/ai-input"
import { Badge } from "@/components/ui/badge"
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

      <main className="pt-0">
        <section className="relative border-b border-border/50 px-3 sm:px-0 hero-section-bg bg-background">
          {/* Background grid with vertical borders */}
          <div className="absolute inset-0 z-0 hero-grid hidden sm:grid">
            <div></div>
            <div className="border-x border-border/50"></div>
            <div></div>
          </div>

          {/* Background Image */}
          <div className="absolute inset-0 z-0 hero-background-image"></div>

          {/* Gradient Background Effects */}
          <figure className="hero-gradient-main" />
          <figure className="hero-gradient-left" />
          <figure className="hero-gradient-right" />

          {/* Content layer with proper z-index */}
          <div className="relative z-10 min-h-[80svh] sm:grid sm:[grid-template-columns:clamp(80px,10vw,120px)_minmax(0,1fr)_clamp(80px,10vw,120px)]">
            <div className="hidden sm:block" />
            <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 flex flex-col items-center divide-y divide-border/50 h-full">
              {/* Trust signal section */}
              <div className="flex w-full items-center justify-center py-1 mt-1 sm:mt-3 md:mt-6 mb-2 sm:mb-4 md:mb-6">
                <Badge variant="default" shiny={true} className="px-2 py-1 text-xs sm:text-sm">
                  Trusted by developers and non-developers alike
                </Badge>
              </div>

              {/* Main content area */}
              <div className="flex flex-col items-center justify-center py-2 sm:py-6 md:py-8 text-center space-y-3 sm:space-y-6 flex-1 w-full">
                {/* Hero headline with responsive clamp and single semantic H1 */}
                <div className="max-w-5xl mx-auto px-1 sm:px-4 md:px-6 text-center">
                  <h1 className="hero-text mx-auto max-w-[22ch] sm:max-w-[24ch] md:max-w-none text-foreground leading-[1.1] sm:leading-tight tracking-tight text-balance mb-0 sm:mb-2">
                    <span className="md:whitespace-nowrap">Instantly Build and Deploy Secure</span>
                    <br className="hidden md:block" />
                    <span className="md:hidden"> </span>
                    <span className="md:whitespace-nowrap">APIs From a Simple Prompt</span>
                  </h1>
                </div>

                {/* AI Input Box */}
                <div className="w-full max-w-2xl mx-auto px-0">
                  <AiInput />
                </div>

                {/* Supporting text with precise line breaks */}
                <div className="max-w-3xl mx-auto mt-0 px-1 sm:px-0">
                  <p className="text-muted-foreground text-sm sm:text-base md:text-lg text-balance leading-relaxed">
                    Go from user story to production-ready, documented API in seconds. No setup, no coding, no hassle.
                  </p>
                </div>

                {/* CTA Buttons - simplified */}
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                  <Button
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 h-12 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl w-full sm:w-auto"
                  >
                    Get Started Free
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-border/50 text-foreground hover:bg-accent px-8 py-3 h-12 rounded-xl font-medium transition-all duration-200 w-full sm:w-auto"
                  >
                    View Demo
                  </Button>
                </div>

                {/* Footer text removed as requested */}
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
        <AuthDialog />
      </main>
    </div>
  )
}
