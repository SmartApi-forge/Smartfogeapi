/**
 * Property-Based Tests for Dependency Detector Service
 * 
 * **Feature: full-project-scaffolding, Property 5: Dependency Detection from Prompt**
 * **Validates: Requirements 3.1**
 * 
 * For any prompt containing library names (case-insensitive), the dependency detector
 * SHALL identify those libraries in the detected packages list.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectFromPrompt,
  suggestLibraries,
  getPackagesToInstall,
  KNOWN_LIBRARIES,
  LIBRARY_SUGGESTIONS,
  type DetectedDependencies,
  type SuggestedLibrary,
} from '../services/dependency-detector';

describe('Dependency Detector Property Tests', () => {
  /**
   * **Feature: full-project-scaffolding, Property 5: Dependency Detection from Prompt**
   * **Validates: Requirements 3.1**
   */
  describe('Property 5: Dependency Detection from Prompt', () => {
    // Get unique library names that map to unique packages
    const libraryEntries = Object.entries(KNOWN_LIBRARIES);
    const uniquePackages = [...new Set(Object.values(KNOWN_LIBRARIES))];
    
    it('should detect explicitly mentioned library names (case-insensitive)', () => {
      // Create arbitrary from known library names
      const libraryNameArb = fc.constantFrom(...Object.keys(KNOWN_LIBRARIES));
      const caseTransformArb = fc.constantFrom(
        (s: string) => s.toLowerCase(),
        (s: string) => s.toUpperCase(),
        (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
        (s: string) => s, // original
      );
      const promptPrefixArb = fc.constantFrom(
        'Create a landing page with ',
        'Build an app using ',
        'I want to use ',
        'Make a website with ',
        'Add ',
        '',
      );
      const promptSuffixArb = fc.constantFrom(
        ' animations',
        ' for my project',
        ' library',
        '',
      );

      fc.assert(
        fc.property(
          libraryNameArb,
          caseTransformArb,
          promptPrefixArb,
          promptSuffixArb,
          (libraryName, transform, prefix, suffix) => {
            const transformedName = transform(libraryName);
            const prompt = `${prefix}${transformedName}${suffix}`;
            const result = detectFromPrompt(prompt);
            
            const expectedPackage = KNOWN_LIBRARIES[libraryName];
            
            // The package should be in explicit list
            expect(result.explicit).toContain(expectedPackage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect multiple libraries in a single prompt', () => {
      // Pick 2-3 different library names that map to different packages
      const distinctLibrariesArb = fc.array(
        fc.constantFrom(...Object.keys(KNOWN_LIBRARIES)),
        { minLength: 2, maxLength: 3 }
      ).filter(libs => {
        // Ensure they map to different packages
        const packages = libs.map(l => KNOWN_LIBRARIES[l]);
        return new Set(packages).size === libs.length;
      });

      fc.assert(
        fc.property(distinctLibrariesArb, (libraries) => {
          const prompt = `Create an app with ${libraries.join(' and ')}`;
          const result = detectFromPrompt(prompt);
          
          // All mentioned libraries should be detected
          for (const lib of libraries) {
            const expectedPackage = KNOWN_LIBRARIES[lib];
            expect(result.explicit).toContain(expectedPackage);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not detect libraries that are not mentioned', () => {
      // Prompts that don't mention any known libraries
      const genericPromptArb = fc.constantFrom(
        'Create a simple landing page',
        'Build a todo app',
        'Make a blog website',
        'Design a portfolio site',
        'Create a contact form page',
      );

      fc.assert(
        fc.property(genericPromptArb, (prompt) => {
          const result = detectFromPrompt(prompt);
          
          // Should not detect any explicit libraries from generic prompts
          // (suggestions may still be made based on keywords)
          expect(result.explicit.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle library aliases correctly', () => {
      // Test specific aliases
      const aliasTestCases = [
        { alias: 'greensock', expected: 'gsap' },
        { alias: 'framer motion', expected: 'framer-motion' },
        { alias: 'threejs', expected: 'three' },
        { alias: 'tanstack-query', expected: '@tanstack/react-query' },
        { alias: 'react-query', expected: '@tanstack/react-query' },
      ];
      
      const aliasArb = fc.constantFrom(...aliasTestCases);

      fc.assert(
        fc.property(aliasArb, ({ alias, expected }) => {
          const prompt = `Build an app with ${alias}`;
          const result = detectFromPrompt(prompt);
          
          expect(result.explicit).toContain(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should not have duplicate packages in explicit list', () => {
      // Use aliases that map to the same package
      const duplicateAliasesArb = fc.constantFrom(
        'gsap and greensock',
        'framer-motion and motion',
        'three.js and threejs and three',
        'react-query and tanstack-query',
      );

      fc.assert(
        fc.property(duplicateAliasesArb, (aliases) => {
          const prompt = `Create an app with ${aliases}`;
          const result = detectFromPrompt(prompt);
          
          // No duplicates in explicit list
          const uniqueExplicit = new Set(result.explicit);
          expect(result.explicit.length).toBe(uniqueExplicit.size);
        }),
        { numRuns: 100 }
      );
    });

    it('should return valid DetectedDependencies structure', () => {
      const promptArb = fc.string({ minLength: 1, maxLength: 200 });

      fc.assert(
        fc.property(promptArb, (prompt) => {
          const result = detectFromPrompt(prompt);
          
          // Should have correct structure
          expect(result).toHaveProperty('explicit');
          expect(result).toHaveProperty('suggested');
          expect(result).toHaveProperty('reasons');
          
          expect(Array.isArray(result.explicit)).toBe(true);
          expect(Array.isArray(result.suggested)).toBe(true);
          expect(typeof result.reasons).toBe('object');
          
          // All explicit packages should be strings
          for (const pkg of result.explicit) {
            expect(typeof pkg).toBe('string');
          }
          
          // All suggested packages should be strings
          for (const pkg of result.suggested) {
            expect(typeof pkg).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: full-project-scaffolding, Property 16: Library Suggestion Keywords**
   * **Validates: Requirements 9.1**
   */
  describe('Property 16: Library Suggestion Keywords', () => {
    it('should suggest framer-motion for prompts containing "animation" or "animated"', () => {
      const animationKeywordArb = fc.constantFrom(
        'animation',
        'animated',
        'animate',
        'Animation',
        'ANIMATED',
        'Animate',
      );
      const promptTemplateArb = fc.constantFrom(
        (kw: string) => `Create a landing page with ${kw}`,
        (kw: string) => `Build an ${kw} hero section`,
        (kw: string) => `Make a website with smooth ${kw}s`,
        (kw: string) => `Add ${kw} effects to the page`,
      );

      fc.assert(
        fc.property(
          animationKeywordArb,
          promptTemplateArb,
          (keyword, template) => {
            const prompt = template(keyword);
            const suggestions = suggestLibraries(prompt);
            
            // Should suggest framer-motion
            const framerSuggestion = suggestions.find(s => s.name === 'framer-motion');
            expect(framerSuggestion).toBeDefined();
            expect(framerSuggestion?.reason).toBe('Lightweight React animation library');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT suggest framer-motion when another animation library is explicitly mentioned', () => {
      const otherAnimationLibArb = fc.constantFrom('gsap', 'lottie');
      const animationKeywordArb = fc.constantFrom('animation', 'animated');

      fc.assert(
        fc.property(
          otherAnimationLibArb,
          animationKeywordArb,
          (otherLib, keyword) => {
            const prompt = `Create a landing page with ${keyword} using ${otherLib}`;
            const suggestions = suggestLibraries(prompt);
            
            // Should NOT suggest framer-motion when gsap or lottie is mentioned
            const framerSuggestion = suggestions.find(s => s.name === 'framer-motion');
            expect(framerSuggestion).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should suggest gsap for scroll animation keywords', () => {
      const scrollKeywordArb = fc.constantFrom(
        'scroll animation',
        'parallax',
        'scroll trigger',
        'scrolltrigger',
      );

      fc.assert(
        fc.property(scrollKeywordArb, (keyword) => {
          const prompt = `Create a landing page with ${keyword} effects`;
          const suggestions = suggestLibraries(prompt);
          
          const gsapSuggestion = suggestions.find(s => s.name === 'gsap');
          expect(gsapSuggestion).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should suggest recharts for chart/graph keywords', () => {
      const chartKeywordArb = fc.constantFrom(
        'chart',
        'charts',
        'graph',
        'graphs',
        'visualization',
      );

      fc.assert(
        fc.property(chartKeywordArb, (keyword) => {
          const prompt = `Build a dashboard with ${keyword}`;
          const suggestions = suggestLibraries(prompt);
          
          const rechartsSuggestion = suggestions.find(s => s.name === 'recharts');
          expect(rechartsSuggestion).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should suggest react-hook-form for form keywords', () => {
      const formKeywordArb = fc.constantFrom(
        'form',
        'forms',
        'validation',
      );

      fc.assert(
        fc.property(formKeywordArb, (keyword) => {
          const prompt = `Create a contact ${keyword} page`;
          const suggestions = suggestLibraries(prompt);
          
          const formSuggestion = suggestions.find(s => s.name === 'react-hook-form');
          expect(formSuggestion).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should return valid SuggestedLibrary structure', () => {
      const keywordArb = fc.constantFrom(
        ...LIBRARY_SUGGESTIONS.flatMap(rule => rule.keywords)
      );

      fc.assert(
        fc.property(keywordArb, (keyword) => {
          const prompt = `Create something with ${keyword}`;
          const suggestions = suggestLibraries(prompt);
          
          // Each suggestion should have correct structure
          for (const suggestion of suggestions) {
            expect(suggestion).toHaveProperty('name');
            expect(suggestion).toHaveProperty('reason');
            expect(suggestion).toHaveProperty('keywords');
            
            expect(typeof suggestion.name).toBe('string');
            expect(typeof suggestion.reason).toBe('string');
            expect(Array.isArray(suggestion.keywords)).toBe(true);
            expect(suggestion.keywords.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not have duplicate suggestions', () => {
      // Prompts with multiple keywords that could trigger same suggestion
      const multiKeywordPromptArb = fc.constantFrom(
        'Create an animated page with smooth animation effects',
        'Build a dashboard with charts and graphs and visualization',
        'Make a form with validation and forms handling',
      );

      fc.assert(
        fc.property(multiKeywordPromptArb, (prompt) => {
          const suggestions = suggestLibraries(prompt);
          
          // No duplicate package names
          const packageNames = suggestions.map(s => s.name);
          const uniqueNames = new Set(packageNames);
          expect(packageNames.length).toBe(uniqueNames.size);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('getPackagesToInstall', () => {
    it('should filter out packages already in template', () => {
      // framer-motion and gsap are in template
      const inTemplateLibArb = fc.constantFrom('framer-motion', 'gsap', 'zustand', 'zod');
      
      fc.assert(
        fc.property(inTemplateLibArb, (lib) => {
          const prompt = `Create an app with ${lib}`;
          const toInstall = getPackagesToInstall(prompt);
          
          // Should NOT include packages that are in template
          expect(toInstall).not.toContain(lib);
        }),
        { numRuns: 100 }
      );
    });

    it('should include packages not in template', () => {
      // three, recharts, etc. are NOT in template
      const notInTemplateArb = fc.constantFrom('three', 'chart.js', 'stripe');

      fc.assert(
        fc.property(notInTemplateArb, (lib) => {
          const prompt = `Create an app with ${lib}`;
          const toInstall = getPackagesToInstall(prompt);
          
          // Should include packages not in template
          const expectedPackage = lib === 'chart.js' ? 'chart.js' : 
                                  lib === 'stripe' ? '@stripe/stripe-js' : lib;
          expect(toInstall).toContain(expectedPackage);
        }),
        { numRuns: 100 }
      );
    });
  });
});
