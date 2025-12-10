import { redirect } from 'next/navigation'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to SmartAPIForge to access your AI-powered API projects. Build, deploy, and manage REST APIs with no code.',
  robots: { index: true, follow: true },
}

export default function LoginPage() {
  redirect('/?auth=login')
}
