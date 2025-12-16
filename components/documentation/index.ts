/**
 * Documentation Components
 * 
 * Core components for the SmartAPIForge documentation system
 */

export { DocumentationLayout } from "./documentation-layout"
export { DocumentationHeader } from "./documentation-header"
export { LeftSidebar } from "./left-sidebar"
export { RightSidebar, TableOfContents } from "./right-sidebar"
export { NavigationTree } from "./navigation-tree"
export { NavigationItem } from "./navigation-item"
export { ContentArea } from "./content-area"
export { Callout } from "./callout"
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"
export { Card, CardGrid } from "./card"
export { CodeBlock, CopyButton } from "./code-block"
export { SearchBar } from "./search-bar"
export { SkipToContent } from "./skip-to-content"
export { Breadcrumb, generateBreadcrumbs } from "./breadcrumb"

// Lazy-loaded versions for performance optimization
export { SearchBarLazy } from "./search-bar-lazy"
export { CodeBlockLazy } from "./code-block-lazy"
export { OptimizedImage } from "./optimized-image"

// Performance optimization components
export { PagePrefetch } from "./page-prefetch"
export { PageNavigation } from "./page-navigation"
