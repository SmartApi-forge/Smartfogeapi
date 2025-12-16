/**
 * Search Index Utilities
 * 
 * Functions for creating and managing the documentation search index.
 * Supports both build-time indexing and client-side search queries.
 */

import FlexSearch from 'flexsearch';
import { DocumentationContent, SearchResult } from './types';

// Type for FlexSearch Index
type SearchIndex = any; // FlexSearch.Index type is not properly exported

/**
 * Serializable search data for client-side hydration
 */
export interface SerializableSearchData {
  docs: Array<{
    id: number;
    title: string;
    slug: string;
    category: string;
    content: string;
  }>;
  indexData: string; // Serialized FlexSearch index
}

/**
 * Create a search index from documentation content
 * This can be used at build time to pre-index all documentation
 */
export function createSearchIndex(docs: DocumentationContent[]): SearchIndex {
  const index = new FlexSearch.Index({
    tokenize: 'forward',
    cache: true,
    resolution: 9,
    context: {
      depth: 2,
      bidirectional: true,
      resolution: 9,
    },
  });

  docs.forEach((doc, i) => {
    const searchableContent = `${doc.title} ${doc.content}`;
    index.add(i, searchableContent);
  });

  return index;
}

/**
 * Export search index and data for client-side use
 * Instead of serializing the index, we just export the docs
 * and rebuild the index on the client side
 */
export async function exportSearchData(
  index: SearchIndex,
  docs: DocumentationContent[]
): Promise<SerializableSearchData> {
  // Prepare minimal doc data for search results
  const docsData = docs.map((doc, i) => ({
    id: i,
    title: doc.title,
    slug: doc.slug,
    category: doc.category,
    content: doc.content.substring(0, 500), // Store first 500 chars for excerpts
  }));

  // Instead of exporting the index, we'll just send the docs
  // The client will rebuild the index from the docs
  return {
    docs: docsData,
    indexData: '', // Empty string, not used
  };
}

/**
 * Import search index from serialized data
 * Used on the client to hydrate the search index
 * Rebuilds the index from the document data
 */
export async function importSearchData(
  data: SerializableSearchData
): Promise<{ index: SearchIndex; docs: SerializableSearchData['docs'] }> {
  const index = new FlexSearch.Index({
    tokenize: 'forward',
    cache: true,
    resolution: 9,
    context: {
      depth: 2,
      bidirectional: true,
      resolution: 9,
    },
  });

  // Rebuild the index from the docs
  data.docs.forEach((doc) => {
    const searchableContent = `${doc.title} ${doc.content}`;
    index.add(doc.id, searchableContent);
  });

  return {
    index,
    docs: data.docs,
  };
}

/**
 * Search documentation content
 * Returns ranked search results with excerpts
 */
export function searchDocumentation(
  index: SearchIndex,
  docs: Array<{ id: number; title: string; slug: string; category: string; content: string }>,
  query: string,
  limit = 10
): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const results = index.search(query, { limit }) as number[];
  
  return results.map((id: number) => {
    const doc = docs[id];
    if (!doc) return null;
    
    // Extract excerpt around the match
    const excerpt = extractExcerpt(doc.content, query);
    
    return {
      title: doc.title,
      excerpt,
      url: `/docs/${doc.category}/${doc.slug}`,
      category: doc.category as any,
      matchScore: 1, // FlexSearch doesn't provide scores by default
    };
  }).filter((result: SearchResult | null): result is SearchResult => result !== null);
}

/**
 * Extract a relevant excerpt from content based on query
 * Shows context around the matched term
 */
function extractExcerpt(content: string, query: string, maxLength = 150): string {
  // Remove markdown syntax for cleaner excerpts
  const cleanContent = content
    .replace(/#{1,6}\s/g, '') // Remove heading markers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
    .replace(/`(.+?)`/g, '$1'); // Remove inline code
  
  const lowerContent = cleanContent.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);
  
  if (index === -1) {
    // If exact match not found, return beginning of content
    return cleanContent.substring(0, maxLength).trim() + '...';
  }
  
  // Extract text around the match
  const start = Math.max(0, index - 50);
  const end = Math.min(cleanContent.length, index + query.length + 100);
  
  let excerpt = cleanContent.substring(start, end).trim();
  
  if (start > 0) excerpt = '...' + excerpt;
  if (end < cleanContent.length) excerpt = excerpt + '...';
  
  return excerpt;
}

/**
 * Highlight search terms in text
 * Wraps matching terms in <mark> tags for visual highlighting
 */
export function highlightSearchTerms(text: string, query: string): string {
  if (!query.trim()) return text;
  
  // Escape special regex characters in query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Build search index from all documentation files
 * This is typically called at build time or on initial load
 */
export async function buildSearchIndex(
  docs: DocumentationContent[]
): Promise<SerializableSearchData> {
  const index = createSearchIndex(docs);
  return exportSearchData(index, docs);
}
