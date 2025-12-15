/**
 * ToolExecutor Service
 * 
 * Executes AI tools for codebase exploration and file operations.
 * Works with file_snapshots to provide consistent view of project state.
 * 
 * Requirements: 15.7, 15.8, 15.9, 15.10, 15.11
 */

import { minimatch } from 'minimatch';
import type { FileSnapshotData } from '../types/database';

/**
 * Result of a grep search match
 */
export interface GrepMatch {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Result of GrepRepo tool execution
 */
export interface GrepRepoResult {
  matches: GrepMatch[];
  totalMatches: number;
  truncated: boolean;
  filesSearched: number;
}

/**
 * Result of LSRepo tool execution
 */
export interface LSRepoResult {
  files: string[];
  totalFiles: number;
  truncated: boolean;
}

/**
 * Result of ReadFile tool execution
 */
export interface ReadFileResult {
  content: string;
  filePath: string;
  lineCount: number;
  truncated: boolean;
  startLine?: number;
  endLine?: number;
  chunked?: boolean;
  chunkReason?: string;
}

/**
 * Result of SearchRepo tool execution
 */
export interface SearchRepoResult {
  summary: string;
  relevantFiles: Array<{
    path: string;
    relevance: string;
    snippet?: string;
  }>;
  totalFilesAnalyzed: number;
}


/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  snapshot: FileSnapshotData;
  projectId: string;
}

/**
 * Maximum results to return from searches
 */
const MAX_GREP_RESULTS = 200;
const MAX_LS_RESULTS = 200;
const LARGE_FILE_LINE_THRESHOLD = 2000;
const MAX_LINE_LENGTH = 2000;

/**
 * Execute GrepRepo tool - regex search on file_snapshots
 * 
 * Requirement 15.7: Search file_snapshots using regex and return matching lines with file paths
 * 
 * @param pattern - Regex pattern to search for
 * @param context - Tool execution context with snapshot
 * @param options - Optional glob pattern and path filter
 */
export function executeGrepRepo(
  pattern: string,
  context: ToolExecutionContext,
  options: { globPattern?: string; path?: string } = {}
): GrepRepoResult {
  const { snapshot } = context;
  const { globPattern, path: pathFilter } = options;
  
  const matches: GrepMatch[] = [];
  let filesSearched = 0;
  
  try {
    const regex = new RegExp(pattern, 'gi');
    
    for (const [filePath, fileData] of Object.entries(snapshot)) {
      // Apply path filter if provided
      if (pathFilter && !filePath.startsWith(pathFilter)) {
        continue;
      }
      
      // Apply glob pattern if provided
      if (globPattern && !minimatch(filePath, globPattern)) {
        continue;
      }
      
      filesSearched++;
      const content = fileData.content;
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineMatches = line.matchAll(regex);
        
        for (const match of lineMatches) {
          if (matches.length >= MAX_GREP_RESULTS) {
            return {
              matches,
              totalMatches: matches.length,
              truncated: true,
              filesSearched,
            };
          }
          
          // Truncate long lines
          const truncatedLine = line.length > MAX_LINE_LENGTH 
            ? line.substring(0, MAX_LINE_LENGTH) + '...[truncated]'
            : line;
          
          matches.push({
            filePath,
            lineNumber: i + 1,
            lineContent: truncatedLine,
            matchStart: match.index || 0,
            matchEnd: (match.index || 0) + match[0].length,
          });
        }
      }
    }
    
    return {
      matches,
      totalMatches: matches.length,
      truncated: false,
      filesSearched,
    };
  } catch (error) {
    // Invalid regex pattern
    console.error('[ToolExecutor] GrepRepo error:', error);
    return {
      matches: [],
      totalMatches: 0,
      truncated: false,
      filesSearched: 0,
    };
  }
}

/**
 * Execute LSRepo tool - list files from snapshot
 * 
 * Requirement 15.8: List files from file_snapshots with optional glob filtering
 * 
 * @param context - Tool execution context with snapshot
 * @param options - Optional path and glob pattern filters
 */
