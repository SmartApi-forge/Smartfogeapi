/**
 * Property-Based Tests for Color Guidelines
 * 
 * **Feature: full-project-scaffolding, Property 17: No Purple Colors**
 * **Validates: Requirements 10.7, 10.12**
 * 
 * For any generated code, the Tailwind color classes SHALL NOT include
 * purple, violet, or fuchsia unless explicitly requested in the prompt.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Forbidden color patterns for generated code
 * These colors should NOT appear unless explicitly requested
 */
const FORBIDDEN_COLOR_PATTERNS = [
  // Tailwind purple classes
  /\bpurple-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
  // Tailwind violet classes
  /\bviolet-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
  // Tailwind fuchsia classes
  /\bfuchsia-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
  // Tailwind pink classes (also discouraged unless requested)
  /\bpink-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
  // CSS named colors
  /\bcolor:\s*(?:purple|violet|fuchsia|magenta|orchid|plum|lavender|thistle|mediumpurple|darkviolet|darkorchid|blueviolet|mediumorchid|rebeccapurple)\b/i,
  // Background with forbidden colors
  /\bbg-(?:purple|violet|fuchsia|pink)-\d+\b/,
  // Text with forbidden colors
  /\btext-(?:purple|violet|fuchsia|pink)-\d+\b/,
  // Border with forbidden colors
  /\bborder-(?:purple|violet|fuchsia|pink)-\d+\b/,
  // Ring with forbidden colors
  /\bring-(?:purple|violet|fuchsia|pink)-\d+\b/,
  // From/to gradient with forbidden colors
  /\bfrom-(?:purple|violet|fuchsia|pink)-\d+\b/,
  /\bto-(?:purple|violet|fuchsia|pink)-\d+\b/,
  /\bvia-(?:purple|violet|fuchsia|pink)-\d+\b/,
];

/**
 * Allowed/preferred color patterns
 */
const ALLOWED_COLOR_PATTERNS = [
  // Neutrals
  /\b(?:slate|zinc|neutral|stone|gray)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
  // Cool accents (blue family)
  /\b(?:blue|sky|cyan)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
  // Nature accents (green family)
  /\b(?:green|emerald|teal)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
  // Warm accents
  /\b(?:amber|orange|yellow)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
  // Error/destructive
  /\b(?:red)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
  // Semantic colors
  /\b(?:background|foreground|muted|accent|primary|secondary|destructive|border|input|ring)\b/,
];

/**
 * Check if code contains forbidden purple/violet/fuchsia colors
 */
export function containsForbiddenColors(code: string): boolean {
  return FORBIDDEN_COLOR_PATTERNS.some(pattern => pattern.test(code));
}

/**
 * Extract all Tailwind color classes from code
 */
export function extractColorClasses(code: string): string[] {
  const colorClassPattern = /\b(?:bg|text|border|ring|from|to|via)-[a-z]+-\d+\b/g;
  const matches = code.match(colorClassPattern) || [];
  return [...new Set(matches)];
}

/**
 * Check if a prompt explicitly requests purple/violet/fuchsia colors
 */
export function promptRequestsForbiddenColors(prompt: string): boolean {
  const requestPatterns = [
    /\bpurple\b/i,
    /\bviolet\b/i,
    /\bfuchsia\b/i,
    /\bmagenta\b/i,
    /\blavender\b/i,
  ];
  return requestPatterns.some(pattern => pattern.test(prompt));
}

/**
 * Validate generated code against color guidelines
 * Returns true if code is compliant (no forbidden colors OR user requested them)
 */
