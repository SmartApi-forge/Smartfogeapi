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
  Loader2
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

  if (!selectedFile || selectedFile.type === 'folder') {
    return (
      <div className="h-full flex flex-col">
        <div className="h-10 border-b px-3 flex items-center text-xs text-gray-300 bg-gray-800/50">
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
      {/* File header */}
      <div className="h-10 border-b px-3 flex items-center text-xs text-gray-300 bg-gray-800/50 flex-shrink-0">
        <span className="mr-2">{getFileIcon(selectedFile.name)}</span>
        <span className="font-medium">{selectedFile.name}</span>
        <span className="ml-2 text-gray-500">
          ({selectedFile.language || 'text'})
        </span>
      </div>
      
      {/* Code content with proper scrolling */}
      <div className="flex-1 overflow-auto">
        <div className="min-h-full">
          <Highlight
            theme={themes.vsDark}
            code={selectedFile.content || '// No content available'}
            language={selectedFile.language || 'text'}
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre 
                className={`${className} text-sm leading-6 p-4 min-h-full`} 
                style={{
                  ...style,
                  margin: 0,
                  background: '#1D1D1D',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                }}
              >
                {tokens.map((line, i) => (
                  <div 
                    key={i} 
                    {...getLineProps({ line })}
                    className="flex hover:bg-gray-800/30 transition-colors"
                  >
                    <span className="inline-block w-12 text-right mr-4 text-gray-500 select-none flex-shrink-0 text-xs leading-6">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0">
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <SimpleHeader />
      
      {/* Main content */}
      <div className="flex flex-1 h-[calc(100vh-80px)] relative">
        {/* Left: Chat sidebar */}
        <section className="w-full md:w-96 flex flex-col h-full overflow-hidden border-r" style={{ backgroundColor: '#09090B' }}>
          <header className="h-12 shrink-0 px-4 flex items-center gap-2 text-sm font-medium border-b border-gray-800">
            <MessageSquare className="size-4 text-white" /> 
            <span className="text-white truncate">{project.name}</span>
            <div className="ml-auto flex items-center gap-1">
              {getStatusIcon(project.status)}
              <span className={`text-xs ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
          </header>
          
          {/* Messages container with proper scrolling */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: '#09090B' }}>
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
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" 
                       style={{ backgroundColor: message.role === "user" ? '#3b82f6' : '#10b981' }}>
                    {message.role === "user" ? (
                      <User className="size-4 text-white" />
                    ) : (
                      <Bot className="size-4 text-white" />
                    )}
                  </div>
                  <div
                    className={`flex-1 rounded-lg px-4 py-3 shadow-sm max-w-[85%] ${
                      message.role === "user"
                        ? "text-white"
                        : "text-white"
                    }`}
                    style={{ 
                      backgroundColor: message.role === "user" ? '#333333' : '#1a1a1a',
                    }}
                  >
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    {message.fragments && message.fragments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="text-xs text-gray-400 mb-2">Generated Files:</div>
                        {message.fragments.map((fragment) => (
                          <div key={fragment.id} className="text-xs text-blue-300 mb-1">
                            📄 {fragment.title}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input at bottom of chat */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-600 shadow-lg" style={{ backgroundColor: '#333333' }}>
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
                className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm"
                disabled={isLoading}
              />
              <button 
                onClick={send} 
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 rounded-md text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

        {/* Right: VS Code-style file explorer and editor - Hidden on mobile, shown on desktop */}
        <section className="hidden md:flex flex-1 p-4">
          <div className="h-full w-full rounded-lg border bg-card shadow-sm overflow-hidden flex">
            {/* File Explorer */}
            <aside className="w-64 border-r flex-shrink-0" style={{ backgroundColor: '#1D1D1D' }}>
              <div className="h-10 border-b px-3 flex items-center text-xs uppercase tracking-wide text-gray-400 font-medium">
                Explorer
              </div>
              <div className="p-2 overflow-y-auto h-[calc(100%-2.5rem)]">
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

            {/* Code Editor with improved scrolling */}
            <div className="flex-1 min-w-0 flex flex-col" style={{ backgroundColor: '#1D1D1D' }}>
              <CodeViewer filename={selected} fileTree={fileTree} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}