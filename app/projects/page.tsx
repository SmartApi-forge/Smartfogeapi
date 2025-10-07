"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, FolderOpen, FileCode, ChevronRight, MessageSquare } from "lucide-react";
import { SimpleHeader } from "@/components/simple-header";
import { Highlight, themes } from "prism-react-renderer";

// Simple file tree data
export type TreeNode = {
  id: string;
  name: string;
  type: "folder" | "file";
  children?: TreeNode[];
};

const sampleTree: TreeNode[] = [
  {
    id: "src",
    name: "src",
    type: "folder",
    children: [
      {
        id: "app",
        name: "app",
        type: "folder",
        children: [
          { id: "page.tsx", name: "page.tsx", type: "file" },
          { id: "layout.tsx", name: "layout.tsx", type: "file" },
        ],
      },
      {
        id: "components",
        name: "components",
        type: "folder",
        children: [
          { id: "button.tsx", name: "button.tsx", type: "file" },
          { id: "navbar.tsx", name: "navbar.tsx", type: "file" },
        ],
      },
      { id: "utils.ts", name: "utils.ts", type: "file" },
    ],
  },
  { id: "package.json", name: "package.json", type: "file" },
  { id: "README.md", name: "README.md", type: "file" },
];

const codeSamplesWithLang: Record<string, { code: string; lang: string }> = {
  "page.tsx": { 
    code: `export default function Home() {
  return (
    <main className="p-8">Hello VS Code-like UI</main>
  )
}`, 
    lang: "tsx" 
  },
  "layout.tsx": { 
    code: `export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>
}`, 
    lang: "tsx" 
  },
  "button.tsx": { 
    code: `type Props = React.ButtonHTMLAttributes<HTMLButtonElement>
export const Button = ({ className, ...props }: Props) => {
  return <button className={\`px-3 py-2 rounded bg-blue-600 text-white\`} {...props} />
}`, 
    lang: "tsx" 
  },
  "navbar.tsx": { 
    code: `export const Navbar = () => (
  <nav className="h-12 border-b flex items-center px-4">Navbar</nav>
)`, 
    lang: "tsx" 
  },
  "utils.ts": { 
    code: `export const sum = (a: number, b: number) => a + b`, 
    lang: "ts" 
  },
  "package.json": { 
    code: `{
  "name": "demo",
  "private": true
}`, 
    lang: "json" 
  },
  "README.md": { 
    code: `# Demo

This is a demo readme.`, 
    lang: "markdown" 
  },
};

function getFileIcon(name: string) {
  // Could vary by extension if desired
  return <FileCode className="size-4 text-muted-foreground" />;
}