export function executeLSRepo(
  context: ToolExecutionContext,
  options: { path?: string; globPattern?: string } = {}
): LSRepoResult {
  const { snapshot } = context;
  const { path: pathFilter, globPattern } = options;
  
  let files = Object.keys(snapshot);
  
  // Apply path filter if provided
  if (pathFilter) {
    files = files.filter(f => f.startsWith(pathFilter));
  }
  
  // Apply glob pattern if provided
  if (globPattern) {
    files = files.filter(f => minimatch(f, globPattern));
  }
  
  // Sort alphabetically
  files.sort();
  
  // Truncate if too many results
  const truncated = files.length > MAX_LS_RESULTS;
  if (truncated) {
    files = files.slice(0, MAX_LS_RESULTS);
  }
  
  return {
    files,
    totalFiles: files.length,
    truncated,
  };
}


/**
 * Execute ReadFile tool - smart chunking for large files
 * 
 * Requirement 15.9: Return complete content for small files (≤2000 lines)
 * Requirement 15.10: Use AI-based chunking for large files (>2000 lines)
 * 
 * @param filePath - Path to the file to read
 * @param context - Tool execution context with snapshot
 * @param options - Optional query, startLine, endLine
 */
export function executeReadFile(
  filePath: string,
  context: ToolExecutionContext,
  options: { query?: string; startLine?: number; endLine?: number } = {}
): ReadFileResult {
  const { snapshot } = context;
  const { query, startLine, endLine } = options;
  
  const fileData = snapshot[filePath];
  
  if (!fileData) {
    return {
      content: `Error: File not found: ${filePath}`,
      filePath,
      lineCount: 0,
      truncated: false,
    };
  }
  
  const lines = fileData.content.split('\n');
  const totalLines = lines.length;
  
  // If specific line range requested, return that range
  if (startLine !== undefined || endLine !== undefined) {
    const start = Math.max(1, startLine || 1) - 1;
    const end = Math.min(totalLines, endLine || totalLines);
    const selectedLines = lines.slice(start, end);
    
    return {
      content: selectedLines.join('\n'),
      filePath,
      lineCount: selectedLines.length,
      truncated: false,
      startLine: start + 1,
      endLine: end,
    };
  }
  
  // Small files: return complete content
  if (totalLines <= LARGE_FILE_LINE_THRESHOLD) {
    return {
      content: fileData.content,
      filePath,
      lineCount: totalLines,
      truncated: false,
    };
  }
  
  // Large files: use smart chunking based on query
  if (query) {
    const chunks = findRelevantChunks(lines, query);
    return {
      content: chunks.content,
      filePath,
      lineCount: chunks.lineCount,
      truncated: true,
      chunked: true,
      chunkReason: `File has ${totalLines} lines. Showing ${chunks.lineCount} relevant lines based on query.`,
    };
  }
  
  // Large file without query: return first portion with warning
  const firstChunk = lines.slice(0, LARGE_FILE_LINE_THRESHOLD);
  return {
    content: firstChunk.join('\n') + '\n\n... [File truncated - use query parameter to find specific content]',
    filePath,
    lineCount: LARGE_FILE_LINE_THRESHOLD,
    truncated: true,
    chunked: true,
    chunkReason: `File has ${totalLines} lines. Showing first ${LARGE_FILE_LINE_THRESHOLD} lines. Use query parameter to find specific content.`,
  };
}

/**
 * Find relevant chunks in a large file based on query
 * Uses keyword matching and context extraction
 */
function findRelevantChunks(
  lines: string[],
  query: string
): { content: string; lineCount: number } {
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
  const relevantLineIndices = new Set<number>();
  const contextLines = 5; // Lines of context around matches
  
  // Find lines matching keywords
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    for (const keyword of keywords) {
      if (lineLower.includes(keyword)) {
        // Add this line and surrounding context
        for (let j = Math.max(0, i - contextLines); j <= Math.min(lines.length - 1, i + contextLines); j++) {
          relevantLineIndices.add(j);
        }
        break;
      }
    }
  }
  
  // If no matches, return first portion
  if (relevantLineIndices.size === 0) {
    const firstChunk = lines.slice(0, 500);
    return {
      content: firstChunk.join('\n') + '\n\n... [No matches found for query]',
      lineCount: 500,
    };
  }
  
  // Sort indices and group into contiguous chunks
  const sortedIndices = Array.from(relevantLineIndices).sort((a, b) => a - b);
  const chunks: string[] = [];
  let currentChunkStart = sortedIndices[0];
  let currentChunkEnd = sortedIndices[0];
  
  for (let i = 1; i < sortedIndices.length; i++) {
    if (sortedIndices[i] - currentChunkEnd <= 3) {
      // Extend current chunk
      currentChunkEnd = sortedIndices[i];
    } else {
      // Save current chunk and start new one
      chunks.push(`// Lines ${currentChunkStart + 1}-${currentChunkEnd + 1}:\n` + 
        lines.slice(currentChunkStart, currentChunkEnd + 1).join('\n'));
      currentChunkStart = sortedIndices[i];
      currentChunkEnd = sortedIndices[i];
    }
  }
  
  // Add final chunk
  chunks.push(`// Lines ${currentChunkStart + 1}-${currentChunkEnd + 1}:\n` + 
    lines.slice(currentChunkStart, currentChunkEnd + 1).join('\n'));
  
  const content = chunks.join('\n\n// ...\n\n');
  return {
    content,
    lineCount: relevantLineIndices.size,
  };
}


