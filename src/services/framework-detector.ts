/**
 * Framework Detector Service
 * Parses package.json to detect framework from dependencies
 * Supports: react, next, vue, express, fastapi, flask, django
 * Returns 'unknown' if no framework detected
 * 
 * Requirements: 6.6
 */

export interface FrameworkDetectionResult {
  framework: 'nextjs' | 'react' | 'vue' | 'angular' | 'express' | 'fastapi' | 'flask' | 'django' | 'python' | 'unknown';
  version?: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'unknown';
  buildCommand?: string;
  startCommand?: string;
  port?: number;
}

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

/**
 * Detect framework from package.json content
 * This is a pure function that can be easily tested
 */
export function detectFrameworkFromPackageJson(
  packageJson: PackageJson,
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
): FrameworkDetectionResult {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Next.js detection
  if (deps.next || packageJson.scripts?.dev?.includes('next')) {
    return {
      framework: 'nextjs',
      packageManager,
      buildCommand: 'npm run build',
      startCommand: 'npm run dev',
      port: 3000,
      version: deps.next,
    };
  }
  
  // React (without Next.js)
  if (deps.react && !deps.next) {
    return {
      framework: 'react',
      packageManager,
      buildCommand: 'npm run build',
      startCommand: packageJson.scripts?.dev || packageJson.scripts?.start || 'npm start',
      port: deps.vite ? 5173 : 3000,
      version: deps.react,
    };
  }
  
  // Vue.js
  if (deps.vue) {
    return {
      framework: 'vue',
      packageManager,
      buildCommand: 'npm run build',
      startCommand: 'npm run dev',
      port: 5173,
      version: deps.vue,
    };
  }
  
  // Angular
  if (deps['@angular/core']) {
    return {
      framework: 'angular',
      packageManager,
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      port: 4200,
      version: deps['@angular/core'],
    };
  }
  
  // Express
  if (deps.express) {
    return {
      framework: 'express',
      packageManager,
      startCommand: packageJson.scripts?.start || 'node index.js',
      port: 3000,
      version: deps.express,
    };
  }
  
  return {
    framework: 'unknown',
    packageManager,
  };
}

/**
 * Detect package manager from lock file names
 */
export function detectPackageManager(lockFiles: string[]): 'npm' | 'yarn' | 'pnpm' {
  if (lockFiles.some(f => f.includes('pnpm-lock.yaml') || f.includes('pnpm-lock'))) {
    return 'pnpm';
  }
  if (lockFiles.some(f => f.includes('yarn.lock'))) {
    return 'yarn';
  }
  return 'npm';
}

/**
 * Detect Python framework from requirements.txt or pyproject.toml content
 */
export function detectPythonFramework(
  requirementsContent?: string,
  pyprojectContent?: string,
  fileContents?: Record<string, string>
): FrameworkDetectionResult {
  const packageManager = pyprojectContent ? 'poetry' : 'pip';
  const content = requirementsContent || pyprojectContent || '';
  
  // Check for FastAPI
  if (content.includes('fastapi') || content.includes('FastAPI')) {
    return {
      framework: 'fastapi',
      packageManager,
      startCommand: 'uvicorn main:app --reload --host 0.0.0.0',
      port: 8000,
    };
  }
  
  // Check for Flask
  if (content.includes('flask') || content.includes('Flask')) {
    return {
      framework: 'flask',
      packageManager,
      startCommand: 'flask run --host=0.0.0.0',
      port: 5000,
    };
  }
  
  // Check for Django
  if (content.includes('django') || content.includes('Django')) {
    return {
      framework: 'django',
      packageManager,
      startCommand: 'python manage.py runserver 0.0.0.0:8000',
      port: 8000,
    };
  }
  
  // Check file contents for framework imports
  if (fileContents) {
    for (const [, fileContent] of Object.entries(fileContents)) {
      if (fileContent.includes('from fastapi') || fileContent.includes('import FastAPI')) {
        return {
          framework: 'fastapi',
          packageManager,
          startCommand: 'uvicorn main:app --reload --host 0.0.0.0',
          port: 8000,
        };
      }
      if (fileContent.includes('from flask') || fileContent.includes('import Flask')) {
        return {
          framework: 'flask',
          packageManager,
          startCommand: 'flask run --host=0.0.0.0',
          port: 5000,
        };
      }
    }
  }
  
  // Generic Python
  return {
    framework: 'python',
    packageManager,
    startCommand: 'python main.py',
    port: 8000,
  };
}

/**
 * Main framework detection function
 * Combines all detection strategies
 */
export function detectFramework(
  packageJsonContent?: string,
  lockFiles: string[] = [],
  requirementsContent?: string,
  pyprojectContent?: string,
  pythonFileContents?: Record<string, string>
): FrameworkDetectionResult {
  // Try Node.js/JavaScript frameworks first
  if (packageJsonContent) {
    try {
      const packageJson = JSON.parse(packageJsonContent);
      const packageManager = detectPackageManager(lockFiles);
      return detectFrameworkFromPackageJson(packageJson, packageManager);
    } catch {
      // Invalid JSON, continue to other detection methods
    }
  }
  
  // Try Python frameworks
  if (requirementsContent || pyprojectContent) {
    return detectPythonFramework(requirementsContent, pyprojectContent, pythonFileContents);
  }
  
  return {
    framework: 'unknown',
    packageManager: 'unknown',
  };
}
