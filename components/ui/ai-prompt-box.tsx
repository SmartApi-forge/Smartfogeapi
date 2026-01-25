/**
 * AI Prompt Box Component
 * 
 * Enhanced prompt input with:
 * - Ask/Code mode toggle (Requirements: 1.1)
 * - Paperclip button for attachments (Requirements: 5.1)
 * - Horizontal scrollable attachment list (Requirements: 5.11)
 */

import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ArrowUp, Square, Paperclip } from "lucide-react";
import { TypingAnimation } from "./typing-animation";
import { GitHubRepoSelector } from "../github-repo-selector";
import { AttachmentList } from "../attachment-preview";
import { AttachmentModal } from "../attachment-modal";
import type { Attachment, AttachmentType } from "@/src/types/chat-ux";

// Utility function for className merging
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// Embedded CSS for minimal custom styles
const styles = `
  *:focus-visible {
    outline-offset: 0 !important;
    --ring-offset: 0 !important;
  }
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  textarea::-webkit-scrollbar-thumb {
    background-color: #444444;
    border-radius: 3px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background-color: #555555;
  }
`;

// Inject styles into document with guard to prevent duplicates
if (typeof document !== 'undefined') {
  const styleId = 'ai-prompt-box-styles';
  if (!document.getElementById(styleId)) {
    const styleSheet = document.createElement("style");
    styleSheet.id = styleId;
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
  }
}

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-md border-none bg-transparent px-4 py-3 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[56px] resize-none scrollbar-thin scrollbar-thumb-[#444444] scrollbar-track-transparent hover:scrollbar-thumb-[#555555]",
      className
    )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// Tooltip Components (simplified)
const TooltipProvider = TooltipPrimitive.Provider;

// Button Component
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
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// PromptInput Context and Components
interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => { },
  maxHeight: 200,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 200,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-2xl border border-[#444444] bg-[#1F2023] p-3 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300",
              isLoading && "border-red-500/70",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
}
const PromptInputTextarea: React.FC<PromptInputTextareaProps & React.ComponentProps<typeof Textarea>> = ({
  className,
  onKeyDown,
  disableAutosize = false,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  // API-focused prompts for typing animation
  const apiPrompts = [
    "Create a REST API for user authentication with JWT tokens...",
    "Build an e-commerce API with products, cart, and payments...",
    "Design a blog API with posts, comments, and categories...",
    "Generate a task management API with projects and teams...",
    "Create a social media API with posts, likes, and follows...",
    "Build a file storage API with upload and download endpoints...",
    "Design a notification API with real-time messaging...",
    "Create a analytics API with metrics and reporting...",
  ];

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn("text-base", className)}
        disabled={disabled}
        placeholder=""
        {...props}
      />
      {!value && !isFocused && (
        <div className="absolute inset-0 px-4 py-3 pointer-events-none">
          <TypingAnimation
            prompts={apiPrompts}
            className="text-sm text-gray-400"
            typingSpeed={40}
            deletingSpeed={25}
            pauseAfterType={2500}
            pauseAfterDelete={300}
          />
        </div>
      )}
    </div>
  );
};

type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>;
const PromptInputActions: React.FC<PromptInputActionsProps> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);


// ============================================================================
// GitHub Icon Component
// ============================================================================

/**
 * GitHub icon SVG component
 * Uses the same icon as github-dark.svg for consistency
 */
const GitHubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={cn("w-4 h-4", className)}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
    />
  </svg>
);

// ============================================================================
// Model Selector Import
// ============================================================================

import { ModelSelector, type AIModel } from '../model-selector';

// ============================================================================
// PromptInputBox Component
// ============================================================================

