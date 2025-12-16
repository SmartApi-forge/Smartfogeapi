/**
 * Search Data Hook
 * 
 * Hook to fetch and cache search index data from the API.
 */

'use client';

import { useState, useEffect } from 'react';
import { SerializableSearchData } from '@/lib/docs/search-index';

interface UseSearchDataReturn {
  searchData: SerializableSearchData | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch search data from the API
 * Caches the result in memory to avoid repeated fetches
 */
export function useSearchData(): UseSearchDataReturn {
  const [searchData, setSearchData] = useState<SerializableSearchData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSearchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/docs/search-data');
        
        if (!response.ok) {
          throw new Error('Failed to fetch search data');
        }

        const data = await response.json();
        setSearchData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setSearchData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchData();
  }, []);

  return { searchData, isLoading, error };
}
