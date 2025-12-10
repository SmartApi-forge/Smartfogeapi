/**
 * ValidationAgent Service
 * 
 * Validates generated code and applies automatic fixes for common issues.
 * Handles missing imports, syntax errors, type errors, and framework-specific validations.
 * 
 * Requirements: 2.4, 8.4, 12.1, 12.2, 12.3, 12.4
 */

import type {
  IValidationAgent,
  ValidationResult,
  ValidationIssue,
  ValidationContext,
  AppliedFix,
  ReadinessReport,
  ReadinessCheck,
  ValidationIssueType,
} from '../types/context-management';

/**
 * React hooks that require "use client" directive in Next.js App Router
 */
const REACT_HOOKS = [
  'useState',
  'useEffect',
  'useCallback',
  'useMemo',
  'useRef',
  'useContext',
  'useReducer',
  'useLayoutEffect',
  'useImperativeHandle',
  'useDebugValue',
  'useDeferredValue',
  'useTransition',
  'useId',
  'useSyncExternalStore',
  'useInsertionEffect',
];

/**
 * Next.js client-side hooks from next/navigation that require "use client"
 */
const NEXTJS_CLIENT_HOOKS = [
  'useRouter',
  'usePathname',
  'useSearchParams',
  'useParams',
  'useSelectedLayoutSegment',
  'useSelectedLayoutSegments',
];

/**
 * React DOM hooks that require "use client" directive
 */
const REACT_DOM_HOOKS = [
  'useFormState',
  'useFormStatus',
];

/**
 * Third-party hooks that commonly require "use client" directive
 */
const THIRD_PARTY_CLIENT_HOOKS = [
  // react-hook-form
  'useForm',
  'useFieldArray',
  'useWatch',
  'useFormContext',
  'useController',
  // SWR
  'useSWR',
  'useSWRMutation',
  'useSWRInfinite',
  // React Query / TanStack Query
  'useQuery',
  'useMutation',
  'useInfiniteQuery',
  'useQueryClient',
  // Zustand
  'useStore',
  // Jotai
  'useAtom',
  'useAtomValue',
  'useSetAtom',
  // Framer Motion
  'useAnimation',
  'useMotionValue',
  'useSpring',
  'useTransform',
  'useScroll',
  'useInView',
  // Other common hooks
  'useTheme',
  'useMediaQuery',
  'useLocalStorage',
  'useSessionStorage',
  'useDebounce',
  'useThrottle',
  'usePrevious',
  'useClickOutside',
  'useOnClickOutside',
  'useHover',
  'useFocus',
  'useKeyPress',
  'useWindowSize',
  'useElementSize',
  'useIntersectionObserver',
  'useCopyToClipboard',
  'useToggle',
  'useDisclosure',
  'useBoolean',
  'useCounter',
  'useInterval',
  'useTimeout',
  'useEventListener',
  'useMounted',
  'useIsMounted',
  'useIsClient',
];

/**
 * Event handlers that require "use client" directive
 */
const EVENT_HANDLERS = [
  'onClick',
  'onChange',
  'onSubmit',
  'onKeyDown',
  'onKeyUp',
  'onKeyPress',
  'onFocus',
  'onBlur',
  'onMouseEnter',
  'onMouseLeave',
  'onMouseDown',
  'onMouseUp',
  'onScroll',
  'onDrag',
  'onDrop',
  'onInput',
  'onSelect',
  'onTouchStart',
  'onTouchEnd',
];

/**
 * Browser APIs that require "use client" directive
 */
const BROWSER_APIS = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
  'addEventListener',
  'removeEventListener',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IntersectionObserver',
  'ResizeObserver',
  'MutationObserver',
  'matchMedia',
  'getComputedStyle',
  'scrollTo',
  'scrollBy',
  'fetch', // When used directly in component body (not in useEffect)
  'XMLHttpRequest',
  'WebSocket',
  'BroadcastChannel',
  'Notification',
  'Geolocation',
  'MediaDevices',
  'AudioContext',
  'SpeechRecognition',
  'SpeechSynthesis',
  'Clipboard',
  'Performance',
  'PerformanceObserver',
  'crypto',
  'indexedDB',
  'caches',
  'serviceWorker',
];


/**
 * Common shadcn/ui component imports
 */
