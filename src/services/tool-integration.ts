/**
 * Tool Integration Module
 * 
 * Bridges the ToolExecutor service with the /api/generate route.
 * Handles tool call parsing from LLM responses, execution, and result formatting.
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */

import { 
  executeTool, 
  type ToolExecutionContext,
  type ToolResult,
  type GrepRepoResult,
  type LSRepoResult,
  type ReadFileResult,
  type SearchRepoResult,
  type SearchWebResult,
  type FetchFromWebResult,
  type TodoManagerResult,
  type GetIntegrationResult,
  type DesignInspirationResult,
} from './tool-executor';
import type { FileSnapshotData } from '../types/database';

/**
 * Tool call parsed from LLM response
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Tool execution result with SSE event info
 */
export interface ToolExecutionResult {
  toolCall: ToolCall;
  result: ToolResult | { tool: string; error: string };
  taskNameActive: string;
  taskNameComplete: string;
  executionTimeMs: number;
}

/**
 * Files that have been read in the current turn (for read-before-write enforcement)
 */
export interface ReadTracker {
  filesRead: Set<string>;
  addFile: (path: string) => void;
  hasRead: (path: string) => boolean;
  clear: () => void;
}

/**
 * Create a new read tracker for a turn
 * 
 * Requirement 17.1: Track which files have been read in current turn
 */
export function createReadTracker(): ReadTracker {
  const filesRead = new Set<string>();
  
  return {
    filesRead,
    addFile: (path: string) => filesRead.add(path),
    hasRead: (path: string) => filesRead.has(path),
    clear: () => filesRead.clear(),
  };
}

/**
 * Tool definitions for Claude/OpenAI function calling
 * 
 * Requirement 15.12: Use JSON Schema format compatible with Claude/OpenAI
 * Includes taskNameActive/taskNameComplete for UI feedback (v0-style)
 */
