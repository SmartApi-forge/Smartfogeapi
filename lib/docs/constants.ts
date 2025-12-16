/**
 * Documentation System Constants
 * 
 * Shared constants for the documentation system including themes,
 * breakpoints, and configuration values.
 */

import { ThemeConfig } from './types';

// ============================================================================
// Theme Configurations
// ============================================================================

export const lightTheme: ThemeConfig = {
  background: 'hsl(0 0% 100%)',
  foreground: 'hsl(222.2 84% 4.9%)',
  sidebar: 'hsl(210 40% 98%)',
  border: 'hsl(214.3 31.8% 91.4%)',
  accent: 'hsl(210 40% 96.1%)',
  code: 'hsl(210 40% 96.1%)',
};

export const darkTheme: ThemeConfig = {
  background: 'hsl(222.2 84% 4.9%)',
  foreground: 'hsl(210 40% 98%)',
  sidebar: 'hsl(217.2 32.6% 17.5%)',
  border: 'hsl(217.2 32.6% 17.5%)',
  accent: 'hsl(217.2 32.6% 17.5%)',
  code: 'hsl(217.2 32.6% 17.5%)',
};

// ============================================================================
// Responsive Breakpoints
// ============================================================================

export const breakpoints = {
  mobile: {
    min: 0,
    max: 768,
    description: 'Single column, hamburger menu',
  },
  tablet: {
    min: 768,
    max: 1024,
    description: 'Two columns (content + one sidebar)',
  },
  desktop: {
    min: 1024,
    max: Infinity,
    description: 'Three columns (full layout)',
  },
} as const;

// ============================================================================
// Layout Configuration
// ============================================================================

export const layoutConfig = {
  leftSidebarWidth: '280px',
  rightSidebarWidth: '240px',
  contentMaxWidth: '800px',
  headerHeight: '64px',
  mobileHeaderHeight: '56px',
} as const;

// ============================================================================
// Scroll Configuration
// ============================================================================

export const scrollConfig = {
  // Intersection Observer options for scroll spy
  rootMargin: '-80px 0px -80% 0px',
  threshold: 1.0,
  
  // Smooth scroll behavior
  scrollBehavior: 'smooth' as ScrollBehavior,
  scrollBlock: 'start' as ScrollLogicalPosition,
} as const;

// ============================================================================
// Search Configuration
// ============================================================================

export const searchConfig = {
  maxResults: 10,
  excerptLength: 150,
  minQueryLength: 2,
  debounceMs: 300,
} as const;

// ============================================================================
// Code Block Configuration
// ============================================================================

export const codeBlockConfig = {
  defaultLanguage: 'typescript',
  showLineNumbers: true,
  theme: {
    light: 'github-light',
    dark: 'github-dark',
  },
  supportedLanguages: [
    'typescript',
    'javascript',
    'python',
    'bash',
    'json',
    'yaml',
    'markdown',
    'html',
    'css',
    'sql',
  ],
} as const;

// ============================================================================
// Performance Configuration
// ============================================================================

export const performanceConfig = {
  // Target metrics
  targetLoadTime: 2000, // 2 seconds
  targetFPS: 60,
  
  // Optimization settings
  enableCodeSplitting: true,
  enableLazyLoading: true,
  enablePrefetching: true,
  
  // Cache settings
  cacheSearchIndex: true,
  cacheThemePreference: true,
} as const;

// ============================================================================
// Accessibility Configuration
// ============================================================================

export const a11yConfig = {
  keyboardShortcuts: {
    search: ['cmd+k', 'ctrl+k'],
    closeModal: ['escape'],
    navigateResults: ['arrowup', 'arrowdown'],
    selectResult: ['enter'],
  },
  
  // ARIA labels
  ariaLabels: {
    mainNav: 'Documentation navigation',
    toc: 'Table of contents',
    search: 'Search documentation',
    themeToggle: 'Toggle theme',
    mobileMenu: 'Toggle mobile menu',
  },
} as const;
