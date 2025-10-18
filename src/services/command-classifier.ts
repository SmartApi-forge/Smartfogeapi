import OpenAI from "openai";
import type {
  CommandClassification,
  CommandType,
} from "../modules/versions/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Keyword patterns for fast classification
const KEYWORD_PATTERNS: Record<CommandType, RegExp[]> = {
  CREATE_FILE: [
    /\b(create|add|new|generate|make|build)\s+(a\s+)?(new\s+)?(file|component|module|endpoint|route|api|service|handler|controller|middleware)\b/i,
    /\b(scaffold|setup|initialize|implement)\s+(a\s+)?new\b/i,
  ],
  MODIFY_FILE: [
    /\b(modify|update|change|edit|alter|adjust|fix|improve|enhance|refactor)\s+(the\s+)?(existing\s+)?(file|code|function|method|class|component)\b/i,
    /\b(add|include|insert)\s+(to|in|into)\s+(the\s+)?(existing|current)\b/i,
    /\b(remove|delete)\s+(from|in)\s+(the\s+)?(existing|current)\b/i,
  ],
  DELETE_FILE: [
    /\b(delete|remove|drop)\s+(the\s+)?(file|component|module|endpoint|route)\b/i,
    /\b(get\s+rid\s+of|eliminate|erase)\s+(the\s+)?(file|component)\b/i,
  ],
  REFACTOR_CODE: [
    /\b(refactor|restructure|reorganize|optimize|clean\s*up|rewrite)\b/i,
    /\b(improve|enhance)\s+(the\s+)?(code|structure|architecture|organization)\b/i,
    /\b(convert|migrate|transform)\s+.+\s+(to|into)\b/i,
  ],
  GENERATE_API: [
    /\b(create|generate|build|make)\s+(an\s+|a\s+)?(api|rest\s*api|graphql|endpoint|backend|server)\b/i,
    /\b(api|rest\s*api)\s+for\b/i,
    /\bI\s+need\s+(an\s+|a\s+)?(api|backend)\b/i,
  ],
};

// Cache for common command patterns
const classificationCache = new Map<string, CommandClassification>();
const CACHE_MAX_SIZE = 1000;

/**
 * Fast keyword-based classification
 * Returns classification with confidence score
 */
function keywordClassify(
  prompt: string,
): { type: CommandType; confidence: number } | null {
  const normalizedPrompt = prompt.toLowerCase().trim();

  // Check cache first
  if (classificationCache.has(normalizedPrompt)) {
    const cached = classificationCache.get(normalizedPrompt)!;
    return { type: cached.type, confidence: cached.confidence };
  }

  let bestMatch: { type: CommandType; confidence: number } | null = null;

  for (const [type, patterns] of Object.entries(KEYWORD_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedPrompt)) {
        const confidence = 85; // High confidence for keyword matches
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { type: type as CommandType, confidence };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * AI-powered classification using OpenAI function calling
 * Used when keyword classification has low confidence
 */
async function aiClassify(
  prompt: string,
  currentFiles: string[] = [],
): Promise<CommandClassification> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a command classifier for a code generation system. Analyze user prompts and classify them into one of these categories:
- CREATE_FILE: User wants to create new files/components/features
- MODIFY_FILE: User wants to modify existing files/code
- DELETE_FILE: User wants to delete/remove files
- REFACTOR_CODE: User wants to restructure/optimize existing code
- GENERATE_API: User wants to generate a complete API/backend

Also determine if this should create a new version (usually yes, unless it's a very minor change).
Extract any mentioned file names, function names, or entities.

Current files in project: ${currentFiles.length > 0 ? currentFiles.join(", ") : "none (new project)"}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      functions: [
        {
          name: "classify_command",
          description:
            "Classify the user command and extract relevant information",
          parameters: {
            type: "object",
            properties: {
              command_type: {
                type: "string",
                enum: [
                  "CREATE_FILE",
                  "MODIFY_FILE",
                  "DELETE_FILE",
                  "REFACTOR_CODE",
                  "GENERATE_API",
                ],
                description: "The type of command",
              },
              confidence: {
                type: "number",
                description: "Confidence level 0-100",
                minimum: 0,
                maximum: 100,
              },
              should_create_new_version: {
                type: "boolean",
                description: "Whether this command should create a new version",
              },
              entities: {
                type: "array",
                items: { type: "string" },
                description:
                  "Extracted file names, function names, or other entities mentioned",
              },
              reasoning: {
                type: "string",
                description: "Brief explanation of the classification",
              },
            },
            required: [
              "command_type",
              "confidence",
              "should_create_new_version",
              "entities",
              "reasoning",
            ],
          },
        },
      ],
      function_call: { name: "classify_command" },
      temperature: 0.3,
    });

    const functionCall = completion.choices[0]?.message?.function_call;
    if (!functionCall) {
      throw new Error("No function call in AI response");
    }

    const result = JSON.parse(functionCall.arguments);

    return {
      type: result.command_type as CommandType,
      confidence: result.confidence,
      shouldCreateNewVersion: result.should_create_new_version,
      entities: result.entities || [],
      reasoning: result.reasoning || "AI classification",
    };
  } catch (error) {
    console.error("AI classification error:", error);
    // Fallback to safe defaults
    return {
      type: "GENERATE_API",
      confidence: 50,
      shouldCreateNewVersion: true,
      entities: [],
      reasoning: "Fallback classification due to error",
    };
  }
}