export const TOOL_DEFINITIONS = [
  // ==========================================================================
  // CODE SEARCH & READING TOOLS
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'GrepRepo',
      description: 'Searches for regex patterns within file contents across the repository. Returns matching lines with file paths and line numbers.\n\nPrimary use cases:\n• Find function definitions: "function\\s+myFunction"\n• Locate imports/exports: "import.*from"\n• Search for specific classes or components\n• Find API calls or configuration patterns\n\nSearch strategies:\n• Use glob patterns to focus on relevant file types (*.ts, *.tsx)\n• Start broad, then narrow down with more specific patterns',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The regular expression (regex) pattern to search for within file contents.',
          },
          path: {
            type: 'string',
            description: 'Optional: The path to the directory to search within. If omitted, searches all files.',
          },
          globPattern: {
            type: 'string',
            description: 'Optional: A glob pattern to filter which files are searched (e.g., "*.ts", "src/**").',
          },
          taskNameActive: {
            type: 'string',
            description: '2-5 words describing the task when running. Example: "Searching for imports"',
          },
          taskNameComplete: {
            type: 'string',
            description: '2-5 words describing the task when complete. Example: "Found import patterns"',
          },
        },
        required: ['pattern', 'taskNameActive', 'taskNameComplete'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'LSRepo',
      description: 'Lists files and directories in the repository. Returns file paths sorted alphabetically.\n\nCommon use cases:\n• Explore repository structure and understand project layout\n• Find files in specific directories\n• Locate configuration files or specific file types\n• Get overview of available files before diving into specific areas',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Optional: The path to the directory to list. If omitted, lists from root.',
          },
          globPattern: {
            type: 'string',
            description: 'Optional: A glob pattern to filter which files are listed (e.g., "*.tsx", "src/**").',
          },
          taskNameActive: {
            type: 'string',
            description: '2-5 words describing the task when running. Example: "Listing project files"',
          },
          taskNameComplete: {
            type: 'string',
            description: '2-5 words describing the task when complete. Example: "Listed project structure"',
          },
        },
        required: ['taskNameActive', 'taskNameComplete'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'ReadFile',
      description: 'Reads file contents - returns complete files when small, or targeted chunks when large based on your query.\n\n**CRITICAL: You MUST call this before editing ANY existing file.**\n\n**How it works:**\n• Small files (≤2000 lines) - Returns complete content\n• Large files (>2000 lines) - Uses query to find relevant chunks\n\n**When to use:**\n• **Before editing** - ALWAYS read files before making changes\n• **Understanding implementation** - How specific features work\n• **Finding specific code** - Locate patterns or functions',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the file to read (e.g., "app/page.tsx", "components/button.tsx").',
          },
          query: {
            type: 'string',
            description: 'Optional: What you\'re looking for in the file. Required for large files (>2000 lines).',
          },
          startLine: {
            type: 'number',
            description: 'Optional: Starting line number (1-based).',
          },
          endLine: {
            type: 'number',
            description: 'Optional: Ending line number (1-based).',
          },
          taskNameActive: {
            type: 'string',
            description: '2-5 words describing the task when running. Example: "Reading page.tsx"',
          },
          taskNameComplete: {
            type: 'string',
            description: '2-5 words describing the task when complete. Example: "Read page.tsx"',
          },
        },
        required: ['filePath', 'taskNameActive', 'taskNameComplete'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'SearchRepo',
      description: 'Searches and explores the codebase using multiple search strategies. Returns relevant files and contextual information.\n\n**Core capabilities:**\n• File discovery and content analysis across the repository\n• Pattern matching with regex search\n• Directory exploration and project structure understanding\n\n**When to use:**\n• Architecture exploration - Understanding project structure\n• Refactoring preparation - Finding all instances of functions or patterns\n• Getting to know the codebase - "Give me an overview of the codebase"',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Describe what you\'re looking for. Can be files, code patterns, or functionality.\n\nExamples:\n• "components/ui/button.tsx, utils/api.ts" - Read multiple files\n• "authentication logic" - Find auth-related code\n• "Give me an overview of the codebase" - Start here when unfamiliar',
          },
          goal: {
            type: 'string',
            description: 'Optional: Brief context about why you\'re searching and what you plan to do.',
          },
          taskNameActive: {
            type: 'string',
            description: '2-5 words describing the task when running. Example: "Analyzing codebase"',
          },
          taskNameComplete: {
            type: 'string',
            description: '2-5 words describing the task when complete. Example: "Analyzed codebase"',
          },
        },
        required: ['query', 'taskNameActive', 'taskNameComplete'],
      },
    },
  },
  // ==========================================================================
  // WEB & EXTERNAL TOOLS
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'SearchWeb',
      description: 'Performs intelligent web search using high-quality sources. Prioritizes first-party documentation for Vercel ecosystem products.\n\n**When to use:**\n• Technology documentation - Latest features, API references\n• Current best practices - Up-to-date development patterns\n• Version-specific details - New releases, breaking changes\n• Error messages and troubleshooting\n\n**Use isFirstParty: true** for Next.js, Vercel, Supabase, shadcn, Tailwind, TypeScript docs.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Be specific for best results.\n\nExamples:\n• "Next.js 15 app router features"\n• "Supabase RLS policies best practices"\n• "shadcn/ui form validation"',
          },
          isFirstParty: {
            type: 'boolean',
            description: 'Enable first-party documentation search for Vercel ecosystem (Next.js, Supabase, shadcn, etc.)',
          },
          taskNameActive: {
            type: 'string',
            description: '2-5 words describing the task when running.',
          },
          taskNameComplete: {
            type: 'string',
            description: '2-5 words describing the task when complete.',
          },
        },
        required: ['query', 'taskNameActive', 'taskNameComplete'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'FetchFromWeb',
      description: 'Fetches full text content from web pages when you have specific URLs to read. Returns clean, parsed text with metadata.\n\n**When to use:**\n• Known URLs you need to read completely\n• Documentation reading - External docs, tutorials\n• Follow-up research after web search',
      parameters: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URLs to fetch content from.',
          },
          taskNameActive: {
            type: 'string',
            description: '2-5 words describing the task when running.',
          },
          taskNameComplete: {
            type: 'string',
            description: '2-5 words describing the task when complete.',
          },
        },
        required: ['urls', 'taskNameActive', 'taskNameComplete'],
      },
    },
  },
  // ==========================================================================
  // PROJECT MANAGEMENT TOOLS
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'TodoManager',
      description: 'Manages structured todo lists for complex, multi-step projects.\n\n**Core workflow:**\n1. set_tasks - Break project into 3-7 milestone tasks\n2. move_to_task - Complete current work, focus on next task\n\n**Task guidelines:**\n• Milestone-level tasks: "Build Homepage", "Setup Auth", "Add Database"\n• One page = one task\n• UI before backend\n• ≤10 tasks total\n• NO vague tasks like "Polish" or "Test"\n\n**When to use:**\n• Projects with multiple distinct systems\n• Apps requiring separate user-facing and admin components\n\n**Skip when:**\n• Single cohesive builds (landing pages, forms)\n• Trivial or single-step tasks',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['set_tasks', 'move_to_task', 'add_task', 'read_list', 'mark_all_done'],
            description: 'The action to perform.',
          },
          tasks: {
            type: 'array',
            items: { type: 'string' },
            description: 'Complete task list for set_tasks action.',
          },
          moveToTask: {
            type: 'string',
            description: 'Task name to focus on for move_to_task action.',
          },
          task: {
            type: 'string',
            description: 'Task description for add_task action.',
          },
          taskNameActive: {
            type: 'string',
            description: '2-5 words describing the task when running.',
          },
          taskNameComplete: {
            type: 'string',
            description: '2-5 words describing the task when complete.',
          },
        },
        required: ['action', 'taskNameActive', 'taskNameComplete'],
      },
    },
  },
  // ==========================================================================
  // INTEGRATION TOOLS
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'GetOrRequestIntegration',
      description: 'Checks integration status, retrieves environment variables, and gets live database schemas.\n\n**What it provides:**\n• Integration status - Connected services and configuration\n• Environment variables - Available and missing requirements\n• Live database schemas - Real-time table/column info for SQL integrations\n• RLS policies for Supabase tables\n\n**When to use:**\n• Before building integration features (auth, payments, database)\n• Debugging integration issues\n• Before writing SQL queries\n\n**Key behavior:** Stops execution and requests user setup for missing integrations.',
      parameters: {
        type: 'object',
        properties: {
          names: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['Supabase', 'Neon', 'Stripe', 'Upstash', 'Vercel AI Gateway'],
            },
            description: 'Integration names to check. Omit to get overview of all connected integrations.',
          },
          taskNameActive: {
            type: 'string',
            description: '2-5 words describing the task when running.',
          },
          taskNameComplete: {
            type: 'string',
            description: '2-5 words describing the task when complete.',
          },
        },
        required: ['taskNameActive', 'taskNameComplete'],
      },
    },
  },
  // ==========================================================================
  // DESIGN TOOLS
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'GenerateDesignInspiration',
      description: 'Generate design inspiration for visually appealing generations.\n\n**When to use:**\n• Vague design requests - "a nice landing page"\n• Creative enhancement needed\n• No clear aesthetic or color scheme provided\n• Complex UI/UX projects\n\n**Skip when:**\n• Backend/API work\n• Minor styling tweaks\n• Design already detailed\n• Copying an existing design\n\n**Important:** If you generate a design brief, you MUST follow it.',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'High-level product/feature or UX goal.',
          },
          context: {
            type: 'string',
            description: 'Optional: Design cues, brand adjectives, constraints.',
          },
          taskNameActive: {
            type: 'string',
            description: '2-5 words describing the task when running.',
          },
          taskNameComplete: {
            type: 'string',
            description: '2-5 words describing the task when complete.',
          },
        },
        required: ['goal', 'taskNameActive', 'taskNameComplete'],
      },
    },
  },
];