const SHADCN_COMPONENTS: Record<string, string> = {
  Dialog: '@/components/ui/dialog',
  DialogContent: '@/components/ui/dialog',
  DialogHeader: '@/components/ui/dialog',
  DialogTitle: '@/components/ui/dialog',
  DialogDescription: '@/components/ui/dialog',
  DialogFooter: '@/components/ui/dialog',
  DialogTrigger: '@/components/ui/dialog',
  DialogClose: '@/components/ui/dialog',
  Button: '@/components/ui/button',
  Input: '@/components/ui/input',
  Label: '@/components/ui/label',
  Card: '@/components/ui/card',
  CardContent: '@/components/ui/card',
  CardHeader: '@/components/ui/card',
  CardTitle: '@/components/ui/card',
  CardDescription: '@/components/ui/card',
  CardFooter: '@/components/ui/card',
  Textarea: '@/components/ui/textarea',
  Select: '@/components/ui/select',
  SelectContent: '@/components/ui/select',
  SelectItem: '@/components/ui/select',
  SelectTrigger: '@/components/ui/select',
  SelectValue: '@/components/ui/select',
  Checkbox: '@/components/ui/checkbox',
  RadioGroup: '@/components/ui/radio-group',
  RadioGroupItem: '@/components/ui/radio-group',
  Switch: '@/components/ui/switch',
  Tabs: '@/components/ui/tabs',
  TabsContent: '@/components/ui/tabs',
  TabsList: '@/components/ui/tabs',
  TabsTrigger: '@/components/ui/tabs',
  Avatar: '@/components/ui/avatar',
  AvatarImage: '@/components/ui/avatar',
  AvatarFallback: '@/components/ui/avatar',
  Badge: '@/components/ui/badge',
  Alert: '@/components/ui/alert',
  AlertTitle: '@/components/ui/alert',
  AlertDescription: '@/components/ui/alert',
  Separator: '@/components/ui/separator',
  Skeleton: '@/components/ui/skeleton',
  Table: '@/components/ui/table',
  TableBody: '@/components/ui/table',
  TableCell: '@/components/ui/table',
  TableHead: '@/components/ui/table',
  TableHeader: '@/components/ui/table',
  TableRow: '@/components/ui/table',
  Popover: '@/components/ui/popover',
  PopoverContent: '@/components/ui/popover',
  PopoverTrigger: '@/components/ui/popover',
  Modal: '@/components/ui/modal',
  ModalContent: '@/components/ui/modal',
  ModalHeader: '@/components/ui/modal',
  ModalFooter: '@/components/ui/modal',
  Sheet: '@/components/ui/sheet',
  SheetContent: '@/components/ui/sheet',
  SheetHeader: '@/components/ui/sheet',
  SheetTitle: '@/components/ui/sheet',
  SheetDescription: '@/components/ui/sheet',
  SheetTrigger: '@/components/ui/sheet',
  Form: '@/components/ui/form',
  FormField: '@/components/ui/form',
  FormItem: '@/components/ui/form',
  FormLabel: '@/components/ui/form',
  FormControl: '@/components/ui/form',
  FormDescription: '@/components/ui/form',
  FormMessage: '@/components/ui/form',
};

/**
 * Common library imports
 */
const LIBRARY_IMPORTS: Record<string, { from: string; namedImports: string[] }> = {
  useForm: { from: 'react-hook-form', namedImports: ['useForm'] },
  useFieldArray: { from: 'react-hook-form', namedImports: ['useFieldArray'] },
  useWatch: { from: 'react-hook-form', namedImports: ['useWatch'] },
  useFormContext: { from: 'react-hook-form', namedImports: ['useFormContext'] },
  Controller: { from: 'react-hook-form', namedImports: ['Controller'] },
  z: { from: 'zod', namedImports: ['z'] },
  zodResolver: { from: '@hookform/resolvers/zod', namedImports: ['zodResolver'] },
  cn: { from: '@/lib/utils', namedImports: ['cn'] },
  clsx: { from: 'clsx', namedImports: ['clsx'] },
  twMerge: { from: 'tailwind-merge', namedImports: ['twMerge'] },
  toast: { from: 'sonner', namedImports: ['toast'] },
  Toaster: { from: 'sonner', namedImports: ['Toaster'] },
};

/**
 * Components that should not be placed inside header/nav/footer
 * due to z-index and positioning issues
 */
const OVERLAY_COMPONENTS = ['Dialog', 'Modal', 'Popover', 'Sheet', 'AlertDialog', 'DropdownMenu'];

/**
 * Container components that overlay components should not be nested in
 */
const PROBLEMATIC_CONTAINERS = ['header', 'nav', 'footer', 'Header', 'Nav', 'Footer', 'Navbar', 'Navigation'];


/**
 * ValidationAgent implementation
 * Validates generated code and applies automatic fixes
 */
