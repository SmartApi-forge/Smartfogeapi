"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Folder, 
  FolderOpen,
  FolderClosed,
  FileCode,
  File,
  FileCode2,
  FileText,
  Braces,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft, 
  MessageSquare, 
  User, 
  Bot,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Loader2,
  Copy,
  Download,
  Check,
  ArrowUp,
  Paperclip,
  SlidersHorizontal,
  Eye,
  Code2,
  Monitor,
  RefreshCw,
  ExternalLink,
  RotateCw,
  MoreVertical,
  Maximize,
  X
} from "lucide-react";
import { SimpleHeader } from "@/components/simple-header";
import { Highlight, themes } from "prism-react-renderer";
import { useTheme } from "next-themes";
import { api } from "@/lib/trpc-client";
import { useGenerationStream } from "../../../hooks/use-generation-stream";
import { StreamingCodeViewer } from "../../../components/streaming-code-viewer";
import { GenerationProgressTracker } from "../../../components/generation-progress-tracker";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { VersionCard } from "@/components/version-card";
import { SandboxPreview } from "@/components/sandbox-preview";
import JSZip from "jszip";

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'image' | 'file' | 'code' | 'result' | 'error';
  created_at: string;
  updated_at: string;
  sender_id?: string;
  receiver_id?: string;
  project_id?: string;
  fragments?: Fragment[];
}

interface Fragment {
  id: string;
  message_id: string;
  sandbox_url: string;
  title: string;
  content: string;
  order_index: number;
  files: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  framework: 'fastapi' | 'express' | 'python' | 'nextjs' | 'react' | 'vue' | 'angular' | 'flask' | 'django' | 'unknown';
  status: 'pending' | 'generating' | 'testing' | 'deploying' | 'deployed' | 'failed';
  created_at: string;
  updated_at: string;
  deploy_url?: string;
  swagger_url?: string;
  openapi_spec?: any;
  code_url?: string;
  prompt?: string;
  advanced?: boolean;
  sandbox_url?: string;
}

interface ProjectPageClientProps {
  projectId: string;
  initialMessages: Message[];
  project: Project;
}

interface TreeNode {
  id: string;
  name: string;
  type: "folder" | "file";
  content?: string;
  language?: string;
  children?: TreeNode[];
}

function getStatusIcon(status: Project['status']) {
  switch (status) {
    case 'generating':
      return <Loader2 className="size-4 animate-spin text-blue-400" />;
    case 'deployed':
      return <CheckCircle className="size-4 text-green-400" />;
    case 'failed':
      return <XCircle className="size-4 text-red-400" />;
    default:
      return <Clock className="size-4 text-yellow-400" />;
  }
}

function getStatusColor(status: Project['status']) {
  switch (status) {
    case 'generating':
      return 'text-blue-400';
    case 'deployed':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
    default:
      return 'text-yellow-400';
  }
}

// Helper function to sort tree nodes: folders first, then files (VS Code style)
function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    // Folders come before files
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    
    // Within same type, sort alphabetically (case-insensitive)
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

function generateFileTreeFromProject(project: Project, messages: Message[] = [], streamingFiles: any[] = []): TreeNode[] {
  // Check if we have any generated files from messages OR streaming
  const hasGeneratedFiles = messages.some(
    (message) => message.fragments && message.fragments.length > 0
  ) || streamingFiles.length > 0;

  // Don't show placeholder if project is still generating/cloning
  const isStillProcessing = project.status === 'generating' || project.status === 'pending';
  
  // Only show placeholder files if:
  // 1. We don't have any real generated files AND
  // 2. Project is completed (not still generating)
  const shouldShowPlaceholder = !hasGeneratedFiles && !isStillProcessing;
  
  const baseStructure: TreeNode[] = shouldShowPlaceholder ? [
    {
      id: "placeholder-info",
      name: "README.md",
      type: "file",
      language: "markdown",
      content: `# ${project.name}

${project.description || 'No description provided'}

## Status
Waiting for files to be generated or cloned...

## Next Steps
- If this is a new project, enter a prompt to generate code
- If this is a GitHub repository, files should appear after cloning completes
`
    }
  ] : [];

  // Add generated files from messages
  messages.forEach((message) => {
    if (message.fragments && message.fragments.length > 0) {
      message.fragments.forEach((fragment) => {
        if (fragment.files && typeof fragment.files === 'object') {
          Object.entries(fragment.files).forEach(([filename, fileContent]) => {
            const pathParts = filename.split('/');
            let currentLevel = baseStructure;
            
            for (let i = 0; i < pathParts.length; i++) {
              const part = pathParts[i];
              const isFile = i === pathParts.length - 1;
              
              let existingNode = currentLevel.find(node => node.name === part);
              
              if (!existingNode) {
                const newNode: TreeNode = {
                  id: pathParts.slice(0, i + 1).join('/'),
                  name: part,
                  type: isFile ? "file" : "folder",
                  children: isFile ? undefined : []
                };
                
                if (isFile) {
                  newNode.content = typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent, null, 2);
                  newNode.language = getLanguageFromFilename(filename);
                }
                
                currentLevel.push(newNode);
                existingNode = newNode;
              }
              
              if (!isFile && existingNode.children) {
                currentLevel = existingNode.children;
              }
            }
          });
        }
      });
    }
  });

  // Sort all levels recursively (folders first, then files)
  const sortRecursive = (nodes: TreeNode[]) => {
    sortTreeNodes(nodes);
    nodes.forEach(node => {
      if (node.children) {
        sortRecursive(node.children);
      }
    });
  };
  
  sortRecursive(baseStructure);
  return baseStructure;
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'py': 'python',
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'tsx',
    'jsx': 'jsx',
    'json': 'json',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'txt': 'text',
    'sh': 'bash',
    'dockerfile': 'dockerfile'
  };
  return languageMap[ext || ''] || 'text';
}

// Helper function to build proper folder tree from flat file paths
function buildTreeFromPaths(files: Record<string, any>): TreeNode[] {
  const root: TreeNode[] = [];
  
  Object.entries(files).forEach(([filepath, content]) => {
    const pathParts = filepath.split('/');
    let currentLevel = root;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isFile = i === pathParts.length - 1;
      
      let existingNode = currentLevel.find(node => node.name === part);
      
      if (!existingNode) {
        const newNode: TreeNode = {
          id: pathParts.slice(0, i + 1).join('/'),
          name: part,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : []
        };
        
        if (isFile) {
          newNode.content = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
          newNode.language = getLanguageFromFilename(filepath);
        }
        
        currentLevel.push(newNode);
        existingNode = newNode;
      }
      
      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  });
  
  // Sort recursively: folders first, then files
  const sortRecursive = (nodes: TreeNode[]) => {
    sortTreeNodes(nodes);
    nodes.forEach(node => {
      if (node.children) {
        sortRecursive(node.children);
      }
    });
  };
  
  sortRecursive(root);
  return root;
}

function getFileIcon(name: string) {
  const iconClass = "size-3.5 sm:size-4 flex-shrink-0";
  
  // If no extension, it's a folder (use FolderClosed)
  if (!name.includes('.')) {
    return <FolderClosed className={`${iconClass} text-yellow-500 dark:text-yellow-400`} />;
  }
  
  // All files use the same generic File icon
  return <File className={`${iconClass} text-gray-500 dark:text-gray-400`} />;
}

