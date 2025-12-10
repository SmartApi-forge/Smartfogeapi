/**
 * ValidationAgent Property-Based Tests
 * 
 * Tests for the ValidationAgent service using fast-check for property-based testing.
 * 
 * Feature: enhanced-context-management
 * 
 * These tests verify the correctness properties defined in the design document.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ValidationAgent } from './validation-agent';
import type { ValidationContext } from '../types/context-management';

describe('ValidationAgent', () => {
  let validationAgent: ValidationAgent;

  beforeEach(() => {
    validationAgent = new ValidationAgent();
  });

  /**
   * Property 10: Use Client Directive
   * *For any* Next.js App Router component that uses hooks, event handlers, or browser APIs,
   * the ValidationAgent SHALL ensure "use client" directive is present.
   * 
   * **Feature: enhanced-context-management, Property 10: Use Client Directive**
   * **Validates: Requirements 12.1**
   */
  describe('Property 10: Use Client Directive', () => {
    // React hooks that require "use client"
    const REACT_HOOKS = [
      'useState',
      'useEffect',
      'useCallback',
      'useMemo',
      'useRef',
      'useContext',
      'useReducer',
    ];

    // Event handlers that require "use client"
    const EVENT_HANDLERS = [
      'onClick',
      'onChange',
      'onSubmit',
      'onKeyDown',
      'onFocus',
      'onBlur',
    ];

    // Browser APIs that require "use client"
    const BROWSER_APIS = [
      'window',
      'document',
      'localStorage',
      'sessionStorage',
    ];

    const defaultContext: ValidationContext = {
      projectPatterns: {
        uiLibrary: 'shadcn/ui',
        styling: 'tailwind',
        formLibrary: 'react-hook-form',
        stateManagement: 'zustand',
        commonComponents: [],
        importPatterns: [],
      },
      existingImports: [],
      isNextJsAppRouter: true,
      filePath: 'app/components/test.tsx',
    };


    it('should add "use client" directive for any component using React hooks', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Pick a random React hook
          fc.constantFrom(...REACT_HOOKS),
          // Generate a random component name
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (hook, componentName) => {
            // Generate code that uses the hook without "use client"
            const code = `
import { ${hook} } from "react";

export function ${componentName}() {
  const value = ${hook}(${hook === 'useState' ? 'null' : hook === 'useRef' ? 'null' : ''});
  return <div>Test</div>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have "use client" directive
            expect(result.fixedCode.trim().startsWith('"use client"')).toBe(true);
            
            // There should be a fix applied for the directive
            const directiveFix = result.fixes.find(f => f.type === 'missing_directive');
            expect(directiveFix).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add "use client" directive for any component using event handlers', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Pick a random event handler
          fc.constantFrom(...EVENT_HANDLERS),
          // Generate a random component name
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (handler, componentName) => {
            // Generate code that uses the event handler without "use client"
            const code = `
export function ${componentName}() {
  return <button ${handler}={() => console.log('clicked')}>Click</button>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have "use client" directive
            expect(result.fixedCode.trim().startsWith('"use client"')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add "use client" directive for any component using browser APIs', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Pick a random browser API
          fc.constantFrom(...BROWSER_APIS),
          // Generate a random component name
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (api, componentName) => {
            // Generate code that uses the browser API without "use client"
            const code = `
export function ${componentName}() {
  const value = ${api}.${api === 'window' ? 'innerWidth' : api === 'document' ? 'title' : 'getItem("key")'};
  return <div>{value}</div>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have "use client" directive
            expect(result.fixedCode.trim().startsWith('"use client"')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT add "use client" directive for server components', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a random component name
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          // Generate random props
          fc.stringMatching(/^[a-z][a-zA-Z]{2,10}$/),
          async (componentName, propName) => {
            // Generate a pure server component (no hooks, no event handlers, no browser APIs)
            const code = `
export function ${componentName}({ ${propName} }: { ${propName}: string }) {
  return <div>{${propName}}</div>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code should NOT have "use client" directive added
            // (it should remain unchanged since it doesn't need it)
            expect(result.fixedCode.trim().startsWith('"use client"')).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve existing "use client" directive', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REACT_HOOKS),
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (hook, componentName) => {
            // Generate code that already has "use client"
            const code = `"use client";

import { ${hook} } from "react";

export function ${componentName}() {
  const value = ${hook}(${hook === 'useState' ? 'null' : ''});
  return <div>Test</div>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // Should not add duplicate directive
            const directiveCount = (result.fixedCode.match(/"use client"/g) || []).length;
            expect(directiveCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Next.js specific client hooks
    const NEXTJS_CLIENT_HOOKS = [
      'useRouter',
      'usePathname',
      'useSearchParams',
      'useParams',
    ];

    it('should add "use client" directive for any component using Next.js client hooks', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Pick a random Next.js client hook
          fc.constantFrom(...NEXTJS_CLIENT_HOOKS),
          // Generate a random component name
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (hook, componentName) => {
            // Generate code that uses the Next.js hook without "use client"
            const code = `
import { ${hook} } from "next/navigation";

export function ${componentName}() {
  const value = ${hook}();
  return <div>Test</div>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have "use client" directive
            expect(result.fixedCode.trim().startsWith('"use client"')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Third-party hooks that require "use client"
    const THIRD_PARTY_HOOKS = [
      'useForm',
      'useSWR',
      'useQuery',
      'useAtom',
      'useTheme',
    ];

    it('should add "use client" directive for any component using third-party client hooks', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Pick a random third-party hook
          fc.constantFrom(...THIRD_PARTY_HOOKS),
          // Generate a random component name
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (hook, componentName) => {
            // Generate code that uses the third-party hook without "use client"
            const code = `
export function ${componentName}() {
  const value = ${hook}();
  return <div>Test</div>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have "use client" directive
            expect(result.fixedCode.trim().startsWith('"use client"')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add "use client" directive for components using createContext', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (contextName) => {
            // Generate code that uses createContext without "use client"
            const code = `
import { createContext } from "react";

export const ${contextName}Context = createContext(null);

export function ${contextName}Provider({ children }) {
  return <${contextName}Context.Provider value={{}}>{children}</${contextName}Context.Provider>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have "use client" directive
            expect(result.fixedCode.trim().startsWith('"use client"')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT add "use client" for hooks mentioned in comments', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REACT_HOOKS),
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (hook, componentName) => {
            // Generate code that only mentions hooks in comments
            const code = `
// This component could use ${hook} but doesn't
/* We might add ${hook} later */
export function ${componentName}({ value }: { value: string }) {
  return <div>{value}</div>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code should NOT have "use client" directive
            expect(result.fixedCode.trim().startsWith('"use client"')).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 11: Import Completeness
   * *For any* code that uses react-hook-form's useForm, the ValidationAgent SHALL 
   * ensure the import statement is present.
   * 
   * **Feature: enhanced-context-management, Property 11: Import Completeness**
   * **Validates: Requirements 12.2**
   */
  describe('Property 11: Import Completeness', () => {
    const defaultContext: ValidationContext = {
      projectPatterns: {
        uiLibrary: 'shadcn/ui',
        styling: 'tailwind',
        formLibrary: 'react-hook-form',
        stateManagement: 'zustand',
        commonComponents: [],
        importPatterns: [],
      },
      existingImports: [],
      isNextJsAppRouter: true,
      filePath: 'app/components/test.tsx',
      // Include shadcn component files so validation knows they exist
      projectFiles: [
        'components/ui/button.tsx',
        'components/ui/input.tsx',
        'components/ui/card.tsx',
        'components/ui/dialog.tsx',
        'components/ui/label.tsx',
        'components/ui/form.tsx',
        'lib/utils.ts',
      ],
    };

    it('should add useForm import when useForm is used without import', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a random form name
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}Form$/),
          async (formName) => {
            // Generate code that uses useForm without importing it
            const code = `"use client";

export function ${formName}() {
  const form = useForm();
  return <form onSubmit={form.handleSubmit(() => {})}><input /></form>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have useForm import from react-hook-form
            expect(result.fixedCode).toContain('import');
            expect(result.fixedCode).toContain('useForm');
            expect(result.fixedCode).toContain('react-hook-form');
            
            // There should be a fix applied for the missing import
            const importFix = result.fixes.find(f => 
              f.type === 'missing_import' && f.description.includes('useForm')
            );
            expect(importFix).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add zodResolver import when zodResolver is used without import', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}Form$/),
          async (formName) => {
            // Generate code that uses zodResolver without importing it
            const code = `"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({ name: z.string() });

export function ${formName}() {
  const form = useForm({ resolver: zodResolver(schema) });
  return <form><input /></form>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have zodResolver import
            expect(result.fixedCode).toContain('zodResolver');
            expect(result.fixedCode).toContain('@hookform/resolvers/zod');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT add duplicate imports when import already exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}Form$/),
          async (formName) => {
            // Generate code that already has the import
            const code = `"use client";

import { useForm } from "react-hook-form";

export function ${formName}() {
  const form = useForm();
  return <form><input /></form>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // Should not add duplicate import
            const importCount = (result.fixedCode.match(/from\s+["']react-hook-form["']/g) || []).length;
            expect(importCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add shadcn component imports when components are used without import', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Pick random shadcn components
          fc.constantFrom('Button', 'Input', 'Card', 'Dialog', 'Label'),
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (component, componentName) => {
            // Generate code that uses the component without importing it
            const code = `"use client";

export function ${componentName}() {
  return <${component}>Content</${component}>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have the component import
            expect(result.fixedCode).toContain(`import`);
            expect(result.fixedCode).toContain(component);
            expect(result.fixedCode).toContain('@/components/ui/');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add React hook imports when hooks are used without import', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('useState', 'useEffect', 'useCallback', 'useMemo', 'useRef'),
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,15}$/),
          async (hook, componentName) => {
            // Generate code that uses the hook without importing it
            const code = `"use client";

export function ${componentName}() {
  const value = ${hook}(${hook === 'useState' ? 'null' : hook === 'useRef' ? 'null' : ''});
  return <div>Test</div>;
}
`.trim();

            const result = await validationAgent.validate(code, 'app/test.tsx', defaultContext);

            // The fixed code MUST have the hook import from react
            expect(result.fixedCode).toContain('import');
            expect(result.fixedCode).toContain(hook);
            expect(result.fixedCode).toContain('from "react"');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