/**
 * Main classification function with hybrid approach
 * 1. Try keyword matching first (fast)
 * 2. If confidence < 80%, use AI classification
 * 3. Cache results for performance
 */
export async function classifyCommand(
  prompt: string,
  currentFiles: string[] = [],
): Promise<CommandClassification> {
  const normalizedPrompt = prompt.toLowerCase().trim();

  // Check cache
  if (classificationCache.has(normalizedPrompt)) {
    return classificationCache.get(normalizedPrompt)!;
  }

  // Try keyword classification first
  const keywordResult = keywordClassify(prompt);

  if (keywordResult && keywordResult.confidence >= 80) {
    // High confidence keyword match
    const classification: CommandClassification = {
      type: keywordResult.type,
      confidence: keywordResult.confidence,
      shouldCreateNewVersion: true, // Default to creating new version
      entities: extractEntities(prompt),
      reasoning: "Keyword pattern match",
    };

    // Cache result
    cacheClassification(normalizedPrompt, classification);

    return classification;
  }

  // Low confidence or no match - use AI
  const aiResult = await aiClassify(prompt, currentFiles);

  // Cache result
  cacheClassification(normalizedPrompt, aiResult);

  return aiResult;
}

/**
 * Extract file names and entities from prompt using simple pattern matching
 */
function extractEntities(prompt: string): string[] {
  const entities: string[] = [];

  // Match file names (e.g., "auth.js", "UserProfile.tsx", "api/users.ts")
  const filePattern = /\b[\w-]+\.[\w]+\b/g;
  const fileMatches = prompt.match(filePattern);
  if (fileMatches) {
    entities.push(...fileMatches);
  }

  // Match quoted strings (likely file or function names)
  const quotedPattern = /["']([^"']+)["']/g;
  let match;
  while ((match = quotedPattern.exec(prompt)) !== null) {
    entities.push(match[1]);
  }

  return [...new Set(entities)]; // Remove duplicates
}

/**
 * Cache classification with size limit
 */
function cacheClassification(
  prompt: string,
  classification: CommandClassification,
): void {
  if (classificationCache.size >= CACHE_MAX_SIZE) {
    // Remove oldest entry
    const firstKey = classificationCache.keys().next().value;
    classificationCache.delete(firstKey);
  }

  classificationCache.set(prompt, classification);
}

/**
 * Clear classification cache (useful for testing)
 */
export function clearClassificationCache(): void {
  classificationCache.clear();
}
