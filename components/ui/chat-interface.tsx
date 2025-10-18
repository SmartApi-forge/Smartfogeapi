"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Sparkles,
  Code,
  FileText,
  Zap,
  ChevronDown,
  Settings,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicChatInput } from "./dynamic-chat-input";
import { ChatMessageComponent, type ChatMessage } from "./chat-message";
import { Button } from "./button";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onFileAttach?: (files: FileList) => void;
  isLoading?: boolean;
  className?: string;
  showWelcome?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  streamingMessage?: string;
  progressInfo?: {
    fileBeingEdited?: string;
    operation?: string;
    progress?: number;
  };
}

const WELCOME_SUGGESTIONS = [
  {
    icon: Code,
    title: "Modify Code",
    description: "Update logic in existing files",
    prompt: "Change the authentication logic in auth.ts to use JWT tokens",
  },
  {
    icon: FileText,
    title: "Create Files",
    description: "Generate new components or modules",
    prompt: "Create a new React component for user profile management",
  },
  {
    icon: Zap,
    title: "Optimize",
    description: "Improve performance and structure",
    prompt: "Optimize the database queries in the user service",
  },
  {
    icon: Sparkles,
    title: "Refactor",
    description: "Clean up and modernize code",
    prompt: "Refactor the legacy API endpoints to use modern patterns",
  },
];

