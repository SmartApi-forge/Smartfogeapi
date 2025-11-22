import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { ThemeProvider } from "@/components/theme-provider"
import { TRPCReactProvider } from "@/src/trpc/client"
import { AuthInitializer } from "@/components/auth-initializer"
import { Toaster } from "@/components/ui/sonner"
import { Analytics } from '@vercel/analytics/next';
import "./globals.css"

export const metadata: Metadata = {
  title: "SmartAPIForge - Build APIs Without Code",
  description: "Transform ideas into production-ready APIs instantly with AI-powered no-code platform",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Global tRPC client for browser console testing */}
        <script src="/trpc-console-helper.js" defer></script>
      </head>
      <body className="font-sans">
        <TRPCReactProvider>
          <AuthInitializer />
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </TRPCReactProvider>
        <Analytics />
        <Toaster />
      </body>
    </html>
  )
}