/**
 * Default task names for UI feedback (fallback when not provided in tool call)
 * 
 * Requirement 15.5, 15.6: taskNameActive/taskNameComplete for UI display
 */
const DEFAULT_TOOL_TASK_NAMES: Record<string, { active: string; complete: (result: unknown) => string }> = {
  GrepRepo: {
    active: 'Searching codebase...',
    complete: (result: unknown) => {
      const r = result as GrepRepoResult;
      if (!r || r.totalMatches === undefined) {
        return 'Search completed';
      }
      return `Found ${r.totalMatches} match${r.totalMatches !== 1 ? 'es' : ''} in ${r.filesSearched || 0} file${r.filesSearched !== 1 ? 's' : ''}`;
    },
  },
  LSRepo: {
    active: 'Listing files...',
    complete: (result: unknown) => {
      const r = result as LSRepoResult;
      if (!r || r.totalFiles === undefined) {
        return 'Files listed';
      }
      return `Listed ${r.totalFiles} file${r.totalFiles !== 1 ? 's' : ''}`;
    },
  },
  ReadFile: {
    active: 'Reading file...',
    complete: (result: unknown) => {
      const r = result as ReadFileResult;
      if (!r || r.lineCount === undefined) {
        return 'File read';
      }
      return r.truncated 
        ? `Read ${r.lineCount} lines (truncated)` 
        : `Read ${r.lineCount} line${r.lineCount !== 1 ? 's' : ''}`;
    },
  },
  SearchRepo: {
    active: 'Analyzing codebase...',
    complete: (result: unknown) => {
      const r = result as SearchRepoResult;
      if (!r || !r.relevantFiles) {
        return 'Search completed';
      }
      return `Found ${r.relevantFiles.length} relevant file${r.relevantFiles.length !== 1 ? 's' : ''}`;
    },
  },
  // New tools
  SearchWeb: {
    active: 'Searching web...',
    complete: () => 'Web search completed',
  },
  FetchFromWeb: {
    active: 'Fetching web content...',
    complete: () => 'Fetched web content',
  },
  TodoManager: {
    active: 'Managing tasks...',
    complete: () => 'Tasks updated',
  },
  GetOrRequestIntegration: {
    active: 'Checking integrations...',
    complete: () => 'Checked integrations',
  },
  GenerateDesignInspiration: {
    active: 'Generating design...',
    complete: () => 'Design inspiration ready',
  },
};

