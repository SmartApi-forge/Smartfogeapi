/**
 * PatternDetector Service
 * 
 * Analyzes project files to detect UI libraries, styling approaches,
 * state management, and form handling patterns.
 * 
 * Requirements: 7.1, 7.4
 */

import type { ProjectPatterns } from '../types/context-management';

/**
 * Detection result for a specific pattern category
 */
interface DetectionResult {
  detected: string;
  confidence: number;
  evidence: string[];
}

/**
 * Pattern detection configuration
 */
interface PatternConfig {
  name: string;
  packageNames: string[];
  importPatterns: RegExp[];
  filePatterns?: RegExp[];
}

/**
 * UI Library configurations
 */
const UI_LIBRARIES: PatternConfig[] = [
  {
    name: 'shadcn/ui',
    packageNames: ['@radix-ui/react-', 'class-variance-authority'],
    importPatterns: [
      /from\s+['"]@\/components\/ui\//,
      /from\s+['"]@radix-ui\/react-/,
      /from\s+['"]class-variance-authority/,
    ],
    filePatterns: [/components\/ui\/.*\.tsx$/],
  },
  {
    name: 'Material UI',
    packageNames: ['@mui/material', '@mui/icons-material'],
    importPatterns: [
      /from\s+['"]@mui\/material/,
      /from\s+['"]@mui\/icons-material/,
    ],
  },
  {
    name: 'Chakra UI',
    packageNames: ['@chakra-ui/react'],
    importPatterns: [/from\s+['"]@chakra-ui\/react/],
  },
  {
    name: 'Ant Design',
    packageNames: ['antd'],
    importPatterns: [/from\s+['"]antd/],
  },
  {
    name: 'Mantine',
    packageNames: ['@mantine/core'],
    importPatterns: [/from\s+['"]@mantine\/core/],
  },
  {
    name: 'Headless UI',
    packageNames: ['@headlessui/react'],
    importPatterns: [/from\s+['"]@headlessui\/react/],
  },
];

/**
 * Styling approach configurations
 */
const STYLING_APPROACHES: PatternConfig[] = [
  {
    name: 'Tailwind CSS',
    packageNames: ['tailwindcss'],
    importPatterns: [/className\s*=\s*["'`][^"'`]*(?:flex|grid|p-|m-|text-|bg-|border-)/],
    filePatterns: [/tailwind\.config\.(js|ts|mjs|cjs)$/],
  },
  {
    name: 'CSS Modules',
    packageNames: [],
    importPatterns: [
      /import\s+\w+\s+from\s+['"].*\.module\.css['"]/,
      /import\s+\w+\s+from\s+['"].*\.module\.scss['"]/,
    ],
    filePatterns: [/\.module\.(css|scss)$/],
  },
  {
    name: 'styled-components',
    packageNames: ['styled-components'],
    importPatterns: [
      /from\s+['"]styled-components/,
      /styled\.\w+`/,
    ],
  },
  {
    name: 'Emotion',
    packageNames: ['@emotion/react', '@emotion/styled'],
    importPatterns: [
      /from\s+['"]@emotion\/react/,
      /from\s+['"]@emotion\/styled/,
      /css`/,
    ],
  },
  {
    name: 'Sass/SCSS',
    packageNames: ['sass'],
    importPatterns: [/import\s+['"].*\.scss['"]/],
    filePatterns: [/\.scss$/],
  },
  {
    name: 'Plain CSS',
    packageNames: [],
    importPatterns: [/import\s+['"].*\.css['"]/],
    filePatterns: [/\.css$/],
  },
];

/**
 * State management configurations
 */
const STATE_MANAGEMENT: PatternConfig[] = [
  {
    name: 'Zustand',
    packageNames: ['zustand'],
    importPatterns: [
      /from\s+['"]zustand/,
      /create\s*\(\s*\(/,
    ],
  },
  {
    name: 'Redux Toolkit',
    packageNames: ['@reduxjs/toolkit', 'react-redux'],
    importPatterns: [
      /from\s+['"]@reduxjs\/toolkit/,
      /from\s+['"]react-redux/,
      /useSelector|useDispatch/,
    ],
  },
  {
    name: 'Jotai',
    packageNames: ['jotai'],
    importPatterns: [
      /from\s+['"]jotai/,
      /useAtom|atom\(/,
    ],
  },
  {
    name: 'Recoil',
    packageNames: ['recoil'],
    importPatterns: [
      /from\s+['"]recoil/,
      /useRecoilState|atom\(/,
    ],
  },
  {
    name: 'MobX',
    packageNames: ['mobx', 'mobx-react'],
    importPatterns: [
      /from\s+['"]mobx/,
      /from\s+['"]mobx-react/,
      /observable|makeAutoObservable/,
    ],
  },
  {
    name: 'TanStack Query',
    packageNames: ['@tanstack/react-query', 'react-query'],
    importPatterns: [
      /from\s+['"]@tanstack\/react-query/,
      /from\s+['"]react-query/,
      /useQuery|useMutation/,
    ],
  },
  {
    name: 'React Context',
    packageNames: [],
    importPatterns: [
      /createContext\s*\(/,
      /useContext\s*\(/,
    ],
  },
];

/**
 * Form handling configurations
 */
const FORM_LIBRARIES: PatternConfig[] = [
  {
    name: 'react-hook-form',
    packageNames: ['react-hook-form'],
    importPatterns: [
      /from\s+['"]react-hook-form/,
      /useForm\s*\(/,
    ],
  },
  {
    name: 'Formik',
    packageNames: ['formik'],
    importPatterns: [
      /from\s+['"]formik/,
      /useFormik|<Formik/,
    ],
  },
  {
    name: 'React Final Form',
    packageNames: ['react-final-form'],
    importPatterns: [
      /from\s+['"]react-final-form/,
      /<Form|useForm/,
    ],
  },
  {
    name: 'Zod',
    packageNames: ['zod'],
    importPatterns: [
      /from\s+['"]zod/,
      /z\.object|z\.string/,
    ],
  },
];

/**
 * PatternDetector implementation
 * Analyzes project files to detect common patterns and conventions
 */
export class PatternDetector {
  /**
   * Detect all patterns from project files
   * 
   * @param files - Record of file paths to file contents
   * @returns Detected project patterns
   */
  detectPatterns(files: Record<string, string>): ProjectPatterns {
    const filePaths = Object.keys(files);
    const allContent = Object.values(files).join('\n');
    
    // Detect each pattern category
    const uiLibrary = this.detectCategory(files, filePaths, UI_LIBRARIES);
    const styling = this.detectCategory(files, filePaths, STYLING_APPROACHES);
    const stateManagement = this.detectCategory(files, filePaths, STATE_MANAGEMENT);
    const formLibrary = this.detectCategory(files, filePaths, FORM_LIBRARIES);
    
    // Detect common components
    const commonComponents = this.detectCommonComponents(filePaths);
    
    // Detect import patterns
    const importPatterns = this.detectImportPatterns(allContent);
    
    return {
      uiLibrary: uiLibrary.detected,
      styling: styling.detected,
      stateManagement: stateManagement.detected,
      formLibrary: formLibrary.detected,
      commonComponents,
      importPatterns,
    };
  }

  /**
   * Detect a specific pattern category
   */
  private detectCategory(
    files: Record<string, string>,
    filePaths: string[],
    configs: PatternConfig[]
  ): DetectionResult {
    const results: Array<{ config: PatternConfig; score: number; evidence: string[] }> = [];
    
    for (const config of configs) {
      const evidence: string[] = [];
      let score = 0;
      
      // Check package.json for dependencies
      const packageJson = files['package.json'];
      if (packageJson) {
        for (const pkgName of config.packageNames) {
          if (packageJson.includes(`"${pkgName}`)) {
            score += 3;
            evidence.push(`Found package: ${pkgName}`);
          }
        }
      }
      
      // Check import patterns in all files
      for (const [path, content] of Object.entries(files)) {
        if (!this.isCodeFile(path)) continue;
        
        for (const pattern of config.importPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            score += 1;
            if (evidence.length < 5) {
              evidence.push(`Import pattern in ${path}`);
            }
          }
        }
      }
      
      // Check file patterns
      if (config.filePatterns) {
        for (const path of filePaths) {
          for (const pattern of config.filePatterns) {
            if (pattern.test(path)) {
              score += 2;
              if (evidence.length < 5) {
                evidence.push(`File pattern match: ${path}`);
              }
            }
          }
        }
      }
      
      if (score > 0) {
        results.push({ config, score, evidence });
      }
    }
    
    // Sort by score and return the best match
    results.sort((a, b) => b.score - a.score);
    
    if (results.length > 0) {
      const best = results[0];
      return {
        detected: best.config.name,
        confidence: Math.min(best.score / 10, 1),
        evidence: best.evidence,
      };
    }
    
    return {
      detected: 'none',
      confidence: 0,
      evidence: [],
    };
  }

  /**
   * Detect common component patterns in the project
   */
  private detectCommonComponents(filePaths: string[]): string[] {
    const components: string[] = [];
    const componentPatterns = [
      { pattern: /components\/ui\/button/i, name: 'Button' },
      { pattern: /components\/ui\/input/i, name: 'Input' },
      { pattern: /components\/ui\/card/i, name: 'Card' },
      { pattern: /components\/ui\/dialog/i, name: 'Dialog' },
      { pattern: /components\/ui\/modal/i, name: 'Modal' },
      { pattern: /components\/ui\/form/i, name: 'Form' },
      { pattern: /components\/ui\/table/i, name: 'Table' },
      { pattern: /components\/ui\/select/i, name: 'Select' },
      { pattern: /components\/ui\/dropdown/i, name: 'Dropdown' },
      { pattern: /components\/ui\/tabs/i, name: 'Tabs' },
      { pattern: /components\/ui\/toast/i, name: 'Toast' },
      { pattern: /components\/ui\/alert/i, name: 'Alert' },
      { pattern: /components\/header/i, name: 'Header' },
      { pattern: /components\/footer/i, name: 'Footer' },
      { pattern: /components\/sidebar/i, name: 'Sidebar' },
      { pattern: /components\/navbar/i, name: 'Navbar' },
      { pattern: /components\/layout/i, name: 'Layout' },
    ];
    
    for (const { pattern, name } of componentPatterns) {
      if (filePaths.some(path => pattern.test(path))) {
        components.push(name);
      }
    }
    
    return components;
  }

  /**
   * Detect import alias patterns used in the project
   */
  private detectImportPatterns(content: string): string[] {
    const patterns: string[] = [];
    
    // Check for common import alias patterns
    const aliasPatterns = [
      { pattern: /from\s+['"]@\//g, name: '@/' },
      { pattern: /from\s+['"]@components\//g, name: '@components/' },
      { pattern: /from\s+['"]@lib\//g, name: '@lib/' },
      { pattern: /from\s+['"]@utils\//g, name: '@utils/' },
      { pattern: /from\s+['"]@hooks\//g, name: '@hooks/' },
      { pattern: /from\s+['"]@services\//g, name: '@services/' },
      { pattern: /from\s+['"]@types\//g, name: '@types/' },
      { pattern: /from\s+['"]~\//g, name: '~/' },
      { pattern: /from\s+['"]src\//g, name: 'src/' },
    ];
    
    for (const { pattern, name } of aliasPatterns) {
      if (pattern.test(content)) {
        patterns.push(name);
      }
    }
    
    return patterns;
  }

  /**
   * Check if a file is a code file that should be analyzed
   */
  private isCodeFile(path: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    return codeExtensions.some(ext => path.endsWith(ext));
  }

  /**
   * Detect UI library from files
   */
  detectUILibrary(files: Record<string, string>): DetectionResult {
    return this.detectCategory(files, Object.keys(files), UI_LIBRARIES);
  }

  /**
   * Detect styling approach from files
   */
  detectStyling(files: Record<string, string>): DetectionResult {
    return this.detectCategory(files, Object.keys(files), STYLING_APPROACHES);
  }

  /**
   * Detect state management from files
   */
  detectStateManagement(files: Record<string, string>): DetectionResult {
    return this.detectCategory(files, Object.keys(files), STATE_MANAGEMENT);
  }

  /**
   * Detect form library from files
   */
  detectFormLibrary(files: Record<string, string>): DetectionResult {
    return this.detectCategory(files, Object.keys(files), FORM_LIBRARIES);
  }
}

// Export singleton instance
export const patternDetector = new PatternDetector();
