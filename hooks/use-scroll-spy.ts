/**
 * Scroll Spy Hook
 * 
 * Custom hook that tracks which heading is currently visible in the viewport
 * using the Intersection Observer API. This is used to highlight the active
 * section in the right sidebar table of contents.
 */

import { useEffect, useState, useRef } from 'react';

/**
 * Options for configuring the scroll spy behavior
 */
export interface UseScrollSpyOptions {
  /**
   * Root margin for the Intersection Observer
   * Controls when headings are considered "active"
   * Default: '-80px 0px -80% 0px' (triggers when heading is near top)
   */
  rootMargin?: string;
  
  /**
   * Threshold for intersection (0-1)
   * Default: 1.0 (fully visible)
   */
  threshold?: number;
  
  /**
   * Offset from top of viewport in pixels
   * Useful for accounting for fixed headers
   * Default: 100
   */
  offset?: number;
}

/**
 * Custom hook for scroll spy functionality
 * 
 * Tracks which heading is currently visible in the viewport and returns
 * the ID of the active heading. Uses Intersection Observer for efficient
 * scroll tracking.
 * 
 * @param headingIds - Array of heading IDs to track
 * @param options - Configuration options
 * @returns The ID of the currently active heading
 * 
 * @example
 * ```typescript
 * const headings = [
 *   { id: 'intro', text: 'Introduction', level: 2 },
 *   { id: 'features', text: 'Features', level: 2 },
 * ];
 * 
 * const activeId = useScrollSpy(
 *   headings.map(h => h.id),
 *   { offset: 100 }
 * );
 * 
 * // activeId will be 'intro' or 'features' based on scroll position
 * ```
 */
export function useScrollSpy(
  headingIds: string[],
  options: UseScrollSpyOptions = {}
): string {
  const {
    rootMargin = '-100px 0px -66% 0px',
    threshold = 1.0,
    offset = 100,
  } = options;
  
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const headingElementsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  
  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    // Reset state
    headingElementsRef.current.clear();
    
    // Don't set up observer if no headings
    if (headingIds.length === 0) {
      setActiveId('');
      return;
    }
    
    /**
     * Check if user has scrolled to the bottom of the page
     * Returns true if within 50px of the bottom (more lenient)
     */
    const isAtBottom = (): boolean => {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || window.pageYOffset;
      const clientHeight = window.innerHeight;
      
      return scrollTop + clientHeight >= scrollHeight - 50;
    };
    
    /**
     * Find the currently active heading based on scroll position
     */
    const findActiveHeading = (): string | null => {
      // Check if at bottom first - always highlight last heading
      if (isAtBottom() && headingIds.length > 0) {
        return headingIds[headingIds.length - 1];
      }
      
      // Get all heading elements and their positions
      const headingElements = headingIds
        .map(id => ({
          id,
          element: document.getElementById(id)
        }))
        .filter(({ element }) => element !== null);
      
      if (headingElements.length === 0) {
        return null;
      }
      
      // Find the heading that's currently in view or just passed
      const scrollPosition = window.scrollY + offset;
      
      // Iterate from bottom to top to find the last heading above scroll position
      for (let i = headingElements.length - 1; i >= 0; i--) {
        const { id, element } = headingElements[i];
        if (element && element.offsetTop <= scrollPosition) {
          return id;
        }
      }
      
      // Default to first heading if we're above all headings
      return headingElements[0].id;
    };
    
    /**
     * Handle the case when no headings are intersecting
     * This typically happens at the bottom of the page
     */
    const handleNoIntersection = () => {
      const activeHeading = findActiveHeading();
      if (activeHeading) {
        setActiveId(activeHeading);
      }
    };
    
    // Create intersection observer with multiple thresholds for smoother updates
    const observer = new IntersectionObserver(
      (entries) => {
        // Update the map with latest entries
        entries.forEach((entry) => {
          headingElementsRef.current.set(entry.target.id, entry);
        });
        
        // Check if at bottom first
        if (isAtBottom() && headingIds.length > 0) {
          setActiveId(headingIds[headingIds.length - 1]);
          return;
        }
        
        // Find all visible headings and sort by vertical position (topmost first)
        const visibleHeadings = Array.from(headingElementsRef.current.values())
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => {
            // Sort by position in document (top to bottom)
            return a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top;
          });
        
        if (visibleHeadings.length > 0) {
          // Select the topmost visible heading as active
          setActiveId(visibleHeadings[0].target.id);
        } else {
          // Handle case where no headings are intersecting
          handleNoIntersection();
        }
      },
      {
        rootMargin,
        // Use multiple thresholds for smoother updates at different scroll speeds
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      }
    );
    
    observerRef.current = observer;
    
    // Observe all heading elements
    headingIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });
    
    // Add scroll listener for bottom detection
    const handleScroll = () => {
      if (isAtBottom() && headingIds.length > 0) {
        setActiveId(headingIds[headingIds.length - 1]);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Set initial active heading based on scroll position
    const setInitialActiveHeading = () => {
      const activeHeading = findActiveHeading();
      if (activeHeading) {
        setActiveId(activeHeading);
      } else if (headingIds.length > 0) {
        // Default to first heading
        setActiveId(headingIds[0]);
      }
    };
    
    // Set initial state after a brief delay to ensure DOM is ready
    const timeoutId = setTimeout(setInitialActiveHeading, 100);
    
    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      headingElementsRef.current.clear();
    };
  }, [headingIds, rootMargin, threshold, offset]);
  
  return activeId;
}

/**
 * Alternative scroll spy hook using scroll events
 * Fallback for browsers that don't support Intersection Observer
 * 
 * @param headingIds - Array of heading IDs to track
 * @param offset - Offset from top in pixels
 * @returns The ID of the currently active heading
 */
export function useScrollSpyFallback(
  headingIds: string[],
  offset: number = 100
): string {
  const [activeId, setActiveId] = useState<string>('');
  
  useEffect(() => {
    if (headingIds.length === 0) {
      setActiveId('');
      return;
    }
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY + offset;
      
      // Find the heading that's currently in view
      for (let i = headingIds.length - 1; i >= 0; i--) {
        const element = document.getElementById(headingIds[i]);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveId(headingIds[i]);
          return;
        }
      }
      
      // Default to first heading if none found
      if (headingIds.length > 0) {
        setActiveId(headingIds[0]);
      }
    };
    
    // Set initial state
    handleScroll();
    
    // Add scroll listener with throttling
    let timeoutId: NodeJS.Timeout;
    const throttledScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(handleScroll, 100);
    };
    
    window.addEventListener('scroll', throttledScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', throttledScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [headingIds, offset]);
  
  return activeId;
}

/**
 * Get all visible heading IDs
 * Useful for showing multiple active sections
 * 
 * @param headingIds - Array of heading IDs to track
 * @returns Array of currently visible heading IDs
 */
export function useVisibleHeadings(headingIds: string[]): string[] {
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (headingIds.length === 0) {
      setVisibleIds([]);
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target.id);
        
        setVisibleIds(visible);
      },
      {
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0.5,
      }
    );
    
    headingIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });
    
    return () => {
      observer.disconnect();
    };
  }, [headingIds]);
  
  return visibleIds;
}
