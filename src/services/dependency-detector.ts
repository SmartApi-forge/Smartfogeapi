/**
 * Dependency Detection Service for Full Project Scaffolding
 * 
 * Detects required packages from user prompts and suggests appropriate libraries
 * based on context keywords.
 * 
 * Requirements: 3.1, 9.1-9.9
 */

import { isPackageInTemplate } from './template-service';

/**
 * Result of dependency detection from a prompt
 */
export interface DetectedDependencies {
  /** Explicitly mentioned libraries (e.g., "GSAP", "Three.js") */
  explicit: string[];
  /** Suggested libraries based on context */
  suggested: string[];
  /** Reasons for each suggestion */
  reasons: Record<string, string>;
}

/**
 * A suggested library with metadata
 */
export interface SuggestedLibrary {
  /** Package name to install */
  name: string;
  /** Human-readable reason for suggestion */
  reason: string;
  /** Keywords that triggered this suggestion */
  keywords: string[];
}

/**
 * Library suggestion rule configuration
 */
export interface LibrarySuggestionRule {
  /** Keywords that trigger this suggestion (case-insensitive) */
  keywords: string[];
  /** Package name to suggest */
  library: string;
  /** Human-readable reason */
  reason: string;
  /** Whether this package is pre-installed in template */
  inTemplate: boolean;
}

/**
 * Known library names and their npm package equivalents
 * Maps common names/aliases to actual package names
 * 
 * Requirements: 3.1
 */
export const KNOWN_LIBRARIES: Record<string, string> = {
  // Animation libraries
  'gsap': 'gsap',
  'greensock': 'gsap',
  'framer-motion': 'framer-motion',
  'framer motion': 'framer-motion',
  'motion': 'framer-motion',
  'lottie': 'lottie-react',
  
  // 3D/Graphics
  'three.js': 'three',
  'threejs': 'three',
  'three': 'three',
  'webgl': 'three',
  'r3f': '@react-three/fiber',
  'react-three-fiber': '@react-three/fiber',
  
  // Charts/Visualization
  'recharts': 'recharts',
  'chart.js': 'chart.js',
  'chartjs': 'chart.js',
  'd3': 'd3',
  'd3.js': 'd3',
  'nivo': '@nivo/core',
  'victory': 'victory',
  'visx': '@visx/visx',
  
  // Forms
  'react-hook-form': 'react-hook-form',
  'formik': 'formik',
  'final-form': 'react-final-form',
  
  // State management
  'zustand': 'zustand',
  'redux': '@reduxjs/toolkit',
  'jotai': 'jotai',
  'recoil': 'recoil',
  'mobx': 'mobx',
  'valtio': 'valtio',
  
  // Data fetching
  'react-query': '@tanstack/react-query',
  'tanstack-query': '@tanstack/react-query',
  'swr': 'swr',
  'axios': 'axios',
  
  // UI Components
  'shadcn': '@radix-ui/react-slot',
  'radix': '@radix-ui/react-slot',
  'headless-ui': '@headlessui/react',
  'chakra': '@chakra-ui/react',
  'material-ui': '@mui/material',
  'mui': '@mui/material',
  'ant-design': 'antd',
  'antd': 'antd',
  
  // Carousel/Slider
  'embla': 'embla-carousel-react',
  'embla-carousel': 'embla-carousel-react',
  'swiper': 'swiper',
  'slick': 'react-slick',
  
  // Maps
  'leaflet': 'react-leaflet',
  'react-leaflet': 'react-leaflet',
  'mapbox': 'react-map-gl',
  'google-maps': '@react-google-maps/api',
  
  // Date/Time
  'date-fns': 'date-fns',
  'dayjs': 'dayjs',
  'moment': 'moment',
  'luxon': 'luxon',
  
  // Validation
  'zod': 'zod',
  'yup': 'yup',
  'joi': 'joi',
  
  // Icons
  'lucide': 'lucide-react',
  'lucide-react': 'lucide-react',
  'heroicons': '@heroicons/react',
  'react-icons': 'react-icons',
  'phosphor': '@phosphor-icons/react',
  
  // Utilities
  'lodash': 'lodash-es',
  'ramda': 'ramda',
  'immer': 'immer',
  
  // Payments
  'stripe': '@stripe/stripe-js',
  'paypal': '@paypal/react-paypal-js',
  
  // Auth
  'next-auth': 'next-auth',
  'clerk': '@clerk/nextjs',
  'auth0': '@auth0/nextjs-auth0',
  
  // Database/ORM
  'prisma': '@prisma/client',
  'drizzle': 'drizzle-orm',
  'mongoose': 'mongoose',
  
  // Real-time
  'socket.io': 'socket.io-client',
  'pusher': 'pusher-js',
  'ably': 'ably',
};