function TreeItem({ node, depth = 0, expanded, toggle, select, selectedId }: {
  node: TreeNode;
  depth?: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  select: (id: string) => void;
  selectedId?: string | null;
}) {
  const isFolder = node.type === "folder";
  const isOpen = expanded.has(node.id);
  const padding = 6 + depth * 10;

  return (
    <div>
      <button
        onClick={() => (isFolder ? toggle(node.id) : select(node.id))}
        className={`group w-full text-left flex items-center gap-1.5 py-1 pr-2 rounded cursor-pointer relative ${
          selectedId === node.id ? "text-foreground" : "text-foreground/90"
        }`}
        style={{ 
          paddingLeft: padding,
          backgroundColor: 'transparent'
        }}
      >
        {/* Selection background that only covers the content */}
        {selectedId === node.id && (
          <div 
            className="absolute inset-y-0 left-0 rounded"
            style={{ 
              backgroundColor: '#333333',
              right: `calc(100% - ${node.name.length * 7 + 32 + padding}px)`
            }}
          />
        )}

        {/* Folder/File icon */}
        <AnimatePresence initial={false} mode="wait">
          {isFolder ? (
            <motion.span
              key={isOpen ? "open" : "closed"}
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={{ duration: 0.12 }}
              className="inline-flex relative z-10"
            >
              {isOpen ? (
                <FolderOpen className="size-3.5 text-amber-600 dark:text-amber-400" />
              ) : (
                <Folder className="size-3.5 text-amber-600 dark:text-amber-400" />
              )}
            </motion.span>
          ) : (
            <span className="inline-flex relative z-10">{getFileIcon(node.name)}</span>
          )}
        </AnimatePresence>

        <span
          className={`truncate text-xs relative z-10 ${
            selectedId === node.id ? "text-foreground" : "text-foreground/90"
          }`}
        >
          {node.name}
        </span>
      </button>

      {/* Children */}
      {isFolder && (
        <AnimatePresence initial={false}>
          {isOpen && node.children && node.children.length > 0 && (
            <motion.div
              key="children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.16 }}
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
      )}
    </div>
  );
}

function CodeViewer({ filename }: { filename: string | null }) {
  const { code, lang } = useMemo(() => 
    filename ? (codeSamplesWithLang[filename] ?? { code: "", lang: "text" }) : { code: "", lang: "text" },
    [filename]
  );

  if (!filename) {
    return (
      <div className="h-full w-full grid place-items-center text-muted-foreground text-sm">
        Select a file to preview its code
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      {/* Tab bar */}
      <div className="h-10 shrink-0 flex items-center gap-2 border-b border-border/60 px-3 text-sm">
        <FileCode className="size-4 text-muted-foreground" />
        <span className="truncate">{filename}</span>
      </div>
      {/* Editor area */}
      <div className="flex-1 overflow-auto">
        <Highlight code={code} language={lang} theme={themes.vsDark}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={className} style={{ ...style, padding: "1rem", margin: 0, background: "transparent" }}>
              {tokens.map((line, i) => {
                const lineProps = getLineProps({ line });
                return (
                  <div key={i} {...lineProps} className="grid grid-cols-[48px_1fr] items-center">
                    <span className="select-none text-muted-foreground/70 text-right pr-4 text-xs">
                      {i + 1}
                    </span>
                    <div className="flex">
                      {line.map((token, key) => {
                        const tokenProps = getTokenProps({ token });
                        return (
                          <span key={key} {...tokenProps} />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["src", "app", "components"]));
  const [selected, setSelected] = useState<string | null>(null);
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const select = (id: string) => setSelected(id);

  // Simple chat state
  const [messages, setMessages] = useState<Array<{ id: number; role: "user" | "assistant"; text: string }>>([
    { id: 1, role: "assistant", text: "Welcome! Select a file on the right to view code." },
  ]);
  const [input, setInput] = useState("");

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { id: Date.now(), role: "user", text }]);
    setInput("");
    // Fake assistant echo
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, role: "assistant", text: `You said: ${text}` },
      ]);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Navbar */}
      <SimpleHeader />
      
      {/* Main content */}
      <div className="flex flex-1 h-[calc(100vh-80px)]">
        {/* Left: Chat sidebar */}
        <section className="w-96 flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#09090B' }}>
          <header className="h-10 shrink-0 px-4 flex items-center gap-2 text-sm font-medium" style={{ backgroundColor: '#09090B' }}>
            <MessageSquare className="size-4 text-white" /> 
            <span className="text-white">Chat</span>
          </header>
          <div className="flex-1 overflow-auto p-4 space-y-3 pb-4" style={{ backgroundColor: '#09090B' }}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`text-sm ${
                  m.role === "user"
                    ? "ml-auto text-white rounded-lg px-4 py-3 shadow-sm"
                    : "mr-auto text-white"
                }`}
                style={{ 
                  backgroundColor: m.role === "user" ? '#333333' : 'transparent',
                  maxWidth: m.role === "user" ? 'fit-content' : '85%'
                }}
              >
                {m.text}
              </div>
            ))}
          </div>
        </section>

        {/* Right: Curved content area */}
        <section className="flex-1 p-4">
          <div className="h-full w-full rounded-3xl border bg-card shadow-sm overflow-hidden flex">
              {/* Explorer - Smaller width and text */}
              <aside className="w-52 border-r" style={{ backgroundColor: '#1D1D1D' }}>
                <div className="h-8 border-b px-2 flex items-center text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Explorer
                </div>
                <div className="p-1 relative">
                  {sampleTree.map((node) => (
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

              {/* Editor */}
              <div className="flex-1 min-w-0" style={{ backgroundColor: '#1D1D1D' }}>
                <CodeViewer filename={selected} />
              </div>
            </div>
          </section>
      </div>
      
      {/* Prompt input fixed at left bottom of entire page */}
      <div className="absolute bottom-4 left-4 w-96 p-4">
        <div className="flex items-center gap-2 p-3 rounded-full border border-gray-600 shadow-lg" style={{ backgroundColor: '#333333' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Orchids to make changes"
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