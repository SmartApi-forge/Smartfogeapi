/**
 * ReadinessChecker Service
 * 
 * Checks production readiness of a project by verifying:
 * - All required environment variables are set
 * - No hardcoded secrets in code
 * - API routes have proper error handling
 * - Generates pass/fail report with remediation steps
 * 
 * Requirements: 17.1, 17.2, 17.3, 17.5, 17.6
 */

import type { ReadinessReport, ReadinessCheck } from '../types/context-management';
import { EnvManager } from './env-manager';

/**
 * Common patterns for hardcoded secrets
 * These patterns detect potential secrets that should be in environment variables
 */
const SECRET_PATTERNS: Array<{ pattern: RegExp; name: string; remediation: string }> = [
  {
    // Note: TESTKEY_ prefix is for unit testing only (to avoid GitHub secret scanning)
    pattern: /['"](?:sk|TESTKEY)[-_](?:live|test)[-_][a-zA-Z0-9]{24,}['"]/gi,
    name: 'Stripe API Key',
    remediation: 'Move Stripe API key to STRIPE_SECRET_KEY environment variable',
  },
  {
    pattern: /['"]pk[-_](?:live|test)[-_][a-zA-Z0-9]{24,}['"]/gi,
    name: 'Stripe Publishable Key',
    remediation: 'Move Stripe publishable key to NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable',
  },
  {
    pattern: /['"](?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}['"]/gi,
    name: 'GitHub Token',
    remediation: 'Move GitHub token to GITHUB_TOKEN environment variable',
  },
  {
    pattern: /['"](?:xoxb|xoxp|xoxa|xoxr)-[a-zA-Z0-9-]{24,}['"]/gi,
    name: 'Slack Token',
    remediation: 'Move Slack token to SLACK_TOKEN environment variable',
  },
  {
    pattern: /['"]AKIA[A-Z0-9]{16}['"]/gi,
    name: 'AWS Access Key ID',
    remediation: 'Move AWS access key to AWS_ACCESS_KEY_ID environment variable',
  },
  {
    pattern: /['"][a-zA-Z0-9/+=]{40}['"](?=.*(?:aws|secret|key))/gi,
    name: 'AWS Secret Access Key',
    remediation: 'Move AWS secret key to AWS_SECRET_ACCESS_KEY environment variable',
  },
  {
    pattern: /['"]eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}['"]/gi,
    name: 'JWT Token',
    remediation: 'Move JWT token to an environment variable or generate dynamically',
  },
  {
    pattern: /mongodb(?:\+srv)?:\/\/[^'"]+:[^'"]+@[^'"]+['"]/gi,
    name: 'MongoDB Connection String',
    remediation: 'Move MongoDB connection string to DATABASE_URL environment variable',
  },
  {
    pattern: /postgres(?:ql)?:\/\/[^'"]+:[^'"]+@[^'"]+['"]/gi,
    name: 'PostgreSQL Connection String',
    remediation: 'Move PostgreSQL connection string to DATABASE_URL environment variable',
  },
  {
    pattern: /mysql:\/\/[^'"]+:[^'"]+@[^'"]+['"]/gi,
    name: 'MySQL Connection String',
    remediation: 'Move MySQL connection string to DATABASE_URL environment variable',
  },
  {
    pattern: /['"]SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}['"]/gi,
    name: 'SendGrid API Key',
    remediation: 'Move SendGrid API key to SENDGRID_API_KEY environment variable',
  },
  {
    pattern: /['"]AIza[a-zA-Z0-9_-]{35}['"]/gi,
    name: 'Google API Key',
    remediation: 'Move Google API key to GOOGLE_API_KEY environment variable',
  },
  {
    pattern: /['"](?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    name: 'Hardcoded Password',
    remediation: 'Remove hardcoded password and use environment variable or secure vault',
  },
  {
    pattern: /['"](?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_-]{16,}['"]/gi,
    name: 'Generic API Key',
    remediation: 'Move API key to an appropriate environment variable',
  },
  {
    pattern: /['"](?:secret|private[_-]?key)\s*[:=]\s*['"][^'"]{16,}['"]/gi,
    name: 'Generic Secret',
    remediation: 'Move secret to an appropriate environment variable',
  },
];

/**
 * Patterns for detecting proper error handling in API routes
 */
const ERROR_HANDLING_PATTERNS = {
  tryCatch: /try\s*\{[\s\S]*?\}\s*catch/,
  errorResponse: /(?:NextResponse|Response)\.json\s*\([^)]*(?:error|message|status)/i,
  statusCode: /(?:status|statusCode)\s*[:=()]\s*(?:4|5)\d{2}|\.status\s*\(\s*(?:4|5)\d{2}\s*\)/,
  throwError: /throw\s+(?:new\s+)?(?:Error|NextResponse)/,
};

/**
 * Files to exclude from secret scanning
 */
const EXCLUDED_FILES = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\.d\.ts$/,
  /node_modules/,
  /\.git/,
  /\.env/,
  /\.example$/,
  /README\.md$/i,
  /CHANGELOG\.md$/i,
];

/**
 * API route file patterns
 */
const API_ROUTE_PATTERNS = [
  /(?:^|\/)app\/api\/.*route\.(ts|js)$/,  // Next.js App Router
  /(?:^|\/)pages\/api\/.*\.(ts|js)$/,     // Next.js Pages Router
];

export interface ReadinessCheckOptions {
  /** Files to check (path -> content) */
  files: Record<string, string>;
  /** Environment variables that are set */
  setEnvVariables?: string[];
  /** Skip certain checks */
  skipChecks?: ('env' | 'secrets' | 'errorHandling')[];
}

export interface SecretDetection {
  file: string;
  line: number;
  secretType: string;
  remediation: string;
}

export interface ErrorHandlingIssue {
  file: string;
  issue: string;
  remediation: string;
}

/**
 * ReadinessChecker implementation
 * Checks production readiness of a project
 */
export class ReadinessChecker {
  private envManager: EnvManager;

  constructor(envManager?: EnvManager) {
    this.envManager = envManager || new EnvManager();
  }

  /**
   * Check production readiness of a project
   * 
   * Requirements: 17.1, 17.2, 17.3, 17.5, 17.6
   * 
   * @param options - Check options including files and set env variables
   * @returns Readiness report with pass/fail status for each check
   */
  checkReadiness(options: ReadinessCheckOptions): ReadinessReport {
    const checks: ReadinessCheck[] = [];
    const skipChecks = options.skipChecks || [];

    // Check 1: Environment Variables (Requirements: 17.1)
    if (!skipChecks.includes('env')) {
      const envCheck = this.checkEnvVariables(options.files, options.setEnvVariables || []);
      checks.push(envCheck);
    }

    // Check 2: Hardcoded Secrets (Requirements: 17.2)
    if (!skipChecks.includes('secrets')) {
      const secretsCheck = this.checkHardcodedSecrets(options.files);
      checks.push(secretsCheck);
    }

    // Check 3: API Error Handling (Requirements: 17.3)
    if (!skipChecks.includes('errorHandling')) {
      const errorHandlingCheck = this.checkApiErrorHandling(options.files);
      checks.push(errorHandlingCheck);
    }

    // Generate summary (Requirements: 17.5)
    const passedCount = checks.filter(c => c.passed).length;
    const totalCount = checks.length;
    const isReady = checks.every(c => c.passed);

    const summary = isReady
      ? `All ${totalCount} production readiness checks passed. Project is ready for deployment.`
      : `${passedCount}/${totalCount} checks passed. Please address the failing checks before deployment.`;

    return {
      isReady,
      checks,
      summary,
    };
  }

  /**
   * Check if all required environment variables are set
   * 
   * Requirements: 17.1
   * 
   * @param files - Project files to scan for env variable usage
   * @param setVariables - List of environment variables that are set
   * @returns Readiness check result
   */
  checkEnvVariables(
    files: Record<string, string>,
    setVariables: string[]
  ): ReadinessCheck {
    // Detect required variables from code
    const requiredVariables = this.envManager.detectRequiredVariables(files);
    
    // Find missing variables
    const setVariablesSet = new Set(setVariables);
    const missingVariables = requiredVariables.filter(v => !setVariablesSet.has(v));

    if (missingVariables.length === 0) {
      return {
        name: 'Environment Variables',
        passed: true,
        message: `All ${requiredVariables.length} required environment variables are set`,
      };
    }

    // Generate remediation steps (Requirements: 17.6)
    const remediation = [
      'Add the following environment variables to your .env.local file:',
      ...missingVariables.map(v => `  ${v}=<your-value>`),
      '',
      'For production, ensure these are set in your deployment platform (Vercel, etc.)',
    ].join('\n');

    return {
      name: 'Environment Variables',
      passed: false,
      message: `Missing ${missingVariables.length} required environment variable(s): ${missingVariables.join(', ')}`,
      remediation,
    };
  }

  /**
   * Check for hardcoded secrets in code
   * 
   * Requirements: 17.2
   * 
   * @param files - Project files to scan
   * @returns Readiness check result
   */
  checkHardcodedSecrets(files: Record<string, string>): ReadinessCheck {
    const detectedSecrets = this.detectSecrets(files);

    if (detectedSecrets.length === 0) {
      return {
        name: 'Hardcoded Secrets',
        passed: true,
        message: 'No hardcoded secrets detected in code',
      };
    }

    // Group by secret type for cleaner output
    const secretsByType = new Map<string, SecretDetection[]>();
    for (const secret of detectedSecrets) {
      const existing = secretsByType.get(secret.secretType) || [];
      existing.push(secret);
      secretsByType.set(secret.secretType, existing);
    }

    // Generate remediation steps (Requirements: 17.6)
    const remediationLines: string[] = ['Found hardcoded secrets that should be moved to environment variables:', ''];
    
    for (const [secretType, secrets] of secretsByType) {
      remediationLines.push(`${secretType}:`);
      for (const secret of secrets) {
        remediationLines.push(`  - ${secret.file}:${secret.line}`);
      }
      remediationLines.push(`  Remediation: ${secrets[0].remediation}`);
      remediationLines.push('');
    }

    return {
      name: 'Hardcoded Secrets',
      passed: false,
      message: `Found ${detectedSecrets.length} hardcoded secret(s) in ${secretsByType.size} categor${secretsByType.size === 1 ? 'y' : 'ies'}`,
      remediation: remediationLines.join('\n'),
    };
  }

  /**
   * Check if API routes have proper error handling
   * 
   * Requirements: 17.3
   * 
   * @param files - Project files to scan
   * @returns Readiness check result
   */
  checkApiErrorHandling(files: Record<string, string>): ReadinessCheck {
    const issues = this.detectErrorHandlingIssues(files);

    if (issues.length === 0) {
      const apiRouteCount = Object.keys(files).filter(f => this.isApiRoute(f)).length;
      return {
        name: 'API Error Handling',
        passed: true,
        message: apiRouteCount > 0 
          ? `All ${apiRouteCount} API route(s) have proper error handling`
          : 'No API routes found to check',
      };
    }

    // Generate remediation steps (Requirements: 17.6)
    const remediationLines: string[] = [
      'The following API routes need improved error handling:',
      '',
    ];

    for (const issue of issues) {
      remediationLines.push(`${issue.file}:`);
      remediationLines.push(`  Issue: ${issue.issue}`);
      remediationLines.push(`  Remediation: ${issue.remediation}`);
      remediationLines.push('');
    }

    remediationLines.push('Example of proper error handling:');
    remediationLines.push('```typescript');
    remediationLines.push('export async function POST(request: Request) {');
    remediationLines.push('  try {');
    remediationLines.push('    // Your logic here');
    remediationLines.push('    return NextResponse.json({ success: true });');
    remediationLines.push('  } catch (error) {');
    remediationLines.push('    console.error("API error:", error);');
    remediationLines.push('    return NextResponse.json(');
    remediationLines.push('      { error: "Internal server error" },');
    remediationLines.push('      { status: 500 }');
    remediationLines.push('    );');
    remediationLines.push('  }');
    remediationLines.push('}');
    remediationLines.push('```');

    return {
      name: 'API Error Handling',
      passed: false,
      message: `${issues.length} API route(s) missing proper error handling`,
      remediation: remediationLines.join('\n'),
    };
  }

  /**
   * Detect hardcoded secrets in files
   * 
   * @param files - Files to scan
   * @returns Array of detected secrets
   */
  detectSecrets(files: Record<string, string>): SecretDetection[] {
    const detections: SecretDetection[] = [];

    for (const [filePath, content] of Object.entries(files)) {
      // Skip excluded files
      if (this.shouldExcludeFile(filePath)) {
        continue;
      }

      const lines = content.split('\n');
      
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        // Skip comment lines
        if (this.isCommentLine(line)) {
          continue;
        }

        for (const { pattern, name, remediation } of SECRET_PATTERNS) {
          // Reset regex lastIndex
          pattern.lastIndex = 0;
          
          if (pattern.test(line)) {
            detections.push({
              file: filePath,
              line: lineIndex + 1,
              secretType: name,
              remediation,
            });
          }
        }
      }
    }

    return detections;
  }

  /**
   * Detect error handling issues in API routes
   * 
   * @param files - Files to scan
   * @returns Array of error handling issues
   */
  detectErrorHandlingIssues(files: Record<string, string>): ErrorHandlingIssue[] {
    const issues: ErrorHandlingIssue[] = [];

    for (const [filePath, content] of Object.entries(files)) {
      if (!this.isApiRoute(filePath)) {
        continue;
      }

      // Check for try-catch blocks
      const hasTryCatch = ERROR_HANDLING_PATTERNS.tryCatch.test(content);
      
      // Check for error responses
      const hasErrorResponse = ERROR_HANDLING_PATTERNS.errorResponse.test(content);
      
      // Check for status codes in error range
      const hasErrorStatusCode = ERROR_HANDLING_PATTERNS.statusCode.test(content);

      // Determine if error handling is adequate
      const hasAdequateErrorHandling = hasTryCatch && (hasErrorResponse || hasErrorStatusCode);

      if (!hasAdequateErrorHandling) {
        let issue: string;
        let remediation: string;

        if (!hasTryCatch) {
          issue = 'No try-catch block found';
          remediation = 'Wrap API logic in try-catch to handle unexpected errors';
        } else if (!hasErrorResponse && !hasErrorStatusCode) {
          issue = 'No error response handling found';
          remediation = 'Add proper error responses with appropriate status codes (4xx, 5xx)';
        } else {
          issue = 'Incomplete error handling';
          remediation = 'Ensure all error paths return proper error responses';
        }

        issues.push({
          file: filePath,
          issue,
          remediation,
        });
      }
    }

    return issues;
  }

  /**
   * Check if a file should be excluded from scanning
   */
  private shouldExcludeFile(filePath: string): boolean {
    return EXCLUDED_FILES.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if a line is a comment
   */
  private isCommentLine(line: string): boolean {
    const trimmed = line.trim();
    return (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('#')
    );
  }

  /**
   * Check if a file is an API route
   */
  isApiRoute(filePath: string): boolean {
    return API_ROUTE_PATTERNS.some(pattern => pattern.test(filePath));
  }

  /**
   * Get list of API routes from files
   */
  getApiRoutes(files: Record<string, string>): string[] {
    return Object.keys(files).filter(f => this.isApiRoute(f));
  }
}

// Export singleton instance
export const readinessChecker = new ReadinessChecker();
