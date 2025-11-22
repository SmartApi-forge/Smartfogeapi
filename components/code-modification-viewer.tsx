"use client";

import { useState } from "react";
import { Check, X, FileCode, AlertCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { useTheme } from "next-themes";
import { api } from "@/lib/trpc-client";

interface CodeChange {
  lineStart: number | null;
  lineEnd: number | null;
  oldContent: string | null;
  newContent: string;
  reason: string | null;
}

interface CodeModification {
  id: string;
  project_id: string;
  message_id: string;
  file_path: string;
  old_content: string | null;
  new_content: string;
  line_start: number | null;
  line_end: number | null;
  modification_type: 'edit' | 'create' | 'delete';
  reason: string | null;
  applied: boolean;
  created_at: string;
  updated_at: string;
}

interface CodeModificationViewerProps {
  messageId: string;
  projectId: string;
}

export function CodeModificationViewer({ messageId, projectId }: CodeModificationViewerProps) {
  const { resolvedTheme } = useTheme();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  
  const codeTheme = resolvedTheme === 'dark' ? themes.vsDark : themes.vsLight;

  // Fetch modifications for this message
  const { data: modifications = [], refetch } = api.codeModifications.getByMessage.useQuery(
    { messageId },
    {
      refetchOnWindowFocus: false,
    }
  );

  const applyMutation = api.codeModifications.apply.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const rejectMutation = api.codeModifications.reject.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const applyMultipleMutation = api.codeModifications.applyMultiple.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleApply = (id: string) => {
    applyMutation.mutate({ id });
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate({ id });
  };

  const handleApplyAll = () => {
    const unappliedIds = modifications
      .filter(mod => !mod.applied)
      .map(mod => mod.id);
    
    if (unappliedIds.length > 0) {
      applyMultipleMutation.mutate({ modification_ids: unappliedIds });
    }
  };

  const toggleFile = (filePath: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  if (modifications.length === 0) {
    return null;
  }

  // Group modifications by file
  const modsByFile = modifications.reduce((acc, mod) => {
    if (!acc[mod.file_path]) {
      acc[mod.file_path] = [];
    }
    acc[mod.file_path].push(mod);
    return acc;
  }, {} as Record<string, CodeModification[]>);

  const unappliedCount = modifications.filter(m => !m.applied).length;

  return (
    <div className="mt-3 space-y-2">
      {/* Header with apply all button */}
      {unappliedCount > 0 && (
        <div className="flex items-center justify-between p-2 bg-muted/50 dark:bg-[#1D1D1D] rounded-lg border border-border/50 dark:border-[#333433]">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <AlertCircle className="size-3.5" />
            <span>{unappliedCount} modification{unappliedCount !== 1 ? 's' : ''} pending review</span>
          </div>
          <button
            onClick={handleApplyAll}
            disabled={applyMultipleMutation.isPending}
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {applyMultipleMutation.isPending ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Check className="size-3" />
                <span>Apply All</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* File modifications */}
      {Object.entries(modsByFile).map(([filePath, mods]) => {
        const isExpanded = expandedFiles.has(filePath);
        const fileUnapplied = mods.filter(m => !m.applied).length;
        
        return (
          <div
            key={filePath}
            className="border border-border/50 dark:border-[#333433] rounded-lg overflow-hidden bg-muted/30 dark:bg-[#1D1D1D]"
          >
            {/* File header */}
            <button
              onClick={() => toggleFile(filePath)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 dark:hover:bg-[#262626] transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="size-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 flex-shrink-0 text-muted-foreground" />
                )}
                <FileCode className="size-4 flex-shrink-0 text-blue-500" />
                <span className="text-sm font-medium text-foreground truncate">{filePath}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {fileUnapplied > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {fileUnapplied} pending
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {mods.length} change{mods.length !== 1 ? 's' : ''}
                </span>
              </div>
            </button>

            {/* File modifications */}
            {isExpanded && (
              <div className="border-t border-border/50 dark:border-[#333433]">
                {mods.map((mod, idx) => (
                  <div
                    key={mod.id}
                    className={`p-3 ${idx > 0 ? 'border-t border-border/30 dark:border-[#2A2A2A]' : ''}`}
                  >
                    {/* Modification header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        {mod.line_start && mod.line_end && (
                          <div className="text-xs text-muted-foreground mb-1">
                            Lines {mod.line_start}-{mod.line_end}
                          </div>
                        )}
                        {mod.reason && (
                          <div className="text-xs text-foreground/80 italic">
                            {mod.reason}
                          </div>
                        )}
                      </div>
                      
                      {/* Action buttons */}
                      {!mod.applied && (
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <button
                            onClick={() => handleApply(mod.id)}
                            disabled={applyMutation.isPending}
                            className="px-2 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title="Apply this change"
                          >
                            {applyMutation.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(mod.id)}
                            disabled={rejectMutation.isPending}
                            className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title="Reject this change"
                          >
                            {rejectMutation.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <X className="size-3" />
                            )}
                          </button>
                        </div>
                      )}
                      
                      {mod.applied && (
                        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-2">
                          <Check className="size-3" />
                          <span>Applied</span>
                        </div>
                      )}
                    </div>

                    {/* Diff view */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {/* Old content */}
                      {mod.old_content && (
                        <div className="rounded border border-red-500/30 dark:border-red-500/20 overflow-hidden">
                          <div className="bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-400 border-b border-red-500/30 dark:border-red-500/20">
                            Before
                          </div>
                          <div className="bg-red-500/5 dark:bg-red-500/5 overflow-x-auto">
                            <Highlight
                              theme={codeTheme}
                              code={mod.old_content}
                              language="javascript"
                            >
                              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                                <pre
                                  className={`${className} text-xs p-2`}
                                  style={{ ...style, margin: 0, background: 'transparent' }}
                                >
                                  {tokens.map((line, i) => (
                                    <div key={i} {...getLineProps({ line })}>
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
                      )}

                      {/* New content */}
                      <div className="rounded border border-emerald-500/30 dark:border-emerald-500/20 overflow-hidden">
                        <div className="bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/30 dark:border-emerald-500/20">
                          {mod.old_content ? 'After' : 'New Code'}
                        </div>
                        <div className="bg-emerald-500/5 dark:bg-emerald-500/5 overflow-x-auto">
                          <Highlight
                            theme={codeTheme}
                            code={mod.new_content}
                            language="javascript"
                          >
                            {({ className, style, tokens, getLineProps, getTokenProps }) => (
                              <pre
                                className={`${className} text-xs p-2`}
                                style={{ ...style, margin: 0, background: 'transparent' }}
                              >
                                {tokens.map((line, i) => (
                                  <div key={i} {...getLineProps({ line })}>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


