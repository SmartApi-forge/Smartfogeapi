"use client"

import { Suspense } from "react"
import { HeroHeader } from "@/components/header"
import AuthDialog from "@/components/auth-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PromptInputBox } from "@/components/ui/ai-prompt-box"
import { Badge } from "@/components/ui/badge"
import FeaturesSection from "@/components/features-section"
import IntegrationsSection from "@/components/integrations-section"
import ContentSection from "@/components/content-section"
import PricingSection from "@/components/pricing-section"
import FAQSection from "@/components/faq-section"
import Footer from "@/components/footer"
import NewsletterCTA from "@/components/newsletter-cta"
import Link from "next/link"
import { motion } from "@/components/motion-wrapper"
import BelowFooterBanner from "@/components/below-footer-banner"



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
              {/* Trust signal section - hidden on mobile, with spacing preserved */}
              <motion.div 
                className="py-4 mb-4 sm:py-1 sm:mt-3 md:mt-6 sm:mb-2 md:mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="hidden sm:flex w-full items-center justify-center">
                  <Badge variant="default" shiny={true} className="px-2 py-1 text-xs sm:text-sm">
                    Trusted by developers and non-developers alike
                  </Badge>
                </div>
              </motion.div>

              {/* Main content area */}
              <div className="flex flex-col items-center justify-center py-2 sm:py-6 md:py-8 text-center space-y-3 sm:space-y-6 flex-1 w-full">
                {/* Hero headline with responsive clamp and single semantic H1 */}
                <motion.div 
                  className="max-w-5xl mx-auto px-1 sm:px-4 md:px-6 text-center"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <h1 className="hero-text mx-auto max-w-[22ch] sm:max-w-[24ch] md:max-w-none text-foreground leading-[1.1] sm:leading-tight tracking-tight text-balance mb-0 sm:mb-2">
                    <span className="md:whitespace-nowrap">Instantly Build and Deploy Secure</span>
                    <br className="hidden md:block" />
                    <span className="md:hidden"> </span>
                    <span className="md:whitespace-nowrap">APIs From a Simple Prompt</span>
                  </h1>
                </motion.div>

                {/* AI Input Box */}
                <motion.div 
                  className="w-full max-w-2xl mx-auto px-3 sm:px-0"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <PromptInputBox />
                </motion.div>

                {/* Supporting text with precise line breaks */}
                <motion.div 
                  className="max-w-3xl mx-auto mt-0 px-1 sm:px-0"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                >
                  <p className="text-muted-foreground text-base sm:text-base md:text-lg text-balance leading-relaxed">
                    Go from user story to production-ready, documented API in seconds. No setup, no coding, no hassle.
                  </p>
                </motion.div>

                {/* CTA Buttons - simplified */}
                <motion.div 
                  className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                >
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
                    View Documentation
                  </Button>
                </motion.div>

                {/* Footer text removed as requested */}
              </div>
            </div>
            <div className="hidden sm:block" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            viewport={{ once: true, amount: 0.2 }}
          >
            <FeaturesSection />
          </motion.div>
        </section>



        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.2 }}
        >
          <IntegrationsSection />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.2 }}
        >
          <ContentSection />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.2 }}
        >
          <PricingSection />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.2 }}
        >
          <FAQSection />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.2 }}
        >
          <NewsletterCTA />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <Footer />
        </motion.div>
        
        {/* Below Footer Banner matching provided screenshot */}
        <BelowFooterBanner />
        
        <Suspense fallback={<div />}>
          <AuthDialog />
        </Suspense>
      </main>
    </div>
  )
}
