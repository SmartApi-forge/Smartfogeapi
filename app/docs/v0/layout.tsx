import { ReactNode } from "react"

export default function V0DocsLayout({ children }: { children: ReactNode }) {
  // Return children directly without any wrapper
  // This layout exists only for backward compatibility redirects
  return <>{children}</>
}

export const metadata = {
  title: "Documentation - SmartAPIForge",
  description: "Learn how to use SmartAPIForge to build APIs faster",
}
