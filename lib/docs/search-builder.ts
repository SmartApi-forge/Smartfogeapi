/**
 * Search Index Builder
 * 
 * Utilities for building the search index from documentation files.
 * This is typically used at build time or during initial page load.
 */

import { DocumentationContent, DocumentationCategory } from './types';
import { buildSearchIndex, SerializableSearchData } from './search-index';
import { docsContent } from './content';

/**
 * Load all documentation from the in-memory content array
 * This uses the structured content from lib/docs/content.ts
 */
export async function loadAllDocumentation(): Promise<DocumentationContent[]> {
  // Convert docsContent to DocumentationContent format
  return docsContent.map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    content: doc.content,
    headings: doc.subsections?.map(sub => ({
      id: sub.id,
      text: sub.title,
      level: sub.level,
    })) || [],
    category: doc.category as DocumentationCategory,
  }));
}

/**
 * Build search index from documentation content
 * This can be called during the build process or at runtime
 */
export async function buildAndSaveSearchIndex(): Promise<SerializableSearchData> {
  const docs = await loadAllDocumentation();
  const searchData = await buildSearchIndex(docs);
  return searchData;
}
