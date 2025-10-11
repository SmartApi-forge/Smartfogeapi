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

// Types
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

// File tree structure for displaying generated API files
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
      return <Clock className="size-4 text-yellow-500" />;
    case 'deployed':
      return <CheckCircle className="size-4 text-green-500" />;
    case 'failed':
      return <XCircle className="size-4 text-red-500" />;
    default:
      return <AlertCircle className="size-4 text-blue-500" />;
  }
}

function getStatusColor(status: Project['status']) {
  switch (status) {
    case 'generating':
      return 'text-yellow-500';
    case 'deployed':
      return 'text-green-500';
    case 'failed':
      return 'text-red-500';
    default:
      return 'text-blue-500';
  }
}

function generateFileTreeFromProject(project: Project, messages: Message[] = []): TreeNode[] {
  // Start with base tree structure
  const baseTree: TreeNode[] = [
    {
      id: "src",
      name: "src",
      type: "folder",
      children: []
    },
    {
      id: "README.md",
      name: "README.md",
      type: "file",
      content: `# ${project.name}\n\n${project.description || 'API generated with SmartAPIForge'}\n\n## Framework\n${project.framework}\n\n## Status\n${project.status}\n\n${project.deploy_url ? `## Deployment\n[View Live API](${project.deploy_url})` : ''}`,
      language: 'markdown'
    }
  ];

  // Extract all generated files from message fragments
  const generatedFiles: Record<string, { content: string; language: string }> = {};
  
  messages.forEach(message => {
    if (message.fragments && message.fragments.length > 0) {
      message.fragments.forEach(fragment => {
        if (fragment.files && typeof fragment.files === 'object') {
          Object.entries(fragment.files).forEach(([filename, content]) => {
            if (typeof content === 'string' && content.trim()) {
              // Determine language based on file extension
              let language = 'text';
              if (filename.endsWith('.py')) language = 'python';
              else if (filename.endsWith('.js')) language = 'javascript';
              else if (filename.endsWith('.json')) language = 'json';
              else if (filename.endsWith('.md')) language = 'markdown';
              else if (filename.endsWith('.yaml') || filename.endsWith('.yml')) language = 'yaml';
              else if (filename.endsWith('.html')) language = 'html';
              else if (filename.endsWith('.css')) language = 'css';
              else if (filename.endsWith('.ts')) language = 'typescript';
              else if (filename.endsWith('.jsx')) language = 'jsx';
              else if (filename.endsWith('.tsx')) language = 'tsx';
              else if (filename.endsWith('.sql')) language = 'sql';
              else if (filename.endsWith('.sh')) language = 'bash';
              else if (filename.endsWith('.dockerfile') || filename === 'Dockerfile') language = 'dockerfile';

              generatedFiles[filename] = {
                content: content,
                language: language
              };
            }
          });
        }
      });
    }
  });

  // Add generated files to the tree structure
  const srcFolder = baseTree.find(node => node.id === "src");
  if (srcFolder && srcFolder.children) {
    // Ensure src folder has children array
      if (!srcFolder.children) {
        srcFolder.children = [];
      }
      
      // Add generated files to src folder or root based on filename
    Object.entries(generatedFiles).forEach(([filename, fileData]) => {
      const fileNode: TreeNode = {
        id: filename,
        name: filename,
        type: "file",
        content: fileData.content,
        language: fileData.language
      };

      // Determine where to place the file
      if (filename.includes('/')) {
        // Handle nested file paths
        const pathParts = filename.split('/');
        const fileName = pathParts.pop()!;
        let currentFolder = srcFolder;

        // Create nested folder structure
        pathParts.forEach(folderName => {
          let folder = currentFolder.children?.find(child => child.name === folderName && child.type === 'folder');
          if (!folder) {
            folder = {
              id: `${currentFolder.id}/${folderName}`,
              name: folderName,
              type: 'folder',
              children: []
            };
            currentFolder.children = currentFolder.children || [];
            currentFolder.children.push(folder);
          }
          currentFolder = folder;
        });

        // Add file to the deepest folder
        currentFolder.children = currentFolder.children || [];
        currentFolder.children.push({
          ...fileNode,
          id: filename,
          name: fileName
        });
      } else {
        // Add to src folder or root based on file type
        if (filename === 'README.md' || filename === 'requirements.txt' || filename === 'package.json' || filename === 'Dockerfile') {
          // Add to root level, replace existing if needed
          const existingIndex = baseTree.findIndex(node => node.name === filename);
          if (existingIndex >= 0) {
            baseTree[existingIndex] = fileNode;
          } else {
            baseTree.push(fileNode);
          }
        } else {
          // Add to src folder (ensure children exists)
          if (srcFolder.children) {
            srcFolder.children.push(fileNode);
          }
        }
      }
    });
  }

  // Add default files if no generated files exist
  if (Object.keys(generatedFiles).length === 0 && srcFolder && srcFolder.children) {
    srcFolder.children.push(
      {
        id: "main.py",
        name: project.framework === 'fastapi' ? "main.py" : "app.js",
        type: "file",
        content: project.framework === 'fastapi' 
          ? `from fastapi import FastAPI\n\napp = FastAPI(title="${project.name}")\n\n@app.get("/")\ndef read_root():\n    return {"message": "Hello from ${project.name}!"}`
          : `const express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => {\n  res.json({ message: 'Hello from ${project.name}!' });\n});\n\napp.listen(3000, () => {\n  console.log('Server running on port 3000');\n});`,
        language: project.framework === 'fastapi' ? 'python' : 'javascript'
      },
      {
        id: "requirements.txt",
        name: project.framework === 'fastapi' ? "requirements.txt" : "package.json",
        type: "file",
        content: project.framework === 'fastapi'
          ? `fastapi==0.104.1\nuvicorn==0.24.0`
          : `{\n  "name": "${project.name.toLowerCase().replace(/\s+/g, '-')}",\n  "version": "1.0.0",\n  "dependencies": {\n    "express": "^4.18.2"\n  }\n}`,
        language: project.framework === 'fastapi' ? 'text' : 'json'
      }
    );
  }

  return baseTree;
}