function TreeItem({ 
  node, 
  depth = 0, 
  expanded, 
  toggle, 
  select, 
  selectedId 
}: {
  node: TreeNode;
  depth?: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  select: (id: string) => void;
  selectedId?: string | null;
}) {
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-2 sm:py-1 cursor-pointer hover:bg-muted/50 transition-colors rounded-md ${
          isSelected ? 'bg-[#E6E6E6] dark:bg-[#333433] text-foreground' : 'text-foreground'
        }`}
        style={{ paddingLeft: `${depth * 8 + 6}px` }}
        onClick={() => {
          if (node.type === "folder") {
            toggle(node.id);
          } else {
            select(node.id);
          }
        }}
      >
        {node.type === "folder" && (
          <ChevronRight 
            className={`size-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
          />
        )}
        {node.type === "folder" ? (
          isExpanded ? <FolderOpen className="size-3.5 sm:size-4 flex-shrink-0" style={{ color: '#8AADF4' }} /> : <FolderClosed className="size-3.5 sm:size-4 flex-shrink-0" style={{ color: '#8AADF4' }} />
        ) : (
          <span className="flex-shrink-0">{getFileIcon(node.name)}</span>
        )}
        <span className="truncate min-w-0 font-sans text-[14px] font-normal">{node.name}</span>
      </div>
      
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              select={select}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CodeViewer({ 
  filename, 
  fileTree,
  codeTheme,
}: { 
  filename: string | null;
  fileTree: TreeNode[];
  codeTheme: any;
}) {
  const [copySuccess, setCopySuccess] = useState(false);

  const selectedFile = useMemo(() => {
    const findFile = (nodes: TreeNode[], id: string): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findFile(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    return filename ? findFile(fileTree, filename) : null;
  }, [filename, fileTree]);

  const handleCopyCode = async () => {
    if (!selectedFile?.content) return;
    
    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleDownload = () => {
    if (!selectedFile?.content || !selectedFile?.name) return;

    const blob = new Blob([selectedFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!selectedFile || selectedFile.type === 'folder') {
    return (
        <div className="h-full flex items-center justify-center text-muted-foreground bg-white dark:bg-[#1D1D1D] p-4">
        <div className="text-center">
          <FileCode className="size-10 sm:size-12 mx-auto mb-3 sm:mb-4 opacity-50" />
          <p className="text-sm sm:text-base">Select a file to view its contents</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Code viewer header - sticky and always visible with clear filename - NO bottom border for unified look */}
      <div className="sticky top-0 z-10 h-12 sm:h-10 px-2 sm:px-3 flex items-center justify-between gap-3 text-xs text-foreground bg-white dark:bg-[#1D1D1D] backdrop-blur-sm flex-shrink-0">
        {/* Filename section with FULL PATH - responsive spacing */}
        <div className="flex items-center gap-4 sm:gap-5 lg:gap-2.5 min-w-0 flex-1 overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6">
            {getFileIcon(selectedFile.name)}
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 py-1">
            {/* Show full file path instead of just name - use GeistSans */}
            <span className="font-sans font-medium truncate text-[12px] sm:text-[13px] text-foreground">{filename || selectedFile.name}</span>
            <span className="font-sans text-muted-foreground flex-shrink-0 hidden md:inline text-[10px] sm:text-[11px] whitespace-nowrap opacity-70">
              • {selectedFile.language || 'text'}
            </span>
          </div>
        </div>
        
        {/* Action buttons - ALWAYS visible on ALL screen sizes */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            onClick={handleCopyCode}
            className="flex items-center justify-center gap-1 px-2 py-2 sm:py-1.5 rounded text-xs hover:bg-muted dark:hover:bg-[#262726] active:bg-muted/70 dark:active:bg-[#262726]/70 transition-colors focus:outline-none focus:ring-1 focus:ring-primary w-8 h-8 sm:w-auto sm:h-auto"
            title="Copy code to clipboard"
            aria-label="Copy code"
          >
            {copySuccess ? (
              <>
                <Check className="size-4 sm:size-3.5 text-emerald-500 flex-shrink-0" />
                <span className="text-emerald-500 hidden lg:inline text-[11px] whitespace-nowrap">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-4 sm:size-3.5 flex-shrink-0" />
                <span className="hidden lg:inline text-[11px] whitespace-nowrap">Copy</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-1 px-2 py-2 sm:py-1.5 rounded text-xs hover:bg-muted dark:hover:bg-[#262726] active:bg-muted/70 dark:active:bg-[#262726]/70 transition-colors focus:outline-none focus:ring-1 focus:ring-primary w-8 h-8 sm:w-auto sm:h-auto"
            title="Download file"
            aria-label="Download file"
          >
            <Download className="size-4 sm:size-3.5 flex-shrink-0" />
            <span className="hidden lg:inline text-[11px] whitespace-nowrap">Download</span>
          </button>
        </div>
      </div>

            {/* Code display container - proper overflow handling for mobile/tablet */}
            <div 
              className="flex-1 overflow-y-auto overflow-x-auto md:overflow-x-hidden scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent bg-white dark:bg-[#1D1D1D] overscroll-contain" 
              style={{ 
                minHeight: 0,
                scrollBehavior: 'smooth',
                width: '100%',
                WebkitOverflowScrolling: 'touch'
              }}
            >
        <div>
          <Highlight
            theme={codeTheme}
            code={selectedFile.content || '// No content available'}
            language={selectedFile.language || 'text'}
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre 
                className={`${className} font-mono p-2 sm:p-3 overflow-x-visible md:overflow-x-auto`} 
                style={{
                  ...style,
                  margin: 0,
                  background: 'transparent',
                  fontSize: '13px',
                  lineHeight: '20px',
                  fontWeight: '400',
                  maxWidth: '100%',
                }}
              >
                {tokens.map((line, i) => (
                  <div 
                    key={i} 
                    {...getLineProps({ line })}
                    className="flex hover:bg-muted/20 transition-colors"
                    style={{ minHeight: '1.25rem' }}
                  >
                    <span 
                      className="inline-block w-7 sm:w-10 text-right mr-1.5 sm:mr-3 text-muted-foreground/50 select-none flex-shrink-0 font-mono"
                      style={{ fontSize: '13px', lineHeight: '20px' }}
                    >
                      {i + 1}
                    </span>
                    <span 
                      className="flex-1 min-w-0 md:whitespace-pre md:break-normal" 
                      style={{
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        whiteSpace: 'pre-wrap',
                        maxWidth: '100%',
                      }}
                    >
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      </div>
    </div>
  );
}

export function ProjectPageClient({ 
  projectId, 
  initialMessages, 
  project 
}: ProjectPageClientProps) {
  const { theme, resolvedTheme } = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["src"]));
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileExplorerOpen, setIsMobileExplorerOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'chat' | 'code'>('chat');
  const [isChatPanelCollapsed, setIsChatPanelCollapsed] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    // Check if we're on the client side and detect mobile on initial render
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640; // sm breakpoint
    }
    return false;
  });
  
  // For cloned GitHub projects (repo_url or github_mode), default to preview
  // For generated projects (text prompts), default to code view
  const isClonedProject = ('repo_url' in project && project.repo_url) || ('github_mode' in project && project.github_mode);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>(() => {
    // Use initializer function to ensure it only runs once
    return isClonedProject ? 'preview' : 'code';
  });
  
  const [previewPath, setPreviewPath] = useState('/');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const versionDropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 640); // sm breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setIsVersionDropdownOpen(false);
      }
    };

    if (isMenuOpen || isVersionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen, isVersionDropdownOpen]);

  // Use streaming hook for real-time updates
  const streamState = useGenerationStream(projectId);
  
  // Track when stream completed to limit refetch duration
  const [completionTime, setCompletionTime] = useState<number | null>(null);
  const hasAutoSwitched = useRef(false);
  
  // Update completion time when stream completes
  useEffect(() => {
    if (streamState.status === 'complete' && !streamState.isStreaming && !completionTime) {
      setCompletionTime(Date.now());
    }
  }, [streamState.status, streamState.isStreaming, completionTime]);
  
  // Calculate if we should still be refetching (within 15 seconds of completion)
  const shouldRefetch = completionTime ? (Date.now() - completionTime < 15000) : false;
  
  // Fetch project data with auto-refresh to get updated status
  const { data: currentProject = project, refetch: refetchProject } = api.projects.getOne.useQuery(
    { id: projectId },
    {
      initialData: project as any,
      refetchOnWindowFocus: true,
      // Poll every 5 seconds when streaming, then continue for 15 seconds after to catch DB updates
      refetchInterval: streamState.isStreaming ? 5000 : 
        (shouldRefetch ? 3000 : false),
      // CRITICAL: Keep staleTime at 0 during refetch window to allow manual refetch() calls to fetch fresh data
      staleTime: (streamState.isStreaming || shouldRefetch) ? 0 : 5000,
    }
  );
  
  // Determine code theme based on current theme
  const codeTheme = resolvedTheme === 'dark' ? themes.vsDark : themes.vsLight;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = Math.max(newHeight, 32) + 'px';
    }
  }, [input]);

  const { data: messages = initialMessages, refetch } = api.messages.getMany.useQuery(
    {
      projectId,
      limit: 100,
      includeFragment: true,
    },
    {
      initialData: initialMessages as any,
      refetchOnWindowFocus: true,
      // Reduce polling frequency when streaming is active - increase poll rate for faster updates
      refetchInterval: streamState.isStreaming ? 15000 : 5000,
    }
  );

  // Fetch persisted generation events from database
  const { data: generationEvents = [] } = api.generationEvents.getMany.useQuery(
    {
      projectId,
      limit: 100,
    },
    {
      refetchOnWindowFocus: true,
      refetchInterval: 10000,
    }
  );

  // Mutations
  const createMessage = api.messages.create.useMutation();
  const classifyCommand = api.apiGeneration.classify.useMutation();
  const triggerIteration = api.apiGeneration.triggerIteration.useMutation();

  // Fetch versions
  const { data: versions = [], refetch: refetchVersions } = api.versions.getMany.useQuery(
    { projectId, limit: 50 },
    { 
      refetchInterval: streamState.isStreaming ? false : 2000, // Poll every 2s when not streaming
      refetchOnWindowFocus: true,
    }
  );

  // Refetch versions and messages when streaming completes to get the newly created version
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !streamState.isStreaming && streamState.status === 'complete') {
      console.log('Streaming completed, refetching versions and messages...');
      // Refetch immediately, then again after 500ms and 1500ms to catch delayed DB writes
      refetchVersions();
      refetch(); // Refetch messages to get updated version_id links
      setTimeout(() => {
        refetchVersions();
        refetch();
      }, 500);
      setTimeout(() => {
        refetchVersions();
        refetch();
      }, 1500);
    }
    wasStreaming.current = streamState.isStreaming;
  }, [streamState.isStreaming, streamState.status, refetchVersions, refetch]);

  // State for selected version - MUST be declared before useMemos that use it
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Auto-select latest version or streaming version
  const previousVersionsLength = useRef(0);
  
  useEffect(() => {
    // Priority 1: If actively streaming a version, always switch to it
    if (streamState.currentVersionId && streamState.isStreaming) {
      setSelectedVersionId(streamState.currentVersionId);
      return;
    }
    
    // Priority 2: Auto-switch to latest when versions list changes (new version created)
    if (versions.length > 0) {
      // Only consider completed versions for auto-selection
      const completedVersions = versions.filter(v => v.status === 'complete');
      
      if (completedVersions.length > 0) {
        const latest = completedVersions.reduce((max, v) => 
          v.version_number > max.version_number ? v : max
        );
        
        // Auto-switch to latest version if:
        // 1. No version selected yet, OR
        // 2. A new version was just created (length increased), OR  
        // 3. Current selection doesn't exist anymore
        const newVersionCreated = completedVersions.length > previousVersionsLength.current;
        const currentSelectionInvalid = selectedVersionId && !completedVersions.find(v => v.id === selectedVersionId);
        
        if (!selectedVersionId || newVersionCreated || currentSelectionInvalid) {
          console.log('Auto-switching to latest completed version:', latest.version_number);
          setSelectedVersionId(latest.id);
        }
        
        // Update ref for next comparison
        previousVersionsLength.current = completedVersions.length;
      }
    }
  }, [versions, versions.length, streamState.currentVersionId, streamState.isStreaming, selectedVersionId]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages]);

  // Combine streaming events with regular messages for display
  // Memoize with explicit dependencies to prevent unnecessary recalculations
  // Optimized for instant display - no debouncing
  const streamingMessages = useMemo(() => {
    const msgs: any[] = [];
    const fileStatusMap = new Map<string, { generating: any; complete: any }>();
    let validationStatus: { start: any; complete: any } = { start: null, complete: null };
    
    // Show immediate feedback even with no events yet
    if (streamState.isStreaming && streamState.events.length === 0 && streamState.status === 'generating') {
      msgs.push({
        id: 'stream-initializing',
        content: 'Starting generation...',
        role: 'assistant' as const,
        type: 'text' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isStreaming: true,
        icon: 'generating',
      });
      return msgs;
    }
    
    // Early return if no events
    if (streamState.events.length === 0) {
      return msgs;
    }
    
    // First pass: collect file events, validation status, and step status
    const stepStatusMap = new Map<string, { start: any | null; complete: any | null }>();
    
    streamState.events.forEach((event) => {
      if (event.type === 'file:generating') {
        if (!fileStatusMap.has(event.filename)) {
          fileStatusMap.set(event.filename, { generating: event, complete: null });
        }
      } else if (event.type === 'file:complete') {
        const existing = fileStatusMap.get(event.filename);
        if (existing) {
          existing.complete = event;
        } else {
          fileStatusMap.set(event.filename, { generating: null, complete: event });
        }
      } else if (event.type === 'validation:start') {
        validationStatus.start = event;
      } else if (event.type === 'validation:complete') {
        validationStatus.complete = event;
      } else if (event.type === 'step:start' && event.step && event.step !== 'Validating') {
        const stepKey = event.step;
        if (!stepStatusMap.has(stepKey)) {
          stepStatusMap.set(stepKey, { start: event, complete: null });
        }
      } else if (event.type === 'step:complete' && event.step && event.step !== 'Validating') {
        const stepKey = event.step;
        const existing = stepStatusMap.get(stepKey);
        if (existing) {
          existing.complete = event;
        } else {
          stepStatusMap.set(stepKey, { start: null, complete: event });
        }
      }
    });
    
    // Second pass: create messages based on file status
    fileStatusMap.forEach((status, filename) => {
      if (status.complete) {
        // Only show the completed state
        msgs.push({
          id: `stream-file-${filename}`,
          content: `✓ Created ${filename}`,
          role: 'assistant' as const,
          type: 'text' as const,
          created_at: new Date(status.complete.timestamp).toISOString(),
          updated_at: new Date(status.complete.timestamp).toISOString(),
          isStreaming: true,
          icon: 'complete',
        });
      } else if (status.generating) {
        // Show generating state only if not yet complete
        msgs.push({
          id: `stream-file-${filename}`,
          content: `Generating ${filename}...`,
          role: 'assistant' as const,
          type: 'text' as const,
          created_at: new Date(status.generating.timestamp).toISOString(),
          updated_at: new Date(status.generating.timestamp).toISOString(),
          isStreaming: true,
          icon: 'generating',
        });
      }
    });
    
    // Add validation message (transforming from "Validating..." to "✓ Validated")
    if (validationStatus.complete) {
      msgs.push({
        id: 'stream-validation',
        content: `✓ ${validationStatus.complete.summary || 'Code validated successfully'}`,
        role: 'assistant' as const,
        type: 'text' as const,
        created_at: new Date(validationStatus.complete.timestamp).toISOString(),
        updated_at: new Date(validationStatus.complete.timestamp).toISOString(),
        isStreaming: true,
        icon: 'complete',
      });
    } else if (validationStatus.start) {
      msgs.push({
        id: 'stream-validation',
        content: 'Validating generated code...',
        role: 'assistant' as const,
        type: 'text' as const,
        created_at: new Date(validationStatus.start.timestamp).toISOString(),
        updated_at: new Date(validationStatus.start.timestamp).toISOString(),
        isStreaming: true,
        icon: 'processing',
      });
    }
    
    // Add other event types (step:start, complete)
    stepStatusMap.forEach((status, stepName) => {
      if (status.complete) {
        // Show completed step with checkmark
        msgs.push({
          id: `stream-step-${stepName}`,
          content: status.complete.message,
          role: 'assistant' as const,
          type: 'text' as const,
          created_at: new Date(status.complete.timestamp).toISOString(),
          updated_at: new Date(status.complete.timestamp).toISOString(),
          isStreaming: true,
          icon: 'complete',
        });
      } else if (status.start) {
        // Show in-progress step with spinner
        msgs.push({
          id: `stream-step-${stepName}`,
          content: status.start.message,
          role: 'assistant' as const,
          type: 'text' as const,
          created_at: new Date(status.start.timestamp).toISOString(),
          updated_at: new Date(status.start.timestamp).toISOString(),
          isStreaming: true,
          icon: 'processing',
        });
      }
    });
    
    return msgs;
  }, [streamState.events, streamState.isStreaming, streamState.status]); // Added dependencies for instant updates

  // Convert persisted generation events from database into message format
  const persistedEventMessages = useMemo(() => {
    const eventMsgs: any[] = [];
    
    // Only show persisted events if NOT currently streaming
    if (!streamState.isStreaming && streamState.events.length === 0 && generationEvents.length > 0) {
      // Convert each generation event into a message format
      generationEvents.forEach((event: any) => {
        eventMsgs.push({
          id: `persisted-event-${event.id}`,
          content: event.message,
          role: 'assistant' as const,
          type: 'text' as const,
          created_at: event.timestamp || event.created_at,
          updated_at: event.updated_at,
          isPersistent: true,
          icon: event.icon,
        });
      });
    }
    
    return eventMsgs;
  }, [generationEvents, streamState.isStreaming, streamState.events.length]);

  // Merge and sort all messages, avoiding duplicates, and inject version cards
  const allMessages = useMemo(() => {
    // If we have streaming events OR persisted events, filter out database messages
    const hasGenerationEvents = streamState.isStreaming || streamState.events.length > 0 || persistedEventMessages.length > 0;
    
    const filteredDbMessages = hasGenerationEvents
      ? sortedMessages.filter((dbMsg) => {
          // Always keep user messages and errors
          if (dbMsg.role === 'user') return true;
          if (dbMsg.type === 'error') return true;
          
          // Filter out assistant messages that duplicate generation events
          if (dbMsg.role === 'assistant') {
            // Filter out messages that look like completion summaries
            if (dbMsg.content.includes('API Generation Complete') ||
                dbMsg.content.includes('Generated Files:') ||
                dbMsg.content.includes('Validation:') ||
                dbMsg.content.toLowerCase().includes('this api allows')) {
              return false; // Skip these, we show them via generation events
            }
          }
          
          return true;
        })
      : sortedMessages;

    // Combine database messages, streaming messages, and persisted generation events
    let combined = [...filteredDbMessages, ...streamingMessages, ...persistedEventMessages];
    
    // Sort by timestamp
    combined.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Inject version cards after the messages that created them
    // Only show COMPLETED versions (not generating ones) to avoid premature display
    const completedVersions = versions.filter(v => v.status === 'complete');
    
    if (completedVersions.length > 0) {
      const messagesWithVersions: any[] = [];
      const addedVersionIds = new Set<string>();
      
      combined.forEach((msg, index) => {
        messagesWithVersions.push(msg);
        
        // After each message, check if there's a version that should appear
        // Either linked by version_id or created around the same time
        if ('id' in msg) {
          // Method 1: Direct link via version_id (most reliable)
          const directLinkedVersion = completedVersions.find(v => 
            'version_id' in msg && msg.version_id === v.id
          );
          
          if (directLinkedVersion && !addedVersionIds.has(directLinkedVersion.id)) {
            messagesWithVersions.push({
              id: `version-card-${directLinkedVersion.id}`,
              role: 'version' as const,
              type: 'version-card' as const,
              created_at: directLinkedVersion.created_at,
              updated_at: directLinkedVersion.updated_at,
              versionData: directLinkedVersion,
            });
            addedVersionIds.add(directLinkedVersion.id);
          } else if (msg.role === 'user') {
            // Method 2: Time-based matching for versions without direct links
            const timeBasedVersions = completedVersions.filter(v => {
              if (addedVersionIds.has(v.id)) return false;
              const msgTime = new Date(msg.created_at).getTime();
              const versionTime = new Date(v.created_at).getTime();
              // Version should be created within 10 seconds after the message
              return versionTime >= msgTime && versionTime - msgTime < 10000;
            });
            
            // Add time-based matched versions
            timeBasedVersions.forEach(version => {
              messagesWithVersions.push({
                id: `version-card-${version.id}`,
                role: 'version' as const,
                type: 'version-card' as const,
                created_at: version.created_at,
                updated_at: version.updated_at,
                versionData: version,
              });
              addedVersionIds.add(version.id);
            });
          }
        }
      });
      
      // Add any versions that haven't been added yet (orphaned versions)
      completedVersions.forEach(version => {
        if (!addedVersionIds.has(version.id)) {
          messagesWithVersions.push({
            id: `version-card-${version.id}`,
            role: 'version' as const,
            type: 'version-card' as const,
            created_at: version.created_at,
            updated_at: version.updated_at,
            versionData: version,
          });
        }
      });
      
      // Re-sort to ensure proper chronological order
      messagesWithVersions.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      return messagesWithVersions;
    }
    
    return combined;
  }, [sortedMessages, streamingMessages, persistedEventMessages, versions, streamState.isStreaming, streamState.events.length]);

  // Extract project files for GitHub push
  const projectFiles = useMemo(() => {
    // Priority 1: Use streaming files
    if (streamState.isStreaming && streamState.generatedFiles.length > 0) {
      const filesObj: Record<string, any> = {};
      streamState.generatedFiles.forEach(file => {
        filesObj[file.filename] = file.content;
      });
      return filesObj;
    }
    
    // Priority 2: Load from selected version
    if (selectedVersionId && versions.length > 0) {
      const selectedVersion = versions.find(v => v.id === selectedVersionId);
      if (selectedVersion?.files) {
        return selectedVersion.files;
      }
    }
    
    return {};
  }, [selectedVersionId, versions, streamState.generatedFiles, streamState.isStreaming]);

  // Build file tree from selected version or streaming files
  const fileTree = useMemo(() => {
    // Priority 1: Use streaming files only while currently generating
    if (streamState.isStreaming && streamState.generatedFiles.length > 0) {
      const streamingFilesObj: Record<string, any> = {};
      streamState.generatedFiles.forEach(file => {
        streamingFilesObj[file.filename] = file.content;
      });
      return buildTreeFromPaths(streamingFilesObj);
    }
    
    // Priority 2: Load from selected version if available
    if (selectedVersionId && versions.length > 0) {
      const selectedVersion = versions.find(v => v.id === selectedVersionId);
      if (selectedVersion?.files) {
        return buildTreeFromPaths(selectedVersion.files);
      }
    }
    
    // Priority 3: If streaming is active but no files yet, show empty tree
    if (streamState.isStreaming) {
      return [];
    }
    
    // Priority 4: Fallback to project-based tree generation from messages
    return generateFileTreeFromProject(currentProject, sortedMessages, streamState.generatedFiles);
  }, [selectedVersionId, versions, streamState.generatedFiles, streamState.isStreaming, currentProject, sortedMessages]);

  // When switching versions, ensure the selected file exists in that version.
  // If not, select the first file of the chosen version.
  useEffect(() => {
    if (streamState.isStreaming) return; // don't override while streaming
    if (!selectedVersionId) return;
    const version = versions.find(v => v.id === selectedVersionId);
    const versionFiles = version?.files ? Object.keys(version.files) : [];
    if (versionFiles.length === 0) return;

    // If current selection is not in this version, pick the first file
    if (!selected || !versionFiles.includes(selected)) {
      setSelected(versionFiles[0]);
    }
  }, [selectedVersionId, versions, streamState.isStreaming]);

  // Auto-select currently generating file during streaming
  useEffect(() => {
    if (streamState.isStreaming && streamState.currentFile) {
      // Always switch to the current file being generated
      setSelected(streamState.currentFile);
    }
  }, [streamState.isStreaming, streamState.currentFile]);

  // Auto-select default file when switching to code mode
  useEffect(() => {
    if (viewMode === 'code' && !selected && fileTree.length > 0) {
      // Find the first file (not folder) to select as default
      const firstFile = fileTree.find(node => node.type === 'file');
      if (firstFile) {
        setSelected(firstFile.id);
      }
    }
  }, [viewMode, selected, fileTree]);

  // Auto-switch to Code tab when GitHub clone completes and refetch project
  useEffect(() => {
    if (streamState.status === 'complete' && !streamState.isStreaming && !hasAutoSwitched.current) {
      hasAutoSwitched.current = true;
      
      console.log('[AUTO-SWITCH] Clone complete! Starting auto-switch sequence...');
      console.log('[AUTO-SWITCH] isMobileScreen:', isMobileScreen);
      console.log('[AUTO-SWITCH] Current sandbox_url:', ('sandbox_url' in currentProject ? currentProject.sandbox_url : 'not set'));
      
      // Aggressive refetch strategy - multiple attempts to catch DB update
      const refetchSequence = async () => {
        console.log('[AUTO-SWITCH] Refetch #1 (immediate)');
        await refetchProject();
        
        setTimeout(async () => {
          console.log('[AUTO-SWITCH] Refetch #2 (1s)');
          await refetchProject();
        }, 1000);
        
        setTimeout(async () => {
          console.log('[AUTO-SWITCH] Refetch #3 (3s)');
          await refetchProject();
        }, 3000);
        
        setTimeout(async () => {
          console.log('[AUTO-SWITCH] Refetch #4 (5s)');
          await refetchProject();
        }, 5000);
      };
      
      refetchSequence();
      
      // Auto-switch to Code section on mobile (desktop shows both panels already)
      // Do this regardless of refetch success
      setTimeout(() => {
        console.log('[AUTO-SWITCH] Switching views...');
        console.log('[AUTO-SWITCH] isClonedProject:', isClonedProject);
        console.log('[AUTO-SWITCH] Current viewMode:', viewMode);
        
        // For mobile: switch to code section (which will show preview for cloned projects)
        if (isMobileScreen) {
          console.log('[AUTO-SWITCH] Mobile detected - switching to code section');
          setMobileView('code');
        } else {
          console.log('[AUTO-SWITCH] Desktop detected - both panels already visible');
        }
        
        // DON'T change viewMode for cloned projects - they default to 'preview' which is correct
        // Only set to 'code' for non-cloned projects
        if (!isClonedProject) {
          console.log('[AUTO-SWITCH] Non-cloned project - switching to code view');
          setViewMode('code');
        } else {
          console.log('[AUTO-SWITCH] Cloned project - keeping preview mode');
        }
        
        console.log('[AUTO-SWITCH] View switch complete!');
      }, 800);
    }
  }, [streamState.status, streamState.isStreaming, refetchProject, isMobileScreen, currentProject, isClonedProject, viewMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const select = (id: string) => setSelected(id);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    const messageContent = input.trim();
    setInput(""); // Clear input immediately for better UX
    
    try {
      // 1. Save user message
      const message = await createMessage.mutateAsync({
        content: messageContent,
        role: 'user',
        type: 'text',
        project_id: projectId,
      });
      
      // Refetch messages to show user's message
      refetch();
      
      // 2. Classify command (with current file list for context)
      const currentFiles = selectedVersionId 
        ? Object.keys(versions.find(v => v.id === selectedVersionId)?.files || {})
        : [];
      
      const classification = await classifyCommand.mutateAsync({
        prompt: messageContent,
        projectId,
        currentFiles,
      });
      
      console.log('Command classified:', classification);
      
      // 3. Trigger iteration workflow
      await triggerIteration.mutateAsync({
        projectId,
        messageId: message.id,
        prompt: messageContent,
        commandType: classification.type,
        shouldCreateNewVersion: classification.shouldCreateNewVersion,
        parentVersionId: selectedVersionId || undefined,
      });
      
      // Refetch versions to get the new one
      setTimeout(() => {
        refetchVersions();
      }, 1000);
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error processing message:", error);
      setIsLoading(false);
      // Re-add the message to input on error
      setInput(messageContent);
    }
  };

  // Download all files as ZIP
  const handleDownloadZip = async () => {
    try {
      console.log('Starting ZIP download...');
      console.log('Current project:', currentProject);
      console.log('Selected version ID:', selectedVersionId);
      console.log('Versions:', versions);
      console.log('Is streaming:', streamState.isStreaming);
      console.log('Generated files:', streamState.generatedFiles);
      
      const zip = new JSZip();
      const projectName = currentProject?.name || 'project';
      
      // Get files from selected version or streaming files
      let filesToZip: Record<string, any> = {};
      
      if (streamState.isStreaming && streamState.generatedFiles.length > 0) {
        console.log('Using streaming files');
        // Use streaming files if currently generating
        streamState.generatedFiles.forEach(file => {
          filesToZip[file.filename] = file.content;
        });
      } else if (selectedVersionId) {
        console.log('Using selected version files');
        // Use selected version files
        const selectedVersion = versions.find(v => v.id === selectedVersionId);
        console.log('Selected version:', selectedVersion);
        if (selectedVersion?.files) {
          filesToZip = selectedVersion.files;
        }
      } else if (versions.length > 0) {
        console.log('No selected version, trying first completed version');
        // Try to get the first completed version
        const completedVersion = versions.find(v => v.status === 'complete');
        if (completedVersion?.files) {
          filesToZip = completedVersion.files;
        }
      } else {
        // FALLBACK: Try to get files from message fragments if no versions exist
        console.log('No versions found, falling back to message fragments');
        const latestMessageWithFragments = messages
          .filter(m => m.fragments && m.fragments.length > 0)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        
        if (latestMessageWithFragments?.fragments?.[0]?.files) {
          console.log('Found files in message fragment:', latestMessageWithFragments.fragments[0].id);
          filesToZip = latestMessageWithFragments.fragments[0].files;
        }
      }
      
      console.log('Files to zip:', Object.keys(filesToZip));
      
      if (Object.keys(filesToZip).length === 0) {
        console.error('No files to download - filesToZip is empty');
        alert('No files available to download. Please wait for code generation to complete.');
        return;
      }
      
      // Add all files to the ZIP
      Object.entries(filesToZip).forEach(([filename, content]) => {
        console.log(`Adding file to ZIP: ${filename}`);
        const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        zip.file(filename, fileContent);
      });
      
      console.log('Generating ZIP blob...');
      // Generate ZIP and trigger download
      const blob = await zip.generateAsync({ type: 'blob' });
      console.log('ZIP blob generated, size:', blob.size);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`✅ Successfully downloaded ${Object.keys(filesToZip).length} files as ${projectName}.zip`);
    } catch (error) {
      console.error('❌ Error downloading ZIP:', error);
      alert('Error creating ZIP file. Please check the console for details.');
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <SimpleHeader 
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        project={currentProject}
        projectFiles={projectFiles}
      />

      {/* Mobile view toggle buttons */}
      <div className="sm:hidden flex border-b border-border dark:border-[#333433] bg-white dark:bg-[#0E100F]">
        <button
          onClick={() => setMobileView('chat')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            mobileView === 'chat'
              ? 'text-foreground border-b-2 border-primary bg-muted/30'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="size-4" />
            <span>Chat</span>
          </div>
        </button>
        <button
          onClick={() => setMobileView('code')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            mobileView === 'code'
              ? 'text-foreground border-b-2 border-primary bg-muted/30'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileCode className="size-4" />
            <span>Code</span>
          </div>
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Messages section - collapsible with smooth animation */}
        <motion.section 
          initial={false}
          animate={isMobileScreen ? {} : { 
            // Only apply motion animations on desktop
            width: isChatPanelCollapsed ? 0 : 'auto',
            minWidth: isChatPanelCollapsed ? 0 : '256px',
            maxWidth: isChatPanelCollapsed ? 0 : '400px',
            opacity: isChatPanelCollapsed ? 0 : 1
          }}
          transition={{ 
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1], // Custom easing curve for smoother motion
            width: { duration: 0.3 },
            minWidth: { duration: 0.3 },
            maxWidth: { duration: 0.3 },
            opacity: { duration: 0.2, delay: isChatPanelCollapsed ? 0 : 0.1 }
          }}
          style={isMobileScreen ? {
            // Force remove any max-width on mobile
            maxWidth: 'none',
            minWidth: 'auto',
            width: '100%'
          } : undefined}
          className={`flex-col h-full bg-[#FAFAFA] dark:bg-[#0E100F] ${
            isChatPanelCollapsed 
              ? 'overflow-hidden' 
              : 'w-full sm:w-64 md:w-72 lg:w-80 xl:w-96 overflow-hidden'
          } ${mobileView === 'chat' ? 'flex flex-1 sm:flex-none' : 'hidden sm:flex'}`}
        >
          
          {/* Messages Area - compact spacing for cleaner look */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-2 space-y-1.5 min-h-0 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent bg-[#FAFAFA] dark:bg-[#0E100F] relative">
            
            <AnimatePresence>
              {allMessages.map((message, index) => {
                const isStreamingMsg = 'isStreaming' in message && message.isStreaming;
                const isPersistentMsg = 'isPersistent' in message && message.isPersistent;
                const streamIcon = 'icon' in message ? message.icon : null;
                
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="text-sm"
                  >
                    {message.type === "version-card" && 'versionData' in message ? (
                      // Version card - seamlessly integrated with description below
                      <div className="my-2 space-y-2">
                        <VersionCard
                          version={message.versionData}
                          isActive={selectedVersionId === message.versionData.id}
                          onClick={() => setSelectedVersionId(message.versionData.id)}
                          previousVersion={
                            versions.find(v => v.id === message.versionData.parent_version_id)
                          }
                        />
                        {message.versionData.description && (
                          <div className="flex gap-2 sm:gap-3 items-start pr-2 sm:pr-4">
                            <div className="whitespace-pre-wrap break-words leading-[1.5] text-[14px] sm:text-[15px] flex-1 text-muted-foreground">
                              {message.versionData.description}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : message.role === "user" ? (
                      // User message - compact spacing
                      <div className="flex justify-end mb-1.5">
                        <div className="rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 bg-[#EBEBEB] dark:bg-[#262626] border border-[#d1d5db] dark:border-[#262626] max-w-[90%]">
                          <div className="whitespace-pre-wrap break-words leading-[1.5] text-[14px] sm:text-[15px] text-gray-900 dark:text-white font-medium">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // AI message - clean modern UI like ChatGPT/Claude with compact spacing
                      <div className="flex gap-2 sm:gap-3 items-start mb-1.5 pr-2 sm:pr-4">
                        {/* Only show spinner when actively generating, no checkmarks */}
                        {isStreamingMsg && (streamIcon === 'generating' || streamIcon === 'processing') && (
                          <Loader2 className="size-4 animate-spin text-primary mt-1 flex-shrink-0" />
                        )}
                        <div className="whitespace-pre-wrap break-words leading-[1.5] text-[14px] sm:text-[15px] flex-1">
                          {isStreamingMsg && (streamIcon === 'generating' || streamIcon === 'processing') ? (
                            <TextShimmer 
                              duration={1.5} 
                              className="text-[14px] sm:text-[15px] font-normal text-foreground"
                            >
                              {message.content}
                            </TextShimmer>
                          ) : (
                            <span className="text-foreground dark:text-gray-200">
                              {message.content}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {message.fragments && message.fragments.length > 0 && message.role === "user" && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <div className="text-xs text-muted-foreground mb-1.5 font-medium">Generated Files:</div>
                        {message.fragments.map((fragment: Fragment) => (
                          <div key={fragment.id} className="text-xs text-primary mb-1 flex items-center gap-1">
                            <FileCode className="size-3" />
                            <span className="truncate">{fragment.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box - Compact design for more code space */}
          <div className="px-3 sm:px-4 pb-2 sm:pb-2 bg-[#FAFAFA] dark:bg-[#0E100F] flex flex-col justify-end">
            <div className="rounded-xl border border-border/50 dark:border-[#444444] bg-white dark:bg-[#1F2023] p-2 sm:p-3 shadow-lg flex flex-col">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Continue the conversation..."
                className="w-full bg-transparent text-foreground dark:text-gray-100 placeholder-muted-foreground dark:placeholder-gray-400 outline-none text-[13px] px-2 py-2 border-none resize-none overflow-hidden leading-relaxed"
                style={{ 
                  border: 'none', 
                  boxShadow: 'none', 
                  outline: 'none',
                  minHeight: '32px',
                  maxHeight: '120px',
                  height: '32px'
                }}
                disabled={isLoading}
                rows={1}
                ref={textareaRef}
              />
              {/* Input actions - responsive button sizes */}
              <div className="flex items-center justify-between pt-2.5">
                <div className="flex items-center gap-2">
                  <button
                    className="h-8 sm:h-7 px-3 py-1 rounded-full text-xs text-foreground dark:text-gray-200 border border-border/50 dark:border-[#444444] bg-transparent hover:bg-muted/50 dark:hover:bg-gray-700/40 transition-colors flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                    <span className="hidden xs:inline">Tools</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    className="h-9 w-9 sm:h-8 sm:w-8 rounded-full text-foreground dark:text-gray-300 hover:bg-muted/50 dark:hover:bg-gray-600/30 transition-colors flex items-center justify-center"
                    disabled={isLoading}
                  >
                    <Paperclip className="h-4.5 w-4.5 sm:h-4 sm:w-4" />
                  </button>
                  <button 
                    onClick={send} 
                    disabled={!input.trim() || isLoading}
                    className={`h-9 w-9 sm:h-8 sm:w-8 rounded-full transition-all duration-200 flex items-center justify-center ${
                      input.trim() 
                        ? 'bg-white hover:bg-white/90 text-[#1F2023]' 
                        : 'bg-transparent hover:bg-gray-600/30 text-gray-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4.5 sm:size-4 animate-spin" />
                    ) : (
                      <ArrowUp className="size-4.5 sm:size-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.section>


        {/* Code viewer section - conditionally shown on mobile based on mobileView */}
        <section className={`p-1 sm:p-2 min-h-0 relative bg-white dark:bg-[#0E100F] sm:min-w-0 flex-col ${
          mobileView === 'code' ? 'flex flex-1' : 'hidden sm:flex sm:flex-1'
        }`}>
          {/* Folder toggle button - only show when explorer is closed AND in code mode */}
          {!isMobileExplorerOpen && viewMode === 'code' && (
            <button
              onClick={() => setIsMobileExplorerOpen(true)}
              className="sm:hidden absolute top-16 left-4 z-50 p-2 rounded-md bg-white dark:bg-[#1D1D1D] border border-border dark:border-[#333433] text-foreground hover:bg-muted transition-colors shadow-lg"
              aria-label="Open file explorer"
            >
              <Folder className="size-4" />
            </button>
          )}

          {/* Unified header bar with view toggle - ALWAYS full width at top */}
          <div className="bg-muted/30 dark:bg-[#1D1D1D] border border-border dark:border-[#333433] rounded-t-lg px-2 sm:px-3 py-2 sm:py-2.5 flex flex-wrap items-center gap-1 sm:gap-2 flex-shrink-0">
                {/* View Mode Toggle - positioned like v0 */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Collapse/Expand Chevron Button - double chevrons */}
                  <motion.button
                    onClick={() => setIsChatPanelCollapsed(!isChatPanelCollapsed)}
                    className="hidden sm:flex p-1 text-muted-foreground hover:text-gray-400 dark:hover:text-gray-500 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title={isChatPanelCollapsed ? "Expand chat panel" : "Collapse chat panel"}
                  >
                    {isChatPanelCollapsed ? (
                      <ChevronsRight className="h-4 w-4" />
                    ) : (
                      <ChevronsLeft className="h-4 w-4" />
                    )}
                  </motion.button>
                  
                  <div className="relative flex items-center gap-0 bg-background dark:bg-[#0E100F] border border-border/50 dark:border-[#333433] rounded-lg p-0.5">
                    {/* Animated background indicator with smooth selection animation */}
                    <motion.div
                      className="absolute inset-y-0.5 bg-muted/50 dark:bg-[#1D1D1D] rounded-md shadow-sm"
                      initial={false}
                      animate={{
                        left: viewMode === 'preview' ? '2px' : 'calc(50%)',
                        right: viewMode === 'preview' ? 'calc(50%)' : '2px',
                      }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 400, 
                        damping: 35,
                        mass: 0.8
                      }}
                    />
                    <motion.button
                      onClick={() => setViewMode('preview')}
                      className={`relative z-10 px-2.5 py-1.5 text-xs font-medium transition-all duration-200 rounded-md ${
                        viewMode === 'preview'
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Preview"
                      whileTap={{ scale: 0.95 }}
                      animate={{ 
                        scale: viewMode === 'preview' ? 1 : 1,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </motion.button>
                    <motion.button
                      onClick={() => setViewMode('code')}
                      className={`relative z-10 px-2.5 py-1.5 text-xs font-medium transition-all duration-200 rounded-md ${
                        viewMode === 'code'
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Code view"
                      whileTap={{ scale: 0.95 }}
                      animate={{ 
                        scale: viewMode === 'code' ? 1 : 1,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                    </motion.button>
                  </div>
                </div>
                
            {/* Path bar and menu container - only shown in preview mode */}
            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              {/* Path bar - only shown in preview mode for navigation */}
              {currentProject && viewMode === 'preview' && (
                <>
                  {/* URL Bar with controls - v0.app style - adjusted height */}
                  <div className="flex items-center gap-1 sm:gap-1.5 bg-background dark:bg-[#0E100F] border border-border dark:border-[#333433] rounded-lg px-1.5 sm:px-2.5 py-[5px] flex-1 min-w-0 max-w-[200px] sm:max-w-none">
                    <Monitor className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      value={previewPath}
                      onChange={(e) => {
                        let newPath = e.target.value;
                        if (!newPath.startsWith('/')) {
                          newPath = '/' + newPath;
                        }
                        setPreviewPath(newPath);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Trigger refresh by updating sandbox key
                        }
                      }}
                      placeholder="/"
                      className="flex-1 bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none border-none min-w-0"
                      style={{ 
                        border: 'none', 
                        boxShadow: 'none',
                        padding: 0
                      }}
                    />
                    <div className="flex items-center gap-0.5 border-l border-border dark:border-[#333433] pl-1 sm:pl-1.5 ml-1 sm:ml-1.5">
                      <button
                        onClick={() => {
                          setRefreshKey(prev => prev + 1);
                        }}
                        className="p-0.5 sm:p-1 rounded hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                        title="Refresh preview"
                      >
                        <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          const sandboxUrl = ('sandbox_url' in currentProject ? currentProject.sandbox_url : undefined) ||
                            currentProject.deploy_url || '';
                          const fullUrl = sandboxUrl + (previewPath !== '/' ? previewPath : '');
                          window.open(fullUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="p-0.5 sm:p-1 rounded hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Spacer in code mode to push menu to the right */}
              {viewMode === 'code' && <div className="flex-1" />}

              {/* Version Dropdown - shown in both modes */}
              {versions.length > 0 && (
                <div className="relative flex-shrink-0" ref={versionDropdownRef}>
                  <button
                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                    className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-medium bg-background dark:bg-[#0E100F] border border-border dark:border-[#333433] hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                    title="Switch version"
                  >
                    <span className="font-medium text-foreground hidden xs:inline">
                      v{versions.find(v => v.id === selectedVersionId)?.version_number || versions[versions.length - 1]?.version_number || 1}
                    </span>
                    <span className="font-medium text-foreground xs:hidden">v{versions.find(v => v.id === selectedVersionId)?.version_number || versions[versions.length - 1]?.version_number || 1}</span>
                    <ChevronRight className={`h-3 w-3 transition-transform ${isVersionDropdownOpen ? 'rotate-90' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {isVersionDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="fixed sm:absolute right-2 sm:right-0 mt-2 w-56 bg-card dark:bg-[#1D1D1D] border border-border dark:border-[#333433] rounded-lg shadow-lg overflow-hidden z-[100] max-h-64 overflow-y-auto"
                      >
                        {versions.map((version) => (
                          <button
                            key={version.id}
                            onClick={() => {
                              setSelectedVersionId(version.id);
                              setIsVersionDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 text-xs hover:bg-muted dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                              selectedVersionId === version.id ? 'bg-primary/10 text-primary' : ''
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">v{version.version_number} - {version.name}</span>
                              <span className="text-muted-foreground text-[10px] truncate">
                                {version.status === 'complete' ? '✓ Complete' : version.status === 'generating' ? '⏳ Generating...' : '❌ Failed'}
                              </span>
                            </div>
                            {selectedVersionId === version.id && (
                              <Check className="h-3 w-3 text-primary flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Three-dot menu - shown in both modes, different options per mode */}
              <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-1.5 rounded-lg bg-background dark:bg-[#0E100F] border border-border dark:border-[#333433] hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                  title="More options"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>

                {/* Dropdown menu */}
                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="fixed sm:absolute right-2 sm:right-0 mt-2 w-48 bg-card dark:bg-[#1D1D1D] border border-border dark:border-[#333433] rounded-lg shadow-lg overflow-hidden z-[100]"
                    >
                      {/* Show Fullscreen option only in preview mode */}
                      {viewMode === 'preview' && (
                        <button
                          onClick={() => {
                            setIsFullscreen(true);
                            setIsMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-sans hover:bg-muted dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                        >
                          <Maximize className="h-4 w-4" />
                          <span>Fullscreen</span>
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          console.log('Download ZIP button clicked');
                          await handleDownloadZip();
                          setIsMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm font-sans hover:bg-muted dark:hover:bg-gray-800 transition-colors flex items-center gap-2 ${
                          viewMode === 'preview' ? 'border-t border-border dark:border-[#333433]' : ''
                        }`}
                      >
                        <Download className="h-4 w-4" />
                        <span>Download ZIP</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Container for file explorer and code/preview area */}
          <div className="flex-1 min-h-0 overflow-hidden flex border-x border-b border-border dark:border-[#333433] rounded-b-lg bg-muted/30 dark:bg-[#1D1D1D] shadow-xl backdrop-blur-sm" key={refreshKey}>
            {/* File explorer sidebar - NO header, just files - hidden in preview mode */}
            <aside className={`
              w-56 sm:w-36 md:w-40 lg:w-44 xl:w-48 2xl:w-52 border-r border-border dark:border-[#333433] flex-shrink-0 transition-all duration-300
              ${viewMode === 'preview' ? 'hidden' : ''}
              ${isMobileExplorerOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
              sm:relative absolute sm:z-auto z-40 h-full bg-[#FAFAFA] dark:bg-[#1D1D1D]
            `}>
              {/* File tree container - NO header, starts immediately */}
              <div className="p-1.5 sm:p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent bg-[#FAFAFA] dark:bg-[#1D1D1D] h-full">
                {/* Close button for mobile - positioned at top right */}
                <button
                  onClick={() => setIsMobileExplorerOpen(false)}
                  className="sm:hidden absolute top-2 right-2 z-50 p-1.5 hover:bg-muted rounded text-foreground text-xl leading-none flex-shrink-0"
                  aria-label="Close file explorer"
                >
                  ×
                </button>
                {fileTree.map((node) => (
                  <TreeItem
                    key={node.id}
                    node={node}
                    expanded={expanded}
                    toggle={toggle}
                    select={select}
                    selectedId={selected}
                  />
                ))}
              </div>
            </aside>

            {isMobileExplorerOpen && (
              <div
                className="sm:hidden absolute inset-0 bg-black/50 z-30"
                onClick={() => setIsMobileExplorerOpen(false)}
              />
            )}

            {/* Code/Preview content area with smooth animations */}
            <div className="flex-1 min-w-0 overflow-hidden bg-white dark:bg-[#1D1D1D] relative">
              <AnimatePresence mode="wait">
                {viewMode === 'preview' ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="absolute inset-0"
                  >
                    <SandboxPreview 
                      sandboxUrl={
                        ('sandbox_url' in currentProject ? currentProject.sandbox_url : undefined) ||
                        currentProject.deploy_url || 
                        ''
                      }
                      projectName={currentProject.name}
                      projectId={projectId}
                      hideHeader={true}
                      path={previewPath}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="code"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="absolute inset-0"
                  >
                    {streamState.isStreaming && streamState.generatedFiles.length > 0 ? (
                      <StreamingCodeViewer
                        files={streamState.generatedFiles}
                        currentFile={streamState.currentFile}
                        isStreaming={streamState.isStreaming}
                        selectedFile={selected || undefined}
                        versions={versions}
                        selectedVersionId={selectedVersionId}
                        onVersionChange={setSelectedVersionId}
                      />
                    ) : (
                      <CodeViewer 
                        filename={selected} 
                        fileTree={fileTree} 
                        codeTheme={codeTheme}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .scrollbar-thin {
          scrollbar-width: thin;
        }
        
        .scrollbar-thumb-gray-600::-webkit-scrollbar-thumb {
          background-color: #4b5563;
          border-radius: 0.375rem;
        }
        
        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background-color: transparent;
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        /* Mobile-specific styles */
        @media (max-width: 640px) {
          .h-screen {
            height: 100vh;
            height: 100dvh;
          }
          
          /* Better scrolling on mobile */
          * {
            -webkit-overflow-scrolling: touch;
          }
          
          /* Prevent zoom on input focus */
          input, textarea, select {
            font-size: 16px !important;
          }
        }
        
        /* Tablet and mobile code viewer improvements */
        @media (max-width: 1023px) {
          /* Ensure code wraps on mobile/tablet for better readability */
          pre code {
            white-space: pre-wrap !important;
            word-break: break-word !important;
          }
        }
        
        @media (min-width: 1024px) {
          .scrollbar-thin::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
        }
        
        /* Removed global transition to prevent interference with streaming updates */
        button, a, [role="button"] {
          transition-property: background-color, border-color, color, opacity, box-shadow, transform;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
        }
        
        button:focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
        
        input:focus,
        input:focus-visible {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }
        
        body {
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* Scroll fade effect for chat */
        .scroll-fade::before {
          content: '';
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(to bottom, hsl(var(--card)) 0%, transparent 100%);
          z-index: 10;
          pointer-events: none;
          display: block;
        }
        
        .scroll-fade::after {
          content: '';
          position: sticky;
          bottom: 0;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(to top, hsl(var(--card)) 0%, transparent 100%);
          z-index: 10;
          pointer-events: none;
          display: block;
        }
        
        /* Light mode scroll fade */
        .scroll-fade::before {
          background: linear-gradient(to bottom, white 0%, transparent 100%);
        }
        
        .scroll-fade::after {
          background: linear-gradient(to top, white 0%, transparent 100%);
        }
        
        /* Dark mode scroll fade */
        .dark .scroll-fade::before {
          background: linear-gradient(to bottom, #0E100F 0%, transparent 100%);
        }
        
        .dark .scroll-fade::after {
          background: linear-gradient(to top, #0E100F 0%, transparent 100%);
        }
      `}</style>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && currentProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background dark:bg-[#0E100F] z-[100] flex flex-col"
          >
            {/* Fullscreen header with path bar */}
            <div className="bg-muted/30 dark:bg-[#1D1D1D] border-b border-border dark:border-[#333433] px-4 py-2.5 flex items-center gap-3">
              {/* Close button */}
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded-lg bg-background dark:bg-[#0E100F] border border-border dark:border-[#333433] hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                title="Exit fullscreen"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Path bar */}
              <div className="flex items-center gap-1.5 bg-background dark:bg-[#0E100F] border border-border dark:border-[#333433] rounded-lg px-2.5 py-[5px] flex-1 min-w-0">
                <Monitor className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={previewPath}
                  onChange={(e) => {
                    let newPath = e.target.value;
                    if (!newPath.startsWith('/')) {
                      newPath = '/' + newPath;
                    }
                    setPreviewPath(newPath);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setRefreshKey(prev => prev + 1);
                    }
                  }}
                  placeholder="/"
                  className="flex-1 bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none border-none min-w-0"
                  style={{ 
                    border: 'none', 
                    boxShadow: 'none',
                    padding: 0
                  }}
                />
                <div className="flex items-center gap-0.5 border-l border-border dark:border-[#333433] pl-1.5 ml-1.5">
                  <button
                    onClick={() => {
                      setRefreshKey(prev => prev + 1);
                    }}
                    className="p-1 rounded hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                    title="Refresh preview"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const sandboxUrl = ('sandbox_url' in currentProject ? currentProject.sandbox_url : undefined) ||
                        currentProject.deploy_url || '';
                      const fullUrl = sandboxUrl + (previewPath !== '/' ? previewPath : '');
                      window.open(fullUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="p-1 rounded hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Fullscreen preview content */}
            <div className="flex-1 overflow-hidden">
              <SandboxPreview 
                sandboxUrl={
                  ('sandbox_url' in currentProject ? currentProject.sandbox_url : undefined) ||
                  currentProject.deploy_url || 
                  ''
                }
                projectId={projectId}
                hideHeader={true}
                path={previewPath}
                onRefresh={() => setRefreshKey(prev => prev + 1)}
                key={`fullscreen-${refreshKey}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}