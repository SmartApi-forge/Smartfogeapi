/**
 * SearchBar Component
 * 
 * Documentation search with:
 * - Keyboard shortcuts (Cmd+K / Ctrl+K)
 * - Search overlay/modal
 * - Real-time search suggestions
 * - Result highlighting
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SearchResult } from '@/lib/docs/types';
import { useDocumentationSearch } from '@/hooks/use-documentation-search';
import { SerializableSearchData, highlightSearchTerms } from '@/lib/docs/search-index';

interface SearchBarProps {
  searchData?: SerializableSearchData;
  placeholder?: string;
  className?: string;
}

/**
 * SearchBar Component
 * 
 * Provides a search interface for documentation with keyboard shortcuts
 * and real-time search results.
 */
export function SearchBar({
  searchData,
  placeholder = 'Search documentation...',
  className,
}: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { query, setQuery, results, isLoading, isIndexReady } = useDocumentationSearch({
    searchData,
  });

  // Keyboard shortcut to open search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Handle keyboard navigation in results
  // Requirements: 6.5 - Keyboard navigation support
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleResultClick(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      } else if (e.key === 'Tab' && !e.shiftKey && results.length > 0) {
        // Allow Tab to cycle through results
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === 'Tab' && e.shiftKey && results.length > 0) {
        // Allow Shift+Tab to cycle backwards through results
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    },
    [results, selectedIndex]
  );

  // Handle result selection
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      router.push(result.url);
      setIsOpen(false);
      setQuery('');
    },
    [router, setQuery]
  );

  // Handle dialog close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, [setQuery]);

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        onKeyDown={(e) => {
          // Requirements: 6.5 - Enter key activation for interactive elements
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-label="Open search dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className={cn(
          'relative flex h-9 w-full items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          className
        )}
      >
        <Search className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{placeholder}</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex" aria-hidden="true">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search dialog/modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogTitle className="sr-only">Search Documentation</DialogTitle>
          
          {/* Search input */}
          <div className="flex items-center border-b px-4 py-3">
            <Search className="mr-2 h-5 w-5 shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border-0 bg-transparent p-0 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
            />
            {isLoading && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {query && !isLoading && (
              <button
                onClick={() => setQuery('')}
                className="ml-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </button>
            )}
          </div>

          {/* Search results */}
          <ScrollArea className="max-h-[400px]">
            {!isIndexReady ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading search index...
              </div>
            ) : query && results.length === 0 && !isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>No results found for &quot;{query}&quot;</p>
                <p className="mt-2 text-xs">Try different keywords or check your spelling</p>
              </div>
            ) : query && results.length > 0 ? (
              <div className="py-2" role="listbox" aria-label="Search results">
                {results.map((result, index) => (
                  <button
                    key={`${result.url}-${index}`}
                    onClick={() => handleResultClick(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onKeyDown={(e) => {
                      // Requirements: 6.5 - Enter key activation for search results
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleResultClick(result);
                      }
                    }}
                    role="option"
                    aria-selected={index === selectedIndex}
                    tabIndex={index === selectedIndex ? 0 : -1}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                      index === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    )}
                  >
                    <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium leading-none">{result.title}</p>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {result.category}
                        </span>
                      </div>
                      <p
                        className="line-clamp-2 text-sm text-muted-foreground"
                        dangerouslySetInnerHTML={{
                          __html: highlightSearchTerms(result.excerpt, query),
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>Start typing to search documentation</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <kbd className="rounded border bg-muted px-2 py-1 text-xs">↑↓</kbd>
                  <span className="text-xs">to navigate</span>
                  <kbd className="rounded border bg-muted px-2 py-1 text-xs">Enter</kbd>
                  <span className="text-xs">to select</span>
                  <kbd className="rounded border bg-muted px-2 py-1 text-xs">Esc</kbd>
                  <span className="text-xs">to close</span>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