export function validateColorGuidelines(code: string, userPrompt: string): {
  isCompliant: boolean;
  forbiddenColorsFound: string[];
  userRequestedForbiddenColors: boolean;
} {
  const forbiddenColorsFound = extractColorClasses(code).filter(colorClass => 
    FORBIDDEN_COLOR_PATTERNS.some(pattern => pattern.test(colorClass))
  );
  
  const userRequestedForbiddenColors = promptRequestsForbiddenColors(userPrompt);
  
  // Compliant if no forbidden colors OR user explicitly requested them
  const isCompliant = forbiddenColorsFound.length === 0 || userRequestedForbiddenColors;
  
  return {
    isCompliant,
    forbiddenColorsFound,
    userRequestedForbiddenColors,
  };
}

describe('Color Guidelines Property Tests', () => {
  /**
   * **Feature: full-project-scaffolding, Property 17: No Purple Colors**
   * **Validates: Requirements 10.7, 10.12**
   */
  describe('Property 17: No Purple Colors', () => {
    
    it('should detect forbidden purple color classes', () => {
      const purpleShadeArb = fc.constantFrom(
        '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'
      );
      const prefixArb = fc.constantFrom('bg', 'text', 'border', 'ring', 'from', 'to', 'via');
      
      fc.assert(
        fc.property(prefixArb, purpleShadeArb, (prefix, shade) => {
          const purpleClass = `${prefix}-purple-${shade}`;
          expect(containsForbiddenColors(purpleClass)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should detect forbidden violet color classes', () => {
      const violetShadeArb = fc.constantFrom(
        '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'
      );
      const prefixArb = fc.constantFrom('bg', 'text', 'border', 'ring', 'from', 'to', 'via');
      
      fc.assert(
        fc.property(prefixArb, violetShadeArb, (prefix, shade) => {
          const violetClass = `${prefix}-violet-${shade}`;
          expect(containsForbiddenColors(violetClass)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should detect forbidden fuchsia color classes', () => {
      const fuchsiaShadeArb = fc.constantFrom(
        '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'
      );
      const prefixArb = fc.constantFrom('bg', 'text', 'border', 'ring', 'from', 'to', 'via');
      
      fc.assert(
        fc.property(prefixArb, fuchsiaShadeArb, (prefix, shade) => {
          const fuchsiaClass = `${prefix}-fuchsia-${shade}`;
          expect(containsForbiddenColors(fuchsiaClass)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should allow preferred neutral color classes', () => {
      const neutralColorArb = fc.constantFrom('slate', 'zinc', 'neutral', 'stone', 'gray');
      const shadeArb = fc.constantFrom(
        '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'
      );
      const prefixArb = fc.constantFrom('bg', 'text', 'border');
      
      fc.assert(
        fc.property(prefixArb, neutralColorArb, shadeArb, (prefix, color, shade) => {
          const colorClass = `${prefix}-${color}-${shade}`;
          expect(containsForbiddenColors(colorClass)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should allow preferred blue accent color classes', () => {
      const blueColorArb = fc.constantFrom('blue', 'sky', 'cyan');
      const shadeArb = fc.constantFrom(
        '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'
      );
      const prefixArb = fc.constantFrom('bg', 'text', 'border');
      
      fc.assert(
        fc.property(prefixArb, blueColorArb, shadeArb, (prefix, color, shade) => {
          const colorClass = `${prefix}-${color}-${shade}`;
          expect(containsForbiddenColors(colorClass)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should allow preferred green accent color classes', () => {
      const greenColorArb = fc.constantFrom('green', 'emerald', 'teal');
      const shadeArb = fc.constantFrom(
        '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'
      );
      const prefixArb = fc.constantFrom('bg', 'text', 'border');
      
      fc.assert(
        fc.property(prefixArb, greenColorArb, shadeArb, (prefix, color, shade) => {
          const colorClass = `${prefix}-${color}-${shade}`;
          expect(containsForbiddenColors(colorClass)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should validate code is compliant when no forbidden colors present', () => {
      const allowedCodeArb = fc.constantFrom(
        '<Button className="bg-blue-600 text-white">Click</Button>',
        '<div className="bg-slate-100 text-slate-900">Content</div>',
        '<Card className="border-zinc-200 bg-white">Card</Card>',
        '<span className="text-emerald-600">Success</span>',
        '<div className="from-slate-900 to-slate-700 bg-gradient-to-r">Gradient</div>',
      );
      const promptArb = fc.constantFrom(
        'Create a landing page',
        'Build a dashboard',
        'Make a contact form',
      );
      
      fc.assert(
        fc.property(allowedCodeArb, promptArb, (code, prompt) => {
          const result = validateColorGuidelines(code, prompt);
          expect(result.isCompliant).toBe(true);
          expect(result.forbiddenColorsFound).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should mark code as non-compliant when forbidden colors present without user request', () => {
      const forbiddenCodeArb = fc.constantFrom(
        '<Button className="bg-purple-600 text-white">Click</Button>',
        '<div className="bg-violet-100 text-violet-900">Content</div>',
        '<Card className="border-fuchsia-200">Card</Card>',
        '<span className="text-pink-600">Text</span>',
        '<div className="from-purple-500 to-violet-500 bg-gradient-to-r">Gradient</div>',
      );
      const neutralPromptArb = fc.constantFrom(
        'Create a landing page',
        'Build a dashboard',
        'Make a contact form',
      );
      
      fc.assert(
        fc.property(forbiddenCodeArb, neutralPromptArb, (code, prompt) => {
          const result = validateColorGuidelines(code, prompt);
          expect(result.isCompliant).toBe(false);
          expect(result.forbiddenColorsFound.length).toBeGreaterThan(0);
          expect(result.userRequestedForbiddenColors).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should allow forbidden colors when user explicitly requests them', () => {
      const forbiddenCodeArb = fc.constantFrom(
        '<Button className="bg-purple-600 text-white">Click</Button>',
        '<div className="bg-violet-100 text-violet-900">Content</div>',
        '<Card className="border-fuchsia-200">Card</Card>',
      );
      const purpleRequestPromptArb = fc.constantFrom(
        'Create a landing page with purple theme',
        'Build a dashboard using violet colors',
        'Make a form with fuchsia accents',
        'I want a purple color scheme',
      );
      
      fc.assert(
        fc.property(forbiddenCodeArb, purpleRequestPromptArb, (code, prompt) => {
          const result = validateColorGuidelines(code, prompt);
          expect(result.isCompliant).toBe(true);
          expect(result.userRequestedForbiddenColors).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify prompts requesting forbidden colors', () => {
      const purplePromptArb = fc.constantFrom(
        'purple theme',
        'violet colors',
        'fuchsia accents',
        'magenta buttons',
        'lavender background',
        'I want PURPLE',
        'use Violet',
      );
      
      fc.assert(
        fc.property(purplePromptArb, (prompt) => {
          expect(promptRequestsForbiddenColors(prompt)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify prompts NOT requesting forbidden colors', () => {
      const neutralPromptArb = fc.constantFrom(
        'Create a landing page',
        'Build a dashboard',
        'Make a contact form',
        'blue theme',
        'green accents',
        'slate background',
        'professional design',
      );
      
      fc.assert(
        fc.property(neutralPromptArb, (prompt) => {
          expect(promptRequestsForbiddenColors(prompt)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should extract color classes correctly from code', () => {
      const codeWithColorsArb = fc.constantFrom(
        '<div className="bg-blue-500 text-white border-slate-200">Test</div>',
        '<Button className="bg-emerald-600 hover:bg-emerald-700">Click</Button>',
        '<Card className="from-slate-900 to-slate-700 via-slate-800">Card</Card>',
      );
      
      fc.assert(
        fc.property(codeWithColorsArb, (code) => {
          const classes = extractColorClasses(code);
          expect(classes.length).toBeGreaterThan(0);
          // All extracted classes should match the color pattern
          for (const cls of classes) {
            expect(cls).toMatch(/^(?:bg|text|border|ring|from|to|via)-[a-z]+-\d+$/);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