function getFileIcon(name: string) {
  if (name.endsWith('.py')) return '🐍';
  if (name.endsWith('.js')) return '📜';
  if (name.endsWith('.json')) return '📋';
  if (name.endsWith('.md')) return '📝';
  return '📄';
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
        className={`flex items-center gap-1 px-1 py-0.5 text-xs cursor-pointer hover:bg-gray-700/50 rounded ${
          isSelected ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          if (node.type === 'folder') {
            toggle(node.id);
          } else {
            select(node.id);
          }
        }}
      >
        {node.type === 'folder' && (
          <ChevronRight
            className={`size-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        )}
        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpen className="size-3" />
          ) : (
            <Folder className="size-3" />
          )
        ) : (
          <span className="text-xs">{getFileIcon(node.name)}</span>
        )}
        <span className="truncate">{node.name}</span>
      </div>
      
      <AnimatePresence>
        {node.type === 'folder' && isExpanded && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
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
    const findFile = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === filename) return node;
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findFile(fileTree);
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
      <div className="h-full flex flex-col">
        <div className="h-12 border-b px-4 flex items-center justify-between text-xs text-gray-300 bg-gray-800/50 flex-shrink-0">
          <span>No file selected</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Select a file to view its contents
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced file header with action buttons - optimized height */}
      <div className="h-10 border-b px-3 flex items-center justify-between text-xs text-gray-300 bg-gray-800/50 flex-shrink-0">
        <div className="flex items-center min-w-0">
          <span className="mr-2 flex-shrink-0">{getFileIcon(selectedFile.name)}</span>
          <span className="font-medium truncate">{selectedFile.name}</span>
          <span className="ml-2 text-gray-500 flex-shrink-0">
            ({selectedFile.language || 'text'})
          </span>
        </div>
        
        {/* Compact action buttons */}
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
      
      {/* Code content with optimized scrolling and full viewport utilization */}
      <div 
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800" 
        style={{ 
          minHeight: 0,
          maxHeight: 'calc(100vh - 10rem)', // Optimized for maximum viewport usage
          scrollBehavior: 'smooth'
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
                  fontSize: 'clamp(11px, 1.5vw, 14px)', // Responsive font sizing
                }}
              >
                {tokens.map((line, i) => (
                  <div 
                    key={i} 
                    {...getLineProps({ line })}
                    className="flex hover:bg-gray-800/30 transition-colors"
                    style={{ minHeight: '1.25rem' }} // Consistent line height
                  >
                    <span 
                      className="inline-block w-10 text-right mr-3 text-gray-500 select-none flex-shrink-0 text-xs leading-5"
                      style={{ fontSize: 'clamp(10px, 1.2vw, 12px)' }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 break-all">
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

  // Use tRPC query with initial data and real-time updates
  const { data: messages = initialMessages, refetch } = api.messages.getMany.useQuery(
    {
      projectId,
      limit: 100,
      includeFragment: true,
    },
    {
      initialData: initialMessages as any,
      refetchOnWindowFocus: true,
      refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    }
  );

  // Sort messages by creation date (oldest first, user messages at bottom)
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages]);

  // Generate file tree from project and messages
  const fileTree = useMemo(() => generateFileTreeFromProject(project, sortedMessages), [project, sortedMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedMessages]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const select = (id: string) => setSelected(id);

  // Create message mutation
  const createMessage = api.messages.create.useMutation({
    onSuccess: () => {
      refetch(); // Refresh messages after sending
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  });

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    
    setIsLoading(true);
    setInput("");

    try {
      await createMessage.mutateAsync({
        content: text,
        role: 'user',
        type: 'text',
        project_id: projectId,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setInput(text); // Restore input on error
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <SimpleHeader />
      
      {/* Main content - Responsive layout with optimized space utilization */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Chat sidebar - Responsive width with mobile-first approach */}
        <section className="w-full sm:w-80 md:w-96 lg:w-[28rem] xl:w-[32rem] flex flex-col h-full overflow-hidden border-r border-gray-800/50 backdrop-blur-sm" 
                 style={{ backgroundColor: '#09090B' }}>
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
          
          {/* Messages container with optimized scrolling and space utilization */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" 
               style={{ 
                 backgroundColor: '#09090B',
                 height: 'calc(100vh - 12rem)', // Precise height calculation
                 maxHeight: 'calc(100vh - 12rem)'
               }}>
            <AnimatePresence>
              {sortedMessages.map((message, index) => (
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
                    className={`flex-1 rounded-lg px-4 py-3 shadow-sm max-w-[85%] backdrop-blur-sm border border-gray-700/30 ${
                      message.role === "user"
                        ? "text-white"
                        : "text-white"
                    }`}
                    style={{ 
                      backgroundColor: message.role === "user" ? '#333333' : '#1a1a1a',
                    }}
                  >
                    <div className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
                    {message.fragments && message.fragments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-600/50">
                        <div className="text-xs text-gray-400 mb-2 font-medium">Generated Files:</div>
                        {message.fragments.map((fragment) => (
                          <div key={fragment.id} className="text-xs text-blue-300 mb-1 flex items-center gap-1">
                            <FileCode className="size-3" />
                            {fragment.title}
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
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Fixed input at bottom - Enhanced responsive design */}
          <div className="shrink-0 p-3 border-t border-gray-800/50 backdrop-blur-sm" style={{ backgroundColor: '#09090B' }}>
            <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-600/50 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-gray-500/50 focus-within:border-blue-500/50" 
                 style={{ backgroundColor: '#333333' }}>
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
                disabled={isLoading}
              />
              <button 
                onClick={send} 
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 rounded-md text-sm font-medium text-white transition-all duration-200 hover:bg-blue-600 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 shadow-md"
                style={{ backgroundColor: '#3b82f6' }}
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

        {/* Right: Enhanced VS Code-style file explorer and editor with full responsiveness */}
        <section className="hidden sm:flex flex-1 p-3 min-h-0 relative">
          {/* Mobile explorer toggle button */}
          <button
            onClick={() => setIsMobileExplorerOpen(!isMobileExplorerOpen)}
            className="sm:hidden absolute top-4 left-4 z-50 p-2 rounded-md bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            <Folder className="size-4" />
          </button>

          <div className="h-full w-full rounded-lg border border-gray-700/50 bg-card shadow-xl overflow-hidden flex backdrop-blur-sm">
            {/* File Explorer - Enhanced responsive design */}
            <aside className={`
              w-64 lg:w-72 xl:w-80 border-r border-gray-700/50 flex-shrink-0 transition-all duration-300
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

            {/* Overlay for mobile explorer */}
            {isMobileExplorerOpen && (
              <div
                className="sm:hidden absolute inset-0 bg-black/50 z-30"
                onClick={() => setIsMobileExplorerOpen(false)}
              />
            )}

            {/* Code Editor with enhanced responsive layout and scroll optimization */}
            <div className="flex-1 min-w-0 flex flex-col relative" style={{ backgroundColor: '#1D1D1D' }}>
              <div className="h-full w-full overflow-hidden">
                <CodeViewer filename={selected} fileTree={fileTree} />
              </div>
            </div>
          </div>
        </section>

        {/* Mobile-only code viewer */}
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

      {/* Custom CSS for enhanced scrollbars and responsive behavior */}
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
        
        /* Enhanced responsive breakpoints */
        @media (max-width: 640px) {
          .h-screen {
            height: 100vh;
            height: 100dvh; /* Dynamic viewport height for mobile */
          }
        }
        
        @media (min-width: 1024px) {
          .scrollbar-thin::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
        }
        
        /* Smooth transitions for all interactive elements */
        * {
          transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
        }
        
        /* Enhanced focus states for accessibility */
        button:focus-visible,
        input:focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
        
        /* Optimized text rendering */
        body {
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
    </div>
  );
}