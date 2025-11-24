/**
 * Code Validator - Automatically fixes common AI generation errors
 * Ensures generated code has proper imports, syntax, and structure
 */

interface ValidationResult {
  isValid: boolean;
  fixedCode: string;
  errors: string[];
  warnings: string[];
  addedImports: string[];
}

export class CodeValidator {
  /**
   * Validate and auto-fix generated code
   */
  static validateAndFix(
    code: string,
    filename: string,
    allFiles: Record<string, string>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const addedImports: string[] = [];
    let fixedCode = code;

    // 1. Check for React/Next.js files
    if (this.isReactFile(filename)) {
      const result = this.fixReactImports(fixedCode, filename, allFiles);
      fixedCode = result.code;
      addedImports.push(...result.addedImports);
      warnings.push(...result.warnings);
    }

    // 2. Check for missing "use client" directive
    if (this.needsUseClient(fixedCode) && !this.hasUseClient(fixedCode)) {
      fixedCode = this.addUseClient(fixedCode);
      addedImports.push('"use client" directive');
    }

    // 3. Validate JSX syntax
    const syntaxCheck = this.validateJSXSyntax(fixedCode);
    if (!syntaxCheck.isValid) {
      errors.push(...syntaxCheck.errors);
    }

    // 4. Check for unused imports (warning only)
    const unusedImports = this.findUnusedImports(fixedCode);
    if (unusedImports.length > 0) {
      warnings.push(`Unused imports: ${unusedImports.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      fixedCode,
      errors,
      warnings,
      addedImports,
    };
  }

  /**
   * Auto-fix React imports (Dialog, Button, Input, etc.)
   */
  private static fixReactImports(
    code: string,
    filename: string,
    allFiles: Record<string, string>
  ): { code: string; addedImports: string[]; warnings: string[] } {
    const addedImports: string[] = [];
    const warnings: string[] = [];
    let fixedCode = code;

    // Common shadcn/ui components that are often missing
    const componentMap: Record<string, string> = {
      Dialog: '@/components/ui/dialog',
      DialogContent: '@/components/ui/dialog',
      DialogHeader: '@/components/ui/dialog',
      DialogTitle: '@/components/ui/dialog',
      DialogDescription: '@/components/ui/dialog',
      DialogFooter: '@/components/ui/dialog',
      DialogTrigger: '@/components/ui/dialog',
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
      Toast: '@/components/ui/toast',
      Toaster: '@/components/ui/toaster',
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
    };

    // Find components used in JSX but not imported
    const usedComponents = this.findUsedComponents(fixedCode);
    const importedComponents = this.findImportedComponents(fixedCode);
    const missingComponents = usedComponents.filter(
      (comp) => !importedComponents.includes(comp) && componentMap[comp]
    );

    if (missingComponents.length > 0) {
      // Group by import path
      const importGroups: Record<string, string[]> = {};
      for (const comp of missingComponents) {
        const path = componentMap[comp];
        if (!importGroups[path]) {
          importGroups[path] = [];
        }
        importGroups[path].push(comp);
      }

      // Add imports at the top (after "use client" if exists)
      const lines = fixedCode.split('\n');
      let insertIndex = 0;

      // Skip "use client" and empty lines
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
      for (const [path, components] of Object.entries(importGroups)) {
        const importStatement = `import { ${components.join(', ')} } from "${path}";`;
        newImports.push(importStatement);
        addedImports.push(`${components.join(', ')} from ${path}`);
      }

      // Insert imports
      lines.splice(insertIndex, 0, ...newImports);
      fixedCode = lines.join('\n');

      console.log(`✓ Auto-fixed ${missingComponents.length} missing imports in ${filename}`);
    }

    // Check for React hooks (useState, useEffect, etc.)
    const reactHooks = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext'];
    const usedHooks = reactHooks.filter((hook) => 
      new RegExp(`\\b${hook}\\b`).test(fixedCode)
    );
    const hasReactImport = /import\s+.*from\s+['"]react['"]/.test(fixedCode);
    
    if (usedHooks.length > 0 && !hasReactImport) {
      // Add React import
      const reactImport = `import { ${usedHooks.join(', ')} } from "react";`;
      const lines = fixedCode.split('\n');
      let insertIndex = 0;
      
      while (
        insertIndex < lines.length &&
        (lines[insertIndex].includes('"use client"') ||
          lines[insertIndex].includes("'use client'") ||
          lines[insertIndex].trim() === '')
      ) {
        insertIndex++;
      }
      
      lines.splice(insertIndex, 0, reactImport);
      fixedCode = lines.join('\n');
      addedImports.push(`${usedHooks.join(', ')} from react`);
      console.log(`✓ Auto-fixed missing React hooks import in ${filename}`);
    }

    return { code: fixedCode, addedImports, warnings };
  }

  /**
   * Find all components used in JSX (e.g., <Button>, <Dialog>)
   */
  private static findUsedComponents(code: string): string[] {
    const components = new Set<string>();
    
    // Match JSX opening tags: <ComponentName or <ComponentName>
    const jsxPattern = /<([A-Z][a-zA-Z0-9]*)/g;
    let match;
    
    while ((match = jsxPattern.exec(code)) !== null) {
      components.add(match[1]);
    }
    
    return Array.from(components);
  }

  /**
   * Find all imported components
   */
  private static findImportedComponents(code: string): string[] {
    const components = new Set<string>();
    
    // Match named imports: import { A, B, C } from "..."
    const namedImportPattern = /import\s+\{([^}]+)\}\s+from/g;
    let match;
    
    while ((match = namedImportPattern.exec(code)) !== null) {
      const names = match[1].split(',').map((s) => s.trim());
      names.forEach((name) => components.add(name));
    }
    
    // Match default imports: import Component from "..."
    const defaultImportPattern = /import\s+([A-Z][a-zA-Z0-9]*)\s+from/g;
    while ((match = defaultImportPattern.exec(code)) !== null) {
      components.add(match[1]);
    }
    
    return Array.from(components);
  }

  /**
   * Check if file is a React/Next.js file
   */
  private static isReactFile(filename: string): boolean {
    return /\.(tsx|jsx)$/.test(filename);
  }

  /**
   * Check if code needs "use client" directive
   */
  private static needsUseClient(code: string): boolean {
    // Check for client-side features
    const clientFeatures = [
      /\buseState\b/,
      /\buseEffect\b/,
      /\buseCallback\b/,
      /\buseMemo\b/,
      /\buseRef\b/,
      /\bonClick\b/,
      /\bonChange\b/,
      /\bonSubmit\b/,
      /\bonKeyDown\b/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\baddEventListener\b/,
    ];

    return clientFeatures.some((pattern) => pattern.test(code));
  }

  /**
   * Check if code already has "use client" directive
   */
  private static hasUseClient(code: string): boolean {
    return /^["']use client["']/.test(code.trim());
  }

  /**
   * Add "use client" directive at the top of the file
   */
  private static addUseClient(code: string): string {
    return `"use client";\n\n${code}`;
  }

  /**
   * Validate JSX syntax
   */
  private static validateJSXSyntax(code: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for unclosed JSX tags
    const openTags = (code.match(/<[A-Z][a-zA-Z0-9]*[^/>]*>/g) || []).length;
    const closeTags = (code.match(/<\/[A-Z][a-zA-Z0-9]*>/g) || []).length;
    const selfClosing = (code.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) || []).length;

    if (openTags !== closeTags + selfClosing) {
      errors.push(`Mismatched JSX tags: ${openTags} opening vs ${closeTags} closing`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Find unused imports (for warnings)
   */
  private static findUnusedImports(code: string): string[] {
    const unused: string[] = [];
    
    // This is a simplified check - in production you'd want a proper AST parser
    const importPattern = /import\s+\{([^}]+)\}\s+from/g;
    let match;
    
    while ((match = importPattern.exec(code)) !== null) {
      const imports = match[1].split(',').map((s) => s.trim());
      const codeWithoutImports = code.substring(match.index + match[0].length);
      
      for (const imp of imports) {
        const usagePattern = new RegExp(`\\b${imp}\\b`);
        if (!usagePattern.test(codeWithoutImports)) {
          unused.push(imp);
        }
      }
    }
    
    return unused;
  }
}
