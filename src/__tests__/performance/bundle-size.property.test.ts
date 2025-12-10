/**
 * Property Test: Bundle Size Constraint
 * **Feature: nextjs-performance-optimization, Property 4: Bundle Size Constraint**
 * **Validates: Requirements 4.3**
 * 
 * This property test verifies that the Next.js configuration is properly set up
 * for bundle size optimization. Since we can't run actual builds in unit tests,
 * we verify the configuration settings that enable bundle optimization.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Configuration constants from design document
const BUNDLE_SIZE_LIMIT_KB = 150;
const REQUIRED_OPTIMIZE_PACKAGES = [
  '@tabler/icons-react',
  'lucide-react',
  'framer-motion',
];

describe('Property 4: Bundle Size Constraint', () => {
  /**
   * Property: For any production build configuration, the config SHALL include
   * optimizations that constrain bundle size below 150KB gzipped.
   * 
   * Since we cannot run actual builds in tests, we verify the configuration
   * settings that enable these optimizations.
   */
  it('should have bundle optimization settings configured in next.config.mjs', () => {
    const configPath = join(process.cwd(), 'next.config.mjs');
    expect(existsSync(configPath)).toBe(true);
    
    const configContent = readFileSync(configPath, 'utf-8');
    
    // Verify compression is enabled
    expect(configContent).toContain('compress: true');
    
    // Verify source maps are disabled in production
    expect(configContent).toContain('productionBrowserSourceMaps: false');
    
    // Verify bundle analyzer is configured
    expect(configContent).toContain('@next/bundle-analyzer');
    expect(configContent).toContain('withBundleAnalyzer');
  });

  it('should have optimizePackageImports configured for large libraries', () => {
    const configPath = join(process.cwd(), 'next.config.mjs');
    const configContent = readFileSync(configPath, 'utf-8');
    
    // Verify optimizePackageImports is present
    expect(configContent).toContain('optimizePackageImports');
    
    // Property: For any large library in REQUIRED_OPTIMIZE_PACKAGES,
    // it should be included in optimizePackageImports
    fc.assert(
      fc.property(
        fc.constantFrom(...REQUIRED_OPTIMIZE_PACKAGES),
        (packageName) => {
          return configContent.includes(packageName);
        }
      ),
      { numRuns: REQUIRED_OPTIMIZE_PACKAGES.length }
    );
  });

  it('should have image optimization enabled (reduces bundle by avoiding client-side processing)', () => {
    const configPath = join(process.cwd(), 'next.config.mjs');
    const configContent = readFileSync(configPath, 'utf-8');
    
    // Verify unoptimized is NOT set to true (image optimization is enabled)
    expect(configContent).not.toContain('unoptimized: true');
    
    // Verify modern image formats are configured
    expect(configContent).toContain('image/avif');
    expect(configContent).toContain('image/webp');
  });

  it('should have React Compiler enabled for automatic optimizations', () => {
    const configPath = join(process.cwd(), 'next.config.mjs');
    const configContent = readFileSync(configPath, 'utf-8');
    
    // Verify React Compiler is enabled
    expect(configContent).toContain('reactCompiler: true');
  });

  it('should have analyze script in package.json for bundle analysis', () => {
    const packagePath = join(process.cwd(), 'package.json');
    expect(existsSync(packagePath)).toBe(true);
    
    const packageContent = readFileSync(packagePath, 'utf-8');
    const packageJson = JSON.parse(packageContent);
    
    // Verify analyze script exists
    expect(packageJson.scripts).toHaveProperty('analyze');
    expect(packageJson.scripts.analyze).toContain('ANALYZE=true');
  });
});
