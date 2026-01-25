/**
 * Static Path Generation Utilities
 * 
 * Functions for generating static paths for documentation pages at build time.
 */

import { readdir } from 'fs/promises';
import { join } from 'path';

export interface DocPath {
  slug: string[];
  fullPath: string;
}

/**
 * Get all documentation file paths for static generation
 * This function scans the content/docs directory recursively
 */
export async function getAllDocPaths(): Promise<DocPath[]> {
  const contentDir = join(process.cwd(), 'content', 'docs');
  const paths: DocPath[] = [];

  async function scanDirectory(dir: string, basePath: string[] = []) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await scanDirectory(join(dir, entry.name), [...basePath, entry.name]);
        } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
          // Skip README files
          if (entry.name.toLowerCase() === 'readme.md' || entry.name.toLowerCase() === 'readme.mdx') {
            continue;
          }

          // Extract filename without extension
          const filename = entry.name.replace(/\.(mdx|md)$/, '');
          const slug = [...basePath, filename];
          const fullPath = join(dir, entry.name);

          paths.push({ slug, fullPath });
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
    }
  }

  await scanDirectory(contentDir);
  return paths;
}

/**
 * Get documentation content file path from slug
 */
export function getDocFilePath(slug: string[]): string {
  const contentDir = join(process.cwd(), 'content', 'docs');
  return join(contentDir, ...slug);
}