/**
 * Execute SearchRepo tool - combined search strategies
 * 
 * Requirement 15.11: Spawn a sub-process to explore codebase and return contextual results
 * 
 * @param query - Search query describing what to find
 * @param context - Tool execution context with snapshot
 * @param options - Optional goal for context
 */
export function executeSearchRepo(
  query: string,
  context: ToolExecutionContext,
  options: { goal?: string } = {}
): SearchRepoResult {
  const { snapshot } = context;
  const { goal } = options;
  
  const relevantFiles: SearchRepoResult['relevantFiles'] = [];
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);
  
  // Special case: overview query
  if (queryLower.includes('overview') || queryLower.includes('codebase')) {
    return generateCodebaseOverview(snapshot);
  }
  
  // Search for relevant files
  for (const [filePath, fileData] of Object.entries(snapshot)) {
    const contentLower = fileData.content.toLowerCase();
    const pathLower = filePath.toLowerCase();
    
    // Calculate relevance score
    let relevanceScore = 0;
    const matchedKeywords: string[] = [];
    
    for (const keyword of keywords) {
      if (pathLower.includes(keyword)) {
        relevanceScore += 3; // Path matches are highly relevant
        matchedKeywords.push(keyword);
      }
      if (contentLower.includes(keyword)) {
        relevanceScore += 1;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }
    
    if (relevanceScore > 0) {
      // Extract a relevant snippet
      const snippet = extractRelevantSnippet(fileData.content, keywords);
      
      relevantFiles.push({
        path: filePath,
        relevance: `Matched: ${matchedKeywords.join(', ')}`,
        snippet,
      });
    }
  }
  
  // Sort by relevance (files with more keyword matches first)
  relevantFiles.sort((a, b) => {
    const aMatches = (a.relevance.match(/,/g) || []).length + 1;
    const bMatches = (b.relevance.match(/,/g) || []).length + 1;
    return bMatches - aMatches;
  });
  
  // Limit results
  const limitedFiles = relevantFiles.slice(0, 20);
  
  // Generate summary
  const summary = generateSearchSummary(query, limitedFiles, goal);
  
  return {
    summary,
    relevantFiles: limitedFiles,
    totalFilesAnalyzed: Object.keys(snapshot).length,
  };
}

/**
 * Extract a relevant snippet from file content based on keywords
 */
function extractRelevantSnippet(content: string, keywords: string[]): string {
  const lines = content.split('\n');
  
  // Find the first line containing a keyword
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    for (const keyword of keywords) {
      if (lineLower.includes(keyword)) {
        // Return this line and a few surrounding lines
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 3);
        const snippet = lines.slice(start, end).join('\n');
        return snippet.length > 200 ? snippet.substring(0, 200) + '...' : snippet;
      }
    }
  }
  
  // No keyword match, return first few lines
  const firstLines = lines.slice(0, 3).join('\n');
  return firstLines.length > 200 ? firstLines.substring(0, 200) + '...' : firstLines;
}

/**
 * Generate a codebase overview
 */
