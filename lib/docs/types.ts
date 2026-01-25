/**
 * Documentation System Type Definitions
 * 
 * These types define the structure of the documentation system,
 * including navigation, content, search, and UI components.
 */

// ============================================================================
// Content Types
// ============================================================================

/**
 * Represents a heading extracted from MDX content
 */
export interface Heading {
  id: string;
  text: string;
  level: number; // 1-6 for h1-h6
}

/**
 * Represents a complete documentation page with metadata
 */
export interface DocumentationContent {
  slug: string;
  title: string;
  content: string;
  headings: Heading[];
  category: DocumentationCategory;
}

/**
 * Metadata for a documentation file
 */
export interface DocumentationMetadata {
  title: string;
  description: string;
  category: DocumentationCategory;
  order: number;
  tags: string[];
  lastUpdated: Date;
}

/**
 * Complete documentation file structure
 */
export interface DocumentationFile {
  metadata: DocumentationMetadata;
  content: string; // MDX content
}

/**
 * Documentation categories
 */
export enum DocumentationCategory {
  GETTING_STARTED = 'getting-started',
  FEATURES = 'features',
  API_REFERENCE = 'api-reference',
  GUIDES = 'guides',
  DEPLOYMENT = 'deployment',
  TROUBLESHOOTING = 'troubleshooting',
}

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * A single navigation item in the sidebar
 */
export interface NavigationItem {
  id: string;
  title: string;
  href: string;
  badge?: string; // e.g., "New", "Beta"
  children?: NavigationItem[];
}

/**
 * A section in the navigation sidebar
 */
export interface NavigationSection {
  id: string;
  title: string;
  items: NavigationItem[];
  icon?: React.ReactNode;
  expanded?: boolean;
}

/**
 * Complete navigation configuration
 */
export interface NavigationConfig {
  sections: {
    gettingStarted: NavigationSection;
    features: NavigationSection;
    apiReference: NavigationSection;
    guides: NavigationSection;
    deployment: NavigationSection;
    troubleshooting: NavigationSection;
  };
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for the main documentation page component
 */
export interface DocumentationPageProps {
  initialSection?: string;
}

/**
 * Props for the left sidebar component
 */
export interface LeftSidebarProps {
  sections: NavigationSection[];
  currentPath: string;
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Props for the right sidebar component
 */
export interface RightSidebarProps {
  headings: Heading[];
  activeId: string;
  onHeadingClick: (id: string) => void;
}

/**
 * Props for code block component
 */
export interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
}

/**
 * Props for copy button component
 */
export interface CopyButtonProps {
  code: string;
  onCopy?: () => void;
}

/**
 * Props for search bar component
 */
export interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * A single search result
 */
export interface SearchResult {
  title: string;
  excerpt: string;
  url: string;
  category: DocumentationCategory;
  matchScore: number;
}

/**
 * Search index interface
 */
export interface SearchIndex {
  add(id: number, content: string): void;
  search(query: string): number[];
}

// ============================================================================
// Scroll Spy Types
// ============================================================================

/**
 * State for scroll spy functionality
 */
export interface ScrollSpyState {
  activeId: string;
  visibleIds: string[];
}

// ============================================================================
// Theme Types
// ============================================================================

/**
 * Theme configuration
 */
export interface ThemeConfig {
  background: string;
  foreground: string;
  sidebar: string;
  border: string;
  accent: string;
  code: string;
}

/**
 * Available themes
 */
export type Theme = 'light' | 'dark';
