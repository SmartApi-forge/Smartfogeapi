import React from "react"
import Link from "next/link"
import { SimpleHeader } from "@/components/simple-header"

export const metadata = {
  title: "Privacy Policy | SmartAPIForge",
  description: "Privacy policy for SmartAPIForge platform",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <p className="text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground mb-4">
              SmartAPIForge ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains 
              how we collect, use, disclose, and safeguard your information when you use our AI-powered development platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">2.1 Information You Provide</h3>
            <p className="text-muted-foreground mb-4">
              We collect information that you voluntarily provide when using our platform:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Account information (name, email address, password)</li>
              <li>Profile information and preferences</li>
              <li>Project data and code you create or upload</li>
              <li>Natural language prompts and instructions</li>
              <li>Communication with our support team</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Automatically Collected Information</h3>
            <p className="text-muted-foreground mb-4">
              When you use SmartAPIForge, we automatically collect certain information:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Usage data (features used, time spent, interactions)</li>
              <li>Device information (browser type, operating system, IP address)</li>
              <li>Log data (access times, pages viewed, errors)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process your requests and generate code based on your prompts</li>
              <li>Personalize your experience and provide relevant features</li>
              <li>Communicate with you about updates, security alerts, and support</li>
              <li>Analyze usage patterns to improve our AI models and platform</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations and enforce our terms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Data Storage and Security</h2>
            <p className="text-muted-foreground mb-4">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security audits and monitoring</li>
              <li>Secure cloud infrastructure with reputable providers</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              However, no method of transmission over the internet is 100% secure. While we strive to protect your 
              information, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li><strong>Service Providers:</strong> Third-party vendors who help us operate our platform (hosting, analytics, support)</li>
              <li><strong>AI Model Providers:</strong> To process your prompts and generate code (data is anonymized where possible)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Your Code and Projects</h2>
            <p className="text-muted-foreground mb-4">
              Your code and projects belong to you. We use your prompts and generated code to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Provide the service and generate code based on your instructions</li>
              <li>Improve our AI models (using anonymized, aggregated data)</li>
              <li>Debug and fix issues with the platform</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              We do not use your proprietary code or business logic to train models that would benefit competitors or 
              other users without your explicit consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking</h2>
            <p className="text-muted-foreground mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Maintain your session and keep you logged in</li>
              <li>Remember your preferences and settings</li>
              <li>Analyze usage patterns and improve our services</li>
              <li>Provide personalized content and features</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              You can control cookies through your browser settings, but disabling them may affect platform functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Your Rights and Choices</h2>
            <p className="text-muted-foreground mb-4">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal information</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Restriction:</strong> Limit how we process your information</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              To exercise these rights, please contact us through the platform's support channels.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Data Retention</h2>
            <p className="text-muted-foreground mb-4">
              We retain your information for as long as necessary to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Provide our services and maintain your account</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes and enforce our agreements</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              When you delete your account, we will delete or anonymize your personal information within 30 days, 
              except where we are required to retain it for legal purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Third-Party Services</h2>
            <p className="text-muted-foreground mb-4">
              Our platform integrates with third-party services (GitHub, Vercel, cloud providers, AI model providers). 
              These services have their own privacy policies, and we encourage you to review them. We are not responsible 
              for the privacy practices of these third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Children's Privacy</h2>
            <p className="text-muted-foreground mb-4">
              SmartAPIForge is not intended for users under the age of 13 (or 16 in the EU). We do not knowingly collect 
              personal information from children. If you believe we have collected information from a child, please contact 
              us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. International Data Transfers</h2>
            <p className="text-muted-foreground mb-4">
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate 
              safeguards are in place to protect your information in accordance with this Privacy Policy and applicable laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground mb-4">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the 
              new policy on this page and updating the "Last updated" date. Your continued use of the platform after 
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">14. Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have questions about this Privacy Policy or how we handle your information, please contact us through 
              the platform's support channels.
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-border">
            <Link 
              href="/" 
              className="inline-flex items-center text-primary hover:text-primary/80 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