function generateCodebaseOverview(snapshot: FileSnapshotData): SearchRepoResult {
  const files = Object.keys(snapshot);
  const filesByDir: Record<string, string[]> = {};
  
  // Group files by directory
  for (const file of files) {
    const parts = file.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
    if (!filesByDir[dir]) {
      filesByDir[dir] = [];
    }
    filesByDir[dir].push(parts[parts.length - 1]);
  }
  
  // Identify key files
  const keyFiles: SearchRepoResult['relevantFiles'] = [];
  const keyFilePatterns = [
    { pattern: /package\.json$/, relevance: 'Project configuration' },
    { pattern: /tsconfig\.json$/, relevance: 'TypeScript configuration' },
    { pattern: /next\.config\.(js|mjs|ts)$/, relevance: 'Next.js configuration' },
    { pattern: /app\/layout\.(tsx|jsx)$/, relevance: 'Root layout' },
    { pattern: /app\/page\.(tsx|jsx)$/, relevance: 'Home page' },
    { pattern: /README\.md$/i, relevance: 'Documentation' },
  ];
  
  for (const file of files) {
    for (const { pattern, relevance } of keyFilePatterns) {
      if (pattern.test(file)) {
        keyFiles.push({ path: file, relevance });
        break;
      }
    }
  }
  
  // Generate summary
  const dirs = Object.keys(filesByDir).sort();
  const summary = `
## Codebase Overview

**Total Files:** ${files.length}
**Directories:** ${dirs.length}

### Directory Structure:
${dirs.slice(0, 15).map(d => `- ${d}/ (${filesByDir[d].length} files)`).join('\n')}
${dirs.length > 15 ? `\n... and ${dirs.length - 15} more directories` : ''}

### Key Files:
${keyFiles.map(f => `- ${f.path}: ${f.relevance}`).join('\n')}
`.trim();
  
  return {
    summary,
    relevantFiles: keyFiles,
    totalFilesAnalyzed: files.length,
  };
}

/**
 * Generate a search summary
 */
function generateSearchSummary(
  query: string,
  files: SearchRepoResult['relevantFiles'],
  goal?: string
): string {
  if (files.length === 0) {
    return `No files found matching "${query}". Try different keywords or use LSRepo to explore the file structure.`;
  }
  
  let summary = `Found ${files.length} relevant file(s) for "${query}":\n\n`;
  
  for (const file of files.slice(0, 10)) {
    summary += `- **${file.path}**: ${file.relevance}\n`;
    if (file.snippet) {
      summary += `  \`\`\`\n  ${file.snippet.split('\n').join('\n  ')}\n  \`\`\`\n`;
    }
  }
  
  if (files.length > 10) {
    summary += `\n... and ${files.length - 10} more files`;
  }
  
  if (goal) {
    summary += `\n\n**Goal:** ${goal}`;
  }
  
  return summary;
}

/**
 * Result types for new tools
 */
export interface SearchWebResult {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  query: string;
}

export interface FetchFromWebResult {
  content: string;
  url: string;
  title?: string;
  error?: string;
}

export interface TodoManagerResult {
  action: string;
  tasks: Array<{
    name: string;
    status: 'todo' | 'in-progress' | 'done';
  }>;
  message: string;
}

export interface GetIntegrationResult {
  integrations: Array<{
    name: string;
    connected: boolean;
    envVars?: string[];
    schema?: string;
  }>;
  message: string;
}

export interface DesignInspirationResult {
  brief: string;
  colorPalette: string[];
  typography: string;
  layoutSuggestions: string[];
}

/**
 * Tool execution result type
 */
export type ToolResult = 
  | { tool: 'GrepRepo'; result: GrepRepoResult }
  | { tool: 'LSRepo'; result: LSRepoResult }
  | { tool: 'ReadFile'; result: ReadFileResult }
  | { tool: 'SearchRepo'; result: SearchRepoResult }
  | { tool: 'SearchWeb'; result: SearchWebResult }
  | { tool: 'FetchFromWeb'; result: FetchFromWebResult }
  | { tool: 'TodoManager'; result: TodoManagerResult }
  | { tool: 'GetOrRequestIntegration'; result: GetIntegrationResult }
  | { tool: 'GenerateDesignInspiration'; result: DesignInspirationResult };

/**
 * Execute SearchWeb tool - web search (placeholder - needs external API)
 */
function executeSearchWeb(
  query: string,
  _options: { isFirstParty?: boolean } = {}
): SearchWebResult {
  // TODO: Implement actual web search using Tavily, Serper, or similar API
  // For now, return a placeholder that indicates the tool needs implementation
  return {
    results: [
      {
        title: 'Web Search Not Implemented',
        url: 'https://docs.example.com',
        snippet: `Search for "${query}" requires external API integration. Configure TAVILY_API_KEY or SERPER_API_KEY to enable web search.`,
      },
    ],
    query,
  };
}

