import React from "react"
import Link from "next/link"
import { SimpleHeader } from "@/components/simple-header"

export const metadata = {
  title: "Terms & Conditions | SmartAPIForge",
  description: "Terms and conditions for using SmartAPIForge platform",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-8">Terms & Conditions</h1>
          
          <p className="text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-4">
              By accessing and using SmartAPIForge ("the Platform"), you accept and agree to be bound by the terms and provision of this agreement. 
              If you do not agree to these Terms & Conditions, please do not use the Platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground mb-4">
              SmartAPIForge is an AI-powered development platform that enables users to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Generate production-ready, full-stack web applications using natural language</li>
              <li>Create and deploy APIs with intelligent code generation</li>
              <li>Integrate with external tools and services</li>
              <li>Execute code in secure sandbox environments</li>
              <li>Deploy applications to cloud infrastructure</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p className="text-muted-foreground mb-4">
              To access certain features of the Platform, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain the security of your password and account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
            <p className="text-muted-foreground mb-4">
              You agree not to use the Platform to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the intellectual property rights of others</li>
              <li>Generate malicious code or applications intended to harm others</li>
              <li>Attempt to gain unauthorized access to the Platform or related systems</li>
              <li>Interfere with or disrupt the Platform's operation</li>
              <li>Use the Platform for any illegal or unauthorized purpose</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
            <p className="text-muted-foreground mb-4">
              The Platform and its original content, features, and functionality are owned by SmartAPIForge and are protected by 
              international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p className="text-muted-foreground mb-4">
              Code generated through the Platform is owned by you, the user. However, you acknowledge that the Platform's 
              underlying AI models and generation technology remain the property of SmartAPIForge.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Data and Privacy</h2>
            <p className="text-muted-foreground mb-4">
              Your use of the Platform is also governed by our Privacy Policy. We collect and process data as described in our 
              Privacy Policy to provide and improve our services.
            </p>
            <p className="text-muted-foreground mb-4">
              You retain ownership of any code, data, or content you create using the Platform. We may use anonymized, 
              aggregated data to improve our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Service Availability</h2>
            <p className="text-muted-foreground mb-4">
              We strive to maintain high availability of the Platform but do not guarantee uninterrupted access. The Platform 
              may be unavailable due to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Scheduled maintenance</li>
              <li>Technical issues or system failures</li>
              <li>Circumstances beyond our reasonable control</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              To the maximum extent permitted by law, SmartAPIForge shall not be liable for any indirect, incidental, special, 
              consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, 
              or any loss of data, use, goodwill, or other intangible losses resulting from:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Your use or inability to use the Platform</li>
              <li>Any unauthorized access to or use of our servers and/or any personal information stored therein</li>
              <li>Any bugs, viruses, or other harmful code that may be transmitted to or through the Platform</li>
              <li>Any errors or omissions in any content or for any loss or damage incurred as a result of the use of any content</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground mb-4">
              The Platform is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either express or 
              implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.
            </p>
            <p className="text-muted-foreground mb-4">
              We do not warrant that the Platform will be error-free, secure, or that any defects will be corrected. You use the 
              Platform at your own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Third-Party Services</h2>
            <p className="text-muted-foreground mb-4">
              The Platform may integrate with third-party services (e.g., GitHub, Vercel, cloud providers). Your use of these 
              services is subject to their respective terms and conditions. We are not responsible for the availability, 
              functionality, or content of third-party services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to suspend or terminate your account and access to the Platform at our sole discretion, 
              without notice, for conduct that we believe:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>Violates these Terms & Conditions</li>
              <li>Is harmful to other users, us, or third parties</li>
              <li>Violates applicable laws or regulations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to modify these Terms & Conditions at any time. We will notify users of any material changes 
              by posting the new Terms & Conditions on this page and updating the "Last updated" date.
            </p>
            <p className="text-muted-foreground mb-4">
              Your continued use of the Platform after any changes constitutes acceptance of the new Terms & Conditions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
            <p className="text-muted-foreground mb-4">
              These Terms & Conditions shall be governed by and construed in accordance with the laws of the jurisdiction in 
              which SmartAPIForge operates, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about these Terms & Conditions, please contact us through the Platform's support channels.
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-border">
            <Link 
              href="/ask" 
              className="inline-flex items-center text-primary hover:text-primary/80 transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
