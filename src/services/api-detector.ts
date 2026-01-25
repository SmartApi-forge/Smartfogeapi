/**
 * API Keyword Detector
 * 
 * Detects if a user prompt is API-related based on keyword analysis.
 * Used to determine whether to generate API-focused output with OpenAPI specs.
 * 
 * **Feature: ui-quality-chat-polish**
 * **Validates: Requirements 3.1**
 */

/**
 * Keywords that indicate an API-related request
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
  
  // API documentation
  'openapi',
  'swagger',
  'graphql',
  
  // Backend terms
  'backend',
  'server',
  'microservice',
  'microservices',
  
  // Authentication
  'authentication',
  'authorization',
  'auth',
  'jwt',
  'oauth',
  'token',
  
  // Database/data
  'database',
  'schema',
  'model',
  'models',
  
  // Request/Response
  'request',
  'response',
  'json',
  'payload',
  'body',
  
  // API patterns
  'webhook',
  'webhooks',
  'middleware',
  'controller',
  'handler'
] as const;

/**
 * Result of API detection analysis
 */
export interface APIDetectionResult {
  /** Whether the prompt is determined to be API-related */
  isAPIRequest: boolean;
  /** Keywords found in the prompt */
  keywords: string[];
  /** Suggested project structure based on analysis */
  suggestedStructure: 'api' | 'frontend' | 'fullstack' | 'unknown';
  /** Confidence score (0-1) based on keyword density */
  confidence: number;
}

/**
 * Frontend-related keywords (used to distinguish from API requests)
 */
const FRONTEND_KEYWORDS = [
  'ui',
  'frontend',
  'component',
  'components',
  'react',
  'vue',
  'angular',
  'css',
  'styling',
  'layout',
  'page',
  'pages',
  'button',
  'form',
  'modal',
  'dashboard'
] as const;

/**
 * Detects if a prompt is API-related based on keyword analysis
 * 
 * @param prompt - The user's input prompt
 * @returns APIDetectionResult with detection details
 * 
 * @example
 * ```typescript
 * const result = detectAPIRequest("Create a REST API for user management with CRUD");
 * // result.isAPIRequest === true
 * // result.keywords === ['rest', 'api', 'crud']
 * // result.suggestedStructure === 'api'
 * ```
 */
export function detectAPIRequest(prompt: string): APIDetectionResult {
  const lowerPrompt = prompt.toLowerCase();
  
  // Find API keywords in the prompt
  const foundAPIKeywords = API_KEYWORDS.filter(keyword => {
    // Use word boundary matching to avoid partial matches
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lowerPrompt);
  });
  
  // Find frontend keywords for structure determination
  const foundFrontendKeywords = FRONTEND_KEYWORDS.filter(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lowerPrompt);
  });
  
  // Calculate confidence based on keyword count
  const apiKeywordCount = foundAPIKeywords.length;
  const frontendKeywordCount = foundFrontendKeywords.length;
  
  // Determine if this is an API request (threshold: 2+ API keywords)
  const isAPIRequest = apiKeywordCount >= 2;
  
  // Calculate confidence (normalized to 0-1)
  const maxExpectedKeywords = 5;
  const confidence = Math.min(apiKeywordCount / maxExpectedKeywords, 1);
  
  // Determine suggested structure
  let suggestedStructure: APIDetectionResult['suggestedStructure'] = 'unknown';
  
  if (isAPIRequest && frontendKeywordCount > 0) {
    suggestedStructure = 'fullstack';
  } else if (isAPIRequest) {
    suggestedStructure = 'api';
  } else if (frontendKeywordCount >= 2) {
    suggestedStructure = 'frontend';
  }
  
  return {
    isAPIRequest,
    keywords: foundAPIKeywords,
    suggestedStructure,
    confidence
  };
}

/**
 * Extracts the API name/resource from a prompt
 * 
 * @param prompt - The user's input prompt
 * @returns Extracted API name or null if not found
 * 
 * @example
 * ```typescript
 * extractAPIName("Create a REST API for user management")
 * // Returns: "user"
 * ```
 */
export function extractAPIName(prompt: string): string | null {
  const lowerPrompt = prompt.toLowerCase();
  
  // Common patterns for API resource names
  const patterns = [
    /api\s+for\s+(\w+)/i,
    /(\w+)\s+api/i,
    /(\w+)\s+management/i,
    /(\w+)\s+service/i,
    /crud\s+for\s+(\w+)/i,
    /(\w+)\s+endpoint/i,
    /manage\s+(\w+)/i
  ];
  
  for (const pattern of patterns) {
    const match = lowerPrompt.match(pattern);
    if (match && match[1]) {
      // Filter out common non-resource words
      const word = match[1].toLowerCase();
      const excludeWords = ['rest', 'restful', 'the', 'a', 'an', 'my', 'new', 'simple', 'basic'];
      if (!excludeWords.includes(word)) {
        return word;
      }
    }
  }
  
  return null;
}

/**
 * Gets the HTTP methods likely needed based on prompt analysis
 * 
 * @param prompt - The user's input prompt
 * @returns Array of HTTP methods to generate
 */
export function suggestHTTPMethods(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const methods: string[] = [];
  
  // Check for explicit method mentions
  if (/\bget\b/i.test(lowerPrompt)) methods.push('GET');
  if (/\bpost\b/i.test(lowerPrompt)) methods.push('POST');
  if (/\bput\b/i.test(lowerPrompt)) methods.push('PUT');
  if (/\bdelete\b/i.test(lowerPrompt)) methods.push('DELETE');
  if (/\bpatch\b/i.test(lowerPrompt)) methods.push('PATCH');
  
  // If CRUD is mentioned, include all standard methods
  if (/\bcrud\b/i.test(lowerPrompt)) {
    return ['GET', 'POST', 'PUT', 'DELETE'];
  }
  
  // Default to full CRUD if no specific methods mentioned but it's an API request
  if (methods.length === 0) {
    return ['GET', 'POST', 'PUT', 'DELETE'];
  }
  
  return [...new Set(methods)]; // Remove duplicates
}