/**
 * Library suggestion rules based on context keywords
 * 
 * Requirements: 9.1-9.10
 */
export const LIBRARY_SUGGESTIONS: LibrarySuggestionRule[] = [
  // Animation (9.1) and Visual polish (9.10)
  {
    keywords: ['animation', 'animated', 'animate', 'motion', 'transition', 'beautiful', 'modern', 'sleek', 'polished', 'smooth'],
    library: 'framer-motion',
    reason: 'Lightweight React animation library',
    inTemplate: true,
  },
  // Scroll animation (9.2)
  {
    keywords: ['scroll animation', 'parallax', 'scroll trigger', 'scrolltrigger', 'scroll effect'],
    library: 'gsap',
    reason: 'Professional-grade animation with ScrollTrigger',
    inTemplate: true,
  },
  // Charts (9.3)
  {
    keywords: ['chart', 'graph', 'visualization', 'data viz', 'analytics dashboard', 'statistics'],
    library: 'recharts',
    reason: 'React-native charting library',
    inTemplate: false,
  },
  // Forms (9.4)
  {
    keywords: ['form', 'validation', 'input validation', 'form handling'],
    library: 'react-hook-form',
    reason: 'Performant form handling with zod validation',
    inTemplate: true,
  },
  // Icons (9.5)
  {
    keywords: ['icon'],
    library: 'lucide-react',
    reason: 'Beautiful & consistent icon library',
    inTemplate: true,
  },
  // Carousel (9.6)
  {
    keywords: ['carousel', 'slider', 'slideshow', 'image gallery', 'swiper'],
    library: 'embla-carousel-react',
    reason: 'Lightweight carousel library',
    inTemplate: false,
  },
  // Date picker (9.7)
  {
    keywords: ['date picker', 'datepicker', 'calendar', 'date selection'],
    library: 'date-fns',
    reason: 'Modern date utility library for date picker',
    inTemplate: true,
  },
  // Toast/Notifications (9.8)
  {
    keywords: ['toast', 'notification', 'alert', 'snackbar'],
    library: 'sonner',
    reason: 'Beautiful toast notifications',
    inTemplate: true,
  },
  // 3D Graphics
  {
    keywords: ['3d', 'webgl', '3d graphics', '3d model', '3d scene'],
    library: 'three',
    reason: '3D graphics library',
    inTemplate: false,
  },
  // Maps
  {
    keywords: ['map', 'location', 'geolocation', 'geographic'],
    library: 'react-leaflet',
    reason: 'Interactive maps',
    inTemplate: false,
  },
  // Data tables
  {
    keywords: ['data table', 'datatable', 'table sorting', 'table filtering', 'spreadsheet'],
    library: '@tanstack/react-table',
    reason: 'Powerful data table library',
    inTemplate: false,
  },
  // Drag and drop
  {
    keywords: ['drag and drop', 'drag-and-drop', 'draggable', 'sortable', 'dnd'],
    library: '@dnd-kit/core',
    reason: 'Modern drag and drop toolkit',
    inTemplate: false,
  },
  // Rich text editor
  {
    keywords: ['rich text', 'text editor', 'wysiwyg', 'markdown editor', 'content editor'],
    library: '@tiptap/react',
    reason: 'Headless rich text editor',
    inTemplate: false,
  },
  // PDF
  {
    keywords: ['pdf', 'pdf viewer', 'pdf generation'],
    library: '@react-pdf/renderer',
    reason: 'PDF generation and viewing',
    inTemplate: false,
  },
  // Video
  {
    keywords: ['video player', 'video', 'media player'],
    library: 'react-player',
    reason: 'React video player component',
    inTemplate: false,
  },
];

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect explicitly mentioned libraries from a prompt
 * Supports case-insensitive matching for known library names
 * 
 * @param prompt User's prompt text
 * @returns Array of detected package names
 * 
 * Requirements: 3.1
 */
