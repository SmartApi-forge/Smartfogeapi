import React from "react"
import Link from "next/link"
import { SimpleHeader } from "@/components/simple-header"

export const metadata = {
  title: "Privacy Policy | SmartAPIForge",
  description: "Privacy policy for SmartAPIForge.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />

      <main className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="space-y-8">
          <header className="space-y-3">
            <h1 className="text-4xl font-bold text-foreground">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: July 27, 2026</p>
            <p className="text-lg leading-8 text-muted-foreground">
              SmartAPIForge is built to help you create APIs while keeping your account data,
              prompts, project files, generated code, and workspace content private.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Our Data Promise</h2>
            <p className="leading-7 text-muted-foreground">
              We do not sell your data. We do not rent your data. We do not use your prompts,
              uploaded files, project code, generated code, or private workspace content for
              advertising, resale, or training AI models.
            </p>
            <p className="leading-7 text-muted-foreground">
              Your data is used only to provide the product features you request, keep your
              account secure, maintain the service, and comply with legal obligations.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Information We Collect</h2>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Account details such as your email address and authentication status.</li>
              <li>Project content you create or upload inside SmartAPIForge.</li>
              <li>Prompts, instructions, and generated output needed to complete your requests.</li>
              <li>Basic technical logs used for reliability, abuse prevention, and debugging.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">How We Use Data</h2>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>To sign you in and keep your session working.</li>
              <li>To generate, edit, preview, and save the APIs or applications you ask for.</li>
              <li>To protect the platform from abuse, fraud, unauthorized access, and outages.</li>
              <li>To fix product issues when you report a problem or when a system error occurs.</li>
            </ul>
            <p className="leading-7 text-muted-foreground">
              We do not use your private project content for unrelated analytics, marketing,
              profiling, or model training.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Security</h2>
            <p className="leading-7 text-muted-foreground">
              We use access controls, encrypted connections, authentication checks, and secure
              infrastructure practices to protect user data. Access to private user content is
              limited to what is necessary to operate and troubleshoot the service.
            </p>
            <p className="leading-7 text-muted-foreground">
              No internet service can guarantee perfect security, but we design SmartAPIForge
              around minimizing unnecessary data use and reducing exposure wherever possible.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Third-Party Services</h2>
            <p className="leading-7 text-muted-foreground">
              Some features may rely on trusted infrastructure or service providers, such as
              authentication, hosting, deployment, storage, or AI generation providers. When data
              is sent to a provider, it is sent only as needed to complete the action you requested.
            </p>
            <p className="leading-7 text-muted-foreground">
              We do not authorize third-party providers to sell your data, use it for advertising,
              or train models on your private project content.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Data Retention and Deletion</h2>
            <p className="leading-7 text-muted-foreground">
              We keep account and project data only while it is needed to provide the service,
              maintain security, or meet legal requirements. If you delete your account or project,
              we will delete or anonymize related personal data unless retention is required by law.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Your Rights</h2>
            <p className="leading-7 text-muted-foreground">
              You can request access, correction, export, or deletion of your personal data. You
              remain the owner of the code, files, prompts, and project content you create.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Changes</h2>
            <p className="leading-7 text-muted-foreground">
              If this policy changes, we will update this page. Any material change to how private
              user data is handled will be communicated clearly.
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
