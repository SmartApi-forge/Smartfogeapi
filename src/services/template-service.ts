/**
 * Template Service for Full Project Scaffolding
 * 
 * Handles cloning pre-built Daytona template environments for fast project creation.
 * The template includes all common dependencies pre-installed (shadcn/ui, framer-motion, etc.)
 * 
 * Requirements: 1.1, 1.2, 7.9
 */

import { createWorkspace, readAllFiles, type Sandbox } from '../lib/daytona-client';
import {
  DAYTONA_TEMPLATE_ID,
  TEMPLATE_PACKAGES,
  isPackageInTemplate as configIsPackageInTemplate,
  getTemplatePackages as configGetTemplatePackages,
} from '../config/template';
import { getDefaultTemplateFiles, getTemplateFilePaths } from '../config/template-files';
import type { FileSnapshotData } from '../types/database';

/**
 * Result of a template clone operation
 */
export interface CloneResult {
  success: boolean;
  sandboxId: string;
  sandboxUrl: string;
  files: FileSnapshotData;
  error?: string;
  duration?: number;
}

/**
 * Template service interface
 */
export interface TemplateService {
  cloneTemplate(projectId: string): Promise<CloneResult>;
  getTemplatePackages(): string[];
  isPackageInTemplate(packageName: string): boolean;
}

/**
 * Clone a pre-built template environment for a new project
 * 
 * This creates a new Daytona workspace from the template that has:
 * - Next.js project structure
 * - node_modules pre-installed
 * - shadcn/ui components initialized
 * - Common libraries (framer-motion, gsap, etc.)
 * 
 * @param projectId Project ID for tracking
 * @returns CloneResult with sandbox info and initial files
 * 
 * Requirements: 1.1, 1.2
 */