export function detectFromPrompt(prompt: string): DetectedDependencies {
  const normalizedPrompt = prompt.toLowerCase();
  const explicit: string[] = [];
  const suggested: string[] = [];
  const reasons: Record<string, string> = {};
  const detectedLibraryNames = new Set<string>();

  // Detect explicitly mentioned libraries
  for (const [name, packageName] of Object.entries(KNOWN_LIBRARIES)) {
    // Create a regex that matches the library name as a word boundary
    // This prevents partial matches (e.g., "motion" in "promotion")
    const escapedName = escapeRegex(name);
    const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
    
    if (regex.test(normalizedPrompt)) {
      // Avoid duplicates (e.g., "gsap" and "greensock" both map to "gsap")
      if (!detectedLibraryNames.has(packageName)) {
        explicit.push(packageName);
        detectedLibraryNames.add(packageName);
      }
    }
  }

  // Get suggestions based on context (but don't duplicate explicit ones)
  const suggestions = suggestLibraries(prompt);
  for (const suggestion of suggestions) {
    if (!detectedLibraryNames.has(suggestion.name)) {
      suggested.push(suggestion.name);
      reasons[suggestion.name] = suggestion.reason;
      detectedLibraryNames.add(suggestion.name);
    }
  }

  return { explicit, suggested, reasons };
}


/**
 * Suggest libraries based on context keywords in the prompt
 * 
 * @param prompt User's prompt text
 * @returns Array of suggested libraries with reasons
 * 
 * Requirements: 9.1-9.9
 */
export function suggestLibraries(prompt: string): SuggestedLibrary[] {
  const normalizedPrompt = prompt.toLowerCase();
  const suggestions: SuggestedLibrary[] = [];
  const suggestedPackages = new Set<string>();

  // Check for explicit library mentions first to avoid suggesting alternatives
  const explicitlyMentioned = new Set<string>();
  for (const [name, packageName] of Object.entries(KNOWN_LIBRARIES)) {
    const escapedName = escapeRegex(name);
    const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
    if (regex.test(normalizedPrompt)) {
      explicitlyMentioned.add(packageName);
    }
  }

  // Check each suggestion rule
  for (const rule of LIBRARY_SUGGESTIONS) {
    // Skip if this library is already explicitly mentioned
    if (explicitlyMentioned.has(rule.library)) {
      continue;
    }

    // Skip if we already suggested this package
    if (suggestedPackages.has(rule.library)) {
      continue;
    }

    // Check if any keyword matches
    const matchedKeywords: string[] = [];
    for (const keyword of rule.keywords) {
      // For multi-word keywords, check exact phrase
      // For single words, use word boundary matching with optional plural 's'
      if (keyword.includes(' ')) {
        if (normalizedPrompt.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      } else {
        const escapedKeyword = escapeRegex(keyword);
        // Allow optional 's' at the end for plurals (e.g., "animation" matches "animations")
        const regex = new RegExp(`\\b${escapedKeyword}s?\\b`, 'i');
        if (regex.test(normalizedPrompt)) {
          matchedKeywords.push(keyword);
        }
      }
    }

    if (matchedKeywords.length > 0) {
      // Special case: if "animation" is mentioned but another animation library
      // is explicitly mentioned (like gsap), don't suggest framer-motion
      if (rule.library === 'framer-motion') {
        const otherAnimationLibs = ['gsap', 'lottie-react', '@react-spring/web'];
        if (otherAnimationLibs.some(lib => explicitlyMentioned.has(lib))) {
          continue;
        }
      }

      suggestions.push({
        name: rule.library,
        reason: rule.reason,
        keywords: matchedKeywords,
      });
      suggestedPackages.add(rule.library);
    }
  }

  return suggestions;
}

/**
 * Get all detected and suggested packages that need installation
 * Filters out packages already in the template
 * 
 * @param prompt User's prompt text
 * @returns Array of package names that need to be installed
 */
export function getPackagesToInstall(prompt: string): string[] {
  const detected = detectFromPrompt(prompt);
  const allPackages = [...detected.explicit, ...detected.suggested];
  
  // Filter out packages already in template
  return allPackages.filter(pkg => !isPackageInTemplate(pkg));
}

/**
 * Dependency detector service interface
 */
export interface DependencyDetector {
  detectFromPrompt(prompt: string): DetectedDependencies;
  suggestLibraries(prompt: string): SuggestedLibrary[];
  getPackagesToInstall(prompt: string): string[];
}

/**
 * Default dependency detector instance
 */
export const dependencyDetector: DependencyDetector = {
  detectFromPrompt,
  suggestLibraries,
  getPackagesToInstall,
};

export default dependencyDetector;
