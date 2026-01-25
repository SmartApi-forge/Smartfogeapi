/**
 * Navigation Utilities
 * 
 * Helper functions for working with documentation navigation structure.
 */

import { navigationConfig } from './navigation-config';
import type { NavigationItem } from './types';

interface AdjacentPages {
  previous: NavigationItem | null;
  next: NavigationItem | null;
}

/**
 * Flatten navigation structure into a linear array
 */
function flattenNavigation(): NavigationItem[] {
  const items: NavigationItem[] = [];

  Object.values(navigationConfig.sections).forEach((section) => {
    section.items.forEach((item) => {
      items.push(item);
      
      // Add children if they exist
      if (item.children) {
        items.push(...item.children);
      }
    });
  });

  return items;
}

/**
 * Get adjacent pages (previous and next) for a given page URL
 * 
 * This is used for prefetching adjacent pages to improve navigation performance.
 * 
 * Requirements: 8.2, 8.3 - Optimize navigation performance
 */
export function getAdjacentPages(currentPath: string): AdjacentPages {
  const allPages = flattenNavigation();
  const currentIndex = allPages.findIndex((page) => page.href === currentPath);

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: currentIndex > 0 ? allPages[currentIndex - 1] : null,
    next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null,
  };
}

/**
 * Get all page URLs for prefetching
 */
export function getAllPageUrls(): string[] {
  return flattenNavigation().map((item) => item.href);
}

/**
 * Get the current section for a given path
 */
export function getCurrentSection(currentPath: string): string | null {
  for (const [key, section] of Object.entries(navigationConfig.sections)) {
    const hasMatch = section.items.some((item) => {
      if (item.href === currentPath) return true;
      if (item.children) {
        return item.children.some((child) => child.href === currentPath);
      }
      return false;
    });

    if (hasMatch) {
      return section.title;
    }
  }

  return null;
}
