/**
 * Content Loader Utilities
 * 
 * Functions for loading and processing MDX documentation files.
 */

import { DocumentationContent, DocumentationCategory, Heading } from './types';

/**
 * Extract headings from HTML content
 * This will be used to generate the table of contents
 */
export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi;
  
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1], 10);
    const id = match[2];
    const text = match[3].replace(/<[^>]*>/g, ''); // Strip HTML tags
    
    headings.push({ id, text, level });
  }
  
  return headings;
}

/**
 * Extract h2-h4 headings from MDX content for table of contents
 * Generates unique IDs for each heading
 * 
 * @param content - Raw MDX content string
 * @returns Array of headings with generated IDs
 */
export function extractHeadingsFromMDX(content: string): Heading[] {
  const headings: Heading[] = [];
  const usedIds = new Set<string>();
  
  // Match markdown headings (## to ####)
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length; // Number of # characters
    const text = match[2].trim();
    
    // Generate unique ID from heading text
    let id = generateId(text);
    
    // Ensure ID is unique by appending a number if necessary
    let counter = 1;
    let uniqueId = id;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${id}-${counter}`;
      counter++;
    }
    
    usedIds.add(uniqueId);
    
    headings.push({
      id: uniqueId,
      text,
      level,
    });
  }
  
  return headings;
}

/**
 * Extract headings from rendered HTML content
 * Useful when working with already-rendered MDX
 * 
 * @param html - Rendered HTML string
 * @returns Array of headings extracted from HTML
 */
export function extractHeadingsFromHTML(html: string): Heading[] {
  const headings: Heading[] = [];
  
  // Match h2-h4 tags with IDs
  const headingRegex = /<h([2-4])[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h\1>/gi;
  
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    let id = match[2];
    const text = match[3].replace(/<[^>]*>/g, '').trim(); // Strip HTML tags
    
    // Generate ID if not present
    if (!id) {
      id = generateId(text);
    }
    
    headings.push({ id, text, level });
  }
  
  return headings;
}

/**
 * Generate a slug-friendly ID from text
 */
export function generateId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get category from path
 */
export function getCategoryFromPath(path: string): DocumentationCategory {
  if (path.includes('getting-started')) return DocumentationCategory.GETTING_STARTED;
  if (path.includes('features')) return DocumentationCategory.FEATURES;
  if (path.includes('api-reference')) return DocumentationCategory.API_REFERENCE;
  if (path.includes('guides')) return DocumentationCategory.GUIDES;
  if (path.includes('deployment')) return DocumentationCategory.DEPLOYMENT;
  if (path.includes('troubleshooting')) return DocumentationCategory.TROUBLESHOOTING;
  
  return DocumentationCategory.GETTING_STARTED;
}

/**
 * Parse frontmatter from MDX content
 */
export function parseFrontmatter(content: string): {
  metadata: Record<string, any>;
  content: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { metadata: {}, content };
  }
  
  const [, frontmatterStr, mainContent] = match;
  const metadata: Record<string, any> = {};
  
  // Simple YAML-like parsing
  frontmatterStr.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      metadata[key.trim()] = value.replace(/^["']|["']$/g, '');
    }
  });
  
  return { metadata, content: mainContent };
}
