"use client";

import { useState, useMemo } from "react";
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
  AlertCircle
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

function generateFileTreeFromProject(project: Project): TreeNode[] {
  const baseTree: TreeNode[] = [
    {
      id: "src",
      name: "src",
      type: "folder",
      children: [
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
      ]
    },
    {
      id: "README.md",
      name: "README.md",
      type: "file",
      content: `# ${project.name}\n\n${project.description || 'API generated with SmartAPIForge'}\n\n## Framework\n${project.framework}\n\n## Status\n${project.status}\n\n${project.deploy_url ? `## Deployment\n[View Live API](${project.deploy_url})` : ''}`,
      language: 'markdown'
    }
  ];

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
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Select a file to view its contents
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-8 border-b px-3 flex items-center text-xs text-gray-300 bg-gray-800/50">
        <span className="mr-2">{getFileIcon(selectedFile.name)}</span>
        {selectedFile.name}
      </div>
      <div className="flex-1 overflow-auto p-3">
        <Highlight
          theme={themes.vsDark}
          code={selectedFile.content || '// No content available'}
          language={selectedFile.language || 'text'}
        >
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={`${className} text-xs leading-relaxed`} style={style}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  <span className="inline-block w-8 text-right mr-3 text-gray-500 select-none">
                    {i + 1}
                  </span>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
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

  // Generate file tree from project
  const fileTree = useMemo(() => generateFileTreeFromProject(project), [project]);

  // Use tRPC query with initial data
  const { data: messages = initialMessages } = api.messages.getMany.useQuery(
    {
      projectId,
      limit: 100,
      includeFragment: true,
    },
    {
      initialData: initialMessages as any,
      refetchOnWindowFocus: false,
    }
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const select = (id: string) => setSelected(id);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    // TODO: Implement message sending functionality
    setInput("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Header */}
      <SimpleHeader />
      
      {/* Main content */}
      <div className="flex flex-1 h-[calc(100vh-80px)]">
        {/* Left: Chat sidebar */}
        <section className="w-96 flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#09090B' }}>
          <header className="h-10 shrink-0 px-4 flex items-center gap-2 text-sm font-medium" style={{ backgroundColor: '#09090B' }}>
            <MessageSquare className="size-4 text-white" /> 
            <span className="text-white">Project: {project.name}</span>
            <div className="ml-auto flex items-center gap-1">
              {getStatusIcon(project.status)}
              <span className={`text-xs ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
          </header>
          
          <div className="flex-1 overflow-auto p-4 space-y-3 pb-4" style={{ backgroundColor: '#09090B' }}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`text-sm flex gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1" 
                     style={{ backgroundColor: message.role === "user" ? '#3b82f6' : '#10b981' }}>
                  {message.role === "user" ? (
                    <User className="size-3 text-white" />
                  ) : (
                    <Bot className="size-3 text-white" />
                  )}
                </div>
                <div
                  className={`flex-1 rounded-lg px-4 py-3 shadow-sm ${
                    message.role === "user"
                      ? "text-white"
                      : "text-white"
                  }`}
                  style={{ 
                    backgroundColor: message.role === "user" ? '#333333' : '#1a1a1a',
                    maxWidth: '85%'
                  }}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.fragments && message.fragments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-600">
                      <div className="text-xs text-gray-400 mb-1">Generated Files:</div>
                      {message.fragments.map((fragment) => (
                        <div key={fragment.id} className="text-xs text-blue-300">
                          {fragment.fragment_type}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right: VS Code-style file explorer and editor */}
        <section className="flex-1 p-4">
          <div className="h-full w-full rounded-3xl border bg-card shadow-sm overflow-hidden flex">
            {/* File Explorer */}
            <aside className="w-52 border-r" style={{ backgroundColor: '#1D1D1D' }}>
              <div className="h-8 border-b px-2 flex items-center text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Explorer
              </div>
              <div className="p-1 relative">
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

            {/* Code Editor */}
            <div className="flex-1 min-w-0" style={{ backgroundColor: '#1D1D1D' }}>
              <CodeViewer filename={selected} fileTree={fileTree} />
            </div>
          </div>
        </section>
      </div>
      
      {/* Input at bottom left */}
      <div className="absolute bottom-4 left-4 w-96 p-4">
        <div className="flex items-center gap-2 p-3 rounded-full border border-gray-600 shadow-lg" style={{ backgroundColor: '#333333' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Continue the conversation..."
            className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm px-3"
          />
          <button 
            onClick={send} 
            className="px-4 py-2 rounded-full text-sm font-medium text-white transition-colors hover:bg-blue-600 flex-shrink-0"
            style={{ backgroundColor: '#3b82f6' }}
          >
            ↗
          </button>
        </div>
      </div>
    </div>
  );
}