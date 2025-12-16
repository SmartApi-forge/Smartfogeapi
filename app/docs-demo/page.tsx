import Link from "next/link"

export default function DocsDemoPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">SmartAPIForge Documentation</h1>
        <p className="text-gray-400 max-w-md">
          A complete documentation system with dual sidebars, scroll spy, and responsive design.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/docs/getting-started/introduction"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            View Documentation
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            Back to Home
          </Link>
        </div>
        
        <div className="mt-12 text-left max-w-2xl mx-auto space-y-4 text-sm text-gray-400">
          <h2 className="text-xl font-semibold text-white mb-4">Features:</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>Left sidebar with main topic navigation</li>
            <li>Right sidebar with table of contents (scroll spy)</li>
            <li>Responsive design (mobile, tablet, desktop)</li>
            <li>Markdown rendering with syntax highlighting</li>
            <li>Smooth scroll navigation</li>
            <li>Dark theme with modern aesthetics</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-white mb-4 mt-8">Available Pages:</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/docs/getting-started/introduction" className="text-blue-400 hover:underline">
                Introduction
              </Link>
            </li>
            <li>
              <Link href="/docs/getting-started/quick-start" className="text-blue-400 hover:underline">
                Quickstart
              </Link>
            </li>
            <li>
              <Link href="/docs/features/ai-generation" className="text-blue-400 hover:underline">
                Agentic Features
              </Link>
            </li>
            <li>
              <Link href="/docs/deployment/vercel" className="text-blue-400 hover:underline">
                Vercel Integration
              </Link>
            </li>
            <li>
              <Link href="/docs/troubleshooting/faq" className="text-blue-400 hover:underline">
                FAQs
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
