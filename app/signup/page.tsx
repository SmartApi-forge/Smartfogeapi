import { redirect } from 'next/navigation'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up - Start Building APIs Free',
  description: 'Create your free SmartAPIForge account. Build production-ready REST APIs with AI in minutes. No credit card required.',
  robots: { index: true, follow: true },
}

export default function SignupPage() {
  redirect('/?auth=signup')
}
