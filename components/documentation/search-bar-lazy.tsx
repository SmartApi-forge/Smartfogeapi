"use client"

import dynamic from 'next/dynamic';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SerializableSearchData } from '@/lib/docs/search-index';

// Lazy load the actual SearchBar component
const SearchBar = dynamic(
  () => import('./search-bar').then((mod) => ({ default: mod.SearchBar })),
  {
    loading: () => <SearchBarSkeleton />,
    ssr: false, // Don't render on server since it's interactive
  }
);

interface SearchBarLazyProps {
  searchData?: SerializableSearchData;
  placeholder?: string;
  className?: string;
}

/**
 * Lazy-loaded SearchBar Component
 * 
 * Implements code splitting for the search functionality to reduce initial bundle size.
 * The search component is only loaded when needed.
 * 
 * Requirements: 8.4, 8.5
 */
export function SearchBarLazy(props: SearchBarLazyProps) {
  return <SearchBar {...props} />;
}

/**
 * Loading skeleton for SearchBar
 */
function SearchBarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex h-9 w-full items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm',
        className
      )}
      aria-label="Loading search"
    >
      <Search className="mr-2 h-4 w-4 shrink-0 animate-pulse" aria-hidden="true" />
      <span className="flex-1 text-left animate-pulse">Loading search...</span>
    </div>
  );
}
