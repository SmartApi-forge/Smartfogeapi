"use client"
import React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Sparkles, Zap, ArrowRight } from "lucide-react"

export const AIInputSection = () => {
  const [prompt, setPrompt] = React.useState("")

  const handleGenerate = () => {
    console.log("[v0] Generating API for prompt:", prompt)
    // TODO: Implement API generation logic
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
              disabled={!prompt.trim()}
            >
              <Zap className="mr-2 size-5" />
              Generate API
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
