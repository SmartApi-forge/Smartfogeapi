"use client";

import React from "react";
import { ArrowUp, Square } from "lucide-react";
import { TypingAnimation } from "./typing-animation";

// Utility function for className merging
const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// Simple Textarea Component
interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex w-full rounded-md border-none bg-transparent px-4 py-3 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px] resize-none",
        className,
      )}
      ref={ref}
      rows={1}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

// Simple Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-white hover:bg-white/80 text-black",
      outline: "border border-[#444444] bg-transparent hover:bg-[#3A3A40]",
      ghost: "bg-transparent hover:bg-[#3A3A40]",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

// Main SimplePromptBox Component
interface SimplePromptBoxProps {
  onSend?: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const SimplePromptBox = React.forwardRef<
  HTMLDivElement,
  SimplePromptBoxProps
>(
  (
    {
      onSend = () => {},
      isLoading = false,
      placeholder = "Type your message here...",
      className,
    },
    ref,
  ) => {
    const [input, setInput] = React.useState("");
    const [isFocused, setIsFocused] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // API-focused prompts for typing animation
    const apiPrompts = [
      "Create a REST API for user authentication with JWT tokens...",
      "Build an e-commerce API with products, cart, and payments...",
      "Design a blog API with posts, comments, and categories...",
      "Generate a task management API with projects and teams...",
      "Create a social media API with posts, likes, and follows...",
      "Build a file storage API with upload and download endpoints...",
      "Design a notification API with real-time messaging...",
      "Create an analytics API with metrics and reporting...",
    ];

    const handleSubmit = () => {
      if (input.trim()) {
        onSend(input);
        setInput("");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    // Auto-resize textarea
    React.useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    }, [input]);

    const hasContent = input.trim() !== "";

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-3xl border border-[#444444] bg-[#1F2023] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300",
          className,
        )}
      >
        {/* Textarea with typing animation overlay */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="text-base"
            disabled={isLoading}
            placeholder=""
          />
          {!input && !isFocused && (
            <div className="absolute inset-0 px-4 py-3 pointer-events-none">
              <TypingAnimation
                prompts={apiPrompts}
                className="text-base text-gray-400"
                typingSpeed={40}
                deletingSpeed={25}
                pauseAfterType={2500}
                pauseAfterDelete={300}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-0 pt-2">
          <Button
            variant="default"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full transition-all duration-200",
              hasContent
                ? "bg-white hover:bg-white/80 text-[#1F2023]"
                : "bg-transparent hover:bg-gray-600/30 text-[#9CA3AF] hover:text-[#D1D5DB]",
            )}
            onClick={handleSubmit}
            disabled={isLoading || !hasContent}
          >
            {isLoading ? (
              <Square className="h-4 w-4 fill-[#1F2023] animate-pulse" />
            ) : (
              <ArrowUp className="h-4 w-4 text-[#1F2023]" />
            )}
          </Button>
        </div>
      </div>
    );
  },
);

SimplePromptBox.displayName = "SimplePromptBox";