export async function cloneTemplate(projectId: string): Promise<CloneResult> {
  const startTime = Date.now();

  try {
    // Validate template ID is configured
    if (!DAYTONA_TEMPLATE_ID) {
      console.error('❌ [TemplateService] DAYTONA_TEMPLATE_ID is not configured');
      return {
        success: false,
        sandboxId: '',
        sandboxUrl: '',
        files: {},
        error: 'Template ID not configured. Set DAYTONA_TEMPLATE_ID environment variable.',
      };
    }

    console.log(`📦 [TemplateService] Cloning template for project ${projectId}...`);
    console.log(`📦 [TemplateService] Using template: ${DAYTONA_TEMPLATE_ID}`);

    // Create a new workspace from the template
    // The template already has node_modules installed, so this is fast
    let sandbox: Sandbox;

    try {
      sandbox = await createWorkspace({
        // Use the template image/snapshot
        image: DAYTONA_TEMPLATE_ID,
        // Enable public preview URLs
        public: true,
        // Set auto-stop to 30 minutes for cost efficiency
        autoStopInterval: 30,
        // Pass project ID as env var for tracking
        envVars: {
          PROJECT_ID: projectId,
        },
      });
    } catch (createError) {
      console.error('❌ [TemplateService] Failed to create workspace:', createError);
      return {
        success: false,
        sandboxId: '',
        sandboxUrl: '',
        files: {},
        error: `Failed to create workspace: ${createError instanceof Error ? createError.message : 'Unknown error'}`,
      };
    }

    console.log(`✅ [TemplateService] Created workspace: ${sandbox.id}`);

    // Read the template files to create initial snapshot
    // This reads the pre-existing Next.js project structure
    // The template Dockerfile sets WORKDIR /workspace, so files are there
    let files: FileSnapshotData = {};

    try {
      // Try reading from /workspace first (where Dockerfile puts the project)
      files = await readAllFiles(sandbox, '/workspace');
      console.log(`📖 [TemplateService] Read ${Object.keys(files).length} template files from /workspace`);

      // If no files found in /workspace, try current directory
      if (Object.keys(files).length === 0) {
        console.log(`📖 [TemplateService] No files in /workspace, trying current directory...`);
        files = await readAllFiles(sandbox, '.');
        console.log(`📖 [TemplateService] Read ${Object.keys(files).length} template files from .`);
      }

      // ALWAYS merge with default template files to ensure all essential files exist
      // The Daytona SDK often fails to read files, so we use defaults as fallback
      // Files read from sandbox take priority (override defaults) EXCEPT for package.json
      const MIN_EXPECTED_FILES = 10;
      const filesReadCount = Object.keys(files).length;

      console.log(`📖 [TemplateService] Files read from sandbox: ${filesReadCount}`);
      if (filesReadCount > 0) {
        console.log(`📖 [TemplateService] Sandbox files:`, Object.keys(files).slice(0, 10));
      }

      // Get default template files
      const defaultFiles = getDefaultTemplateFiles();
      console.log(`📖 [TemplateService] Default template files: ${Object.keys(defaultFiles).length}`);

      // ALWAYS merge: start with defaults, override with sandbox files
      const mergedFiles: FileSnapshotData = { ...defaultFiles };

      // Files that should NEVER be overridden from sandbox
      // (because the sandbox's version may be incomplete from failed create-next-app)
      const PROTECTED_FILES = ['package.json', 'tsconfig.json'];

      // Override with actual files from sandbox (they're more up-to-date)
      // EXCEPT for protected files that must come from our defaults
      for (const [path, fileData] of Object.entries(files)) {
        // Normalize path - remove leading /workspace/ if present
        let normalizedPath = path;
        if (normalizedPath.startsWith('/workspace/')) {
          normalizedPath = normalizedPath.substring('/workspace/'.length);
        } else if (normalizedPath.startsWith('workspace/')) {
          normalizedPath = normalizedPath.substring('workspace/'.length);
        }

        // Skip protected files - use defaults instead
        if (PROTECTED_FILES.includes(normalizedPath)) {
          console.log(`📖 [TemplateService] Skipping sandbox ${normalizedPath}, using default version`);
          continue;
        }

        mergedFiles[normalizedPath] = fileData;
      }

      files = mergedFiles;
      console.log(`📖 [TemplateService] Merged to ${Object.keys(files).length} template files`);
      console.log(`📖 [TemplateService] Final file list:`, Object.keys(files));

      // Log summary
      if (filesReadCount >= MIN_EXPECTED_FILES) {
        console.log(`📖 [TemplateService] Sandbox had sufficient files (${filesReadCount}), merged with defaults`);
      } else {
        console.log(`📖 [TemplateService] Sandbox had few files (${filesReadCount}), using mostly defaults`);
      }
    } catch (readError) {
      console.warn('⚠️ [TemplateService] Could not read template files:', readError);
      // Use default template files as fallback
      files = getDefaultTemplateFiles();
      console.log(`📖 [TemplateService] Using ${Object.keys(files).length} default template files as fallback`);
      console.log(`📖 [TemplateService] Default files:`, Object.keys(files));
    }

    // IMPORTANT: Don't get preview URL here - the dev server hasn't started yet!
    // The preview URL will be obtained AFTER the dev server is started in generate/route.ts
    // Just construct the URL format for now (it won't work until server starts)
    const sandboxUrl = `https://3000-${sandbox.id}.proxy.daytona.works`;
    console.log(`📎 [TemplateService] Sandbox URL (server not started yet): ${sandboxUrl}`);

    const duration = Date.now() - startTime;
    console.log(`✅ [TemplateService] Template cloned in ${duration}ms`);

    return {
      success: true,
      sandboxId: sandbox.id,
      sandboxUrl,
      files,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [TemplateService] Clone failed after ${duration}ms:`, errorMessage);

    return {
      success: false,
      sandboxId: '',
      sandboxUrl: '',
      files: {},
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Get all packages pre-installed in the template
 * 
 * @returns Array of package names
 * 
 * Requirements: 7.9
 */
export function getTemplatePackages(): string[] {
  return configGetTemplatePackages();
}

/**
 * Check if a package is pre-installed in the template
 * Supports case-insensitive matching and common aliases
 * 
 * @param packageName Package name to check
 * @returns true if package is in template
 * 
 * Requirements: 7.9
 */
export function isPackageInTemplate(packageName: string): boolean {
  return configIsPackageInTemplate(packageName);
}

/**
 * Filter out packages that are already in the template
 * Returns only packages that need to be installed
 * 
 * @param packages Array of package names to check
 * @returns Array of packages NOT in template (need installation)
 */
export function filterMissingPackages(packages: string[]): string[] {
  return packages.filter(pkg => !isPackageInTemplate(pkg));
}

/**
 * Get template configuration status
 * Useful for debugging and health checks
 */
export function getTemplateStatus(): {
  configured: boolean;
  templateId: string;
  packageCount: number;
} {
  return {
    configured: !!DAYTONA_TEMPLATE_ID,
    templateId: DAYTONA_TEMPLATE_ID || '(not set)',
    packageCount: TEMPLATE_PACKAGES.length,
  };
}

/**
 * Default template service instance
 */
export const templateService: TemplateService = {
  cloneTemplate,
  getTemplatePackages,
  isPackageInTemplate,
};

export default templateService;
