/**
 * Breadcrumb Component Example
 * 
 * This file demonstrates the breadcrumb component usage
 * and can be used for manual testing
 */

import { Breadcrumb, generateBreadcrumbs } from "./breadcrumb"

export function BreadcrumbExample() {
  // Example URL paths to test
  const examplePaths = [
    "/docs/getting-started/introduction",
    "/docs/getting-started/quick-start",
    "/docs/features/ai-generation",
    "/docs/deployment/vercel",
    "/docs/troubleshooting/faq",
  ]

  return (
    <div className="space-y-8 p-8 bg-[#0a0a0a] text-white">
      <h1 className="text-2xl font-bold">Breadcrumb Component Examples</h1>
      
      {examplePaths.map((path) => {
        const breadcrumbs = generateBreadcrumbs(path)
        return (
          <div key={path} className="space-y-2">
            <p className="text-sm text-gray-400">Path: {path}</p>
            <Breadcrumb items={breadcrumbs} />
          </div>
        )
      })}
    </div>
  )
}