/**
 * Execute FetchFromWeb tool - fetch URL content (placeholder - needs implementation)
 */
function executeFetchFromWeb(
  urls: string[]
): FetchFromWebResult {
  // TODO: Implement actual URL fetching with content extraction
  return {
    content: `URL fetching not implemented. Requested URLs: ${urls.join(', ')}. Configure web fetching service to enable this feature.`,
    url: urls[0] || '',
    error: 'Not implemented',
  };
}

/**
 * Execute TodoManager tool - task management
 */
function executeTodoManager(
  action: string,
  parameters: Record<string, unknown>,
  context: ToolExecutionContext
): TodoManagerResult {
  // Simple in-memory task management (in production, this would persist to database)
  const projectTasks = (context as unknown as { tasks?: TodoManagerResult['tasks'] }).tasks || [];
  
  switch (action) {
    case 'set_tasks': {
      const taskNames = parameters.tasks as string[] || [];
      const tasks = taskNames.map((name, index) => ({
        name,
        status: index === 0 ? 'in-progress' as const : 'todo' as const,
      }));
      return {
        action: 'set_tasks',
        tasks,
        message: `Created ${tasks.length} tasks. Starting with: ${tasks[0]?.name || 'none'}`,
      };
    }
    
    case 'move_to_task': {
      const targetTask = parameters.moveToTask as string;
      const tasks = projectTasks.map(t => ({
        ...t,
        status: t.name === targetTask ? 'in-progress' as const : 
                projectTasks.findIndex(pt => pt.name === t.name) < projectTasks.findIndex(pt => pt.name === targetTask) 
                  ? 'done' as const : t.status,
      }));
      return {
        action: 'move_to_task',
        tasks,
        message: `Now working on: ${targetTask}`,
      };
    }
    
    case 'add_task': {
      const newTask = parameters.task as string;
      return {
        action: 'add_task',
        tasks: [...projectTasks, { name: newTask, status: 'todo' as const }],
        message: `Added task: ${newTask}`,
      };
    }
    
    case 'read_list':
      return {
        action: 'read_list',
        tasks: projectTasks,
        message: `${projectTasks.length} tasks in list`,
      };
    
    case 'mark_all_done':
      return {
        action: 'mark_all_done',
        tasks: projectTasks.map(t => ({ ...t, status: 'done' as const })),
        message: 'All tasks marked as done',
      };
    
    default:
      return {
        action,
        tasks: projectTasks,
        message: `Unknown action: ${action}`,
      };
  }
}

/**
 * Execute GetOrRequestIntegration tool - check integration status
 */
