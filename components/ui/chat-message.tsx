"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Bot, 
  CheckCircle, 
  Loader2, 
  Copy, 
  ThumbsUp, 
  ThumbsDown,
  FileCode,
  FileText,
  Sparkles,
  Clock,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isComplete?: boolean;
  metadata?: {
    fileBeingEdited?: string;
    operation?: string;
    progress?: number;
    error?: string;
  };
  fragments?: Array<{
    type: "text" | "code" | "file";
    content: string;
    language?: string;
    filename?: string;
  }>;
}

interface ChatMessageProps {
  message: ChatMessage;
  isLast?: boolean;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: "positive" | "negative") => void;
  className?: string;
}

export function ChatMessageComponent({
  message,
  isLast = false,
  onCopy,
  onFeedback,
  className
}: ChatMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const isUser = message.type === "user";
  const isSystem = message.type === "system";
  const isAssistant = message.type === "assistant";

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      onCopy?.(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(date);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative w-full",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn(
        "flex gap-3 p-4",
        isUser ? "justify-end" : "justify-start"
      )}>
        {/* Avatar */}
        {!isUser && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
              isSystem 
                ? "bg-orange-500/10 text-orange-500" 
                : "bg-primary/10 text-primary"
            )}
          >
            {isSystem ? (
              <AlertCircle className="size-4" />
            ) : (
              <Bot className="size-4" />
            )}
          </motion.div>
        )}

        {/* Message content */}
        <div className={cn(
          "flex flex-col gap-2 max-w-[80%] sm:max-w-[70%]",
          isUser && "items-end"
        )}>
          {/* File being edited indicator */}
          <AnimatePresence>
            {message.metadata?.fileBeingEdited && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium"
              >
                <FileCode className="size-3" />
                <span>Editing: {message.metadata.fileBeingEdited}</span>
                {message.metadata.progress && (
                  <div className="w-12 h-1 bg-blue-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${message.metadata.progress}%` }}
                      className="h-full bg-blue-500"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main message bubble */}
          <motion.div
            layout
            className={cn(
              "relative rounded-2xl px-4 py-3 shadow-sm",
              "border border-border/50",
              isUser
                ? "bg-primary text-primary-foreground ml-auto"
                : isSystem
                ? "bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-100"
                : "bg-muted/50 text-foreground"
            )}
          >
            {/* Streaming indicator */}
            <AnimatePresence>
              {message.isStreaming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-2 -right-2"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <Loader2 className="size-2 text-white animate-spin" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message content */}
            <div className="space-y-2">
              {/* Text content */}
              {message.content && (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.isStreaming ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="inline-block"
                    >
                      {message.content}
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="inline-block w-2 h-4 bg-current ml-1"
                      />
                    </motion.span>
                  ) : (
                    message.content
                  )}
                </div>
              )}

              {/* Fragments (code, files, etc.) */}
              {message.fragments && message.fragments.length > 0 && (
                <div className="space-y-2">
                  {message.fragments.map((fragment, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn(
                        "rounded-lg border border-border/30 overflow-hidden",
                        fragment.type === "code" && "bg-muted/30"
                      )}
                    >
                      {fragment.filename && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/30">
                          <FileText className="size-4" />
                          <span className="text-xs font-medium">{fragment.filename}</span>
                        </div>
                      )}
                      <div className="p-3">
                        <pre className="text-xs overflow-x-auto">
                          <code>{fragment.content}</code>
                        </pre>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Error display */}
              {message.metadata?.error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs"
                >
                  <AlertCircle className="size-3" />
                  <span>{message.metadata.error}</span>
                </motion.div>
              )}
            </div>

            {/* Message status */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
              <div className="flex items-center gap-1 text-xs opacity-60">
                <Clock className="size-3" />
                <span>{formatTime(message.timestamp)}</span>
              </div>

              {message.isComplete && !message.isStreaming && (
                <CheckCircle className="size-3 text-green-500" />
              )}
            </div>
          </motion.div>

          {/* Action buttons */}
          <AnimatePresence>
            {isHovered && !isUser && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="flex items-center gap-1"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(message.content)}
                  className="h-6 px-2 text-xs"
                >
                  <Copy className="size-3 mr-1" />
                  {copiedText === message.content ? "Copied!" : "Copy"}
                </Button>

                {onFeedback && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFeedback(message.id, "positive")}
                      className="h-6 px-2"
                    >
                      <ThumbsUp className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFeedback(message.id, "negative")}
                      className="h-6 px-2"
                    >
                      <ThumbsDown className="size-3" />
                    </Button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User avatar */}
        {isUser && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"
          >
            <User className="size-4" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}