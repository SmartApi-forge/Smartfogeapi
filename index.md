"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, FolderOpen, FileCode, ChevronRight, MessageSquare } from "lucide-react";
import { Highlight } from "prism-react-renderer";
import theme from 'prism-react-renderer/themes/vsDark';

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
  const padding = 8 + depth * 12;

  return (
    <div>
      <button
        onClick={() => (isFolder ? toggle(node.id) : select(node.id))}
        className={`group w-full text-left flex items-center gap-2 py-1.5 pr-2 rounded hover:bg-accent/80 focus:bg-accent/80`}
        style={{ paddingLeft: padding }}
      >
        {/* Chevron */}
        {isFolder ? (
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="inline-flex"
          >
            <ChevronRight className="size-3.5 text-muted-foreground" />
          </motion.span>
        ) : (
          <span className="w-[14px]" />
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
              className="inline-flex"
            >
              {isOpen ? (
                <FolderOpen className="size-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <Folder className="size-4 text-amber-600 dark:text-amber-400" />
              )}
            </motion.span>
          ) : (
            <span className="inline-flex">{getFileIcon(node.name)}</span>
          )}
        </AnimatePresence>

        <span
          className={`truncate text-sm ${
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
        <Highlight code={code} language={lang} theme={theme}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={className} style={{ ...style, padding: "1rem", margin: 0, background: "transparent" }}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line, key: i })} className="grid grid-cols-[48px_1fr] items-center">
                  <span className="select-none text-muted-foreground/70 text-right pr-4 text-xs">
                    {i + 1}
                  </span>
                  <div className="flex">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token, key })} />
                    ))}
                  </div>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}

export const ProjectsView = () => {
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
    <div className="flex h-[calc(100vh-4rem)] min-h-[560px] w-full gap-4">
      {/* Left: Chat panel */}
      <section className="w-full max-w-[360px] border rounded-lg overflow-hidden flex flex-col">
        <header className="h-11 shrink-0 border-b px-3 flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="size-4 text-muted-foreground" /> Chat
        </header>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`text-sm max-w-[90%] ${
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-accent text-foreground"
              } rounded px-3 py-2`}
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="p-2 border-t flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message..."
            className="flex-1 h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2"
          />
          <button onClick={send} className="h-9 px-3 rounded-md bg-foreground text-background text-sm">
            Send
          </button>
        </div>
      </section>

      {/* Right: Curved content area */}
      <section className="flex-1">
        <div className="h-full w-full rounded-3xl border bg-card shadow-sm overflow-hidden flex">
          {/* Explorer */}
          <aside className="w-64 border-r bg-secondary/40">
            <div className="h-10 border-b px-3 flex items-center text-xs uppercase tracking-wide text-muted-foreground">
              Explorer
            </div>
            <div className="p-2">
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
          <div className="flex-1 min-w-0">
            <CodeViewer filename={selected} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProjectsView;