"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  ChevronRight, 
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
  Check
} from "lucide-react";
import { SimpleHeader } from "@/components/simple-header";
import { Highlight, themes } from "prism-react-renderer";
import { api } from "@/lib/trpc-client";
import { useGenerationStream } from "../../../hooks/use-generation-stream";
import { StreamingCodeViewer } from "../../../components/streaming-code-viewer";
import { GenerationProgressTracker } from "../../../components/generation-progress-tracker";

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
  framework: 'fastapi' | 'express';
  status: 'generating' | 'testing' | 'deploying' | 'deployed' | 'failed';
  created_at: string;
  updated_at: string;
  deploy_url?: string;
  swagger_url?: string;
  openapi_spec?: any;
  code_url?: string;
  prompt?: string;
  advanced?: boolean;
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

function generateFileTreeFromProject(project: Project, messages: Message[] = [], streamingFiles: any[] = []): TreeNode[] {
  // Check if we have any generated files from messages OR streaming
  const hasGeneratedFiles = messages.some(
    (message) => message.fragments && message.fragments.length > 0
  ) || streamingFiles.length > 0;

  // Only show placeholder files if we don't have any real generated files
  const baseStructure: TreeNode[] = hasGeneratedFiles ? [] : [
    {
      id: "src",
      name: "src",
      type: "folder",
      children: [
        {
          id: "main.py",
          name: "main.py",
          type: "file",
          language: "python",
          content: `# ${project.name} - FastAPI Application
# Generated API based on: ${project.description || 'No description provided'}

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(
    title="${project.name}",
    description="${project.description || 'Generated API'}",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to ${project.name} API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "${project.name}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
`
        }
      ]
    },
    {
      id: "requirements.txt",
      name: "requirements.txt",
      type: "file",
      language: "text",
      content: `fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
python-multipart==0.0.6
`
    }
  ];

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

function getFileIcon(name: string) {
  if (name.includes('.')) {
    return <FileCode className="size-4 text-blue-400" />;
  }
  return <Folder className="size-4 text-yellow-400" />;
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
        className={`flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-gray-700/50 transition-colors ${
          isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
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
            className={`size-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
          />
        )}
        {node.type === "folder" ? (
          isExpanded ? <FolderOpen className="size-4 text-yellow-400" /> : <Folder className="size-4 text-yellow-400" />
        ) : (
          getFileIcon(node.name)
        )}
        <span className="truncate">{node.name}</span>
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
  fileTree 
}: { 
  filename: string | null;
  fileTree: TreeNode[];
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
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <FileCode className="size-12 mx-auto mb-4 opacity-50" />
          <p>Select a file to view its contents</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 border-b px-3 flex items-center justify-between text-xs text-gray-300 bg-gray-800/50 flex-shrink-0">
        <div className="flex items-center min-w-0">
          <span className="mr-2 flex-shrink-0">{getFileIcon(selectedFile.name)}</span>
          <span className="font-medium truncate">{selectedFile.name}</span>
          <span className="ml-2 text-gray-500 flex-shrink-0">
            ({selectedFile.language || 'text'})
          </span>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-gray-700 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
            title="Copy code to clipboard"
          >
            {copySuccess ? (
              <>
                <Check className="size-3 text-green-400" />
                <span className="text-green-400 hidden sm:inline">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-gray-700 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
            title="Download file"
          >
            <Download className="size-3" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800" 
        style={{ 
          minHeight: 0,
          height: 'calc(100vh - 140px)',
          maxHeight: 'calc(100vh - 140px)',
          scrollBehavior: 'smooth',
          width: '100%',
          minWidth: '600px'
        }}
      >
        <div className="min-h-full">
          <Highlight
            theme={themes.vsDark}
            code={selectedFile.content || '// No content available'}
            language={selectedFile.language || 'text'}
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre 
                className={`${className} text-sm leading-5 p-3 min-h-full`} 
                style={{
                  ...style,
                  margin: 0,
                  background: '#1D1D1D',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: 'clamp(11px, 1.5vw, 14px)',
                }}
              >
                {tokens.map((line, i) => (
                  <div 
                    key={i} 
                    {...getLineProps({ line })}
                    className="flex hover:bg-gray-800/30 transition-colors"
                    style={{ minHeight: '1.25rem' }}
                  >
                    <span 
                      className="inline-block w-10 text-right mr-3 text-gray-500 select-none flex-shrink-0 text-xs leading-5"
                      style={{ fontSize: 'clamp(10px, 1.2vw, 12px)' }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 whitespace-pre-wrap break-words" style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      maxWidth: '100%'
                    }}>
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["src"]));
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileExplorerOpen, setIsMobileExplorerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use streaming hook for real-time updates
  const streamState = useGenerationStream(projectId);

  const { data: messages = initialMessages, refetch } = api.messages.getMany.useQuery(
    {
      projectId,
      limit: 100,
      includeFragment: true,
    },
    {
      initialData: initialMessages as any,
      refetchOnWindowFocus: true,
      // Reduce polling frequency when streaming is active
      refetchInterval: streamState.isStreaming ? 10000 : 5000,
    }
  );

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages]);

  // Combine streaming events with regular messages for display
  // Memoize with explicit dependencies to prevent unnecessary recalculations
  const streamingMessages = useMemo(() => {
    const msgs: any[] = [];
    const fileStatusMap = new Map<string, { generating: any; complete: any }>();
    let validationStatus: { start: any; complete: any } = { start: null, complete: null };
    
    // Early return if no events
    if (streamState.events.length === 0) {
      return msgs;
    }
    
    // First pass: collect file events and validation status
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
    streamState.events.forEach((event) => {
      if (event.type === 'step:start' && event.step !== 'Validating') {
        msgs.push({
          id: `stream-step-${event.timestamp}`,
          content: event.message,
          role: 'assistant' as const,
          type: 'text' as const,
          created_at: new Date(event.timestamp).toISOString(),
          updated_at: new Date(event.timestamp).toISOString(),
          isStreaming: true,
          icon: 'processing',
        });
      } else if (event.type === 'complete') {
        msgs.push({
          id: `stream-done-${event.timestamp}`,
          content: `✓ ${event.summary}`,
          role: 'assistant' as const,
          type: 'text' as const,
          created_at: new Date(event.timestamp).toISOString(),
          updated_at: new Date(event.timestamp).toISOString(),
          isStreaming: true,
          icon: 'complete',
        });
      }
    });
    
    return msgs;
  }, [streamState.events]);

  // Merge and sort all messages, avoiding duplicates
  const allMessages = useMemo(() => {
    // If we have streaming events, filter out database messages that might be duplicates
    const filteredDbMessages = streamState.isStreaming || streamState.events.length > 0 
      ? sortedMessages.filter((dbMsg) => {
          // Filter out database messages that are likely duplicates of streaming events
          // Keep user messages and error messages, but filter out AI result messages
          if (dbMsg.role === 'user') return true;
          if (dbMsg.type === 'error') return true;
          
          // Filter out AI messages that look like completion summaries
          if (dbMsg.role === 'assistant' && dbMsg.content.includes('API Generation Complete')) {
            return false; // Skip this, we'll show the streaming completion instead
          }
          
          return true;
        })
      : sortedMessages;

    return [...filteredDbMessages, ...streamingMessages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [sortedMessages, streamingMessages, streamState.isStreaming, streamState.events.length]);

  // Build file tree from streaming files when active, otherwise use database messages
  const fileTree = useMemo(() => {
    // If we have generated files from streaming (even if streaming has ended), use them
    // This prevents showing placeholder files while waiting for database update
    if (streamState.generatedFiles.length > 0) {
      // Convert streaming files directly to tree nodes without placeholders
      const streamingNodes: TreeNode[] = streamState.generatedFiles.map(file => ({
        id: file.filename,
        name: file.filename,
        type: 'file' as const,
        content: file.content,
        language: getLanguageFromFilename(file.filename),
      }));
      return streamingNodes;
    }
    
    // If streaming is active but no files yet, show empty tree (no placeholders)
    if (streamState.isStreaming) {
      return [];
    }
    
    return generateFileTreeFromProject(project, sortedMessages, streamState.generatedFiles);
  }, [project, sortedMessages, streamState.generatedFiles, streamState.isStreaming]);

  // Auto-select currently generating file during streaming
  useEffect(() => {
    if (streamState.isStreaming && streamState.currentFile) {
      // Always switch to the current file being generated
      setSelected(streamState.currentFile);
    }
  }, [streamState.isStreaming, streamState.currentFile]);

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

  const createMessage = api.messages.create.useMutation({
    onSuccess: () => {
      setInput("");
      setIsLoading(false);
      refetch();
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      setIsLoading(false);
    },
  });

  const send = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    try {
      await createMessage.mutateAsync({
        content: input.trim(),
        role: 'user',
        type: 'text',
        project_id: projectId,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <SimpleHeader />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <section className="w-full sm:w-80 md:w-96 lg:w-[28rem] xl:w-[32rem] flex flex-col h-full overflow-hidden border-r border-gray-800/50 backdrop-blur-sm" 
                 style={{ backgroundColor: '#09090B', minWidth: '320px', maxWidth: '512px', width: '400px' }}>
          <header className="h-12 shrink-0 px-4 flex items-center gap-2 text-sm font-medium border-b border-gray-800/50">
            <MessageSquare className="size-4 text-white flex-shrink-0" /> 
            <span className="text-white truncate flex-1 min-w-0">{project.name}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {getStatusIcon(project.status)}
              <span className={`text-xs ${getStatusColor(project.status)} hidden sm:inline`}>
                {project.status}
              </span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" 
               style={{ 
                 backgroundColor: '#09090B',
                 height: 'calc(100vh - 140px)', // Reduced from 172px to prevent header collision
                 maxHeight: 'calc(100vh - 140px)',
                 minHeight: 'calc(100vh - 140px)'
               }}>
            <AnimatePresence>
              {allMessages.map((message, index) => {
                const isStreamingMsg = 'isStreaming' in message && message.isStreaming;
                const streamIcon = 'icon' in message ? message.icon : null;
                
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`text-sm flex gap-3 ${
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" 
                         style={{ backgroundColor: message.role === "user" ? '#3b82f6' : '#10b981' }}>
                      {message.role === "user" ? (
                        <User className="size-4 text-white" />
                      ) : (
                        <Bot className="size-4 text-white" />
                      )}
                    </div>
                    <div
                      className={`rounded-lg px-4 py-3 shadow-sm backdrop-blur-sm border border-gray-700/30 ${
                        message.role === "user"
                          ? "text-white"
                          : "text-white"
                      }`}
                      style={{ 
                        backgroundColor: message.role === "user" ? '#333333' : '#1a1a1a',
                        width: '280px', // Fixed width for consistent sizing
                        maxWidth: '280px',
                        minWidth: '200px'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {isStreamingMsg && streamIcon === 'generating' && (
                          <Loader2 className="size-3 animate-spin text-blue-400" />
                        )}
                        {isStreamingMsg && streamIcon === 'complete' && (
                          <CheckCircle className="size-3 text-green-400" />
                        )}
                        {isStreamingMsg && streamIcon === 'processing' && (
                          <Loader2 className="size-3 animate-spin text-yellow-400" />
                        )}
                        <div className="whitespace-pre-wrap break-words leading-relaxed text-sm flex-1">{message.content}</div>
                      </div>
                      {message.fragments && message.fragments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-600/50">
                          <div className="text-xs text-gray-400 mb-2 font-medium">Generated Files:</div>
                          {message.fragments.map((fragment: Fragment) => (
                            <div key={fragment.id} className="text-xs text-blue-300 mb-1 flex items-center gap-1">
                              <FileCode className="size-3" />
                              <span className="truncate">{fragment.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(message.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 p-3 border-t border-gray-800/50 backdrop-blur-sm" style={{ backgroundColor: '#09090B', height: '80px' }}>
            <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-600/50 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-gray-500/50 focus-within:border-blue-500/50" 
                 style={{ backgroundColor: '#333333', height: '48px', minHeight: '48px', maxHeight: '48px' }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Continue the conversation..."
                className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm leading-relaxed"
                style={{ height: '24px', minHeight: '24px', maxHeight: '24px' }}
                disabled={isLoading}
              />
              <button 
                onClick={send} 
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 rounded-md text-sm font-medium text-white transition-all duration-200 hover:bg-blue-600 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 shadow-md"
                style={{ backgroundColor: '#3b82f6', height: '32px', minHeight: '32px', maxHeight: '32px', width: '44px', minWidth: '44px' }}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
          </div>
        </section>

        <section className="hidden sm:flex flex-1 p-3 min-h-0 relative" style={{
          minWidth: '800px',
          width: '100%'
        }}>
          <button
            onClick={() => setIsMobileExplorerOpen(!isMobileExplorerOpen)}
            className="sm:hidden absolute top-4 left-4 z-50 p-2 rounded-md bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            <Folder className="size-4" />
          </button>

          <div className="h-full w-full rounded-lg border border-gray-700/50 bg-card shadow-xl overflow-hidden flex backdrop-blur-sm" style={{
            minWidth: '750px',
            width: '100%'
          }}>
            <aside className={`
              w-48 lg:w-52 xl:w-56 border-r border-gray-700/50 flex-shrink-0 transition-all duration-300
              ${isMobileExplorerOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
              sm:relative absolute sm:z-auto z-40 h-full
            `} style={{ backgroundColor: '#1D1D1D' }}>
              <div className="h-10 border-b border-gray-700/50 px-3 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400 font-medium backdrop-blur-sm">
                <span>Explorer</span>
                <button
                  onClick={() => setIsMobileExplorerOpen(false)}
                  className="sm:hidden p-1 hover:bg-gray-700 rounded"
                >
                  ×
                </button>
              </div>
              <div className="p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" 
                   style={{ 
                     height: 'calc(100% - 2.5rem)',
                     maxHeight: 'calc(100vh - 8rem)'
                   }}>
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

            <div className="flex-1 min-w-0 flex flex-col relative" style={{ 
              backgroundColor: '#1D1D1D',
              minWidth: '600px',
              width: '100%'
            }}>
              <div className="h-full w-full overflow-hidden">
                {(streamState.isStreaming || streamState.events.length > 0) && streamState.generatedFiles.length > 0 ? (
                  <StreamingCodeViewer
                    files={streamState.generatedFiles}
                    currentFile={streamState.currentFile}
                    isStreaming={streamState.isStreaming}
                    selectedFile={selected || undefined}
                  />
                ) : (
                  <CodeViewer filename={selected} fileTree={fileTree} />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="sm:hidden flex-1 p-2 min-h-0">
          <div className="h-full w-full rounded-lg border border-gray-700/50 bg-card shadow-xl overflow-hidden" style={{ backgroundColor: '#1D1D1D' }}>
            <div className="h-10 border-b border-gray-700/50 px-3 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400 font-medium">
              <span>Code</span>
              <button
                onClick={() => setIsMobileExplorerOpen(true)}
                className="p-1 hover:bg-gray-700 rounded flex items-center gap-1"
              >
                <Folder className="size-3" />
                Files
              </button>
            </div>
            <div className="h-full overflow-hidden" style={{ height: 'calc(100% - 2.5rem)' }}>
              <CodeViewer filename={selected} fileTree={fileTree} />
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
        
        @media (max-width: 640px) {
          .h-screen {
            height: 100vh;
            height: 100dvh;
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
        
        button:focus-visible,
        input:focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
        
        body {
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
    </div>
  );
}