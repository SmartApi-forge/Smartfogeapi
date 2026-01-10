/**
 * Property-Based Tests for API Detector Service
 * 
 * **Feature: ui-quality-chat-polish, Property 3: API Keyword Detection Accuracy**
 * **Validates: Requirements 3.1**
 * 
 * For any prompt containing at least 2 API-related keywords (api, rest, endpoint, route, crud, etc.),
 * the detector SHALL return isAPIRequest = true.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectAPIRequest,
  API_KEYWORDS,
  type APIDetectionResult,
} from '../services/api-detector';

describe('API Detector Property Tests', () => {
  /**
   * **Feature: ui-quality-chat-polish, Property 3: API Keyword Detection Accuracy**
   * **Validates: Requirements 3.1**
   */
  describe('Property 3: API Keyword Detection Accuracy', () => {
    // Create arbitrary from API keywords
    const apiKeywordArb = fc.constantFrom(...API_KEYWORDS);
    
    // Case transformation arbitrary
    const caseTransformArb = fc.constantFrom(
      (s: string) => s.toLowerCase(),
      (s: string) => s.toUpperCase(),
      (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
      (s: string) => s, // original
    );

    // Prompt templates
    const promptTemplateArb = fc.constantFrom(
      (kw1: string, kw2: string) => `Create a ${kw1} with ${kw2}`,
      (kw1: string, kw2: string) => `Build a ${kw1} ${kw2} service`,
      (kw1: string, kw2: string) => `I need a ${kw1} for ${kw2} operations`,
      (kw1: string, kw2: string) => `Make a ${kw1} and ${kw2}`,
      (kw1: string, kw2: string) => `${kw1} ${kw2}`,
    );

    it('should return isAPIRequest = true for prompts with 2+ API keywords', () => {
      // Pick 2 distinct API keywords
      const twoDistinctKeywordsArb = fc.tuple(apiKeywordArb, apiKeywordArb)
        .filter(([kw1, kw2]) => kw1 !== kw2);

      fc.assert(
        fc.property(
          twoDistinctKeywordsArb,
          caseTransformArb,
          caseTransformArb,
          promptTemplateArb,
          ([kw1, kw2], transform1, transform2, template) => {
            const transformedKw1 = transform1(kw1);
            const transformedKw2 = transform2(kw2);
            const prompt = template(transformedKw1, transformedKw2);
            
            const result = detectAPIRequest(prompt);
            
            // With 2+ API keywords, isAPIRequest should be true
            expect(result.isAPIRequest).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect all mentioned API keywords in the keywords array', () => {
      // Pick 2-4 distinct API keywords
      const multipleKeywordsArb = fc.array(apiKeywordArb, { minLength: 2, maxLength: 4 })
        .filter(keywords => new Set(keywords).size === keywords.length);

      fc.assert(
        fc.property(multipleKeywordsArb, (keywords) => {
          const prompt = `Create an application with ${keywords.join(' and ')}`;
          const result = detectAPIRequest(prompt);
          
          // All mentioned keywords should be in the result
          for (const keyword of keywords) {
            expect(result.keywords).toContain(keyword);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should return isAPIRequest = false for prompts with fewer than 2 API keywords', () => {
      // Prompts with 0 or 1 API keyword
      const singleOrNoKeywordPromptArb = fc.constantFrom(
        'Create a simple landing page',
        'Build a todo app',
        'Make a blog website',
        'Design a portfolio site',
        'Create a contact form page',
        'Build a dashboard', // only 1 keyword if any
        'Make a simple website',
      );

      fc.assert(
        fc.property(singleOrNoKeywordPromptArb, (prompt) => {
          const result = detectAPIRequest(prompt);
          
          // With fewer than 2 API keywords, isAPIRequest should be false
          expect(result.isAPIRequest).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle case-insensitive keyword matching', () => {
      const caseVariationsArb = fc.constantFrom(
        ['API', 'REST'],
        ['api', 'rest'],
        ['Api', 'Rest'],
        ['API', 'endpoint'],
        ['CRUD', 'DATABASE'],
        ['crud', 'database'],
      );

      fc.assert(
        fc.property(caseVariationsArb, ([kw1, kw2]) => {
          const prompt = `Create a ${kw1} with ${kw2}`;
          const result = detectAPIRequest(prompt);
          
          // Should detect regardless of case
          expect(result.isAPIRequest).toBe(true);
          expect(result.keywords.length).toBeGreaterThanOrEqual(2);
        }),
        { numRuns: 100 }
      );
    });

    it('should return valid APIDetectionResult structure', () => {
      const promptArb = fc.string({ minLength: 1, maxLength: 200 });

      fc.assert(
        fc.property(promptArb, (prompt) => {
          const result = detectAPIRequest(prompt);
          
          // Should have correct structure
          expect(result).toHaveProperty('isAPIRequest');
          expect(result).toHaveProperty('keywords');
          expect(result).toHaveProperty('suggestedStructure');
          expect(result).toHaveProperty('confidence');
          
          expect(typeof result.isAPIRequest).toBe('boolean');
          expect(Array.isArray(result.keywords)).toBe(true);
          expect(['api', 'frontend', 'fullstack', 'unknown']).toContain(result.suggestedStructure);
          expect(typeof result.confidence).toBe('number');
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
          
          // All keywords should be strings
          for (const keyword of result.keywords) {
            expect(typeof keyword).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should suggest "api" structure when only API keywords are present', () => {
      // Prompts with only API keywords (no frontend keywords)
      const apiOnlyKeywordsArb = fc.tuple(
        fc.constantFrom('api', 'rest', 'endpoint', 'crud', 'backend'),
        fc.constantFrom('route', 'server', 'database', 'schema', 'model')
      );

      fc.assert(
        fc.property(apiOnlyKeywordsArb, ([kw1, kw2]) => {
          const prompt = `Create a ${kw1} with ${kw2}`;
          const result = detectAPIRequest(prompt);
          
          expect(result.isAPIRequest).toBe(true);
          expect(result.suggestedStructure).toBe('api');
        }),
        { numRuns: 100 }
      );
    });

    it('should suggest "fullstack" structure when both API and frontend keywords are present', () => {
      // Prompts with both API and frontend keywords - ensure distinct API keywords
      const fullstackKeywordsArb = fc.tuple(
        fc.constantFrom('api', 'rest', 'endpoint', 'crud', 'backend'),
        fc.constantFrom('route', 'database', 'server', 'schema', 'model'),
        fc.constantFrom('ui', 'frontend', 'component', 'react', 'dashboard')
      ).filter(([kw1, kw2, _]) => kw1 !== kw2); // Ensure distinct API keywords

      fc.assert(
        fc.property(fullstackKeywordsArb, ([apiKw1, apiKw2, frontendKw]) => {
          const prompt = `Create a ${apiKw1} with ${apiKw2} and ${frontendKw}`;
          const result = detectAPIRequest(prompt);
          
          expect(result.isAPIRequest).toBe(true);
          expect(result.suggestedStructure).toBe('fullstack');
        }),
        { numRuns: 100 }
      );
    });

    it('should calculate confidence based on keyword count', () => {
      // More keywords = higher confidence
      const keywordCountsArb = fc.constantFrom(
        { keywords: ['api', 'rest'], expectedMinConfidence: 0.4 },
        { keywords: ['api', 'rest', 'crud'], expectedMinConfidence: 0.6 },
        { keywords: ['api', 'rest', 'crud', 'endpoint'], expectedMinConfidence: 0.8 },
        { keywords: ['api', 'rest', 'crud', 'endpoint', 'route'], expectedMinConfidence: 1.0 },
      );

      fc.assert(
        fc.property(keywordCountsArb, ({ keywords, expectedMinConfidence }) => {
          const prompt = `Create something with ${keywords.join(' and ')}`;
          const result = detectAPIRequest(prompt);
          
          expect(result.confidence).toBeGreaterThanOrEqual(expectedMinConfidence);
        }),
        { numRuns: 100 }
      );
    });

    it('should use word boundary matching to avoid partial matches', () => {
      // Words that contain API keywords as substrings but aren't API-related
      const partialMatchPromptArb = fc.constantFrom(
        'Create a rapid application', // contains 'api' but not as word
        'Build a therapist finder', // contains 'api' but not as word
        'Make a postcard generator', // contains 'post' but not as word
      );

      fc.assert(
        fc.property(partialMatchPromptArb, (prompt) => {
          const result = detectAPIRequest(prompt);
          
          // Should not detect partial matches as API keywords
          expect(result.isAPIRequest).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

});
