/**
 * CodeBlockParser Service
 * 
 * Extracts file paths and content from LLM responses containing code blocks.
 * Supports the v0-style format: ```language file="path/to/file"
 * Also supports legacy format: ```language\nfilepath\ncontent
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

export interface ParsedFile {
  path: string;
  content: string;
  language: string;
}

export interface CodeBlockParserResult {
  files: ParsedFile[];
  errors: string[];
}

/**
 * Regex patterns for code block parsing
 * Note: Content is captured between the header line and the closing backticks
 */
const CODE_BLOCK_PATTERNS = {
  // v0-style: ```typescript file="src/App.tsx"\ncontent\n```
  // Captures content between the file attribute line and closing backticks
  V0_STYLE: /```(\w+)\s+file="([^"]+)"\n((?:(?!```)[\s\S])*)\n```/g,
  
  // Legacy style: ```typescript\nsrc/App.tsx\ncontent\n```
  LEGACY_STYLE: /```(\w+)\n([^\n]+)\n((?:(?!```)[\s\S])*)\n```/g,
  
  // Generic code block (for validation)
  GENERIC: /```(\w*)\n?([\s\S]*?)```/g
};

/**
 * Language to file extension mapping for validation
 */
const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py'],
  json: ['.json'],
  html: ['.html', '.htm'],
  css: ['.css'],
  scss: ['.scss', '.sass'],
  markdown: ['.md', '.mdx'],
  yaml: ['.yaml', '.yml'],
  sql: ['.sql'],
  shell: ['.sh', '.bash'],
  bash: ['.sh', '.bash'],
  rust: ['.rs'],
  go: ['.go'],
  java: ['.java'],
  kotlin: ['.kt', '.kts'],
  swift: ['.swift'],
  ruby: ['.rb'],
  php: ['.php'],
  csharp: ['.cs'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
  c: ['.c', '.h'],
  vue: ['.vue'],
  svelte: ['.svelte'],
  astro: ['.astro'],
  prisma: ['.prisma'],
  graphql: ['.graphql', '.gql'],
  dockerfile: ['Dockerfile', '.dockerfile'],
  toml: ['.toml'],
  xml: ['.xml'],
  text: ['.txt'],
  env: ['.env', '.env.local', '.env.development', '.env.production']
};

/**
 * Check if a string looks like a valid file path
 */
function isValidFilePath(str: string): boolean {
  // Must not be empty
  if (!str || str.trim().length === 0) {
    return false;
  }

  const trimmed = str.trim();

  // Must not contain newlines
  if (trimmed.includes('\n')) {
    return false;
  }

  // Must have a file extension or be a known extensionless file
  const knownExtensionlessFiles = ['Dockerfile', 'Makefile', '.gitignore', '.env'];
  const hasExtension = trimmed.includes('.') && !trimmed.endsWith('.');
  const isKnownFile = knownExtensionlessFiles.some(f => trimmed.endsWith(f));

  if (!hasExtension && !isKnownFile) {
    return false;
  }

  // Must not look like code (common code patterns)
  const codePatterns = [
    /^(import|export|const|let|var|function|class|interface|type|enum)\s/,
    /^(if|else|for|while|switch|try|catch)\s*\(/,
    /^(return|throw|await|async)\s/,
    /^\s*[{}[\]();]/,
    /^\/\//,  // Comments
    /^\/\*/,  // Block comments
    /^#\s/,   // Python comments or markdown headers
  ];

  for (const pattern of codePatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  // Path should be reasonable length
  if (trimmed.length > 256) {
    return false;
  }

  return true;
}

/**
 * Detect language from file extension
 */
function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.includes('.') 
    ? '.' + filePath.split('.').pop()?.toLowerCase()
    : filePath;

  for (const [lang, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (extensions.some(e => ext === e.toLowerCase() || filePath.endsWith(e))) {
      return lang;
    }
  }

  return 'text';
}

/**
 * Parse code blocks from LLM response using v0-style format.
 * Format: ```language file="path/to/file"
 */
function parseV0StyleBlocks(response: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const regex = new RegExp(CODE_BLOCK_PATTERNS.V0_STYLE.source, 'g');
  
  let match;
  while ((match = regex.exec(response)) !== null) {
    const [, language, filePath, content] = match;
    
    if (isValidFilePath(filePath)) {
      files.push({
        path: filePath.trim(),
        content: content,  // Preserve content exactly as-is
        language: language.toLowerCase() || detectLanguageFromPath(filePath)
      });
    }
  }

  return files;
}

/**
 * Parse code blocks from LLM response using legacy format.
 * Format: ```language\nfilepath\ncontent
 */
function parseLegacyStyleBlocks(response: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const regex = new RegExp(CODE_BLOCK_PATTERNS.LEGACY_STYLE.source, 'g');
  
  let match;
  while ((match = regex.exec(response)) !== null) {
    const [, language, firstLine, restContent] = match;
    
    // Check if first line looks like a file path
    if (isValidFilePath(firstLine)) {
      files.push({
        path: firstLine.trim(),
        content: restContent,  // Preserve content exactly as-is
        language: language.toLowerCase() || detectLanguageFromPath(firstLine)
      });
    }
  }

  return files;
}

/**
 * Main parser function that extracts code blocks from LLM response.
 * 
 * Requirements:
 * - 7.1: Parse code blocks to extract file paths and content
 * - 7.2: Support format ```language\nfilepath\ncontent```
 * - 7.3: Extract content and associate with file path
 * - 7.4: Parse all code blocks and collect all file changes
 * 
 * @param llmResponse - The raw LLM response text
 * @returns Object containing parsed files and any errors
 */
export function parseCodeBlocks(llmResponse: string): CodeBlockParserResult {
  const errors: string[] = [];
  const seenPaths = new Set<string>();
  const files: ParsedFile[] = [];

  // Try v0-style first (more specific)
  const v0Files = parseV0StyleBlocks(llmResponse);
  
  // Then try legacy style
  const legacyFiles = parseLegacyStyleBlocks(llmResponse);

  // Combine results, preferring v0-style for duplicates
  for (const file of v0Files) {
    if (!seenPaths.has(file.path)) {
      seenPaths.add(file.path);
      files.push(file);
    }
  }

  for (const file of legacyFiles) {
    if (!seenPaths.has(file.path)) {
      seenPaths.add(file.path);
      files.push(file);
    }
  }

  return { files, errors };
}

/**
 * Format parsed files back into code block format (for round-trip testing).
 * Uses v0-style format.
 */
export function formatCodeBlocks(files: ParsedFile[]): string {
  return files
    .map(file => `\`\`\`${file.language} file="${file.path}"\n${file.content}\n\`\`\``)
    .join('\n\n');
}

/**
 * Format parsed files using legacy format (for round-trip testing).
 */
export function formatCodeBlocksLegacy(files: ParsedFile[]): string {
  return files
    .map(file => `\`\`\`${file.language}\n${file.path}\n${file.content}\n\`\`\``)
    .join('\n\n');
}

/**
 * CodeBlockParser service interface
 */
export const codeBlockParser = {
  parse: parseCodeBlocks,
  format: formatCodeBlocks,
  formatLegacy: formatCodeBlocksLegacy,
  isValidFilePath,
  detectLanguageFromPath
};

export default codeBlockParser;
