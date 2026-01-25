"use client"

import { useState } from "react"
import { codeToHtml } from "shiki"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import "./code-block.css"

interface CodeBlockProps {
  code: string
  language: string
  filename?: string
  showLineNumbers?: boolean
  highlightLines?: number[]
}

interface CopyButtonProps {
  code: string
  onCopy?: () => void
}

/**
 * CopyButton Component
 * 
 * Provides copy-to-clipboard functionality with visual feedback.
 * Handles clipboard API failures with fallback method.
 * 
 * Requirements: 3.3, 3.4
 */
export function CopyButton({ code, onCopy }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(code)
      setCopied(true)
      onCopy?.()
      
      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback method for older browsers or when clipboard API fails
      try {
        const textarea = document.createElement("textarea")
        textarea.value = code
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
        
        setCopied(true)
        onCopy?.()
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackError) {
        console.error("Failed to copy code:", fallbackError)
      }
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "absolute right-2 top-2 h-8 w-8 p-0",
        "opacity-0 group-hover:opacity-100 transition-opacity",
        "hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={copyToClipboard}
      aria-label={copied ? "Code copied to clipboard" : "Copy code to clipboard"}
      aria-live="polite"
      title={copied ? "Copied!" : "Copy code"}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
    </Button>
  )
}

/**
 * CodeBlock Component
 * 
 * Displays syntax-highlighted code with optional features:
 * - Multiple language support (TypeScript, Python, Bash, JSON, YAML, etc.)
 * - Optional filename display
 * - Optional line numbers
 * - Copy to clipboard functionality
 * 
 * Uses Shiki for syntax highlighting with support for light/dark themes.
 * 
 * Requirements: 3.1, 3.2, 3.5
 */
export function CodeBlock({
  code,
  language,
  filename,
  showLineNumbers = false,
  highlightLines = [],
}: CodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  // Highlight code on mount
  useState(() => {
    const highlightCode = async () => {
      try {
        const html = await codeToHtml(code, {
          lang: language,
          themes: {
            light: "github-light",
            dark: "github-dark",
          },
          defaultColor: false,
        })
        setHighlightedCode(html)
      } catch (error) {
        console.error("Syntax highlighting failed:", error)
        // Fallback to plain code
        setHighlightedCode(`<pre><code>${escapeHtml(code)}</code></pre>`)
      } finally {
        setIsLoading(false)
      }
    }

    highlightCode()
  })

  return (
    <figure className="relative group my-6" role="group" aria-label={`Code example${filename ? ` - ${filename}` : ''}`}>
      {/* Filename header */}
      {filename && (
        <figcaption className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-t-lg">
          <span className="text-sm font-mono text-muted-foreground">
            {filename}
          </span>
        </figcaption>
      )}

      {/* Code container - Requirements: 6.1, 6.2 - Semantic HTML */}
      <div
        className={cn(
          "relative overflow-x-auto",
          "bg-muted border border-border",
          filename ? "rounded-b-lg" : "rounded-lg"
        )}
        role="region"
        aria-label={`${language} code block`}
      >
        {/* Copy button */}
        <CopyButton code={code} />

        {/* Highlighted code */}
        {isLoading ? (
          <div className="p-4" role="status" aria-live="polite" aria-label="Loading code">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted-foreground/20 rounded w-3/4"></div>
              <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>
              <div className="h-4 bg-muted-foreground/20 rounded w-5/6"></div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "code-block-content",
              showLineNumbers && "show-line-numbers"
            )}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
            role="code"
            aria-label={`${language} code snippet`}
          />
        )}
      </div>
    </figure>
  )
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}
