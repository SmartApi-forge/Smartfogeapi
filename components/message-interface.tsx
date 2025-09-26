"use client"

import React from "react";
import { motion } from "framer-motion";
import { User, Bot, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  type: "user" | "system";
  content: string;
  timestamp: Date;
  status?: "pending" | "processing" | "completed" | "error";
  metadata?: {
    estimatedTime?: number;
    progress?: number;
  };
}

interface MessageInterfaceProps {
  messages: Message[];
  className?: string;
}

const MessageBubble: React.FC<{ message: Message; index: number }> = ({ message, index }) => {
  const isUser = message.type === "user";
  
  const getStatusIcon = () => {
    switch (message.status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (message.status) {
      case "pending":
        return "Queued for processing...";
      case "processing":
        return `Generating API... ${message.metadata?.progress ? `${message.metadata.progress}%` : ''}`;
      case "completed":
        return "API generated successfully!";
      case "error":
        return "Failed to generate API";
      default:
        return message.content;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={cn(
        "flex gap-3 mb-6",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: '#333333' }}>
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 shadow-lg font-neue-500",
        isUser 
          ? "text-white shadow-black/20" 
          : "text-gray-100 border border-[#444444]/50 shadow-black/20"
      )}
      style={{
        backgroundColor: '#333333',
        fontSize: '14px',
        lineHeight: '24px'
      }}>
        <div className="text-sm leading-relaxed">
          {isUser ? message.content : getStatusText()}
        </div>
        
        {!isUser && message.status && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#444444]/50">
            {getStatusIcon()}
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            {message.metadata?.estimatedTime && message.status === "processing" && (
              <span className="text-xs text-gray-400">
                • Est. {message.metadata.estimatedTime}s remaining
              </span>
            )}
          </div>
        )}
        
        {!isUser && message.status === "processing" && message.metadata?.progress && (
          <div className="mt-3 pt-3 border-t border-[#444444]/50">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>Progress</span>
              <span>{message.metadata.progress}%</span>
            </div>
            <div className="w-full bg-[#1A1D21] rounded-full h-2">
              <motion.div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${message.metadata.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: '#333333' }}>
          <User className="h-4 w-4 text-white" />
        </div>
      )}
    </motion.div>
  );
};

export const MessageInterface: React.FC<MessageInterfaceProps> = ({ 
  messages, 
  className 
}) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.5 }}
      className={cn(
        "w-full max-w-4xl mx-auto rounded-xl border border-[#444444]/50 shadow-2xl backdrop-blur-sm",
        className
      )}
      style={{ backgroundColor: '#0E100F' }}
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#444444]/50">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: '#333333' }}>
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">API Generation</h3>
            <p className="text-sm text-gray-400">Building your custom API...</p>
          </div>
        </div>
        
        <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-[#444444] scrollbar-track-transparent hover:scrollbar-thumb-[#555555]">
          {messages.map((message, index) => (
            <MessageBubble key={message.id} message={message} index={index} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </motion.div>
  );
};

export default MessageInterface;