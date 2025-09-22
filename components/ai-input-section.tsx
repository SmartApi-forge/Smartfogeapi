"use client"
import React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Sparkles, Zap, ArrowRight } from "lucide-react"
import { api } from "@/lib/trpc-client"
import { toast } from "sonner"

export const AIInputSection = () => {
  const [prompt, setPrompt] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)

  const createMessage = api.messages.create.useMutation({
    onSuccess: (data: any) => {
      console.log("Message created successfully:", data)
      toast.success("API generation started! Check your dashboard for progress.")
      setPrompt("")
      setIsGenerating(false)
    },
    onError: (error: any) => {
      console.error("Error creating message:", error)
      toast.error(`Failed to start API generation: ${error.message}`)
      setIsGenerating(false)
    }
  })

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a description for your API")
      return
    }

    setIsGenerating(true)
    
    try {
      await createMessage.mutateAsync({
        content: prompt,
        role: "user",
        type: "text"
      })
    } catch (error) {
      console.error("Error in handleGenerate:", error)
      // Error is already handled in onError callback
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6">
      <Card className="bg-background/80 backdrop-blur-sm border-2 border-primary/20 p-8 shadow-2xl">
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-left">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary">
              <Sparkles className="size-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Describe Your API</h3>
              <p className="text-muted-foreground">Tell us what you want to build in plain English</p>
            </div>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Create an API to manage a book inventory with add, update, view, and delete operations. Include fields for title, author, ISBN, price, and quantity in stock."
            className="min-h-[120px] resize-none border-2 border-border text-base transition-colors focus:border-primary"
          />

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              size="lg"
              className="h-12 flex-1 text-base font-semibold"
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
            >
              <Zap className="mr-2 size-5" />
              {isGenerating ? "Generating..." : "Generate API"}
              <ArrowRight className="ml-2 size-5" />
            </Button>
            <Button variant="outline" size="lg" className="h-12 bg-transparent text-base">
              View Example
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