export class ValidationAgent implements IValidationAgent {
  /**
   * Validate code and apply automatic fixes
   * Requirements: 2.4, 8.4, 12.1, 12.2, 12.4
   */
  async validate(
    code: string,
    filePath: string,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const fixes: AppliedFix[] = [];
    let fixedCode = code;

    // Only validate TypeScript/JavaScript React files
    if (!this.isReactFile(filePath)) {
      return { isValid: true, fixedCode: code, issues: [], fixes: [] };
    }

    // Step 1: Check and fix "use client" directive (Requirements: 12.1)
    if (context.isNextJsAppRouter) {
      const useClientResult = this.checkAndFixUseClient(fixedCode);
      if (useClientResult.needsDirective && !useClientResult.hasDirective) {
        // Get detailed reasons for the directive requirement
        const reasons = this.getUseClientReason(fixedCode);
        const reasonText = reasons.length > 0 ? ` (${reasons.slice(0, 3).join(', ')})` : '';
        
        issues.push({
          type: 'missing_directive',
          severity: 'error',
          message: `Missing "use client" directive for client-side component${reasonText}`,
          line: 1,
          autoFixable: true,
        });
        fixedCode = useClientResult.fixedCode;
        fixes.push({
          type: 'missing_directive',
          description: `Added "use client" directive${reasonText}`,
          line: 1,
        });
      }

      // Step 1.5: Validate Next.js specific patterns (Requirements: 12.1)
      const nextJsIssues = this.validateNextJsPatterns(fixedCode, filePath);
      issues.push(...nextJsIssues);

      // Auto-fix next/router to next/navigation if needed
      if (nextJsIssues.some(i => i.message.includes('next/navigation'))) {
        const routerFixResult = this.fixNextRouterImport(fixedCode);
        if (routerFixResult.modified) {
          fixedCode = routerFixResult.code;
          fixes.push({
            type: 'missing_import',
            description: 'Changed import from next/router to next/navigation',
          });
        }
      }
    }

    // Step 2: Check and fix missing imports (Requirements: 12.2, 12.4)
    const importResult = this.checkAndFixImports(fixedCode, context);
    issues.push(...importResult.issues);
    fixes.push(...importResult.fixes);
    fixedCode = importResult.fixedCode;

    // Step 3: Check for syntax errors (Requirements: 2.4)
    const syntaxResult = this.checkSyntax(fixedCode);
    issues.push(...syntaxResult.issues);

    // Step 4: Check for Dialog/Modal placement issues (Requirements: 12.3)
    const placementResult = this.checkAndFixOverlayPlacement(fixedCode);
    issues.push(...placementResult.issues);
    fixes.push(...placementResult.fixes);
    fixedCode = placementResult.fixedCode;

    const isValid = issues.filter(i => i.severity === 'error' && !i.autoFixable).length === 0;

    return { isValid, fixedCode, issues, fixes };
  }

