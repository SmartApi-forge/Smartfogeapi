"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChatMessage } from "@/components/ui/chat-message";

interface UseChatStreamOptions {
  apiEndpoint?: string;
  onError?: (error: Error) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  maxMessages?: number;
}

interface StreamResponse {
  type: "message" | "progress" | "file_update" | "error" | "complete";
  content?: string;
  metadata?: {
    fileBeingEdited?: string;
    operation?: string;
    progress?: number;
    error?: string;
  };
  messageId?: string;
}

export function useChatStream({
  apiEndpoint = "/api/chat/stream",
  onError,
  onStreamStart,
  onStreamEnd,
  maxMessages = 100,
}: UseChatStreamOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [progressInfo, setProgressInfo] = useState<{
    fileBeingEdited?: string;
    operation?: string;
    progress?: number;
  }>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamingMessageRef = useRef<string | null>(null);

  // Generate unique message ID
  const generateMessageId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add a new message
  const addMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMessage: ChatMessage = {
        ...message,
        id: generateMessageId(),
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const updated = [...prev, newMessage];
        // Keep only the last maxMessages
        return updated.slice(-maxMessages);
      });

      return newMessage.id;
    },
    [maxMessages],
  );

  // Update an existing message
  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg,
        ),
      );
    },
    [],
  );

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Stop current stream
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);
    setStreamingMessage("");
    setProgressInfo({});
    currentStreamingMessageRef.current = null;
  }, []);

  // Send a message and handle streaming response
  const sendMessage = useCallback(
    async (content: string, files?: FileList) => {
      if (isLoading) return;

      // Add user message
      const userMessageId = addMessage({
        type: "user",
        content,
        isComplete: true,
      });

      setIsLoading(true);
      onStreamStart?.();

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        // Prepare form data
        const formData = new FormData();
        formData.append("message", content);
        formData.append("messageHistory", JSON.stringify(messages));

        if (files) {
          Array.from(files).forEach((file, index) => {
            formData.append(`file_${index}`, file);
          });
        }

        // Start streaming request
        const response = await fetch(apiEndpoint, {
          method: "POST",
          body: formData,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Create assistant message for streaming
        const assistantMessageId = addMessage({
          type: "assistant",
          content: "",
          isStreaming: true,
          isComplete: false,
        });

        currentStreamingMessageRef.current = assistantMessageId;
        setIsStreaming(true);
        setStreamingMessage("");
        setProgressInfo({});

        // Process streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim() === "") continue;

            try {
              // Parse SSE format
              if (line.startsWith("data: ")) {
                const data = line.slice(6);

                if (data === "[DONE]") {
                  // Stream complete
                  updateMessage(assistantMessageId, {
                    isStreaming: false,
                    isComplete: true,
                  });
                  break;
                }

                const streamData: StreamResponse = JSON.parse(data);

                switch (streamData.type) {
                  case "message":
                    // Update message content
                    const newContent = streamData.content || "";
                    setStreamingMessage((prev) => prev + newContent);
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              content: (msg.content || "") + newContent,
                            }
                          : msg,
                      ),
                    );
                    break;

                  case "progress":
                    // Update progress metadata
                    const progressData = {
                      fileBeingEdited: streamData.metadata?.fileBeingEdited,
                      operation: streamData.metadata?.operation,
                      progress: streamData.metadata?.progress,
                    };
                    setProgressInfo(progressData);
                    updateMessage(assistantMessageId, {
                      metadata: {
                        ...streamData.metadata,
                      },
                    });
                    break;

                  case "file_update":
                    // Handle file update notifications
                    const fileUpdateData = {
                      fileBeingEdited: streamData.metadata?.fileBeingEdited,
                      operation: streamData.metadata?.operation,
                      progress: streamData.metadata?.progress,
                    };
                    setProgressInfo(fileUpdateData);
                    updateMessage(assistantMessageId, {
                      metadata: {
                        fileBeingEdited: streamData.metadata?.fileBeingEdited,
                        operation: streamData.metadata?.operation,
                        progress: streamData.metadata?.progress,
                      },
                    });
                    break;

                  case "error":
                    // Handle errors
                    updateMessage(assistantMessageId, {
                      metadata: {
                        error: streamData.metadata?.error,
                      },
                      isStreaming: false,
                    });
                    break;

                  case "complete":
                    // Stream complete
                    setStreamingMessage("");
                    setProgressInfo({});
                    updateMessage(assistantMessageId, {
                      isStreaming: false,
                      isComplete: true,
                    });
                    break;
                }
              }
            } catch (error) {
              console.error("Error parsing stream data:", error);
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was aborted
          return;
        }

        console.error("Stream error:", error);

        // Add error message
        addMessage({
          type: "system",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
          isComplete: true,
          metadata: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });

        onError?.(error instanceof Error ? error : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        setStreamingMessage("");
        setProgressInfo({});
        currentStreamingMessageRef.current = null;
        abortControllerRef.current = null;
        onStreamEnd?.();
      }
    },
    [
      messages,
      isLoading,
      apiEndpoint,
      addMessage,
      updateMessage,
      onError,
      onStreamStart,
      onStreamEnd,
    ],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    progressInfo,
    sendMessage,
    addMessage,
    updateMessage,
    clearMessages,
    stopStream,
  };
}