interface PromptInputBoxProps {
  onSend?: (message: string, model: AIModel, attachments: Attachment[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  initialModel?: AIModel;
  disabled?: boolean;
}

/**
 * Main prompt input box with model selector and attachment support
 * Updated to use model dropdown instead of Ask/Code toggle
 */
export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  ({ 
    onSend = () => {}, 
    isLoading = false, 
    placeholder: _placeholder = "Type your message here...", 
    className,
    initialModel = 'gpt-4o',
    disabled = false
  }, ref) => {
    const [input, setInput] = React.useState("");
    const [model, setModel] = React.useState<AIModel>(initialModel);
    const [attachments, setAttachments] = React.useState<Attachment[]>([]);
    const [previewAttachment, setPreviewAttachment] = React.useState<Attachment | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Size limits (Requirements: 5.10)
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_DOC_SIZE = 1 * 1024 * 1024; // 1MB

    const handleSubmit = () => {
      if (input.trim() || attachments.length > 0) {
        onSend(input, model, attachments);
        setInput("");
        setAttachments([]);
      }
    };

    const getAttachmentType = (file: File): AttachmentType => {
      if (file.type.startsWith('image/')) return 'image';
      if (file.type === 'application/pdf') return 'pdf';
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) return 'markdown';
      if (file.name.match(/\.(ts|tsx|js|jsx|py|java|go|rs|c|cpp|h|hpp|css|scss|html|json|yaml|yml|xml|sql)$/i)) return 'code';
      return 'other';
    };

    const validateFile = (file: File): { valid: boolean; error?: string } => {
      const type = getAttachmentType(file);
      const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_DOC_SIZE;
      
      if (file.size > maxSize) {
        const limitMB = maxSize / (1024 * 1024);
        return { 
          valid: false, 
          error: `File exceeds ${limitMB}MB limit for ${type === 'image' ? 'images' : 'documents'}` 
        };
      }
      return { valid: true };
    };

    const handleFileSelect = async (files: FileList | null) => {
      if (!files) return;

      const newAttachments: Attachment[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const validation = validateFile(file);
        
        if (!validation.valid) {
          console.error(validation.error);
          // Could show toast here
          continue;
        }

        const type = getAttachmentType(file);
        const url = URL.createObjectURL(file);
        
        const attachment: Attachment = {
          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 11)}`,
          name: file.name,
          type,
          size: file.size,
          url,
          thumbnailUrl: type === 'image' ? url : undefined,
          storagePath: '', // Will be set on upload
          createdAt: new Date(),
        };

        // For text-based files, read content
        if (type === 'code' || type === 'markdown') {
          try {
            attachment.content = await file.text();
          } catch (e) {
            console.error('Failed to read file content:', e);
          }
        }

        newAttachments.push(attachment);
      }

      setAttachments(prev => [...prev, ...newAttachments]);
    };

    const handleRemoveAttachment = (id: string) => {
      setAttachments(prev => {
        const attachment = prev.find(a => a.id === id);
        if (attachment?.url) {
          URL.revokeObjectURL(attachment.url);
        }
        return prev.filter(a => a.id !== id);
      });
    };

    const handleAttachmentClick = (attachment: Attachment) => {
      setPreviewAttachment(attachment);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    };

    // Cleanup URLs on unmount
    React.useEffect(() => {
      return () => {
        attachments.forEach(a => {
          if (a.url) URL.revokeObjectURL(a.url);
        });
      };
    }, []);

    const hasContent = input.trim() !== "" || attachments.length > 0;

    return (
      <>
        <PromptInput
          ref={ref}
          isLoading={isLoading}
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          disabled={disabled || isLoading}
          className={cn(
            isDragging && "border-emerald-500/50 bg-emerald-500/5",
            className
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Attachment List - Requirements: 5.11 */}
          {attachments.length > 0 && (
            <AttachmentList
              attachments={attachments}
              onRemove={handleRemoveAttachment}
              onAttachmentClick={handleAttachmentClick}
            />
          )}

          {/* Textarea */}
          <PromptInputTextarea />

          {/* Actions Row */}
          <PromptInputActions className="justify-between pt-2">
            {/* Left side: Model selector, GitHub, and Paperclip */}
            <div className="flex items-center gap-2">
              {/* Model Selector Dropdown */}
              <ModelSelector 
                value={model} 
                onChange={setModel} 
                disabled={disabled || isLoading}
              />

              {/* GitHub Button - Opens repo selector dropdown */}
              <GitHubRepoSelector>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || isLoading}
                  className="text-gray-400 hover:text-gray-200"
                  aria-label="Import from GitHub"
                >
                  <GitHubIcon />
                </Button>
              </GitHubRepoSelector>

              {/* Paperclip Button - Requirements: 5.1 */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isLoading}
                className="text-gray-400 hover:text-gray-200"
                aria-label="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                accept="image/*,.pdf,.md,.markdown,.txt,.ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.c,.cpp,.h,.hpp,.css,.scss,.html,.json,.yaml,.yml,.xml,.sql"
              />
            </div>

            {/* Right side: Submit button */}
            <Button
              variant="default"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full transition-all duration-200",
                hasContent
                  ? "bg-white hover:bg-white/80 text-[#1F2023]"
                  : "bg-transparent hover:bg-gray-600/30 text-[#9CA3AF] hover:text-[#D1D5DB]"
              )}
              onClick={handleSubmit}
              disabled={isLoading || !hasContent || disabled}
              aria-label={isLoading ? "Stop generation" : "Send message"}
            >
              {isLoading ? (
                <Square className="h-4 w-4 fill-current animate-pulse" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </PromptInputActions>
        </PromptInput>

        {/* Attachment Modal - Requirements: 5.4, 5.5, 5.7 */}
        <AttachmentModal
          attachment={previewAttachment}
          isOpen={previewAttachment !== null}
          onClose={() => setPreviewAttachment(null)}
        />
      </>
    );
  }
);

PromptInputBox.displayName = "PromptInputBox";