/**
 * Parse tool calls from OpenAI/Claude response
 */
export function parseToolCalls(
  toolCalls: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>
): ToolCall[] {
  return toolCalls
    .filter(tc => tc.type === 'function')
    .map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
}

/**
 * Execute a single tool call
 * 
 * Requirements: 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11
 */
export async function executeToolCall(
  toolCall: ToolCall,
  context: ToolExecutionContext,
  readTracker: ReadTracker
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  
  // Get task names - prefer from tool call arguments (v0-style), fallback to defaults
  const argsTaskNameActive = toolCall.arguments.taskNameActive as string | undefined;
  const argsTaskNameComplete = toolCall.arguments.taskNameComplete as string | undefined;
  
  const defaultTaskNames = DEFAULT_TOOL_TASK_NAMES[toolCall.name] || {
    active: `Executing ${toolCall.name}...`,
    complete: () => `${toolCall.name} completed`,
  };
  
  const taskNames = {
    active: argsTaskNameActive || defaultTaskNames.active,
    complete: argsTaskNameComplete 
      ? () => argsTaskNameComplete 
      : defaultTaskNames.complete,
  };
  
  // Execute the tool
  const result = executeTool(toolCall.name, toolCall.arguments, context);
  
  // Track file reads for read-before-write enforcement
  if (toolCall.name === 'ReadFile' && 'result' in result && result.tool === 'ReadFile') {
    const readResult = result.result as ReadFileResult;
    if (!readResult.content.startsWith('Error:')) {
      readTracker.addFile(toolCall.arguments.filePath as string);
    }
  } else if (toolCall.name === 'SearchRepo' && 'result' in result && result.tool === 'SearchRepo') {
    // SearchRepo also counts as reading the files it returns
    const searchResult = result.result as SearchRepoResult;
    for (const file of searchResult.relevantFiles) {
      readTracker.addFile(file.path);
    }
  }
  
  const executionTimeMs = performance.now() - startTime;
  
  // Generate completion message
  let taskNameComplete = taskNames.complete(null);
  if ('result' in result) {
    taskNameComplete = taskNames.complete(result.result);
  } else if ('error' in result) {
    taskNameComplete = `Error: ${result.error}`;
  }
  
  return {
    toolCall,
    result,
    taskNameActive: taskNames.active,
    taskNameComplete,
    executionTimeMs,
  };
}

/**
 * Execute multiple tool calls in parallel
 * 
 * Requirement 17.4: Execute independent tool calls in parallel
 */
export async function executeToolCallsParallel(
  toolCalls: ToolCall[],
  context: ToolExecutionContext,
  readTracker: ReadTracker
): Promise<ToolExecutionResult[]> {
  const promises = toolCalls.map(tc => executeToolCall(tc, context, readTracker));
  return Promise.all(promises);
}

/**
 * Format tool result for LLM consumption
 */