function executeGetOrRequestIntegration(
  names?: string[]
): GetIntegrationResult {
  // Check environment variables to determine integration status
  const integrations = [
    {
      name: 'Supabase',
      envVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      connected: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    {
      name: 'Neon',
      envVars: ['DATABASE_URL'],
      connected: !!process.env.DATABASE_URL?.includes('neon'),
    },
    {
      name: 'Stripe',
      envVars: ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
      connected: !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    },
    {
      name: 'Upstash',
      envVars: ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
      connected: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
    },
    {
      name: 'Vercel AI Gateway',
      envVars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
      connected: !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
    },
  ];
  
  const filtered = names && names.length > 0
    ? integrations.filter(i => names.includes(i.name))
    : integrations;
  
  const connected = filtered.filter(i => i.connected);
  const missing = filtered.filter(i => !i.connected);
  
  return {
    integrations: filtered,
    message: missing.length > 0
      ? `Missing integrations: ${missing.map(i => i.name).join(', ')}. Please configure the required environment variables.`
      : `All requested integrations are connected: ${connected.map(i => i.name).join(', ')}`,
  };
}

/**
 * Execute GenerateDesignInspiration tool - generate design brief
 */
function executeGenerateDesignInspiration(
  goal: string,
  context?: string
): DesignInspirationResult {
  // Generate a design brief based on the goal
  // In production, this could use AI to generate more sophisticated briefs
  
  const colorPalettes: Record<string, string[]> = {
    modern: ['#0F172A', '#1E293B', '#3B82F6', '#60A5FA', '#F8FAFC'],
    warm: ['#1C1917', '#44403C', '#F59E0B', '#FBBF24', '#FFFBEB'],
    cool: ['#0C4A6E', '#0369A1', '#06B6D4', '#67E8F9', '#ECFEFF'],
    minimal: ['#18181B', '#3F3F46', '#71717A', '#D4D4D8', '#FAFAFA'],
    vibrant: ['#1E1B4B', '#4338CA', '#8B5CF6', '#C4B5FD', '#F5F3FF'],
  };
  
  const goalLower = goal.toLowerCase();
  let palette = colorPalettes.modern;
  let typography = 'Inter for body, Inter for headings';
  
  if (goalLower.includes('saas') || goalLower.includes('dashboard')) {
    palette = colorPalettes.modern;
    typography = 'Inter for body, Inter for headings - clean and professional';
  } else if (goalLower.includes('ecommerce') || goalLower.includes('shop')) {
    palette = colorPalettes.warm;
    typography = 'DM Sans for body, Playfair Display for headings - elegant and trustworthy';
  } else if (goalLower.includes('portfolio') || goalLower.includes('creative')) {
    palette = colorPalettes.vibrant;
    typography = 'Space Grotesk for body, Space Grotesk for headings - creative and bold';
  } else if (goalLower.includes('minimal') || goalLower.includes('simple')) {
    palette = colorPalettes.minimal;
    typography = 'System UI for body, System UI for headings - fast and clean';
  }
  
  return {
    brief: `Design brief for: ${goal}\n\n${context ? `Context: ${context}\n\n` : ''}Focus on clean, modern aesthetics with clear visual hierarchy. Prioritize readability and user experience.`,
    colorPalette: palette,
    typography,
    layoutSuggestions: [
      'Use consistent spacing with Tailwind scale (p-4, p-6, p-8)',
      'Implement mobile-first responsive design',
      'Use semantic HTML elements for accessibility',
      'Add subtle hover states and transitions',
      'Ensure sufficient color contrast for readability',
    ],
  };
}

/**
 * Execute a tool by name with parameters
 */
export function executeTool(
  toolName: string,
  parameters: Record<string, unknown>,
  context: ToolExecutionContext
): ToolResult | { tool: string; error: string } {
  switch (toolName) {
    case 'GrepRepo':
      return {
        tool: 'GrepRepo',
        result: executeGrepRepo(
          parameters.pattern as string,
          context,
          {
            globPattern: parameters.globPattern as string | undefined,
            path: parameters.path as string | undefined,
          }
        ),
      };
    
    case 'LSRepo':
      return {
        tool: 'LSRepo',
        result: executeLSRepo(context, {
          path: parameters.path as string | undefined,
          globPattern: parameters.globPattern as string | undefined,
        }),
      };
    
    case 'ReadFile':
      return {
        tool: 'ReadFile',
        result: executeReadFile(
          parameters.filePath as string,
          context,
          {
            query: parameters.query as string | undefined,
            startLine: parameters.startLine as number | undefined,
            endLine: parameters.endLine as number | undefined,
          }
        ),
      };
    
    case 'SearchRepo':
      return {
        tool: 'SearchRepo',
        result: executeSearchRepo(
          parameters.query as string,
          context,
          {
            goal: parameters.goal as string | undefined,
          }
        ),
      };
    
    case 'SearchWeb':
      return {
        tool: 'SearchWeb',
        result: executeSearchWeb(
          parameters.query as string,
          {
            isFirstParty: parameters.isFirstParty as boolean | undefined,
          }
        ),
      };
    
    case 'FetchFromWeb':
      return {
        tool: 'FetchFromWeb',
        result: executeFetchFromWeb(
          parameters.urls as string[]
        ),
      };
    
    case 'TodoManager':
      return {
        tool: 'TodoManager',
        result: executeTodoManager(
          parameters.action as string,
          parameters,
          context
        ),
      };
    
    case 'GetOrRequestIntegration':
      return {
        tool: 'GetOrRequestIntegration',
        result: executeGetOrRequestIntegration(
          parameters.names as string[] | undefined
        ),
      };
    
    case 'GenerateDesignInspiration':
      return {
        tool: 'GenerateDesignInspiration',
        result: executeGenerateDesignInspiration(
          parameters.goal as string,
          parameters.context as string | undefined
        ),
      };
    
    default:
      return {
        tool: toolName,
        error: `Unknown tool: ${toolName}`,
      };
  }
}
