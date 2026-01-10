/**
 * Generation Mode Detector
 * 
 * Detects whether a user prompt should trigger lightweight API-only generation
 * or full Next.js template scaffolding.
 * 
 * **Feature: lightweight-api-generation**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 */

/**
 * Generation mode types
 */
export type GenerationMode = 'LIGHTWEIGHT_API' | 'FULL_SCAFFOLD';

/**
 * Result of generation mode detection
 */
export interface GenerationModeResult {
  /** The detected generation mode */
  mode: GenerationMode;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** API-related keywords found in the prompt */
  apiKeywords: string[];
  /** UI-related keywords found in the prompt */
  uiKeywords: string[];
  /** Suggested project name in kebab-case */
  suggestedProjectName: string;
}

/**
 * Keywords that indicate an API-only request
 */
export const API_KEYWORDS = [
  // Core API terms
  'api',
  'rest',
  'restful',
  'endpoint',
  'endpoints',
  'route',
  'routes',
  'crud',
  
  // HTTP methods
  'get',
  'post',
  'put',
  'delete',
  'patch',
  
  // Backend terms
  'backend',
  'server',
  'microservice',
  'microservices',
  
  // API documentation
  'openapi',
  'swagger',
  'graphql',
  
  // Authentication
  'authentication',
  'authorization',
  'jwt',
  'oauth',
  
  // Database/data
  'database',
  'schema',
  'model',
  'repository'
] as const;

/**
 * Keywords that indicate UI/frontend requirements (triggers full scaffold)
 */
export const UI_KEYWORDS = [
  // UI elements
  'page',
  'pages',
  'component',
  'components',
  'ui',
  'frontend',
  'interface',
  
  // Interactive elements
  'button',
  'form',
  'modal',
  'dialog',
  'menu',
  
  // Layout elements
  'layout',
  'header',
  'footer',
  'sidebar',
  'navbar',
  
  // Frameworks/apps
  'react',
  'next.js',
  'nextjs',
  'app',
  'application',
  
  // Page types
  'dashboard',
  'landing',
  'homepage',
  'website'
] as const;

/**
 * Keywords that explicitly request a full application
 */
export const FULL_APP_KEYWORDS = [
  'full application',
  'full app',
  'complete app',
  'complete application',
  'next.js app',
  'nextjs app',
  'react app',
  'web application',
  'web app',
  'full stack',
  'fullstack'
] as const;

/**
 * Detects the appropriate generation mode based on prompt analysis
 * 
 * @param prompt - The user's input prompt
 * @returns GenerationModeResult with mode, confidence, and keywords
 * 
 * @example
 * ```typescript
 * const result = detectGenerationMode("Create a REST API for user management");
 * // result.mode === 'LIGHTWEIGHT_API'
 * // result.confidence >= 0.5
 * // result.suggestedProjectName === 'user-management-api'
 * ```
 */
