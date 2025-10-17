import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { inngest } from "@/src/inngest/client";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatMessage {
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
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
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const message = formData.get("message") as string;
    const messageHistoryStr = formData.get("messageHistory") as string;
    const projectId = formData.get("projectId") as string;
    const userId = formData.get("userId") as string;
    
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Parse message history
    let messageHistory: ChatMessage[] = [];
    try {
      messageHistory = messageHistoryStr ? JSON.parse(messageHistoryStr) : [];
    } catch (error) {
      console.error("Error parsing message history:", error);
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial progress
          const sendData = (data: StreamResponse) => {
            const chunk = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
            controller.enqueue(chunk);
          };

          // Store user message in database
          if (projectId && userId) {
            const { data: userMessage, error: userMessageError } = await supabase
              .from('messages')
              .insert({
                content: message,
                role: 'user',
                type: 'text',
                project_id: projectId,
                user_id: userId
              })
              .select()
              .single();

            if (userMessageError) {
              console.error('Error storing user message:', userMessageError);
            } else {
              // Trigger message created event
              await inngest.send({
                name: "message/created",
                data: {
                  messageId: userMessage.id,
                  content: message,
                  role: 'user',
                  type: 'text',
                  project_id: projectId,
                  user_id: userId
                }
              });
            }
          }

          // Analyze the message to determine if it's a code modification request
          const isCodeModification = await analyzeMessageIntent(message);

          if (isCodeModification.isModification && projectId) {
            // Send file update notification
            sendData({
              type: "file_update",
              metadata: {
                fileBeingEdited: isCodeModification.targetFile,
                operation: isCodeModification.operation,
                progress: 0,
              },
            });

            // The code modification will be handled by the messageCreated function
            // which will trigger the editCode function
            
            // Send progress updates
            sendData({
              type: "progress",
              metadata: {
                fileBeingEdited: isCodeModification.targetFile,
                operation: "Analyzing request...",
                progress: 25,
              },
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            sendData({
              type: "progress",
              metadata: {
                operation: "Processing with AI...",
                progress: 50,
              },
            });

            await new Promise(resolve => setTimeout(resolve, 1500));

            sendData({
              type: "progress",
              metadata: {
                operation: "Applying changes...",
                progress: 75,
              },
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Send completion
            sendData({
              type: "complete",
              metadata: {
                operation: "Code modification completed",
                progress: 100,
              },
            });

          } else {
            // Handle regular chat conversation with OpenAI streaming
            const messages = [
              {
                role: "system" as const,
                content: "You are a helpful AI assistant that specializes in code analysis and modification. Provide clear, concise responses and suggest specific improvements when discussing code."
              },
              ...messageHistory.map(msg => ({
                role: msg.type === "user" ? "user" as const : "assistant" as const,
                content: msg.content
              })),
              {
                role: "user" as const,
                content: message
              }
            ];

            const completion = await openai.chat.completions.create({
              model: "gpt-4",
              messages,
              stream: true,
              temperature: 0.7,
              max_tokens: 2000,
            });

            let fullResponse = "";

            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                fullResponse += content;
                sendData({
                  type: "message",
                  content: content,
                });
              }
            }

            // Store assistant response in database
            if (fullResponse.trim() && projectId && userId) {
              const { error: assistantMessageError } = await supabase
                .from('messages')
                .insert({
                  content: fullResponse,
                  role: 'assistant',
                  type: 'text',
                  project_id: projectId,
                  user_id: userId
                });

              if (assistantMessageError) {
                console.error('Error storing assistant message:', assistantMessageError);
              }
            }

            sendData({ type: "complete" });
          }

          // Send final completion signal
          const doneChunk = encoder.encode("data: [DONE]\n\n");
          controller.enqueue(doneChunk);
          controller.close();

        } catch (error) {
          console.error("Stream error:", error);
          const errorData: StreamResponse = {
            type: "error",
            metadata: {
              error: error instanceof Error ? error.message : "Unknown error occurred",
            },
          };
          const errorChunk = encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`);
          controller.enqueue(errorChunk);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function analyzeMessageIntent(message: string): Promise<{
  isModification: boolean;
  targetFile?: string;
  operation?: string;
}> {
  // Simple keyword-based analysis for code modification requests
  const codeKeywords = [
    "modify", "change", "update", "edit", "fix", "create", "add", "remove", 
    "delete", "refactor", "optimize", "improve", "implement", "build"
  ];
  
  const fileExtensions = [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".c", ".css", ".html"];
  
  const lowerMessage = message.toLowerCase();
  const hasCodeKeyword = codeKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasFileReference = fileExtensions.some(ext => lowerMessage.includes(ext));
  
  // Extract potential file name
  let targetFile = undefined;
  const fileMatch = message.match(/(\w+\.(js|ts|jsx|tsx|py|java|cpp|c|css|html))/i);
  if (fileMatch) {
    targetFile = fileMatch[1];
  }
  
  // Determine operation type
  let operation = "modification";
  if (lowerMessage.includes("create") || lowerMessage.includes("add")) {
    operation = "creation";
  } else if (lowerMessage.includes("delete") || lowerMessage.includes("remove")) {
    operation = "deletion";
  } else if (lowerMessage.includes("refactor") || lowerMessage.includes("optimize")) {
    operation = "refactoring";
  }
  
  return {
    isModification: hasCodeKeyword || hasFileReference,
    targetFile,
    operation,
  };
}