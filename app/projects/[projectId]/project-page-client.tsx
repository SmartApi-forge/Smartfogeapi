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
  Check,
  ArrowUp,
  Paperclip,
  SlidersHorizontal,
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

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  type: "text" | "image" | "file" | "code" | "result" | "error";
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
  framework: "fastapi" | "express";
  status: "generating" | "testing" | "deploying" | "deployed" | "failed";
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

function getStatusIcon(status: Project["status"]) {
  switch (status) {
    case "generating":
      return <Loader2 className="size-4 animate-spin text-blue-400" />;
    case "deployed":
      return <CheckCircle className="size-4 text-green-400" />;
    case "failed":
      return <XCircle className="size-4 text-red-400" />;
    default:
      return <Clock className="size-4 text-yellow-400" />;
  }
}

function getStatusColor(status: Project["status"]) {
  switch (status) {
    case "generating":
      return "text-blue-400";
    case "deployed":
      return "text-green-400";
    case "failed":
      return "text-red-400";
    default:
      return "text-yellow-400";
  }
}

function generateFileTreeFromProject(
  project: Project,
  messages: Message[] = [],
  streamingFiles: any[] = [],
): TreeNode[] {
  // Check if we have any generated files from messages OR streaming
  const hasGeneratedFiles =
    messages.some(
      (message) => message.fragments && message.fragments.length > 0,
    ) || streamingFiles.length > 0;

  // Only show placeholder files if we don't have any real generated files
  const baseStructure: TreeNode[] = hasGeneratedFiles
    ? []
    : [
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
# Generated API based on: ${project.description || "No description provided"}

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(
    title="${project.name}",
    description="${project.description || "Generated API"}",
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
`,
            },
          ],
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
`,
        },
      ];

  // Add generated files from messages
  messages.forEach((message) => {
    if (message.fragments && message.fragments.length > 0) {
      message.fragments.forEach((fragment) => {
        if (fragment.files && typeof fragment.files === "object") {
          Object.entries(fragment.files).forEach(([filename, fileContent]) => {
            const pathParts = filename.split("/");
            let currentLevel = baseStructure;

            for (let i = 0; i < pathParts.length; i++) {
              const part = pathParts[i];
              const isFile = i === pathParts.length - 1;

              let existingNode = currentLevel.find(
                (node) => node.name === part,
              );

              if (!existingNode) {
                const newNode: TreeNode = {
                  id: pathParts.slice(0, i + 1).join("/"),
                  name: part,
                  type: isFile ? "file" : "folder",
                  children: isFile ? undefined : [],
                };

                if (isFile) {
                  newNode.content =
                    typeof fileContent === "string"
                      ? fileContent
                      : JSON.stringify(fileContent, null, 2);
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

/**
 * Calculate indentation level for a line of code
 */
function getIndentationLevel(line: string, tabSize: number = 2): number {
  let spaces = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === " ") {
      spaces++;
    } else if (line[i] === "\t") {
      spaces += tabSize;
    } else {
      break;
    }
  }
  return Math.floor(spaces / tabSize);
}

/**
 * Generate indentation guides for a line
 */
function renderIndentationGuides(
  indentLevel: number,
  lineNumber: number,
): React.ReactElement[] {
  const guides = [];
  const lineNumberWidth = 52; // Width of line number column in pixels (responsive, increased for better alignment)
  const charWidth = 8.4; // Approximate character width in pixels for monospace font
  const tabSize = 2; // Tab size for indentation

  for (let i = 0; i < indentLevel; i++) {
    const leftPosition = lineNumberWidth + i * tabSize * charWidth; // Precise positioning
    guides.push(
      <div
        key={`guide-${lineNumber}-${i}`}
        className="absolute border-l-[1px] border-gray-400/50 dark:border-gray-500/60 pointer-events-none"
        style={{
          left: `${leftPosition}px`,
          top: 0,
          bottom: 0,
          zIndex: 1,
        }}
      />,
    );
  }
  return guides;
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    py: "python",
    js: "javascript",
    ts: "typescript",
    tsx: "tsx",
    jsx: "jsx",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    txt: "text",
    sh: "bash",
    dockerfile: "dockerfile",
  };
  return languageMap[ext || ""] || "text";
}

function getFileIcon(name: string) {
  if (name.includes(".")) {
    return (
      <FileCode className="size-3.5 sm:size-4 text-blue-500 dark:text-blue-400" />
    );
  }
  return (
    <Folder className="size-3.5 sm:size-4 text-yellow-500 dark:text-yellow-400" />
  );
}

function TreeItem({
  node,
  depth = 0,
  expanded,
  toggle,
  select,
  selectedId,
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
        className={`flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-2 sm:py-1 text-xs sm:text-sm cursor-pointer hover:bg-muted/50 transition-colors rounded-md ${
          isSelected
            ? "bg-primary/10 dark:bg-[#333433] text-primary dark:text-foreground"
            : "text-foreground"
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
            className={`size-3 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          />
        )}
        {node.type === "folder" ? (
          isExpanded ? (
            <FolderOpen className="size-3.5 sm:size-4 flex-shrink-0 text-yellow-500 dark:text-yellow-400" />
          ) : (
            <Folder className="size-3.5 sm:size-4 flex-shrink-0 text-yellow-500 dark:text-yellow-400" />
          )
        ) : (
          <span className="flex-shrink-0">{getFileIcon(node.name)}</span>
        )}
        <span className="truncate min-w-0">{node.name}</span>
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
  versions = [],
  selectedVersionId,
  onVersionChange,
}: {
  filename: string | null;
  fileTree: TreeNode[];
  codeTheme: any;
  versions?: any[];
  selectedVersionId?: string | null;
  onVersionChange?: (versionId: string) => void;
}) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      console.error("Failed to copy code:", err);
    }
  };

  const handleDownload = () => {
    if (!selectedFile?.content || !selectedFile?.name) return;

    const blob = new Blob([selectedFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsVersionDropdownOpen(false);
      }
    };

    if (isVersionDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isVersionDropdownOpen]);

  if (!selectedFile || selectedFile.type === "folder") {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30 dark:bg-[#1D1D1D] p-4">
        <div className="text-center">
          <FileCode className="size-10 sm:size-12 mx-auto mb-3 sm:mb-4 opacity-50" />
          <p className="text-sm sm:text-base">
            Select a file to view its contents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Code viewer header - sticky and always visible with clear filename */}
      <div className="sticky top-0 z-10 h-12 sm:h-10 border-b border-border dark:border-[#333433] px-2 sm:px-3 flex items-center justify-between gap-3 text-xs text-foreground bg-white/50 dark:bg-[#1D1D1D] backdrop-blur-sm flex-shrink-0 shadow-sm">
        {/* Filename section - responsive spacing: large on mobile/tablet, compact on desktop */}
        <div className="flex items-center gap-4 sm:gap-5 lg:gap-2.5 min-w-0 flex-1 overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6">
            {getFileIcon(selectedFile.name)}
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 py-1">
            <span className="font-semibold truncate text-[12px] sm:text-[13px] text-foreground">
              {selectedFile.name}
            </span>
            <span className="text-muted-foreground flex-shrink-0 hidden md:inline text-[10px] sm:text-[11px] whitespace-nowrap opacity-70">
              • {selectedFile.language || "text"}
            </span>
          </div>
        </div>

        {/* Version Dropdown */}
        {versions.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
              className="flex items-center gap-1.5 px-2 py-1.5 sm:py-1 rounded text-xs hover:bg-muted dark:hover:bg-[#262726] transition-colors border border-border dark:border-gray-600"
              title="Switch version"
            >
              <span className="font-medium text-[11px]">
                v
                {versions.find((v: any) => v.id === selectedVersionId)
                  ?.version_number ||
                  versions[versions.length - 1]?.version_number ||
                  1}
              </span>
              <ChevronRight
                className={`size-3 transition-transform ${isVersionDropdownOpen ? "rotate-90" : ""}`}
              />
            </button>

            {isVersionDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-1 w-48 bg-background dark:bg-[#1D1D1D] border border-border dark:border-gray-600 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto"
              >
                {versions
                  .sort((a: any, b: any) => b.version_number - a.version_number)
                  .map((version: any) => (
                    <button
                      key={version.id}
                      onClick={() => {
                        onVersionChange?.(version.id);
                        setIsVersionDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-muted dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                        selectedVersionId === version.id
                          ? "bg-primary/10 text-primary"
                          : ""
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          v{version.version_number}
                        </span>
                        <span className="text-muted-foreground truncate">
                          {version.name}
                        </span>
                      </div>
                      {selectedVersionId === version.id && (
                        <Check className="size-3 text-primary" />
                      )}
                    </button>
                  ))}
              </motion.div>
            )}
          </div>
        )}

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
                <span className="text-emerald-500 hidden lg:inline text-[11px] whitespace-nowrap">
                  Copied!
                </span>
              </>
            ) : (
              <>
                <Copy className="size-4 sm:size-3.5 flex-shrink-0" />
                <span className="hidden lg:inline text-[11px] whitespace-nowrap">
                  Copy
                </span>
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
            <span className="hidden lg:inline text-[11px] whitespace-nowrap">
              Download
            </span>
          </button>
        </div>
      </div>

      {/* Code display container - proper overflow handling for mobile/tablet */}
      <div
        className="flex-1 overflow-y-auto overflow-x-auto md:overflow-x-hidden scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent bg-muted/30 dark:bg-[#1D1D1D] overscroll-contain"
        style={{
          minHeight: 0,
          scrollBehavior: "smooth",
          width: "100%",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div>
          <Highlight
            theme={codeTheme}
            code={selectedFile.content || "// No content available"}
            language={selectedFile.language || "text"}
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={`${className} text-sm leading-5 p-2 sm:p-3 overflow-x-visible md:overflow-x-auto`}
                style={{
                  ...style,
                  margin: 0,
                  background: "transparent",
                  fontFamily:
                    'Monaco, Menlo, "Ubuntu Mono", "Courier New", monospace',
                  fontSize: "clamp(11px, 2.5vw, 14px)",
                  lineHeight: "clamp(1.4, 1.6, 1.6)",
                  maxWidth: "100%",
                }}
              >
                {tokens.map((line, i) => {
                  const lineText = line.map((token) => token.content).join("");
                  const indentLevel = getIndentationLevel(lineText);

                  return (
                    <div
                      key={i}
                      {...getLineProps({ line })}
                      className="flex hover:bg-muted/20 transition-colors relative"
                      style={{ minHeight: "1.25rem" }}
                    >
                      {/* Indentation guides */}
                      {renderIndentationGuides(indentLevel, i)}

                      <span
                        className="inline-block w-7 sm:w-10 text-right mr-1.5 sm:mr-3 text-muted-foreground/50 select-none flex-shrink-0 text-xs leading-5 relative z-10"
                        style={{ fontSize: "clamp(10px, 2vw, 12px)" }}
                      >
                        {i + 1}
                      </span>
                      <span
                        className="flex-1 min-w-0 md:whitespace-pre md:break-normal relative z-10"
                        style={{
                          wordBreak: "break-word",
                          overflowWrap: "break-word",
                          whiteSpace: "pre-wrap",
                          maxWidth: "100%",
                        }}
                      >
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </span>
                    </div>
                  );
                })}
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
  project,
}: ProjectPageClientProps) {
  const { theme, resolvedTheme } = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["src"]));
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileExplorerOpen, setIsMobileExplorerOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"chat" | "code">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use streaming hook for real-time updates
  const streamState = useGenerationStream(projectId);

  // Determine code theme based on current theme
  const codeTheme = resolvedTheme === "dark" ? themes.vsDark : themes.vsLight;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = Math.max(newHeight, 32) + "px";
    }
  }, [input]);

  const { data: messages = initialMessages, refetch } =
    api.messages.getMany.useQuery(
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
      },
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
    },
  );

  // Mutations
  const createMessage = api.messages.create.useMutation();
  const classifyCommand = api.apiGeneration.classify.useMutation();
  const triggerIteration = api.apiGeneration.triggerIteration.useMutation();

  // Fetch versions
  const { data: versions = [], refetch: refetchVersions } =
    api.versions.getMany.useQuery(
      { projectId, limit: 50 },
      {
        refetchInterval: streamState.isStreaming ? false : 2000, // Poll every 2s when not streaming
        refetchOnWindowFocus: true,
      },
    );

  // Refetch versions when streaming completes to get the newly created version
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (
      wasStreaming.current &&
      !streamState.isStreaming &&
      streamState.status === "complete"
    ) {
      console.log("Streaming completed, refetching versions...");
      // Refetch immediately, then again after 500ms and 1500ms to catch delayed DB writes
      refetchVersions();
      setTimeout(() => refetchVersions(), 500);
      setTimeout(() => refetchVersions(), 1500);
    }
    wasStreaming.current = streamState.isStreaming;
  }, [streamState.isStreaming, streamState.status, refetchVersions]);

  // State for selected version - MUST be declared before useMemos that use it
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

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
      const completedVersions = versions.filter((v) => v.status === "complete");

      if (completedVersions.length > 0) {
        const latest = completedVersions.reduce((max, v) =>
          v.version_number > max.version_number ? v : max,
        );

        // Auto-switch to latest version if:
        // 1. No version selected yet, OR
        // 2. A new version was just created (length increased), OR
        // 3. Current selection doesn't exist anymore
        const newVersionCreated =
          completedVersions.length > previousVersionsLength.current;
        const currentSelectionInvalid =
          selectedVersionId &&
          !completedVersions.find((v) => v.id === selectedVersionId);

        if (
          !selectedVersionId ||
          newVersionCreated ||
          currentSelectionInvalid
        ) {
          console.log(
            "Auto-switching to latest completed version:",
            latest.version_number,
          );
          setSelectedVersionId(latest.id);
        }

        // Update ref for next comparison
        previousVersionsLength.current = completedVersions.length;
      }
    }
  }, [
    versions,
    versions.length,
    streamState.currentVersionId,
    streamState.isStreaming,
    selectedVersionId,
  ]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [messages]);

  // Combine streaming events with regular messages for display
  // Memoize with explicit dependencies to prevent unnecessary recalculations
  // Optimized for instant display - no debouncing
  const streamingMessages = useMemo(() => {
    const msgs: any[] = [];
    const fileStatusMap = new Map<string, { generating: any; complete: any }>();
    let validationStatus: { start: any; complete: any } = {
      start: null,
      complete: null,
    };

    // Show immediate feedback even with no events yet
    if (
      streamState.isStreaming &&
      streamState.events.length === 0 &&
      streamState.status === "generating"
    ) {
      msgs.push({
        id: "stream-initializing",
        content: "Starting generation...",
        role: "assistant" as const,
        type: "text" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isStreaming: true,
        icon: "generating",
      });
      return msgs;
    }

    // Early return if no events
    if (streamState.events.length === 0) {
      return msgs;
    }

    // First pass: collect file events and validation status
    streamState.events.forEach((event) => {
      if (event.type === "file:generating") {
        if (!fileStatusMap.has(event.filename)) {
          fileStatusMap.set(event.filename, {
            generating: event,
            complete: null,
          });
        }
      } else if (event.type === "file:complete") {
        const existing = fileStatusMap.get(event.filename);
        if (existing) {
          existing.complete = event;
        } else {
          fileStatusMap.set(event.filename, {
            generating: null,
            complete: event,
          });
        }
      } else if (event.type === "validation:start") {
        validationStatus.start = event;
      } else if (event.type === "validation:complete") {
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
          role: "assistant" as const,
          type: "text" as const,
          created_at: new Date(status.complete.timestamp).toISOString(),
          updated_at: new Date(status.complete.timestamp).toISOString(),
          isStreaming: true,
          icon: "complete",
        });
      } else if (status.generating) {
        // Show generating state only if not yet complete
        msgs.push({
          id: `stream-file-${filename}`,
          content: `Generating ${filename}...`,
          role: "assistant" as const,
          type: "text" as const,
          created_at: new Date(status.generating.timestamp).toISOString(),
          updated_at: new Date(status.generating.timestamp).toISOString(),
          isStreaming: true,
          icon: "generating",
        });
      }
    });

    // Add validation message (transforming from "Validating..." to "✓ Validated")
    if (validationStatus.complete) {
      msgs.push({
        id: "stream-validation",
        content: `✓ ${validationStatus.complete.summary || "Code validated successfully"}`,
        role: "assistant" as const,
        type: "text" as const,
        created_at: new Date(validationStatus.complete.timestamp).toISOString(),
        updated_at: new Date(validationStatus.complete.timestamp).toISOString(),
        isStreaming: true,
        icon: "complete",
      });
    } else if (validationStatus.start) {
      msgs.push({
        id: "stream-validation",
        content: "Validating generated code...",
        role: "assistant" as const,
        type: "text" as const,
        created_at: new Date(validationStatus.start.timestamp).toISOString(),
        updated_at: new Date(validationStatus.start.timestamp).toISOString(),
        isStreaming: true,
        icon: "processing",
      });
    }

    // Add other event types (step:start, complete)
    streamState.events.forEach((event) => {
      if (event.type === "step:start" && event.step !== "Validating") {
        msgs.push({
          id: `stream-step-${event.timestamp}`,
          content: event.message,
          role: "assistant" as const,
          type: "text" as const,
          created_at: new Date(event.timestamp).toISOString(),
          updated_at: new Date(event.timestamp).toISOString(),
          isStreaming: true,
          icon: "processing",
        });
      } else if (event.type === "complete") {
        msgs.push({
          id: `stream-done-${event.timestamp}`,
          content: `✓ ${event.summary}`,
          role: "assistant" as const,
          type: "text" as const,
          created_at: new Date(event.timestamp).toISOString(),
          updated_at: new Date(event.timestamp).toISOString(),
          isStreaming: true,
          icon: "complete",
        });
      }
    });

    return msgs;
  }, [streamState.events, streamState.isStreaming, streamState.status]); // Added dependencies for instant updates

  // Convert persisted generation events from database into message format
  const persistedEventMessages = useMemo(() => {
    const eventMsgs: any[] = [];

    // Only show persisted events if NOT currently streaming
    if (
      !streamState.isStreaming &&
      streamState.events.length === 0 &&
      generationEvents.length > 0
    ) {
      // Convert each generation event into a message format
      generationEvents.forEach((event: any) => {
        eventMsgs.push({
          id: `persisted-event-${event.id}`,
          content: event.message,
          role: "assistant" as const,
          type: "text" as const,
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
    const hasGenerationEvents =
      streamState.isStreaming ||
      streamState.events.length > 0 ||
      persistedEventMessages.length > 0;

    const filteredDbMessages = hasGenerationEvents
      ? sortedMessages.filter((dbMsg) => {
          // Always keep user messages and errors
          if (dbMsg.role === "user") return true;
          if (dbMsg.type === "error") return true;

          // Filter out assistant messages that duplicate generation events
          if (dbMsg.role === "assistant") {
            // Filter out messages that look like completion summaries
            if (
              dbMsg.content.includes("API Generation Complete") ||
              dbMsg.content.includes("Generated Files:") ||
              dbMsg.content.includes("Validation:") ||
              dbMsg.content.toLowerCase().includes("this api allows")
            ) {
              return false; // Skip these, we show them via generation events
            }
          }

          return true;
        })
      : sortedMessages;

    // Combine database messages, streaming messages, and persisted generation events
    let combined = [
      ...filteredDbMessages,
      ...streamingMessages,
      ...persistedEventMessages,
    ];

    // Sort by timestamp
    combined.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // Inject version cards after the messages that created them
    // Only show COMPLETED versions (not generating ones) to avoid premature display
    const completedVersions = versions.filter((v) => v.status === "complete");

    if (completedVersions.length > 0) {
      const messagesWithVersions: any[] = [];
      const addedVersionIds = new Set<string>();

      combined.forEach((msg, index) => {
        messagesWithVersions.push(msg);

        // After each message, check if there's a version that should appear
        // Either linked by version_id or created around the same time
        if ("id" in msg) {
          // Method 1: Direct link via version_id (most reliable)
          const directLinkedVersion = completedVersions.find(
            (v) => "version_id" in msg && msg.version_id === v.id,
          );

          if (
            directLinkedVersion &&
            !addedVersionIds.has(directLinkedVersion.id)
          ) {
            messagesWithVersions.push({
              id: `version-card-${directLinkedVersion.id}`,
              role: "version" as const,
              type: "version-card" as const,
              created_at: directLinkedVersion.created_at,
              updated_at: directLinkedVersion.updated_at,
              versionData: directLinkedVersion,
            });
            addedVersionIds.add(directLinkedVersion.id);
          } else if (msg.role === "user") {
            // Method 2: Time-based matching for versions without direct links
            const timeBasedVersions = completedVersions.filter((v) => {
              if (addedVersionIds.has(v.id)) return false;
              const msgTime = new Date(msg.created_at).getTime();
              const versionTime = new Date(v.created_at).getTime();
              // Version should be created within 10 seconds after the message
              return versionTime >= msgTime && versionTime - msgTime < 10000;
            });

            // Add time-based matched versions
            timeBasedVersions.forEach((version) => {
              messagesWithVersions.push({
                id: `version-card-${version.id}`,
                role: "version" as const,
                type: "version-card" as const,
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
      completedVersions.forEach((version) => {
        if (!addedVersionIds.has(version.id)) {
          messagesWithVersions.push({
            id: `version-card-${version.id}`,
            role: "version" as const,
            type: "version-card" as const,
            created_at: version.created_at,
            updated_at: version.updated_at,
            versionData: version,
          });
        }
      });

      // Re-sort to ensure proper chronological order
      messagesWithVersions.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      return messagesWithVersions;
    }

    return combined;
  }, [
    sortedMessages,
    streamingMessages,
    persistedEventMessages,
    versions,
    streamState.isStreaming,
    streamState.events.length,
  ]);

  // Build file tree from selected version or streaming files
  const fileTree = useMemo(() => {
    // Priority 1: Use streaming files only while currently generating
    if (streamState.isStreaming && streamState.generatedFiles.length > 0) {
      const streamingNodes: TreeNode[] = streamState.generatedFiles.map(
        (file) => ({
          id: file.filename,
          name: file.filename,
          type: "file" as const,
          content: file.content,
          language: getLanguageFromFilename(file.filename),
        }),
      );
      return streamingNodes;
    }

    // Priority 2: Load from selected version if available
    if (selectedVersionId && versions.length > 0) {
      const selectedVersion = versions.find((v) => v.id === selectedVersionId);
      if (selectedVersion?.files) {
        const versionNodes: TreeNode[] = Object.entries(
          selectedVersion.files,
        ).map(([filename, content]) => ({
          id: filename,
          name: filename,
          type: "file" as const,
          content:
            typeof content === "string"
              ? content
              : JSON.stringify(content, null, 2),
          language: getLanguageFromFilename(filename),
        }));
        return versionNodes;
      }
    }

    // Priority 3: If streaming is active but no files yet, show empty tree
    if (streamState.isStreaming) {
      return [];
    }

    // Priority 4: Fallback to project-based tree generation from messages
    return generateFileTreeFromProject(
      project,
      sortedMessages,
      streamState.generatedFiles,
    );
  }, [
    selectedVersionId,
    versions,
    streamState.generatedFiles,
    streamState.isStreaming,
    project,
    sortedMessages,
  ]);

  // When switching versions, ensure the selected file exists in that version.
  // If not, select the first file of the chosen version.
  useEffect(() => {
    if (streamState.isStreaming) return; // don't override while streaming
    if (!selectedVersionId) return;
    const version = versions.find((v) => v.id === selectedVersionId);
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
        role: "user",
        type: "text",
        project_id: projectId,
      });

      // Refetch messages to show user's message
      refetch();

      // 2. Classify command (with current file list for context)
      const currentFiles = selectedVersionId
        ? Object.keys(
            versions.find((v) => v.id === selectedVersionId)?.files || {},
          )
        : [];

      const classification = await classifyCommand.mutateAsync({
        prompt: messageContent,
        projectId,
        currentFiles,
      });

      console.log("Command classified:", classification);

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

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <SimpleHeader />

      {/* Mobile view toggle buttons */}
      <div className="sm:hidden flex border-b border-border dark:border-[#333433] bg-white dark:bg-[#0E100F]">
        <button
          onClick={() => setMobileView("chat")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            mobileView === "chat"
              ? "text-foreground border-b-2 border-primary bg-muted/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="size-4" />
            <span>Chat</span>
          </div>
        </button>
        <button
          onClick={() => setMobileView("code")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            mobileView === "code"
              ? "text-foreground border-b-2 border-primary bg-muted/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileCode className="size-4" />
            <span>Code</span>
          </div>
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Messages section - narrower to give more space to code viewer */}
        <section
          className={`w-full sm:w-64 md:w-72 lg:w-80 xl:w-96 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0E100F] sm:min-w-[256px] sm:max-w-[400px] ${
            mobileView === "chat" ? "flex" : "hidden sm:flex"
          }`}
        >
          {/* Messages Area - compact for more code space */}
          <div className="flex-1 overflow-y-auto px-2 sm:px-3 pt-3 sm:pt-4 pb-2 sm:pb-3 space-y-2 sm:space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent bg-white dark:bg-[#0E100F] relative scroll-fade">
            <AnimatePresence>
              {allMessages.map((message, index) => {
                const isStreamingMsg =
                  "isStreaming" in message && message.isStreaming;
                const isPersistentMsg =
                  "isPersistent" in message && message.isPersistent;
                const streamIcon = "icon" in message ? message.icon : null;

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="text-sm"
                  >
                    {message.type === "version-card" &&
                    "versionData" in message ? (
                      // Version card - seamlessly integrated
                      <div className="my-2">
                        <VersionCard
                          version={message.versionData}
                          isActive={
                            selectedVersionId === message.versionData.id
                          }
                          onClick={() =>
                            setSelectedVersionId(message.versionData.id)
                          }
                          previousVersion={versions.find(
                            (v) =>
                              v.id === message.versionData.parent_version_id,
                          )}
                        />
                      </div>
                    ) : message.role === "user" ? (
                      // User message - compact design
                      <div className="flex justify-end mb-1">
                        <div className="rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 bg-muted/40 dark:bg-[#262626] border border-border/30 dark:border-[#262626] max-w-[90%]">
                          <div className="whitespace-pre-wrap break-words leading-relaxed text-[12px] sm:text-[13px] text-foreground font-medium">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // AI message - no card, compact spacing
                      <div className="flex gap-1.5 sm:gap-2 items-start mb-2 sm:mb-3 pr-2 sm:pr-4">
                        <div className="flex items-start gap-2 flex-1">
                          {/* Show icons for streaming and persistent messages */}
                          {(isStreamingMsg || isPersistentMsg) &&
                            streamIcon === "generating" && (
                              <Loader2 className="size-3.5 animate-spin text-primary mt-0.5 flex-shrink-0" />
                            )}
                          {(isStreamingMsg || isPersistentMsg) &&
                            streamIcon === "complete" && (
                              <CheckCircle className="size-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                            )}
                          {(isStreamingMsg || isPersistentMsg) &&
                            streamIcon === "processing" && (
                              <Loader2 className="size-3.5 animate-spin text-amber-500 mt-0.5 flex-shrink-0" />
                            )}
                          <div className="whitespace-pre-wrap break-words leading-relaxed text-[13px] flex-1">
                            {isStreamingMsg &&
                            (streamIcon === "generating" ||
                              streamIcon === "processing") ? (
                              <TextShimmer
                                duration={1.5}
                                className="text-[13px] font-normal"
                              >
                                {message.content}
                              </TextShimmer>
                            ) : (
                              <span className="text-muted-foreground dark:text-gray-400">
                                {message.content}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {message.fragments &&
                      message.fragments.length > 0 &&
                      message.role === "user" && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <div className="text-xs text-muted-foreground mb-1.5 font-medium">
                            Generated Files:
                          </div>
                          {message.fragments.map((fragment: Fragment) => (
                            <div
                              key={fragment.id}
                              className="text-xs text-primary mb-1 flex items-center gap-1"
                            >
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
          <div className="px-2 sm:px-3 pb-2 sm:pb-3 bg-white dark:bg-[#0E100F] flex flex-col justify-end">
            <div className="rounded-xl border border-border/50 dark:border-[#444444] bg-background/50 dark:bg-[#1F2023] p-2 sm:p-3 shadow-lg flex flex-col">
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
                  border: "none",
                  boxShadow: "none",
                  outline: "none",
                  minHeight: "32px",
                  maxHeight: "120px",
                  height: "32px",
                }}
                disabled={isLoading}
                rows={1}
                ref={textareaRef}
              />
              {/* Input actions - responsive button sizes */}
              <div className="flex items-center justify-between pt-2.5">
                <div className="flex items-center gap-2">
                  <button className="h-8 sm:h-7 px-3 py-1 rounded-full text-xs text-foreground dark:text-gray-200 border border-border/50 dark:border-[#444444] bg-transparent hover:bg-muted/50 dark:hover:bg-gray-700/40 transition-colors flex items-center gap-1.5">
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
                        ? "bg-white hover:bg-white/90 text-[#1F2023]"
                        : "bg-transparent hover:bg-gray-600/30 text-gray-400"
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
        </section>

        {/* Code viewer section - conditionally shown on mobile based on mobileView */}
        <section
          className={`flex-1 p-2 sm:p-3 min-h-0 relative bg-white dark:bg-[#0E100F] sm:min-w-0 ${
            mobileView === "code" ? "flex" : "hidden sm:flex"
          }`}
        >
          {/* Folder toggle button - only show when explorer is closed */}
          {!isMobileExplorerOpen && (
            <button
              onClick={() => setIsMobileExplorerOpen(true)}
              className="sm:hidden absolute top-4 left-4 z-50 p-2 rounded-md bg-card border border-border text-foreground hover:bg-muted transition-colors shadow-lg"
              aria-label="Open file explorer"
            >
              <Folder className="size-4" />
            </button>
          )}

          <div className="h-full w-full rounded-lg border border-border bg-muted/30 dark:bg-[#1D1D1D] dark:border-[#1D1D1D] shadow-xl overflow-hidden flex backdrop-blur-sm">
            {/* File explorer sidebar - responsive width - shrinks on smaller screens */}
            <aside
              className={`
              w-56 sm:w-36 md:w-40 lg:w-44 xl:w-48 2xl:w-52 border-r border-border dark:border-[#333433] flex-shrink-0 transition-all duration-300
              ${isMobileExplorerOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}
              sm:relative absolute sm:z-auto z-40 h-full bg-muted/30 dark:bg-[#1D1D1D]
            `}
            >
              {/* Explorer header - clear and unobstructed */}
              <div className="h-12 sm:h-10 border-b border-border dark:border-[#333433] px-3 sm:px-3 flex items-center justify-between text-[11px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold backdrop-blur-sm bg-muted/30 dark:bg-[#1D1D1D]">
                <span className="truncate">Explorer</span>
                <button
                  onClick={() => setIsMobileExplorerOpen(false)}
                  className="sm:hidden p-1.5 hover:bg-muted rounded text-foreground text-xl leading-none flex-shrink-0"
                  aria-label="Close file explorer"
                >
                  ×
                </button>
              </div>
              {/* File tree container - responsive height and padding */}
              <div className="p-1.5 sm:p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent bg-muted/30 dark:bg-[#1D1D1D] h-[calc(100%-3rem)] sm:h-[calc(100%-2.5rem)] max-h-[calc(100vh-8rem)]">
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

            {/* Code content area - responsive width */}
            <div className="flex-1 min-w-0 flex flex-col relative bg-muted/30 w-full">
              <div className="h-full w-full overflow-hidden">
                {streamState.isStreaming &&
                streamState.generatedFiles.length > 0 ? (
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
                    versions={versions}
                    selectedVersionId={selectedVersionId}
                    onVersionChange={setSelectedVersionId}
                  />
                )}
              </div>
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
          input,
          textarea,
          select {
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
        button,
        a,
        [role="button"] {
          transition-property:
            background-color, border-color, color, opacity, box-shadow,
            transform;
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
          content: "";
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(
            to bottom,
            hsl(var(--card)) 0%,
            transparent 100%
          );
          z-index: 10;
          pointer-events: none;
          display: block;
        }

        .scroll-fade::after {
          content: "";
          position: sticky;
          bottom: 0;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(
            to top,
            hsl(var(--card)) 0%,
            transparent 100%
          );
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
          background: linear-gradient(to bottom, #0e100f 0%, transparent 100%);
        }

        .dark .scroll-fade::after {
          background: linear-gradient(to top, #0e100f 0%, transparent 100%);
        }
      `}</style>
    </div>
  );
}
