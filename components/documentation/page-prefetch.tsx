"use client"

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { getAdjacentPages } from '@/lib/docs/navigation-utils';

/**
 * PagePrefetch Component
 * 
 * Automatically prefetches adjacent documentation pages to improve navigation performance.
 * Uses Next.js Link component's prefetch capability to load pages in the background.
 * 
 * This component renders hidden links that trigger Next.js's automatic prefetching,
 * ensuring that when users navigate to the next or previous page, it loads instantly.
 * 
 * Requirements: 8.2, 8.3 - Optimize navigation performance
 */
export function PagePrefetch() {
  const pathname = usePathname();

  useEffect(() => {
    // Prefetch adjacent pages when the component mounts or pathname changes
    const { previous, next } = getAdjacentPages(pathname);

    // Log prefetch activity in development
    if (process.env.NODE_ENV === 'development') {
      if (previous) {
        console.log('[Prefetch] Previous page:', previous.href);
      }
      if (next) {
        console.log('[Prefetch] Next page:', next.href);
      }
    }
  }, [pathname]);

  const { previous, next } = getAdjacentPages(pathname);

  return (
    <>
      {/* Hidden links for prefetching - Next.js automatically prefetches these */}
      {previous && (
        <Link
          href={previous.href}
          prefetch={true}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        >
          {previous.title}
        </Link>
      )}
      {next && (
        <Link
          href={next.href}
          prefetch={true}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        >
          {next.title}
        </Link>
      )}
    </>
  );
}
