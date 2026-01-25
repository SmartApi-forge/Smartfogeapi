/**
 * Documentation Search Hook
 * 
 * Client-side hook for searching documentation content.
 * Manages search state, index loading, and query execution.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import FlexSearch from 'flexsearch';
import { SearchResult } from '@/lib/docs/types';
import { searchDocumentation, importSearchData, SerializableSearchData } from '@/lib/docs/search-index';

interface UseDocumentationSearchOptions {
  searchData?: SerializableSearchData;
  debounceMs?: number;
}

interface UseDocumentationSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  isLoading: boolean;
  isIndexReady: boolean;
  error: Error | null;
}

/**
 * Hook for searching documentation
 * 
 * @param options - Configuration options
 * @returns Search state and methods
 */
export function useDocumentationSearch(
  options: UseDocumentationSearchOptions = {}
): UseDocumentationSearchReturn {
  const { searchData, debounceMs = 150 } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexReady, setIsIndexReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [searchIndex, setSearchIndex] = useState<{
    index: FlexSearch.Index;
    docs: SerializableSearchData['docs'];
  } | null>(null);

  // Initialize search index
  useEffect(() => {
    if (!searchData) return;

    const initializeIndex = async () => {
      try {
        setIsLoading(true);
        const imported = await importSearchData(searchData);
        setSearchIndex(imported);
        setIsIndexReady(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize search index'));
        setIsIndexReady(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeIndex();
  }, [searchData]);

  // Perform search with debouncing
  useEffect(() => {
    if (!searchIndex || !query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      try {
        const searchResults = searchDocumentation(
          searchIndex.index,
          searchIndex.docs,
          query
        );
        setResults(searchResults);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Search failed'));
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [query, searchIndex, debounceMs]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    isIndexReady,
    error,
  };
}
