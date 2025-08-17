"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { Bot, Paperclip, Plus, Send, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }

      textarea.style.height = `${minHeight}px`
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      )

      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight]
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = `${minHeight}px`
    }
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

const MIN_HEIGHT = 48
const MAX_HEIGHT = 164

const models = [
  { id: "llama-3.1", name: "Llama 3.1", provider: "Meta" },
  { id: "mistral-7b", name: "Mistral 7B", provider: "Mistral AI" },
  { id: "claude-3", name: "Claude 3", provider: "Anthropic" },
  { id: "codellama", name: "Code Llama", provider: "Meta" },
]

const AnimatedPlaceholder = ({ selectedModel }: { selectedModel: string }) => {
  const modelName = models.find((m) => m.id === selectedModel)?.name || "AI"

  const prompts = [
    `Describe the REST API you want to build with ${modelName}…`,
    "Create an auth API with signup, login, and JWT refresh…",
    "Generate an e‑commerce API for products, cart, and orders…",
    "Build a blog API with posts, comments, and tags…",
    "Design a task manager API with projects, tasks, and statuses…",
  ]

  const TYPING_MS = 28
  const DELETING_MS = 18
  const PAUSE_AFTER_TYPE_MS = 1200
  const PAUSE_AFTER_DELETE_MS = 300

  const [idx, setIdx] = useState(0)
  const [text, setText] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Restart typing when model changes so the copy stays relevant
  useEffect(() => {
    setIdx(0)
    setText("")
    setDeleting(false)
  }, [selectedModel])

  useEffect(() => {
    const full = prompts[idx % prompts.length]

    if (!deleting && text === full) {
      const t = setTimeout(() => setDeleting(true), PAUSE_AFTER_TYPE_MS)
      return () => clearTimeout(t)
    }

    if (deleting && text === "") {
      const t = setTimeout(() => {
        setDeleting(false)
        setIdx((i) => (i + 1) % prompts.length)
      }, PAUSE_AFTER_DELETE_MS)
      return () => clearTimeout(t)
    }

    const step = () => {
      if (deleting) {
        setText((t) => t.slice(0, -1))
      } else {
        setText(full.slice(0, text.length + 1))
      }
    }

    const interval = setTimeout(step, deleting ? DELETING_MS : TYPING_MS)
    return () => clearTimeout(interval)
  }, [text, deleting, idx, prompts])

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={`${idx}-${deleting}`}
        initial={{ opacity: 0.6, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0.6, y: -2 }}
        transition={{ duration: 0.12 }}
        className="pointer-events-none text-sm text-muted-foreground text-left whitespace-nowrap overflow-hidden"
      >
        {text}
        <span className="ml-0.5 inline-block w-[1ch] animate-pulse">|</span>
      </motion.p>
    </AnimatePresence>
  )
}

export function AiInput({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const [value, setValue] = useState("")
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
  })
  const [selectedModel, setSelectedModel] = useState("llama-3.1")
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handelClose = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    if (fileInputRef.current) {
      fileInputRef.current.value = "" // Reset file input
    }
    setImagePreview(null) // Use null instead of empty string
  }

  const handelChange = (e: any) => {
    const file = e.target.files ? e.target.files[0] : null
    if (file) {
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = () => {
    if (!isAuthenticated) {
      router.replace("/?auth=login")
      return
    }
    
    if (!value.trim()) return
    
    // Here you would typically send the API request to generate the API
    console.log("Generating API for:", value)
    
    // For now, just clear the input
    setValue("")
    adjustHeight(true)
  }

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])
  
  return (
    <div className="w-full py-4">
      <div className="relative max-w-2xl border rounded-[32px] border-border bg-card shadow-lg p-2 w-full mx-auto">
        <div className="relative rounded-[24px] border border-border bg-card flex flex-col">
          <div
            className="overflow-y-auto overflow-x-hidden"
            style={{ maxHeight: `${MAX_HEIGHT}px` }}
          >
            <div className="relative">
              <Textarea
                id="ai-input-04"
                value={value}
                placeholder=""
                className="w-full rounded-[24px] rounded-b-none px-4 py-3 bg-card border-none resize-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 leading-[1.2] text-foreground placeholder:text-muted-foreground text-left"
                ref={textareaRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                onChange={(e) => {
                  setValue(e.target.value)
                  adjustHeight()
                }}
              />
              {!value && (
                <div className="absolute inset-x-4 top-3 text-left">
                  <AnimatedPlaceholder selectedModel={selectedModel} />
                </div>
              )}
            </div>
          </div>

          <div className="h-12 bg-card rounded-b-[24px] border-t border-border">
            <div className="absolute left-3 bottom-3 flex items-center gap-2">
              <label
                className={cn(
                  "cursor-pointer relative rounded-full p-2",
                  imagePreview
                    ? "bg-blue-500/15 border border-blue-500 text-blue-500"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handelChange}
                  className="hidden"
                />
                <Paperclip
                  className={cn(
                    "w-4 h-4 transition-colors",
                    imagePreview && "text-blue-500"
                  )}
                />
                {imagePreview && (
                  <div className="absolute w-[100px] h-[100px] top-14 -left-4">
                    <Image
                      className="object-cover rounded-2xl"
                      src={imagePreview || "/picture1.jpeg"}
                      height={500}
                      width={500}
                      alt="additional image"
                    />
                    <button
                      onClick={handelClose}
                      className="bg-card text-foreground absolute -top-1 -left-1 shadow-lg rounded-full rotate-45 border border-border"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowModelDropdown(!showModelDropdown)
                  }}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-2 px-2 py-1 border h-8",
                    showModelDropdown
                      ? "bg-blue-500/15 border-blue-500 text-blue-500"
                      : "bg-muted border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  )}
                >
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">
                    {models.find(m => m.id === selectedModel)?.name || "GPT-4"}
                  </span>
                  <ChevronDown className={cn(
                    "w-3 h-3 transition-transform",
                    showModelDropdown && "rotate-180"
                  )} />
                </button>
                
                {/* Model Dropdown */}
                <AnimatePresence>
                  {showModelDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-lg p-1 z-10 min-w-[180px]"
                    >
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id)
                            setShowModelDropdown(false)
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                            selectedModel === model.id
                              ? "bg-blue-500/15 text-blue-600"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <div className="font-medium">{model.name}</div>
                          <div className="text-xs text-muted-foreground">{model.provider}</div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="absolute right-3 bottom-3">
              <button
                type="button"
                onClick={handleSubmit}
                className={cn(
                  "rounded-full p-2 transition-colors",
                  value
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
