"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/ui/chat-interface";
import { useChatStream } from "@/hooks/use-chat-stream";

export default function ChatPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    progressInfo,
    sendMessage,
    clearMessages,
    stopStream,
  } = useChatStream();

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900">
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading || isStreaming}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          showWelcome={messages.length === 0}
          streamingMessage={streamingMessage}
          progressInfo={progressInfo}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              AI Code Assistant
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Chat with AI to modify and generate code for your projects
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading || isStreaming}
              isFullscreen={isFullscreen}
              onToggleFullscreen={handleToggleFullscreen}
              showWelcome={messages.length === 0}
              streamingMessage={streamingMessage}
              progressInfo={progressInfo}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