export function formatToolResultForLLM(result: ToolExecutionResult): string {
  const { toolCall, result: toolResult } = result;
  
  if ('error' in toolResult) {
    return `Tool ${toolCall.name} failed: ${toolResult.error}`;
  }
  
  switch (toolResult.tool) {
    case 'GrepRepo': {
      const r = toolResult.result as GrepRepoResult;
      if (r.matches.length === 0) {
        return `No matches found for pattern "${toolCall.arguments.pattern}"`;
      }
      let output = `Found ${r.totalMatches} matches:\n\n`;
      for (const match of r.matches.slice(0, 50)) {
        output += `${match.filePath}:${match.lineNumber}: ${match.lineContent}\n`;
      }
      if (r.truncated) {
        output += `\n... (truncated, showing first ${r.matches.length} of ${r.totalMatches} matches)`;
      }
      return output;
    }
    
    case 'LSRepo': {
      const r = toolResult.result as LSRepoResult;
      if (r.files.length === 0) {
        return 'No files found';
      }
      let output = `Files (${r.totalFiles} total):\n`;
      output += r.files.join('\n');
      if (r.truncated) {
        output += `\n... (truncated)`;
      }
      return output;
    }
    
    case 'ReadFile': {
      const r = toolResult.result as ReadFileResult;
      let output = `File: ${r.filePath}\n`;
      if (r.startLine && r.endLine) {
        output += `Lines ${r.startLine}-${r.endLine}:\n`;
      }
      output += '```\n' + r.content + '\n```';
      if (r.chunked) {
        output += `\n(${r.chunkReason})`;
      }
      return output;
    }
    
    case 'SearchRepo': {
      const r = toolResult.result as SearchRepoResult;
      return r.summary;
    }
    
    case 'SearchWeb': {
      const r = toolResult.result;
      if (!r.results || r.results.length === 0) {
        return `No web results found for "${r.query}"`;
      }
      let output = `Web search results for "${r.query}":\n\n`;
      for (const result of r.results) {
        output += `**${result.title}**\n${result.url}\n${result.snippet}\n\n`;
      }
      return output;
    }
    
    case 'FetchFromWeb': {
      const r = toolResult.result;
      if (r.error) {
        return `Failed to fetch ${r.url}: ${r.error}`;
      }
      let output = `Content from ${r.url}`;
      if (r.title) {
        output += ` (${r.title})`;
      }
      output += `:\n\n${r.content}`;
      return output;
    }
    
    case 'TodoManager': {
      const r = toolResult.result;
      let output = `${r.message}\n\nTasks:\n`;
      for (const task of r.tasks) {
        const icon = task.status === 'done' ? '✅' : task.status === 'in-progress' ? '🔄' : '⬜';
        output += `${icon} ${task.name}\n`;
      }
      return output;
    }
    
    case 'GetOrRequestIntegration': {
      const r = toolResult.result;
      let output = `${r.message}\n\nIntegrations:\n`;
      for (const integration of r.integrations) {
        const icon = integration.connected ? '✅' : '❌';
        output += `${icon} ${integration.name}`;
        if (integration.envVars) {
          output += ` (${integration.envVars.join(', ')})`;
        }
        output += '\n';
      }
      return output;
    }
    
    case 'GenerateDesignInspiration': {
      const r = toolResult.result;
      let output = `## Design Brief\n\n${r.brief}\n\n`;
      output += `### Color Palette\n${r.colorPalette.join(', ')}\n\n`;
      output += `### Typography\n${r.typography}\n\n`;
      output += `### Layout Suggestions\n`;
      for (const suggestion of r.layoutSuggestions) {
        output += `- ${suggestion}\n`;
      }
      return output;
    }
    
    default:
      return JSON.stringify(toolResult, null, 2);
  }
}

/**
 * Check if a file write is allowed (read-before-write enforcement)
 * 
 * Requirement 17.1: Require reading file before modifying
 */
export function canWriteFile(
  filePath: string,
  readTracker: ReadTracker,
  snapshotData: FileSnapshotData
): { allowed: boolean; reason?: string } {
  // New files don't need to be read first
  if (!snapshotData[filePath]) {
    return { allowed: true };
  }
  
  // Existing files must be read first
  if (!readTracker.hasRead(filePath)) {
    return {
      allowed: false,
      reason: `File "${filePath}" must be read before modifying. Use ReadFile or SearchRepo first.`,
    };
  }
  
  return { allowed: true };
}

/**
 * Create tool execution context from snapshot
 */
export function createToolContext(
  projectId: string,
  snapshotData: FileSnapshotData
): ToolExecutionContext {
  return {
    projectId,
    snapshot: snapshotData,
  };
}

/**
 * Get tool definitions for OpenAI/Claude API
 */
export function getToolDefinitions() {
  return TOOL_DEFINITIONS;
}

export default {
  createReadTracker,
  parseToolCalls,
  executeToolCall,
  executeToolCallsParallel,
  formatToolResultForLLM,
  canWriteFile,
  createToolContext,
  getToolDefinitions,
  TOOL_DEFINITIONS,
};
