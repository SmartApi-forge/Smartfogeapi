"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Loader2, 
  ArrowUp, 
  Paperclip, 
  SlidersHorizontal,
  Mic,
  MicOff,
  Image,
  Code,
  FileText,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DynamicChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showTools?: boolean;
  showAttachments?: boolean;
  showVoice?: boolean;
  maxHeight?: number;
  minHeight?: number;
  onFileAttach?: (files: FileList) => void;
  onVoiceToggle?: (isRecording: boolean) => void;
  isRecording?: boolean;
}

export function DynamicChatInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = "Ask me to modify your code...",
  className,
  showTools = true,
  showAttachments = true,
  showVoice = false,
  maxHeight = 200,
  minHeight = 44,
  onFileAttach,
  onVoiceToggle,
  isRecording = false
}: DynamicChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Handle typing indicator
  useEffect(() => {
    if (value.length > 0) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && onFileAttach) {
      onFileAttach(files);
    }
  };

  const canSubmit = value.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className={cn(
      "relative w-full",
      className
    )}>
      {/* Main input container */}
      <motion.div
        initial={false}
        animate={{
          scale: isFocused ? 1.02 : 1,
          boxShadow: isFocused 
            ? "0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(59, 130, 246, 0.3)"
            : "0 4px 16px rgba(0, 0, 0, 0.08)"
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "relative rounded-2xl border bg-background/80 backdrop-blur-sm",
          "transition-all duration-200",
          isFocused 
            ? "border-primary/30 bg-background/90" 
            : "border-border/50 hover:border-border/80",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute -top-8 left-4 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Sparkles className="size-3 animate-pulse" />
              <span>AI is analyzing your request...</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col p-3">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full bg-transparent text-foreground placeholder-muted-foreground",
              "outline-none border-none resize-none",
              "text-sm leading-relaxed",
              "scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
            )}
            style={{
              minHeight: `${minHeight}px`,
              maxHeight: `${maxHeight}px`,
            }}
            rows={1}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
            {/* Left side tools */}
            <div className="flex items-center gap-1">
              {showTools && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "h-8 px-3 rounded-full text-xs font-medium",
                    "border border-border/50 bg-transparent",
                    "hover:bg-muted/50 transition-colors",
                    "flex items-center gap-1.5"
                  )}
                  disabled={disabled}
                >
                  <SlidersHorizontal className="size-3" />
                  <span className="hidden sm:inline">Tools</span>
                </motion.button>
              )}

              {showAttachments && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".js,.ts,.tsx,.jsx,.py,.json,.md,.txt"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "h-8 w-8 rounded-full",
                      "hover:bg-muted/50 transition-colors",
                      "flex items-center justify-center"
                    )}
                    disabled={disabled}
                  >
                    <Paperclip className="size-4" />
                  </motion.button>
                </>
              )}

              {showVoice && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onVoiceToggle?.(!isRecording)}
                  className={cn(
                    "h-8 w-8 rounded-full transition-colors",
                    "flex items-center justify-center",
                    isRecording 
                      ? "bg-red-500 text-white hover:bg-red-600" 
                      : "hover:bg-muted/50"
                  )}
                  disabled={disabled}
                >
                  {isRecording ? (
                    <MicOff className="size-4" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </motion.button>
              )}
            </div>

            {/* Right side - Send button */}
            <motion.button
              whileHover={{ scale: canSubmit ? 1.05 : 1 }}
              whileTap={{ scale: canSubmit ? 0.95 : 1 }}
              onClick={onSubmit}
              disabled={!canSubmit}
              className={cn(
                "h-8 w-8 rounded-full transition-all duration-200",
                "flex items-center justify-center",
                canSubmit
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                  : "bg-muted/50 text-muted-foreground cursor-not-allowed"
              )}
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                  >
                    <Loader2 className="size-4 animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="send"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                  >
                    <ArrowUp className="size-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Focus ring */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 rounded-2xl border-2 border-primary/20 pointer-events-none"
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Character count (optional) */}
      {value.length > 100 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -bottom-6 right-2 text-xs text-muted-foreground"
        >
          {value.length} characters
        </motion.div>
      )}
    </div>
  );
}