  /**
   * Fix next/router import to next/navigation for App Router
   * Requirements: 12.1
   */
  private fixNextRouterImport(code: string): { modified: boolean; code: string } {
    // Check if using next/router
    if (!/from\s+['"]next\/router['"]/.test(code)) {
      return { modified: false, code };
    }

    let modified = false;
    let result = code;

    // Replace useRouter import from next/router to next/navigation
    result = result.replace(
      /import\s+\{\s*useRouter\s*\}\s+from\s+['"]next\/router['"]/g,
      (match) => {
        modified = true;
        return match.replace('next/router', 'next/navigation');
      }
    );

    // Handle combined imports
    result = result.replace(
      /import\s+\{([^}]*)\}\s+from\s+['"]next\/router['"]/g,
      (match, imports) => {
        const importList = imports.split(',').map((s: string) => s.trim());
        const navigationHooks = ['useRouter', 'usePathname', 'useSearchParams', 'useParams'];
        
        const navImports = importList.filter((i: string) => navigationHooks.includes(i));
        const otherImports = importList.filter((i: string) => !navigationHooks.includes(i));
        
        if (navImports.length > 0) {
          modified = true;
          let result = `import { ${navImports.join(', ')} } from 'next/navigation'`;
          if (otherImports.length > 0) {
            result += `;\nimport { ${otherImports.join(', ')} } from 'next/router'`;
          }
          return result;
        }
        
        return match;
      }
    );

    return { modified, code: result };
  }

  /**
   * Apply fixes to code based on detected issues
   * Requirements: 8.4
   */
  async autoFix(code: string, issues: ValidationIssue[]): Promise<string> {
    let fixedCode = code;

    for (const issue of issues) {
      if (!issue.autoFixable) continue;

      switch (issue.type) {
        case 'missing_directive':
          fixedCode = this.addUseClientDirective(fixedCode);
          break;
        case 'missing_import':
          // Extract component/function name from message
          const match = issue.message.match(/Missing import for: (\w+)/);
          if (match) {
            fixedCode = this.addMissingImport(fixedCode, match[1]);
          }
          break;
      }
    }

    return fixedCode;
  }

  /**
   * Check production readiness of a project
   */
  async checkProductionReadiness(projectId: string): Promise<ReadinessReport> {
    // This would be implemented with actual project file access
    // For now, return a placeholder
    const checks: ReadinessCheck[] = [
      {
        name: 'Environment Variables',
        passed: false,
        message: 'Check not implemented',
        remediation: 'Implement environment variable checking',
      },
    ];

    return {
      isReady: checks.every(c => c.passed),
      checks,
      summary: 'Production readiness check not fully implemented',
    };
  }


  /**
   * Check if file is a React/TypeScript file
   */
  private isReactFile(filePath: string): boolean {
    return /\.(tsx|jsx)$/.test(filePath);
  }

  /**
   * Check and fix "use client" directive
   * Requirements: 12.1
   */
  checkAndFixUseClient(code: string): {
    needsDirective: boolean;
    hasDirective: boolean;
    fixedCode: string;
  } {
    const hasDirective = this.hasUseClientDirective(code);
    const needsDirective = this.needsUseClientDirective(code);

    if (needsDirective && !hasDirective) {
      return {
        needsDirective: true,
        hasDirective: false,
        fixedCode: this.addUseClientDirective(code),
      };
    }

    return { needsDirective, hasDirective, fixedCode: code };
  }

  /**
   * Check if code has "use client" directive
   */
  hasUseClientDirective(code: string): boolean {
    const trimmed = code.trim();
    return (
      trimmed.startsWith('"use client"') ||
      trimmed.startsWith("'use client'") ||
      /^["']use client["'];?\s*\n/.test(trimmed)
    );
  }

  /**
   * Check if code needs "use client" directive
   * Requirements: 12.1 - Detect hooks, event handlers, browser APIs
   */
  needsUseClientDirective(code: string): boolean {
    // Remove comments and strings to avoid false positives
    const codeWithoutCommentsAndStrings = this.removeCommentsAndStrings(code);

    // Check for React hooks
    if (this.detectHooksUsage(codeWithoutCommentsAndStrings, REACT_HOOKS)) {
      return true;
    }

    // Check for Next.js client hooks
    if (this.detectHooksUsage(codeWithoutCommentsAndStrings, NEXTJS_CLIENT_HOOKS)) {
      return true;
    }

    // Check for React DOM hooks
    if (this.detectHooksUsage(codeWithoutCommentsAndStrings, REACT_DOM_HOOKS)) {
      return true;
    }

    // Check for third-party client hooks
    if (this.detectHooksUsage(codeWithoutCommentsAndStrings, THIRD_PARTY_CLIENT_HOOKS)) {
      return true;
    }

    // Check for event handlers in JSX
    if (this.detectEventHandlers(codeWithoutCommentsAndStrings)) {
      return true;
    }

    // Check for browser APIs
    if (this.detectBrowserAPIs(codeWithoutCommentsAndStrings)) {
      return true;
    }

    // Check for createContext usage (context providers need "use client")
    if (this.detectContextProvider(codeWithoutCommentsAndStrings)) {
      return true;
    }

    // Check for class components with lifecycle methods
    if (this.detectClassComponentLifecycle(codeWithoutCommentsAndStrings)) {
      return true;
    }

    return false;
  }

  /**
   * Remove comments and string literals from code to avoid false positives
   */
  private removeCommentsAndStrings(code: string): string {
    // Remove single-line comments
    let result = code.replace(/\/\/.*$/gm, '');
    
    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove template literals (but keep the structure)
    result = result.replace(/`[^`]*`/g, '""');
    
    // Remove double-quoted strings
    result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    
    // Remove single-quoted strings
    result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
    
    return result;
  }

  /**
   * Detect usage of hooks from a given list
   */
  private detectHooksUsage(code: string, hooks: string[]): boolean {
    for (const hook of hooks) {
      // Match hook calls: useHook( or useHook<Type>(
      const hookPattern = new RegExp(`\\b${hook}\\s*(?:<[^>]*>)?\\s*\\(`);
      if (hookPattern.test(code)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect event handlers in JSX
   */
  private detectEventHandlers(code: string): boolean {
    for (const handler of EVENT_HANDLERS) {
      // Match event handlers: onClick={...} or onClick=...
      const handlerPattern = new RegExp(`\\b${handler}\\s*=\\s*[{"]`);
      if (handlerPattern.test(code)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect browser API usage
   */
  private detectBrowserAPIs(code: string): boolean {
    for (const api of BROWSER_APIS) {
      // Match direct usage: window.something, document.getElementById, etc.
      const directPattern = new RegExp(`\\b${api}\\s*\\.`);
      if (directPattern.test(code)) {
        return true;
      }
      
      // Match typeof checks: typeof window !== 'undefined'
      const typeofPattern = new RegExp(`typeof\\s+${api}\\b`);
      if (typeofPattern.test(code)) {
        return true;
      }
      
      // Match constructor usage: new IntersectionObserver(
      if (['IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'WebSocket', 
           'BroadcastChannel', 'AudioContext', 'PerformanceObserver'].includes(api)) {
        const constructorPattern = new RegExp(`new\\s+${api}\\s*\\(`);
        if (constructorPattern.test(code)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Detect React context provider usage
   */
  private detectContextProvider(code: string): boolean {
    // Check for createContext usage
    if (/\bcreateContext\s*[<(]/.test(code)) {
      return true;
    }
    
    // Check for .Provider usage in JSX
    if (/<\w+\.Provider\b/.test(code)) {
      return true;
    }
    
    return false;
  }

  /**
   * Detect class component lifecycle methods
   */
  private detectClassComponentLifecycle(code: string): boolean {
    const lifecycleMethods = [
      'componentDidMount',
      'componentDidUpdate',
      'componentWillUnmount',
      'shouldComponentUpdate',
      'getSnapshotBeforeUpdate',
      'componentDidCatch',
      'getDerivedStateFromProps',
      'getDerivedStateFromError',
    ];
    
    for (const method of lifecycleMethods) {
      const pattern = new RegExp(`\\b${method}\\s*\\(`);
      if (pattern.test(code)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if file is a Next.js App Router page/layout that should remain server component
   * These files should NOT have "use client" unless they explicitly need it
   */
  isNextJsServerComponent(filePath: string): boolean {
    // Check for app router special files that are server components by default
    const serverComponentPatterns = [
      /\/app\/.*\/page\.(tsx|jsx|ts|js)$/,
      /\/app\/.*\/layout\.(tsx|jsx|ts|js)$/,
      /\/app\/.*\/loading\.(tsx|jsx|ts|js)$/,
      /\/app\/.*\/error\.(tsx|jsx|ts|js)$/,
      /\/app\/.*\/not-found\.(tsx|jsx|ts|js)$/,
      /\/app\/.*\/template\.(tsx|jsx|ts|js)$/,
      /\/app\/page\.(tsx|jsx|ts|js)$/,
      /\/app\/layout\.(tsx|jsx|ts|js)$/,
    ];
    
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    return serverComponentPatterns.some(pattern => pattern.test(normalizedPath));
  }

  /**
   * Get detailed reason why "use client" is needed
   * Useful for debugging and user feedback
   */
  getUseClientReason(code: string): string[] {
    const reasons: string[] = [];
    const codeWithoutCommentsAndStrings = this.removeCommentsAndStrings(code);

    // Check React hooks
    for (const hook of REACT_HOOKS) {
      const hookPattern = new RegExp(`\\b${hook}\\s*(?:<[^>]*>)?\\s*\\(`);
      if (hookPattern.test(codeWithoutCommentsAndStrings)) {
        reasons.push(`Uses React hook: ${hook}`);
      }
    }

    // Check Next.js client hooks
    for (const hook of NEXTJS_CLIENT_HOOKS) {
      const hookPattern = new RegExp(`\\b${hook}\\s*(?:<[^>]*>)?\\s*\\(`);
      if (hookPattern.test(codeWithoutCommentsAndStrings)) {
        reasons.push(`Uses Next.js client hook: ${hook}`);
      }
    }

    // Check event handlers
    for (const handler of EVENT_HANDLERS) {
      const handlerPattern = new RegExp(`\\b${handler}\\s*=\\s*[{"]`);
      if (handlerPattern.test(codeWithoutCommentsAndStrings)) {
        reasons.push(`Uses event handler: ${handler}`);
        break; // Only report once for event handlers
      }
    }

    // Check browser APIs
    for (const api of BROWSER_APIS) {
      const directPattern = new RegExp(`\\b${api}\\s*\\.`);
      if (directPattern.test(codeWithoutCommentsAndStrings)) {
        reasons.push(`Uses browser API: ${api}`);
      }
    }

    // Check context
    if (/\bcreateContext\s*[<(]/.test(codeWithoutCommentsAndStrings)) {
      reasons.push('Uses createContext');
    }

    return reasons;
  }

  /**
   * Validate Next.js specific patterns
   * Requirements: 12.1
   */
  validateNextJsPatterns(code: string, filePath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for incorrect import from next/router in App Router
    if (/from\s+['"]next\/router['"]/.test(code)) {
      // Check if it's using App Router hooks
      if (/\buseRouter\b/.test(code) || /\busePathname\b/.test(code)) {
        issues.push({
          type: 'missing_import',
          severity: 'warning',
          message: 'Using next/router in App Router - should use next/navigation instead',
          autoFixable: true,
        });
      }
    }

    // Check for getServerSideProps/getStaticProps in App Router
    if (filePath.includes('/app/')) {
      if (/\bgetServerSideProps\b/.test(code) || /\bgetStaticProps\b/.test(code)) {
        issues.push({
          type: 'syntax_error',
          severity: 'error',
          message: 'getServerSideProps/getStaticProps are not supported in App Router - use Server Components or Route Handlers',
          autoFixable: false,
        });
      }
    }

    // Check for mixing server and client patterns
    const hasUseClient = this.hasUseClientDirective(code);
    if (hasUseClient) {
      // Check for server-only imports in client component
      if (/from\s+['"]server-only['"]/.test(code)) {
        issues.push({
          type: 'syntax_error',
          severity: 'error',
          message: 'Cannot import "server-only" in a client component',
          autoFixable: false,
        });
      }
      
      // Check for headers/cookies usage in client component
      if (/\b(headers|cookies)\s*\(\)/.test(code) && /from\s+['"]next\/headers['"]/.test(code)) {
        issues.push({
          type: 'syntax_error',
          severity: 'error',
          message: 'Cannot use headers() or cookies() from next/headers in a client component',
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  /**
   * Add "use client" directive to code
   */
  addUseClientDirective(code: string): string {
    if (this.hasUseClientDirective(code)) {
      return code;
    }
    return `"use client";\n\n${code}`;
  }


  /**
   * Check and fix missing imports
   * Requirements: 12.2, 12.4
   */
  checkAndFixImports(
    code: string,
    context: ValidationContext
  ): { issues: ValidationIssue[]; fixes: AppliedFix[]; fixedCode: string } {
    const issues: ValidationIssue[] = [];
    const fixes: AppliedFix[] = [];
    let fixedCode = code;

    // Find all used components/functions
    const usedIdentifiers = this.findUsedIdentifiers(code);
    const importedIdentifiers = this.findImportedIdentifiers(code);

    // Check for missing imports
    const missingImports: Map<string, string[]> = new Map();

    for (const identifier of usedIdentifiers) {
      if (importedIdentifiers.has(identifier)) continue;

      // Check if component exists in project's available components first
      if (context.availableComponents && context.availableComponents[identifier]) {
        const importPath = context.availableComponents[identifier];
        if (!missingImports.has(importPath)) {
          missingImports.set(importPath, []);
        }
        missingImports.get(importPath)!.push(identifier);
        issues.push({
          type: 'missing_import',
          severity: 'error',
          message: `Missing import for: ${identifier}`,
          autoFixable: true,
        });
        continue;
      }

      // Check shadcn components - but ONLY if the file actually exists in the project
      if (SHADCN_COMPONENTS[identifier]) {
        const importPath = SHADCN_COMPONENTS[identifier];
        // Verify the component file actually exists in the project
        if (this.componentFileExists(importPath, context.projectFiles)) {
          if (!missingImports.has(importPath)) {
            missingImports.set(importPath, []);
          }
          missingImports.get(importPath)!.push(identifier);
          issues.push({
            type: 'missing_import',
            severity: 'error',
            message: `Missing import for: ${identifier}`,
            autoFixable: true,
          });
        } else {
          // Component doesn't exist - report as warning but don't auto-fix
          issues.push({
            type: 'missing_import',
            severity: 'warning',
            message: `Component ${identifier} is used but ${importPath} does not exist in project. Create the component first.`,
            autoFixable: false,
          });
        }
        continue;
      }

      // Check library imports
      if (LIBRARY_IMPORTS[identifier]) {
        const lib = LIBRARY_IMPORTS[identifier];
        if (!missingImports.has(lib.from)) {
          missingImports.set(lib.from, []);
        }
        missingImports.get(lib.from)!.push(identifier);
        issues.push({
          type: 'missing_import',
          severity: 'error',
          message: `Missing import for: ${identifier}`,
          autoFixable: true,
        });
        continue;
      }

      // Check React hooks
      if (REACT_HOOKS.includes(identifier)) {
        if (!missingImports.has('react')) {
          missingImports.set('react', []);
        }
        missingImports.get('react')!.push(identifier);
        issues.push({
          type: 'missing_import',
          severity: 'error',
          message: `Missing import for: ${identifier}`,
          autoFixable: true,
        });
      }
    }

    // Add missing imports to code
    if (missingImports.size > 0) {
      fixedCode = this.addImports(fixedCode, missingImports);
      for (const [path, identifiers] of missingImports) {
        fixes.push({
          type: 'missing_import',
          description: `Added import { ${identifiers.join(', ')} } from "${path}"`,
        });
      }
    }

    return { issues, fixes, fixedCode };
  }

  /**
   * Check if a component file exists in the project
   * Converts import path like '@/components/ui/dialog' to check against project files
   */
  private componentFileExists(importPath: string, projectFiles?: string[]): boolean {
    if (!projectFiles || projectFiles.length === 0) {
      // If no project files provided, assume component doesn't exist (safer default)
      return false;
    }

    // Convert import path to possible file paths
    // @/components/ui/dialog -> components/ui/dialog.tsx, components/ui/dialog.ts, etc.
    const pathWithoutAlias = importPath.replace(/^[@~]\//, '');
    const possiblePaths = [
      `${pathWithoutAlias}.tsx`,
      `${pathWithoutAlias}.ts`,
      `${pathWithoutAlias}.jsx`,
      `${pathWithoutAlias}.js`,
      `${pathWithoutAlias}/index.tsx`,
      `${pathWithoutAlias}/index.ts`,
      `src/${pathWithoutAlias}.tsx`,
      `src/${pathWithoutAlias}.ts`,
    ];

    // Check if any of the possible paths exist in project files
    for (const possiblePath of possiblePaths) {
      if (projectFiles.some(f => f === possiblePath || f.endsWith(`/${possiblePath}`))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find all identifiers used in code (components, hooks, functions)
   */
  findUsedIdentifiers(code: string): Set<string> {
    const identifiers = new Set<string>();

    // Find JSX components: <ComponentName or <ComponentName>
    const jsxPattern = /<([A-Z][a-zA-Z0-9]*)/g;
    let match;
    while ((match = jsxPattern.exec(code)) !== null) {
      identifiers.add(match[1]);
    }

    // Find function calls: functionName(
    const functionPattern = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;
    while ((match = functionPattern.exec(code)) !== null) {
      const name = match[1];
      // Only include known hooks and library functions
      if (REACT_HOOKS.includes(name) || LIBRARY_IMPORTS[name]) {
        identifiers.add(name);
      }
    }

    // Find specific patterns like z.object, z.string
    if (/\bz\.\w+/.test(code)) {
      identifiers.add('z');
    }

    // Find cn() utility
    if (/\bcn\s*\(/.test(code)) {
      identifiers.add('cn');
    }

    // Find toast() utility
    if (/\btoast\s*[.(]/.test(code)) {
      identifiers.add('toast');
    }

    return identifiers;
  }

  /**
   * Find all imported identifiers
   */
  findImportedIdentifiers(code: string): Set<string> {
    const identifiers = new Set<string>();

    // Named imports: import { A, B, C } from "..."
    const namedImportPattern = /import\s+\{([^}]+)\}\s+from/g;
    let match;
    while ((match = namedImportPattern.exec(code)) !== null) {
      const names = match[1].split(',').map(s => s.trim().split(' as ')[0].trim());
      names.forEach(name => identifiers.add(name));
    }

    // Default imports: import Component from "..."
    const defaultImportPattern = /import\s+([A-Z][a-zA-Z0-9]*)\s+from/g;
    while ((match = defaultImportPattern.exec(code)) !== null) {
      identifiers.add(match[1]);
    }

    // Namespace imports: import * as Name from "..."
    const namespacePattern = /import\s+\*\s+as\s+(\w+)\s+from/g;
    while ((match = namespacePattern.exec(code)) !== null) {
      identifiers.add(match[1]);
    }

    return identifiers;
  }


  /**
   * Add imports to code
   */
  addImports(code: string, imports: Map<string, string[]>): string {
    const lines = code.split('\n');
    let insertIndex = 0;

    // Skip "use client" directive and empty lines
    while (
      insertIndex < lines.length &&
      (lines[insertIndex].includes('"use client"') ||
        lines[insertIndex].includes("'use client'") ||
        lines[insertIndex].trim() === '')
    ) {
      insertIndex++;
    }

    // Generate import statements
    const newImports: string[] = [];
    for (const [path, identifiers] of imports) {
      const uniqueIdentifiers = [...new Set(identifiers)];
      const importStatement = `import { ${uniqueIdentifiers.join(', ')} } from "${path}";`;
      newImports.push(importStatement);
    }

    // Insert imports
    lines.splice(insertIndex, 0, ...newImports);
    return lines.join('\n');
  }

  /**
   * Add a single missing import
   */
  addMissingImport(code: string, identifier: string): string {
    const imports = new Map<string, string[]>();

    if (SHADCN_COMPONENTS[identifier]) {
      imports.set(SHADCN_COMPONENTS[identifier], [identifier]);
    } else if (LIBRARY_IMPORTS[identifier]) {
      imports.set(LIBRARY_IMPORTS[identifier].from, [identifier]);
    } else if (REACT_HOOKS.includes(identifier)) {
      imports.set('react', [identifier]);
    }

    if (imports.size > 0) {
      return this.addImports(code, imports);
    }

    return code;
  }

  /**
   * Check for basic syntax errors
   * Requirements: 2.4
   */
  checkSyntax(code: string): { issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];

    // Check for unclosed JSX tags
    const openTags = (code.match(/<([A-Z][a-zA-Z0-9]*)[^/>]*>/g) || []);
    const closeTags = (code.match(/<\/([A-Z][a-zA-Z0-9]*)>/g) || []);
    const selfClosing = (code.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) || []);

    // Simple heuristic: count should roughly match
    const openCount = openTags.length;
    const closeCount = closeTags.length + selfClosing.length;

    if (Math.abs(openCount - closeCount) > 2) {
      issues.push({
        type: 'syntax_error',
        severity: 'warning',
        message: `Possible mismatched JSX tags: ${openCount} opening vs ${closeCount} closing/self-closing`,
        autoFixable: false,
      });
    }

    // Check for unclosed braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push({
        type: 'syntax_error',
        severity: 'error',
        message: `Mismatched braces: ${openBraces} opening vs ${closeBraces} closing`,
        autoFixable: false,
      });
    }

    // Check for unclosed parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push({
        type: 'syntax_error',
        severity: 'error',
        message: `Mismatched parentheses: ${openParens} opening vs ${closeParens} closing`,
        autoFixable: false,
      });
    }

    return { issues };
  }


  /**
   * Check and fix overlay component placement
   * Requirements: 12.3 - Detect Dialog/Modal/Popover inside header/nav/footer
   */
  checkAndFixOverlayPlacement(code: string): {
    issues: ValidationIssue[];
    fixes: AppliedFix[];
    fixedCode: string;
  } {
    const issues: ValidationIssue[] = [];
    const fixes: AppliedFix[] = [];
    let fixedCode = code;

    // Check if any overlay components are inside problematic containers
    for (const container of PROBLEMATIC_CONTAINERS) {
      for (const overlay of OVERLAY_COMPONENTS) {
        const pattern = this.createNestedPattern(container, overlay);
        if (pattern.test(code)) {
          issues.push({
            type: 'z_index_issue',
            severity: 'warning',
            message: `${overlay} component found inside ${container} - may cause z-index issues`,
            autoFixable: true,
          });

          // Attempt to fix by extracting the overlay component
          const extractResult = this.extractOverlayFromContainer(fixedCode, container, overlay);
          if (extractResult.modified) {
            fixedCode = extractResult.code;
            fixes.push({
              type: 'z_index_issue',
              description: `Moved ${overlay} outside of ${container} using React fragment`,
            });
          }
        }
      }
    }

    return { issues, fixes, fixedCode };
  }

  /**
   * Create a regex pattern to detect nested components
   */
  private createNestedPattern(container: string, overlay: string): RegExp {
    // Match <Container>...<Overlay>...</Container>
    // This is a simplified pattern - real AST parsing would be more accurate
    return new RegExp(
      `<${container}[^>]*>[\\s\\S]*?<${overlay}[\\s\\S]*?<\\/${container}>`,
      'i'
    );
  }

  /**
   * Extract overlay component from container
   * Requirements: 12.3 - Auto-move to outside using React fragments
   */
  private extractOverlayFromContainer(
    code: string,
    container: string,
    overlay: string
  ): { modified: boolean; code: string } {
    // Find the overlay component inside the container
    const containerPattern = new RegExp(
      `(<${container}[^>]*>)([\\s\\S]*?)(<\\/${container}>)`,
      'gi'
    );

    let modified = false;
    let result = code;

    result = result.replace(containerPattern, (match, openTag, content, closeTag) => {
      // Find overlay components in the content
      const overlayPattern = new RegExp(
        `(<${overlay}[^>]*(?:\\/>|>[\\s\\S]*?<\\/${overlay}>))`,
        'gi'
      );

      const overlays: string[] = [];
      const cleanedContent = content.replace(overlayPattern, (overlayMatch: string) => {
        overlays.push(overlayMatch);
        modified = true;
        return '';
      });

      if (overlays.length > 0) {
        // Wrap in fragment and move overlays outside
        return `<>\n${openTag}${cleanedContent}${closeTag}\n${overlays.join('\n')}\n</>`;
      }

      return match;
    });

    return { modified, code: result };
  }

  /**
   * Validate that useForm is properly imported when used
   * Requirements: 12.2
   */
  validateUseFormImport(code: string): boolean {
    const usesUseForm = /\buseForm\s*\(/.test(code);
    if (!usesUseForm) return true;

    const hasImport = /import\s+\{[^}]*useForm[^}]*\}\s+from\s+['"]react-hook-form['"]/.test(code);
    return hasImport;
  }

  /**
   * Get all validation issues without fixing
   */
  getIssues(code: string, filePath: string, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!this.isReactFile(filePath)) {
      return issues;
    }

    // Check use client
    if (context.isNextJsAppRouter) {
      const needsDirective = this.needsUseClientDirective(code);
      const hasDirective = this.hasUseClientDirective(code);
      if (needsDirective && !hasDirective) {
        issues.push({
          type: 'missing_directive',
          severity: 'error',
          message: 'Missing "use client" directive for client-side component',
          line: 1,
          autoFixable: true,
        });
      }
    }

    // Check imports
    const usedIdentifiers = this.findUsedIdentifiers(code);
    const importedIdentifiers = this.findImportedIdentifiers(code);

    for (const identifier of usedIdentifiers) {
      if (importedIdentifiers.has(identifier)) continue;

      if (SHADCN_COMPONENTS[identifier] || LIBRARY_IMPORTS[identifier] || REACT_HOOKS.includes(identifier)) {
        issues.push({
          type: 'missing_import',
          severity: 'error',
          message: `Missing import for: ${identifier}`,
          autoFixable: true,
        });
      }
    }

    // Check syntax
    const syntaxIssues = this.checkSyntax(code);
    issues.push(...syntaxIssues.issues);

    return issues;
  }
}

// Export singleton instance
export const validationAgent = new ValidationAgent();
