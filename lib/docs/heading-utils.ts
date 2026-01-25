/**
 * Heading Extraction Utilities
 * 
 * Functions for extracting and processing headings from MDX content
 * for table of contents generation.
 */

import GithubSlugger from 'github-slugger';
import { Heading } from './types';

/**
 * Extract h2-h4 headings from MDX content for table of contents
 * Generates unique IDs for each heading
 * 
 * This function is specifically designed for the right sidebar TOC,
 * which displays h2-h4 headings only.
 * 
 * @param content - Raw MDX content string
 * @returns Array of headings with generated IDs (levels 2-4)
 * 
 * @example
 * ```typescript
 * const mdx = `
 * ## Getting Started
 * ### Installation
 * #### Prerequisites
 * ## Features
 * `;
 * const headings = extractHeadingsForTOC(mdx);
 * // Returns: [
 * //   { id: 'getting-started', text: 'Getting Started', level: 2 },
 * //   { id: 'installation', text: 'Installation', level: 3 },
 * //   { id: 'prerequisites', text: 'Prerequisites', level: 4 },
 * //   { id: 'features', text: 'Features', level: 2 }
 * // ]
 * ```
 */
export function extractHeadingsForTOC(content: string): Heading[] {
  const headings: Heading[] = [];
  const slugger = new GithubSlugger();
  
  // Match markdown headings (## to ####)
  // This regex matches lines starting with 2-4 # characters followed by space and text
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length; // Number of # characters (2, 3, or 4)
    const rawText = match[2].trim();
    
    // Remove any markdown formatting from the heading text
    const text = cleanHeadingText(rawText);
    
    // Generate unique ID using github-slugger (same algorithm as rehype-slug)
    // github-slugger automatically handles duplicate IDs by appending numeric suffixes
    const id = slugger.slug(text);
    
    headings.push({
      id,
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
 * @returns Array of headings extracted from HTML (levels 2-4)
 * 
 * @example
 * ```typescript
 * const html = '<h2 id="intro">Introduction</h2><h3>Details</h3>';
 * const headings = extractHeadingsFromHTML(html);
 * // Returns: [
 * //   { id: 'intro', text: 'Introduction', level: 2 },
 * //   { id: 'details', text: 'Details', level: 3 }
 * // ]
 * ```
 */
export function extractHeadingsFromHTML(html: string): Heading[] {
  const headings: Heading[] = [];
  const slugger = new GithubSlugger();
  
  // Match h2-h4 tags with optional IDs
  const headingRegex = /<h([2-4])(?:\s+[^>]*)?(?:id="([^"]*)")?[^>]*>(.*?)<\/h\1>/gi;
  
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    let id = match[2];
    const rawText = match[3];
    
    // Strip HTML tags and clean text
    const text = rawText.replace(/<[^>]*>/g, '').trim();
    
    // Generate ID if not present using github-slugger
    if (!id) {
      id = slugger.slug(text);
    }
    
    headings.push({ id, text, level });
  }
  
  return headings;
}

/**
 * Clean heading text by removing markdown formatting
 * 
 * @param text - Raw heading text that may contain markdown
 * @returns Cleaned text without markdown formatting
 */
function cleanHeadingText(text: string): string {
  return text
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Trim whitespace
    .trim();
}

/**
 * Filter headings to only include specific levels
 * 
 * @param headings - Array of headings
 * @param levels - Array of levels to include (e.g., [2, 3, 4])
 * @returns Filtered array of headings
 */
export function filterHeadingsByLevel(
  headings: Heading[],
  levels: number[]
): Heading[] {
  return headings.filter((heading) => levels.includes(heading.level));
}

/**
 * Build a nested heading structure for hierarchical TOC display
 * 
 * @param headings - Flat array of headings
 * @returns Nested heading structure
 */
export interface NestedHeading extends Heading {
  children?: NestedHeading[];
}

export function buildNestedHeadings(headings: Heading[]): NestedHeading[] {
  const nested: NestedHeading[] = [];
  const stack: NestedHeading[] = [];
  
  for (const heading of headings) {
    const nestedHeading: NestedHeading = { ...heading, children: [] };
    
    // Find the appropriate parent based on heading level
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }
    
    if (stack.length === 0) {
      // Top-level heading
      nested.push(nestedHeading);
    } else {
      // Child heading
      const parent = stack[stack.length - 1];
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(nestedHeading);
    }
    
    stack.push(nestedHeading);
  }
  
  return nested;
}
