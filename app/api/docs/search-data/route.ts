/**
 * Search Data API Route
 * 
 * Provides search index data for documentation search.
 * This can be called client-side to load the search index.
 */

import { NextResponse } from 'next/server';
import { loadAllDocumentation } from '@/lib/docs/search-builder';
import { buildSearchIndex } from '@/lib/docs/search-index';

// Cache the search data to avoid rebuilding on every request
let cachedSearchData: any = null;

export async function GET() {
  try {
    // Return cached data if available
    if (cachedSearchData) {
      return NextResponse.json(cachedSearchData);
    }

    // Load all documentation and build search index
    const docs = await loadAllDocumentation();
    const searchData = await buildSearchIndex(docs);

    // Cache the result
    cachedSearchData = searchData;

    return NextResponse.json(searchData);
  } catch (error) {
    console.error('Failed to build search index:', error);
    return NextResponse.json(
      { error: 'Failed to build search index' },
      { status: 500 }
    );
  }
}

// Revalidate every hour
export const revalidate = 3600;
