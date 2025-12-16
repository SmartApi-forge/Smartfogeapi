"use client"

import React, { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { DocSection, navigationSections } from "@/lib/docs/content"
import { ChevronRight, Menu, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism"
import { Breadcrumb, generateBreadcrumbs } from "./breadcrumb"

interface DocsLayoutProps {
  doc: DocSection
}

export function DocsLayout({ doc }: DocsLayoutProps) {
  const pathname = usePathname()
  const [activeHeading, setActiveHeading] = useState<string>("")
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const breadcrumbs = generateBreadcrumbs(pathname)

  // Scroll spy for right sidebar
  useEffect(() => {
    let currentActiveId = ""
    
    const observer = new IntersectionObserver(
      (entries) => {
        // Find all visible headings
        const visibleHeadings = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => {
            // Sort by position on page (top to bottom)
            return a.boundingClientRect.top - b.boundingClientRect.top
          })
        
        // Set the first visible heading as active
        if (visibleHeadings.length > 0) {
          const newActiveId = visibleHeadings[0].target.id
          if (newActiveId !== currentActiveId) {
            currentActiveId = newActiveId
            setActiveHeading(newActiveId)
          }
        }
      },
      {
        rootMargin: "-80px 0px -80%",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    )

    // Observe all headings
    const headings = document.querySelectorAll("h2, h3")
    headings.forEach((heading) => observer.observe(heading))

    return () => observer.disconnect()
  }, [doc])

  // Add IDs to headings for scroll spy - match with subsection IDs
  useEffect(() => {
    const headings = document.querySelectorAll("h2, h3")
    const subsectionMap = new Map(
      doc.subsections?.map(sub => [sub.title, sub.id]) || []
    )
    
    headings.forEach((heading) => {
      const text = heading.textContent || ""
      // Try to find matching subsection ID first
      const subsectionId = subsectionMap.get(text)
      if (subsectionId) {
        heading.id = subsectionId
      } else {
        // Fallback to generating ID from text
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
        heading.id = id
      }
    })
  }, [doc])

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 100
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-gray-100 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-50 bg-[#0a0a0a] border-b border-gray-800 px-4 py-3">
        <button
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          className="p-2 hover:bg-gray-800 rounded-md"
          aria-label="Toggle navigation"
        >
          {leftSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex h-full">
        {/* Left Sidebar - Navigation */}
        <aside
          className={cn(
            "fixed lg:sticky top-0 left-0 z-40",
            "h-screen overflow-y-auto",
            "w-[280px]",
            "bg-[#0a0a0a]",
            "transition-transform duration-300 ease-in-out",
            "lg:translate-x-0",
            leftSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <nav className="p-6 space-y-6">
            {navigationSections.map((section) => (
              <div key={section.id} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setLeftSidebarOpen(false)}
                          className={cn(
                            "block px-3 py-2 rounded-md text-sm transition-colors",
                            "hover:bg-gray-800 hover:text-white",
                            isActive
                              ? "bg-gray-800 text-white font-medium"
                              : "text-gray-400"
                          )}
                        >
                          {item.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Overlay for mobile */}
        {leftSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setLeftSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 bg-[#0a0a0a] overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
            {/* Breadcrumb Navigation */}
            <Breadcrumb items={breadcrumbs} className="mb-6" />
            
            <article className="prose prose-invert max-w-none
              [&>h1]:text-[2.5rem] [&>h1]:font-bold [&>h1]:text-white [&>h1]:mb-6 [&>h1]:mt-0 [&>h1]:leading-[1.1] [&>h1]:tracking-tight
              [&>h2]:text-[2rem] [&>h2]:font-semibold [&>h2]:text-white [&>h2]:mt-16 [&>h2]:mb-5 [&>h2]:leading-[1.2] [&>h2]:tracking-tight
              [&>h3]:text-[1.5rem] [&>h3]:font-semibold [&>h3]:text-white [&>h3]:mt-12 [&>h3]:mb-4 [&>h3]:leading-[1.3] [&>h3]:tracking-tight
              [&>h4]:text-[1.25rem] [&>h4]:font-semibold [&>h4]:text-white [&>h4]:mt-8 [&>h4]:mb-3 [&>h4]:leading-[1.4] [&>h4]:tracking-tight
              [&>p]:text-[15px] [&>p]:leading-[1.7] [&>p]:text-gray-400 [&>p]:mb-5 [&>p]:mt-0
              [&_a]:text-blue-400 [&_a]:no-underline [&_a]:font-normal hover:[&_a]:underline hover:[&_a]:text-blue-300
              [&_strong]:text-white [&_strong]:font-semibold
              [&_code]:text-pink-400 [&_code]:text-sm [&_code]:bg-gray-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:before:content-none [&_code]:after:content-none
              [&_pre]:bg-gray-900 [&_pre]:border [&_pre]:border-gray-800 [&_pre]:rounded-lg [&_pre]:my-6 [&_pre]:p-4 [&_pre]:overflow-x-auto
              [&>ul]:text-[15px] [&>ul]:leading-[1.7] [&>ul]:text-gray-400 [&>ul]:my-5 [&>ul]:pl-6 [&>ul]:list-disc [&>ul]:space-y-2
              [&>ol]:text-[15px] [&>ol]:leading-[1.7] [&>ol]:text-gray-400 [&>ol]:my-5 [&>ol]:pl-6 [&>ol]:space-y-2
              [&_li]:text-[15px] [&_li]:leading-[1.7] [&_li]:text-gray-400
              [&>blockquote]:border-l-4 [&>blockquote]:border-l-blue-500 [&>blockquote]:text-gray-400 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:my-6
              [&_table]:my-6 [&_table]:text-sm [&_table]:border-collapse [&_table]:border [&_table]:border-gray-800
              [&_thead]:bg-gray-900
              [&_th]:text-left [&_th]:font-semibold [&_th]:p-2 [&_th]:border [&_th]:border-gray-800
              [&_td]:p-2 [&_td]:border [&_td]:border-gray-800
              [&_img]:rounded-lg [&_img]:border [&_img]:border-gray-800 [&_img]:my-6
              [&>hr]:my-8 [&>hr]:border-gray-800">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "")
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {doc.content}
              </ReactMarkdown>
            </article>
          </div>
        </main>

        {/* Right Sidebar - Table of Contents */}
        <aside className="hidden xl:block w-[240px] h-full overflow-y-auto bg-[#0a0a0a]">
          <div className="p-6">
            <h2 className="text-sm font-semibold mb-4 text-white">On this page</h2>
            <nav>
              <ul className="space-y-2 text-sm">
                {doc.subsections?.map((subsection) => {
                  const isActive = activeHeading === subsection.id
                  const indent = subsection.level === 3 ? "ml-4" : ""

                  return (
                    <li key={subsection.id} className={indent}>
                      <button
                        onClick={() => scrollToHeading(subsection.id)}
                        className={cn(
                          "block w-full text-left px-2 py-1 rounded-md transition-colors",
                          "hover:text-white",
                          isActive
                            ? "text-white font-medium border-l-2 border-blue-500 pl-2"
                            : "text-gray-400"
                        )}
                      >
                        {subsection.title}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  )
}
