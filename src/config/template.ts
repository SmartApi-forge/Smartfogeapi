/**
 * Template Configuration for Full Project Scaffolding
 * 
 * This configuration defines the pre-built Daytona template environment
 * that includes all common dependencies pre-installed for fast project creation.
 * 
 * Requirements: 7.1, 7.5, 7.6, 7.7, 7.8
 */

/**
 * Daytona template Docker image
 * This is a Docker image with Next.js + all dependencies pre-installed
 * Set via environment variable: DAYTONA_TEMPLATE_ID
 * 
 * Example values:
 * - yourusername/smartapiforge-nextjs-template:latest (Docker Hub)
 * - ghcr.io/yourusername/smartapiforge-nextjs-template:latest (GitHub Container Registry)
 * - node:22-bookworm (fallback to base Node.js image)
 * 
 * Requirements: 7.1, 7.2
 */
export const DAYTONA_TEMPLATE_ID = process.env.DAYTONA_TEMPLATE_ID || 'node:22-bookworm';

/**
 * Default Docker image to use when no template is configured
 * This is a base Node.js image - dependencies will need to be installed
 */
export const DEFAULT_NODE_IMAGE = 'node:22-bookworm';

/**
 * Pre-installed UI libraries in the template
 * Requirements: 7.5
 */
export const TEMPLATE_UI_PACKAGES = [
  // shadcn/ui and Radix primitives
  '@radix-ui/react-accordion',
  '@radix-ui/react-alert-dialog',
  '@radix-ui/react-aspect-ratio',
  '@radix-ui/react-avatar',
  '@radix-ui/react-checkbox',
  '@radix-ui/react-collapsible',
  '@radix-ui/react-context-menu',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-hover-card',
  '@radix-ui/react-label',
  '@radix-ui/react-menubar',
  '@radix-ui/react-navigation-menu',
  '@radix-ui/react-popover',
  '@radix-ui/react-progress',
  '@radix-ui/react-radio-group',
  '@radix-ui/react-scroll-area',
  '@radix-ui/react-select',
  '@radix-ui/react-separator',
  '@radix-ui/react-slider',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-toast',
  '@radix-ui/react-toggle',
  '@radix-ui/react-toggle-group',
  '@radix-ui/react-tooltip',
  // Utility libraries for shadcn
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  // Icons
  'lucide-react',
] as const;

/**
 * Pre-installed animation libraries in the template
 * Requirements: 7.6
 */
export const TEMPLATE_ANIMATION_PACKAGES = [
  'framer-motion',
  'gsap',
  'lottie-react',
] as const;

/**
 * Pre-installed data/state management libraries in the template
 * Requirements: 7.7
 */
export const TEMPLATE_DATA_PACKAGES = [
  '@tanstack/react-query',
  'zustand',
  'zod',
  'react-hook-form',
  '@hookform/resolvers',
] as const;

/**
 * Pre-installed utility libraries in the template
 * Requirements: 7.8
 */
export const TEMPLATE_UTILITY_PACKAGES = [
  'date-fns',
  'axios',
  'lodash-es',
] as const;

/**
 * Core Next.js/React packages (always in template)
 */
export const TEMPLATE_CORE_PACKAGES = [
  'next',
  'react',
  'react-dom',
  'typescript',
  'tailwindcss',
  'postcss',
  'autoprefixer',
  '@types/node',
  '@types/react',
  '@types/react-dom',
] as const;

/**
 * All pre-installed packages in the template
 * Combined list for easy checking
 * Requirements: 7.5, 7.6, 7.7, 7.8
 */
export const TEMPLATE_PACKAGES: readonly string[] = [
  ...TEMPLATE_CORE_PACKAGES,
  ...TEMPLATE_UI_PACKAGES,
  ...TEMPLATE_ANIMATION_PACKAGES,
  ...TEMPLATE_DATA_PACKAGES,
  ...TEMPLATE_UTILITY_PACKAGES,
];

/**
 * Normalized package names for case-insensitive matching
 * Maps lowercase names to actual package names
 */
export const PACKAGE_NAME_MAP: Record<string, string> = {
  // Common aliases and variations
  'framer': 'framer-motion',
  'framer-motion': 'framer-motion',
  'motion': 'framer-motion',
  'gsap': 'gsap',
  'greensock': 'gsap',
  'lottie': 'lottie-react',
  'tanstack-query': '@tanstack/react-query',
  'react-query': '@tanstack/react-query',
  'zustand': 'zustand',
  'zod': 'zod',
  'react-hook-form': 'react-hook-form',
  'hookform': 'react-hook-form',
  'date-fns': 'date-fns',
  'datefns': 'date-fns',
  'axios': 'axios',
  'lodash': 'lodash-es',
  'lodash-es': 'lodash-es',
  'lucide': 'lucide-react',
  'lucide-react': 'lucide-react',
  'tailwind': 'tailwindcss',
  'tailwindcss': 'tailwindcss',
};

/**
 * Check if a package is pre-installed in the template
 * Supports case-insensitive matching and common aliases
 * 
 * @param packageName Package name to check
 * @returns true if package is in template
 * 
 * Requirements: 7.9
 */
export function isPackageInTemplate(packageName: string): boolean {
  const normalizedName = packageName.toLowerCase().trim();
  
  // Check direct match (case-insensitive)
  const directMatch = TEMPLATE_PACKAGES.some(
    pkg => pkg.toLowerCase() === normalizedName
  );
  if (directMatch) return true;
  
  // Check alias map
  const mappedName = PACKAGE_NAME_MAP[normalizedName];
  if (mappedName) {
    return TEMPLATE_PACKAGES.some(
      pkg => pkg.toLowerCase() === mappedName.toLowerCase()
    );
  }
  
  // Check if it's a scoped package variant (e.g., @radix-ui/react-*)
  if (normalizedName.startsWith('@radix-ui/')) {
    return TEMPLATE_PACKAGES.some(
      pkg => pkg.toLowerCase() === normalizedName
    );
  }
  
  return false;
}

/**
 * Get all template packages
 * @returns Array of all pre-installed package names
 */
export function getTemplatePackages(): string[] {
  return [...TEMPLATE_PACKAGES];
}

/**
 * Template configuration object for external use
 */
export const TEMPLATE_CONFIG = {
  templateId: DAYTONA_TEMPLATE_ID,
  packages: {
    core: TEMPLATE_CORE_PACKAGES,
    ui: TEMPLATE_UI_PACKAGES,
    animation: TEMPLATE_ANIMATION_PACKAGES,
    data: TEMPLATE_DATA_PACKAGES,
    utility: TEMPLATE_UTILITY_PACKAGES,
    all: TEMPLATE_PACKAGES,
  },
  isPackageInTemplate,
  getTemplatePackages,
} as const;
