"use client"

import { useRouter } from 'next/navigation'
import { PromptInputBox } from "@/components/ui/ai-prompt-box"
import { api } from "@/lib/trpc-client"

export function DashboardContent() {
  const router = useRouter()
  
  // tRPC hook for automatic Inngest invocation
  const invokeInngest = api.apiGeneration.invoke.useMutation({
    onSuccess: (data) => {
      console.log("Inngest function invoked successfully!", data)
      // Redirect to the loading page with the project ID
      if (data.projectId) {
        router.push(`/loading?projectId=${data.projectId}`)
      }
    },
    onError: (error: any) => {
      console.error("Failed to invoke Inngest function:", error)
    }
  })

  const handleSendMessage = (message: string) => {
    if (!message.trim()) return

    // Invoke Inngest function with the user's input
    invokeInngest.mutate({ 
      text: message,
      mode: 'direct',
      repoUrl: undefined
    })
    console.log('Message:', message)
  }

  return (
    <main className="flex flex-col items-center justify-center h-full px-6">
      {/* Logo and Tagline */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-white text-6xl font-neue-500">Smart API Forge</span>
          </div>
        </div>
        <p className="text-white text-xl font-medium" style={{ fontFamily: "'__flecha_df5a44', '__flecha_Fallback_df5a44'" }}>
          The AI Engineer turning Ideas into APIs, Instantly.
        </p>
      </div>

      {/* Input Section */}
      <div className="w-full max-w-2xl">
        <PromptInputBox
          onSend={handleSendMessage}
          isLoading={invokeInngest.isLoading}
          className="border-gray-600 bg-gray-800"
        />
      </div>



      {/* Error Message */}
      {invokeInngest.isError && (
        <div className="mt-6 p-4 bg-red-600/20 border border-red-500/30 rounded-lg backdrop-blur-sm">
          <p className="text-white text-sm text-center">
            ❌ Something went wrong. Please try again.
          </p>
        </div>
      )}
    </main>
  )
}