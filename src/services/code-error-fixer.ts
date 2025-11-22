/**
 * Code Error Fixer Service
 * Automatically detects and fixes common code errors BEFORE they reach the sandbox
 * This prevents runtime errors like "variable is not defined", missing imports, etc.
 */

export interface FixResult {
  fixed: boolean;
  originalCode: string;
  fixedCode: string;
  errors: string[];
  fixes: string[];
}

export class CodeErrorFixer {
  /**
   * Main entry point - fixes all common errors in code
   */
  static fixCode(code: string, filename: string): FixResult {
    const result: FixResult = {
      fixed: false,
      originalCode: code,
      fixedCode: code,
      errors: [],
      fixes: [],
    };

    // Apply all fixes in sequence
    result.fixedCode = this.fixUseClientDirective(result.fixedCode, result);
    result.fixedCode = this.fixUndefinedVariables(result.fixedCode, filename, result);
    result.fixedCode = this.fixMissingImports(result.fixedCode, filename, result);
    result.fixedCode = this.fixSyntaxErrors(result.fixedCode, filename, result);
    result.fixedCode = this.fixReactErrors(result.fixedCode, filename, result);
    
    result.fixed = result.fixes.length > 0;
    
    if (result.fixed) {
      console.log(`🔧 Fixed ${result.fixes.length} error(s) in ${filename}:`);
      result.fixes.forEach(fix => console.log(`   ✓ ${fix}`));
    }
    
    return result;
  }

  /**
   * Fix "use client" directive - must be at top, not an import
   */
  private static fixUseClientDirective(code: string, result: FixResult): string {
    // Check if there's an incorrect import statement
    if (code.includes('import "use client"') || code.includes("import 'use client'")) {
      result.errors.push('Incorrect "use client" import statement');
      result.fixes.push('Removed incorrect import "use client" and added correct directive');
      
      // Remove the incorrect import
      code = code.replace(/import\s+["']use client["'];?\s*/g, '');
    }

    // Check if "use client" directive is needed but missing
    const needsUseClient = this.needsUseClientDirective(code);
    const hasUseClient = code.trim().startsWith('"use client"') || code.trim().startsWith("'use client'");

    if (needsUseClient && !hasUseClient) {
      result.errors.push('Missing "use client" directive for client-side code');
      result.fixes.push('Added "use client" directive at top of file');
      
      // Add "use client" at the very top
      code = '"use client";\n\n' + code;
    }

    return code;
  }

  /**
   * Check if code needs "use client" directive
   */
  private static needsUseClientDirective(code: string): boolean {
    // Check for React hooks
    const hasHooks = /\b(useState|useEffect|useCallback|useMemo|useRef|useContext|useReducer|useLayoutEffect)\b/.test(code);
    
    // Check for event handlers
    const hasEventHandlers = /\bon(Click|Change|Submit|KeyDown|KeyUp|MouseEnter|MouseLeave|Focus|Blur)\s*=/.test(code);
    
    // Check for browser APIs
    const hasBrowserAPIs = /\b(window|document|localStorage|sessionStorage|navigator)\b/.test(code);
    
    return hasHooks || hasEventHandlers || hasBrowserAPIs;
  }

  /**
   * Fix undefined variables by adding declarations or imports
   */
  private static fixUndefinedVariables(code: string, filename: string, result: FixResult): string {
    // Common undefined variable patterns
    const undefinedPatterns = [
      // Array.map without defining the array
      { pattern: /(\w+)\.map\(/g, check: (match: string, varName: string) => !code.includes(`const ${varName}`) && !code.includes(`let ${varName}`) && !code.includes(`var ${varName}`) },
      // Variables used but not defined
      { pattern: /\{(\w+)\.map\(/g, check: (match: string, varName: string) => !code.includes(`const ${varName}`) && !code.includes(`let ${varName}`) },
    ];

    // Find all undefined variables
    const undefinedVars = new Set<string>();
    
    // Check for variables used in JSX that aren't defined
    const jsxVarPattern = /\{(\w+)(?:\.|\[|\))/g;
    let match;
    while ((match = jsxVarPattern.exec(code)) !== null) {
      const varName = match[1];
      
      // Skip if it's a known global or already defined
      if (this.isKnownGlobal(varName)) continue;
      if (code.includes(`const ${varName}`) || code.includes(`let ${varName}`) || code.includes(`var ${varName}`)) continue;
      if (code.includes(`function ${varName}`) || code.includes(`${varName}:`)) continue;
      
      undefinedVars.add(varName);
    }

    // Fix each undefined variable
    for (const varName of undefinedVars) {
      result.errors.push(`Undefined variable: ${varName}`);
      
      // Determine what type of data this variable should be
      const fix = this.generateVariableDeclaration(varName, code);
      
      if (fix) {
        result.fixes.push(`Added declaration for undefined variable: ${varName}`);
        
        // Add the declaration after imports but before the main code
        const importEndIndex = this.findImportEndIndex(code);
        code = code.slice(0, importEndIndex) + '\n' + fix + '\n' + code.slice(importEndIndex);
      }
    }

    return code;
  }

  /**
   * Generate appropriate variable declaration based on usage
   */
  private static generateVariableDeclaration(varName: string, code: string): string | null {
    // Check if it's used with .map() - likely an array
    if (code.includes(`${varName}.map(`)) {
      // Try to infer the array content from context
      const mapMatch = code.match(new RegExp(`${varName}\\.map\\(\\((\\w+)\\)\\s*=>\\s*[\\s\\S]*?<(\\w+)`));
      
      if (mapMatch) {
        const itemName = mapMatch[1];
        const componentName = mapMatch[2];
        
        // Generate sample data based on component name
        if (componentName.toLowerCase().includes('card')) {
          return `const ${varName} = [\n  { id: 1, title: "Sample Card 1", description: "Description for card 1" },\n  { id: 2, title: "Sample Card 2", description: "Description for card 2" },\n  { id: 3, title: "Sample Card 3", description: "Description for card 3" },\n];`;
        }
        
        // Generic array
        return `const ${varName} = [\n  { id: 1, title: "Item 1" },\n  { id: 2, title: "Item 2" },\n  { id: 3, title: "Item 3" },\n];`;
      }
      
      // Fallback: empty array
      return `const ${varName} = [];`;
    }

    // Check if it's used as an object
    if (code.includes(`${varName}.`) || code.includes(`${varName}[`)) {
      return `const ${varName} = {};`;
    }

    // Default: undefined
    return `const ${varName} = undefined;`;
  }

  /**
   * Check if a variable name is a known global
   */
  private static isKnownGlobal(varName: string): boolean {
    const globals = [
      'window', 'document', 'console', 'process', 'require', 'module', 'exports',
      'React', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef',
      'props', 'children', 'className', 'style', 'key', 'ref',
      'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math', 'JSON',
      'Promise', 'Set', 'Map', 'Error', 'RegExp',
    ];
    
    return globals.includes(varName);
  }

  /**
   * Find where imports end in the file
   */
  private static findImportEndIndex(code: string): number {
    const lines = code.split('\n');
    let lastImportIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip "use client" directive
      if (line === '"use client";' || line === "'use client';") {
        lastImportIndex = i + 1;
        continue;
      }
      
      // Check if line is an import
      if (line.startsWith('import ')) {
        lastImportIndex = i + 1;
      } else if (line && !line.startsWith('//') && !lin