export function detectGenerationMode(prompt: string): GenerationModeResult {
  // Handle empty or very short prompts
  if (!prompt || prompt.trim().length < 3) {
    return {
      mode: 'FULL_SCAFFOLD',
      confidence: 0.5,
      apiKeywords: [],
      uiKeywords: [],
      suggestedProjectName: 'generated-project'
    };
  }

  const lowerPrompt = prompt.toLowerCase();
  
  // Check for explicit full app request first
  const foundFullAppKeywords = FULL_APP_KEYWORDS.filter(kw => lowerPrompt.includes(kw));
  if (foundFullAppKeywords.length > 0) {
    return {
      mode: 'FULL_SCAFFOLD',
      confidence: 1.0,
      apiKeywords: [],
      uiKeywords: foundFullAppKeywords,
      suggestedProjectName: extractProjectName(prompt)
    };
  }
  
  // Find API keywords using word boundary matching
  const foundApiKeywords = API_KEYWORDS.filter(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lowerPrompt);
  });
  
  // Find UI keywords using word boundary matching
  const foundUiKeywords = UI_KEYWORDS.filter(keyword => {
    // Handle multi-word keywords like "next.js"
    if (keyword.includes('.') || keyword.includes(' ')) {
      return lowerPrompt.includes(keyword);
    }
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lowerPrompt);
  });
  
  const apiScore = foundApiKeywords.length;
  const uiScore = foundUiKeywords.length;
  
  // Decision logic based on requirements
  if (apiScore >= 2 && uiScore === 0) {
    // Strong API signal, no UI signal - Requirements 1.1, 1.2
    return {
      mode: 'LIGHTWEIGHT_API',
      confidence: Math.min(0.95, 0.5 + (apiScore * 0.1)),
      apiKeywords: foundApiKeywords,
      uiKeywords: foundUiKeywords,
      suggestedProjectName: extractProjectName(prompt) + '-api'
    };
  } else if (apiScore > uiScore && uiScore <= 1) {
    // API dominant with minimal UI - Requirements 1.4
    return {
      mode: 'LIGHTWEIGHT_API',
      confidence: Math.min(0.8, 0.4 + (apiScore * 0.1)),
      apiKeywords: foundApiKeywords,
      uiKeywords: foundUiKeywords,
      suggestedProjectName: extractProjectName(prompt) + '-api'
    };
  } else if (uiScore > 0) {
    // UI keywords present - Requirements 1.3
    return {
      mode: 'FULL_SCAFFOLD',
      confidence: Math.min(0.9, 0.5 + (uiScore * 0.1)),
      apiKeywords: foundApiKeywords,
      uiKeywords: foundUiKeywords,
      suggestedProjectName: extractProjectName(prompt)
    };
  } else {
    // Ambiguous or no clear signal - default to full scaffold
    return {
      mode: 'FULL_SCAFFOLD',
      confidence: 0.5,
      apiKeywords: foundApiKeywords,
      uiKeywords: foundUiKeywords,
      suggestedProjectName: extractProjectName(prompt)
    };
  }
}

/**
 * Extracts a meaningful project name from the prompt and converts to kebab-case
 * 
 * @param prompt - The user's input prompt
 * @returns Project name in kebab-case format
 * 
 * @example
 * ```typescript
 * extractProjectName("Create a REST API for User Management")
 * // Returns: "user-management"
 * ```
 */
export function extractProjectName(prompt: string): string {
  // Patterns to extract meaningful names from prompts
  const patterns = [
    // "Create a REST API for user management"
    /(?:create|build|make|generate)\s+(?:a\s+)?(?:rest\s+)?(?:api|service|backend)\s+for\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,3})/i,
    // "user management API"
    /([a-z0-9]+(?:\s+[a-z0-9]+){0,3})\s+(?:api|service|backend)/i,
    // "API for user management"
    /(?:api|service|backend)\s+for\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,3})/i,
    // "todo app" or "user dashboard"
    /([a-z0-9]+(?:\s+[a-z0-9]+)?)\s+(?:app|application|dashboard|system)/i,
    // "CRUD for users"
    /crud\s+for\s+([a-z0-9]+(?:\s+[a-z0-9]+)?)/i,
    // "manage users"
    /manage\s+([a-z0-9]+(?:\s+[a-z0-9]+)?)/i
  ];
  
  // Words to exclude from project names
  const excludeWords = new Set([
    'rest', 'restful', 'the', 'a', 'an', 'my', 'new', 'simple', 'basic',
    'create', 'build', 'make', 'generate', 'with', 'and', 'or', 'for'
  ]);
  
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim().toLowerCase();
      
      // Filter out excluded words and convert to kebab-case
      const words = extracted
        .split(/\s+/)
        .filter(word => !excludeWords.has(word) && word.length > 1);
      
      if (words.length > 0) {
        return toKebabCase(words.join(' '));
      }
    }
  }
  
  return 'generated-api';
}

/**
 * Converts a string to kebab-case
 * 
 * @param str - Input string
 * @returns String in kebab-case format
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
}
