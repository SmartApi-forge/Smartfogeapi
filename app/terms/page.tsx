import React from "react"
import Link from "next/link"
import { SimpleHeader } from "@/components/simple-header"

export const metadata = {
  title: "Terms & Conditions | SmartAPIForge",
  description: "Terms and conditions for SmartAPIForge.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />

      <main className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="space-y-8">
          <header className="space-y-3">
            <h1 className="text-4xl font-bold text-foreground">Terms & Conditions</h1>
            <p className="text-sm text-muted-foreground">Last updated: July 27, 2026</p>
            <p className="text-lg leading-8 text-muted-foreground">
              These terms explain the basic rules for using SmartAPIForge. By using the
              platform, you agree to use it responsibly and to respect the rights of others.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Your Account</h2>
            <p className="leading-7 text-muted-foreground">
              You are responsible for keeping your account credentials secure and for activity
              that happens through your account. Please use accurate account information and
              notify us if you believe your account has been accessed without permission.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Your Content and Data</h2>
            <p className="leading-7 text-muted-foreground">
              You own the prompts, files, project content, and generated code you create with
              SmartAPIForge. We do not sell, rent, or use your private workspace content for
              advertising or AI model training.
            </p>
            <p className="leading-7 text-muted-foreground">
              We process your data only to provide requested features, keep the service secure,
              troubleshoot issues, and comply with legal obligations.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Acceptable Use</h2>
            <p className="leading-7 text-muted-foreground">
              Do not use SmartAPIForge to break the law, infringe on others rights, generate
              harmful code, abuse infrastructure, attempt unauthorized access, or disrupt the
              platform for other users.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Generated Output</h2>
            <p className="leading-7 text-muted-foreground">
              Generated code should be reviewed before production use. You are responsible for
              testing, securing, deploying, and maintaining anything you build with the platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Service Availability</h2>
            <p className="leading-7 text-muted-foreground">
              We work to keep SmartAPIForge reliable, but the service may occasionally be
              unavailable because of maintenance, updates, infrastructure issues, or events
              outside our control.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Privacy</h2>
            <p className="leading-7 text-muted-foreground">
              Your use of SmartAPIForge is also governed by our Privacy Policy, which explains
              how we protect user data and limit data use.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Changes to These Terms</h2>
            <p className="leading-7 text-muted-foreground">
              We may update these terms when the product or legal requirements change. If changes
              are material, we will communicate them clearly.
            </p>
          </section>

          <div className="border-t border-border pt-8">
            <Link href="/" className="text-primary transition-colors hover:text-primary/80">
              Back to Home
            </Link>
          </div>
        </article>
      </main>
    </div>
  )
}
