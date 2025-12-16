"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAdjacentPages } from '@/lib/docs/navigation-utils';
import { cn } from '@/lib/utils';

interface PageNavigationProps {
  className?: string;
}

/**
 * PageNavigation Component
 * 
 * Displays previous and next page navigation links at the bottom of documentation pages.
 * Automatically determines adjacent pages based on the navigation structure.
 * 
 * Requirements: 8.2, 8.3 - Optimize navigation performance
 */
export function PageNavigation({ className }: PageNavigationProps) {
  const pathname = usePathname();
  const { previous, next } = getAdjacentPages(pathname);

  // Don't render if there are no adjacent pages
  if (!previous && !next) {
    return null;
  }

  return (
    <nav
      className={cn('flex items-center justify-between gap-4 border-t pt-8 mt-12', className)}
      aria-label="Page navigation"
    >
      {/* Previous page link */}
      {previous ? (
        <Link
          href={previous.href}
          prefetch={true}
          className="flex-1 group"
        >
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-auto py-3 px-4"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col items-start text-left">
              <span className="text-xs text-muted-foreground">Previous</span>
              <span className="text-sm font-medium group-hover:text-primary transition-colors">
                {previous.title}
              </span>
            </div>
          </Button>
        </Link>
      ) : (
        <div className="flex-1" />
      )}

      {/* Next page link */}
      {next ? (
        <Link
          href={next.href}
          prefetch={true}
          className="flex-1 group"
        >
          <Button
            variant="outline"
            className="w-full justify-end gap-2 h-auto py-3 px-4"
          >
            <div className="flex flex-col items-end text-right">
              <span className="text-xs text-muted-foreground">Next</span>
              <span className="text-sm font-medium group-hover:text-primary transition-colors">
                {next.title}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Button>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </nav>
  );
}