export function ChatInterface({
  messages,
  onSendMessage,
  onFileAttach,
  isLoading = false,
  className,
  showWelcome = true,
  isFullscreen = false,
  onToggleFullscreen,
  streamingMessage,
  progressInfo,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  // Handle scroll to detect if user is at bottom
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
  }, []);

  const handleSendMessage = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputValue(prompt);
  };

  const showScrollToBottom = !isAtBottom && messages.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-gradient-to-br from-background/95 via-background/90 to-background/95",
        "backdrop-blur-xl border border-border/30 rounded-2xl overflow-hidden shadow-2xl",
        "relative before:absolute before:inset-0 before:bg-gradient-to-br before:from-blue-500/5 before:via-purple-500/5 before:to-pink-500/5 before:pointer-events-none",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border/30 bg-gradient-to-r from-background/90 via-background/95 to-background/90 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <motion.div
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageSquare className="size-5 text-white" />
          </motion.div>
          <div>
            <h3 className="font-bold text-base bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              AI Assistant
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {isLoading ? (
                <>
                  <motion.div
                    className="w-2 h-2 bg-blue-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  Thinking...
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Ready to help
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 rounded-xl hover:bg-muted/50"
            >
              <Settings className="size-4" />
            </Button>
          </motion.div>
          {onToggleFullscreen && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-xl hover:bg-muted/50"
                onClick={onToggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
      >
        <div className="p-6 space-y-6">
          {/* Welcome message and suggestions */}
          {showWelcome && messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-center py-12"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-2xl"
              >
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Sparkles className="size-10 text-white" />
                </motion.div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-2xl font-bold mb-3 bg-gradient-to-r from-foreground via-foreground/90 to-foreground/80 bg-clip-text text-transparent"
              >
                Welcome to AI Assistant
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="text-muted-foreground mb-8 max-w-lg mx-auto text-base leading-relaxed"
              >
                I can help you modify code, create new files, optimize
                performance, and much more. Try one of these suggestions to get
                started:
              </motion.p>

              {/* Suggestion cards */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto"
              >
                {WELCOME_SUGGESTIONS.map((suggestion, index) => (
                  <motion.button
                    key={suggestion.title}
                    initial={{ opacity: 0, y: 30, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: 0.7 + index * 0.1,
                      duration: 0.6,
                      ease: "easeOut",
                    }}
                    whileHover={{
                      scale: 1.03,
                      y: -4,
                      boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSuggestionClick(suggestion.prompt)}
                    className={cn(
                      "p-5 rounded-2xl border border-border/30 bg-gradient-to-br from-background/80 via-background/90 to-background/80",
                      "hover:border-border/50 transition-all duration-300",
                      "text-left group backdrop-blur-sm shadow-lg hover:shadow-xl",
                      "relative overflow-hidden",
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex items-start gap-4">
                      <motion.div
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 via-primary/15 to-primary/10 text-primary flex items-center justify-center group-hover:from-primary/20 group-hover:via-primary/25 group-hover:to-primary/20 transition-all duration-300 shadow-md"
                        whileHover={{ rotate: 5, scale: 1.1 }}
                      >
                        <suggestion.icon className="size-5" />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base mb-2 group-hover:text-primary/90 transition-colors">
                          {suggestion.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                          {suggestion.description}
                        </p>
                        <p className="text-xs text-primary/70 italic truncate bg-primary/5 px-3 py-1 rounded-lg">
                          "{suggestion.prompt}"
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <ChatMessageComponent key={message.id} message={message} />
          ))}

          {/* Streaming message */}
          {streamingMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex gap-4"
            >
              <motion.div
                className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg"
                animate={{
                  boxShadow: [
                    "0 4px 20px rgba(59, 130, 246, 0.3)",
                    "0 4px 30px rgba(147, 51, 234, 0.4)",
                    "0 4px 20px rgba(59, 130, 246, 0.3)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <MessageSquare className="size-5 text-white" />
              </motion.div>
              <div className="flex-1 space-y-3">
                <div className="bg-gradient-to-br from-muted/40 via-muted/60 to-muted/40 backdrop-blur-sm rounded-2xl p-4 border border-border/20 shadow-lg">
                  <div className="prose prose-sm max-w-none text-foreground/90">
                    {streamingMessage}
                    <motion.span
                      className="inline-block w-3 h-5 bg-gradient-to-r from-blue-500 to-purple-600 ml-2 rounded-sm"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Progress indicator */}
          {progressInfo && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex gap-4"
            >
              <motion.div
                className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-lg"
                animate={{
                  rotate: [0, 5, -5, 0],
                  boxShadow: [
                    "0 4px 20px rgba(249, 115, 22, 0.3)",
                    "0 4px 30px rgba(239, 68, 68, 0.4)",
                    "0 4px 20px rgba(249, 115, 22, 0.3)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Code className="size-5 text-white" />
              </motion.div>
              <div className="flex-1 space-y-3">
                <div className="bg-gradient-to-br from-orange-50/80 via-orange-50/90 to-red-50/80 dark:from-orange-950/30 dark:via-orange-950/40 dark:to-red-950/30 border border-orange-200/50 dark:border-orange-800/30 rounded-2xl p-4 backdrop-blur-sm shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-orange-800 dark:text-orange-200 flex items-center gap-2">
                      <motion.div
                        className="w-2 h-2 bg-orange-500 rounded-full"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      {progressInfo.operation || "Processing..."}
                    </span>
                    <motion.span
                      className="text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-100/50 dark:bg-orange-900/30 px-3 py-1 rounded-full"
                      key={progressInfo.progress}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {progressInfo.progress}%
                    </motion.span>
                  </div>
                  {progressInfo.fileBeingEdited && (
                    <motion.div
                      className="text-sm text-orange-600 dark:text-orange-400 mb-3 bg-orange-100/30 dark:bg-orange-900/20 px-3 py-2 rounded-xl border border-orange-200/30 dark:border-orange-800/20"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <span className="font-medium">File:</span>{" "}
                      {progressInfo.fileBeingEdited}
                    </motion.div>
                  )}
                  <div className="relative w-full bg-orange-200/50 dark:bg-orange-800/30 rounded-full h-3 overflow-hidden shadow-inner">
                    <motion.div
                      className="bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 h-3 rounded-full shadow-sm"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressInfo.progress || 0}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingMessage && !progressInfo && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex gap-4"
            >
              <motion.div
                className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg"
                animate={{
                  rotate: 360,
                  boxShadow: [
                    "0 4px 20px rgba(59, 130, 246, 0.3)",
                    "0 4px 30px rgba(147, 51, 234, 0.4)",
                    "0 4px 20px rgba(59, 130, 246, 0.3)",
                  ],
                }}
                transition={{
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                  boxShadow: { duration: 2, repeat: Infinity },
                }}
              >
                <Sparkles className="size-5 text-white" />
              </motion.div>
              <div className="flex-1">
                <div className="bg-gradient-to-br from-muted/40 via-muted/60 to-muted/40 backdrop-blur-sm rounded-2xl p-4 border border-border/20 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-3 h-3 bg-gradient-to-r from-muted-foreground/60 to-muted-foreground/80 rounded-full"
                          animate={{
                            scale: [1, 1.4, 1],
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">
                      AI is thinking...
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollToBottom && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute bottom-24 right-6"
          >
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={scrollToBottom}
                className="rounded-2xl shadow-2xl bg-gradient-to-r from-background/90 to-background/95 backdrop-blur-xl border border-border/30 hover:border-border/50 transition-all duration-300"
              >
                <motion.div
                  animate={{ y: [0, 2, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ChevronDown className="size-4" />
                </motion.div>
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="p-6 border-t border-border/30 bg-gradient-to-r from-background/90 via-background/95 to-background/90 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <DynamicChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSendMessage}
            isLoading={isLoading}
            placeholder="Ask me to modify your code, create new files, or optimize your project..."
            showTools={true}
            showAttachments={true}
            onFileAttach={onFileAttach}
          />
        </motion.div>
      </div>
    </div>
  );
}
