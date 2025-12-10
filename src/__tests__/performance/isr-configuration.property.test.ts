/**
 * Property Test: ISR Configuration Consistency
 * **Feature: nextjs-performance-optimization, Property 3: ISR Configuration Consistency**
 * **Validates: Requirements 3.1, 3.2, 3.5**
 * 
 * This property test verifies that static pages export revalidate = 3600
 * for Incremental Static Regeneration.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// ISR configuration constant from design document
const EXPECTED_REVALIDATE_VALUE = 3600;

// Pages that should have ISR enabled (static content pages)
const STATIC_PAGES = [
  'app/page.tsx',           // Homepage
  // Add more static pages as they are refactored
];

/**
 * Helper function to check if a file exports revalidate constant
 */
function hasRevalidateExport(filePath: string): { hasExport: boolean; value?: number } {
  if (!existsSync(filePath)) {
    return { hasExport: false };
  }
  
  const content = readFileSync(filePath, 'utf-8');
  
  // Check for export const revalidate = <number>
  const revalidateMatch = content.match(/export\s+const\s+revalidate\s*=\s*(\d+)/);
  
  if (revalidateMatch) {
    return { hasExport: true, value: parseInt(revalidateMatch[1], 10) };
  }
  
  return { hasExport: false };
}

/**
 * Helper function to check if a file is a Server Component (no 'use client')
 */
function isServerComponent(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  
  const content = readFileSync(filePath, 'utf-8');
  return !content.includes("'use client'") && !content.includes('"use client"');
}

describe('Property 3: ISR Configuration Consistency', () => {
  /**
   * Property: For any page component that serves primarily static content,
   * the page SHALL export a revalidate constant with a value of 3600 (seconds).
   */
  it('should have revalidate = 3600 exported from static pages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATIC_PAGES),
        (pagePath) => {
          const fullPath = join(process.cwd(), pagePath);
          
          // Skip if file doesn't exist (may not be refactored yet)
          if (!existsSync(fullPath)) {
            return true;
          }
          
          const result = hasRevalidateExport(fullPath);
          
          // Page should have revalidate export
          if (!result.hasExport) {
            throw new Error(`Page ${pagePath} does not export revalidate constant`);
          }
          
          // Revalidate value should be 3600
          if (result.value !== EXPECTED_REVALIDATE_VALUE) {
            throw new Error(
              `Page ${pagePath} has revalidate = ${result.value}, expected ${EXPECTED_REVALIDATE_VALUE}`
            );
          }
          
          return true;
        }
      ),
      { numRuns: STATIC_PAGES.length }
    );
  });

  /**
   * Property: For any page with ISR enabled, the page SHALL be a Server Component
   * (no 'use client' directive at the top).
   */
  it('should have static pages as Server Components (no use client directive)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATIC_PAGES),
        (pagePath) => {
          const fullPath = join(process.cwd(), pagePath);
          
          // Skip if file doesn't exist
          if (!existsSync(fullPath)) {
            return true;
          }
          
          const isServer = isServerComponent(fullPath);
          
          if (!isServer) {
            throw new Error(
              `Page ${pagePath} has 'use client' directive but should be a Server Component for ISR`
            );
          }
          
          return true;
        }
      ),
      { numRuns: STATIC_PAGES.length }
    );
  });

  /**
   * Specific test: Homepage should have ISR configured correctly
   */
  it('should have homepage (app/page.tsx) configured with ISR', () => {
    const homepagePath = join(process.cwd(), 'app/page.tsx');
    
    expect(existsSync(homepagePath)).toBe(true);
    
    const content = readFileSync(homepagePath, 'utf-8');
    
    // Should not have 'use client' directive
    expect(content).not.toContain("'use client'");
    expect(content).not.toContain('"use client"');
    
    // Should export revalidate = 3600
    expect(content).toContain('export const revalidate = 3600');
  });

  /**
   * Property: For any revalidate export, the value SHALL be a positive integer
   * representing seconds (not milliseconds or other units).
   */
  it('should have revalidate values in valid range (seconds, not milliseconds)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATIC_PAGES),
        (pagePath) => {
          const fullPath = join(process.cwd(), pagePath);
          
          if (!existsSync(fullPath)) {
            return true;
          }
          
          const result = hasRevalidateExport(fullPath);
          
          if (result.hasExport && result.value !== undefined) {
            // Value should be reasonable for seconds (1 minute to 1 week)
            const MIN_REVALIDATE = 60;        // 1 minute
            const MAX_REVALIDATE = 604800;    // 1 week
            
            if (result.value < MIN_REVALIDATE || result.value > MAX_REVALIDATE) {
              throw new Error(
                `Page ${pagePath} has revalidate = ${result.value}, which seems incorrect (expected ${MIN_REVALIDATE}-${MAX_REVALIDATE} seconds)`
              );
            }
          }
          
          return true;
        }
      ),
      { numRuns: STATIC_PAGES.length }
    );
  });
});
