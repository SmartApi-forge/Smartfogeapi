/**
 * Message Sanitizer Utility
 * 
 * Provides functions to sanitize chat messages, particularly for handling
 * legacy data where assistant responses may contain duplicated user prompts.
 * 
 * Requirements: 1.5 - Strip duplicated prompts from legacy data display
 */

/**
 * Sanitizes an assistant response by removing any duplicated user prompt
 * from the beginning of the response.
 * 
 * This handles legacy data where the assistant response may have been
 * stored with the user's prompt prepended to it.
 * 
 * @param userMessage - The original user message/prompt
 * @param assistantResponse - The assistant's response that may contain the duplicated prompt
 * @returns The sanitized assistant response without the duplicated prompt
 * 
 * @example
 * // Legacy data with duplicated prompt
 * sanitizeAssistantResponse(
 *   "Create a REST API",
 *   "Create a REST API\n\nI'll create a REST API for you..."
 * );
 * // Returns: "I'll create a REST API for you..."
 */
export function sanitizeAssistantResponse(
  userMessage: string | null | undefined,
  assistantResponse: string | null | undefined
): string {
  // Handle null/undefined cases
  if (!assistantResponse) {
    return '';
  }
  
  if (!userMessage) {
    return assistantResponse;
  }
  
  const trimmedUserMessage = userMessage.trim();
  const trimmedResponse = assistantResponse.trim();
  
  // If the response is empty or shorter than the user message, return as-is
  if (!trimmedResponse || trimmedResponse.length < trimmedUserMessage.length) {
    return assistantResponse;
  }
  
  // Check if the response starts with the user message (exact match)
  if (trimmedResponse.startsWith(trimmedUserMessage)) {
    const remaining = trimmedResponse.slice(trimmedUserMessage.length).trim();
    // Return the remaining content, or the original if nothing remains
    return remaining || assistantResponse;
  }
  
  // Check for case-insensitive match at the beginning
  const lowerResponse = trimmedResponse.toLowerCase();
  const lowerUserMessage = trimmedUserMessage.toLowerCase();
  
  if (lowerResponse.startsWith(lowerUserMessage)) {
    const remaining = trimmedResponse.slice(trimmedUserMessage.length).trim();
    return remaining || assistantResponse;
  }
  
  // Check for common patterns where the prompt is quoted or prefixed
  const quotedPatterns = [
    `"${trimmedUserMessage}"`,
    `'${trimmedUserMessage}'`,
    `User: ${trimmedUserMessage}`,
    `Prompt: ${trimmedUserMessage}`,
    `Request: ${trimmedUserMessage}`,
  ];
  
  for (const pattern of quotedPatterns) {
    if (trimmedResponse.startsWith(pattern)) {
      const remaining = trimmedResponse.slice(pattern.length).trim();
      return remaining || assistantResponse;
    }
  }
  
  // No duplication detected, return original response
  return assistantResponse;
}

/**
 * Checks if an assistant response appears to contain a duplicated user prompt.
 * 
 * @param userMessage - The original user message/prompt
 * @param assistantResponse - The assistant's response to check
 * @returns True if the response appears to contain the duplicated prompt
 */
export function hasPromptDuplication(
  userMessage: string | null | undefined,
  assistantResponse: string | null | undefined
): boolean {
  if (!userMessage || !assistantResponse) {
    return false;
  }
  
  const trimmedUserMessage = userMessage.trim();
  const trimmedResponse = assistantResponse.trim();
  
  // Check for exact match at the beginning
  if (trimmedResponse.startsWith(trimmedUserMessage)) {
    return true;
  }
  
  // Check for case-insensitive match
  const lowerResponse = trimmedResponse.toLowerCase();
  const lowerUserMessage = trimmedUserMessage.toLowerCase();
  
  if (lowerResponse.startsWith(lowerUserMessage)) {
    return true;
  }
  
  // Check for quoted patterns
  const quotedPatterns = [
    `"${trimmedUserMessage}"`,
    `'${trimmedUserMessage}'`,
    `User: ${trimmedUserMessage}`,
    `Prompt: ${trimmedUserMessage}`,
    `Request: ${trimmedUserMessage}`,
  ];
  
  return quotedPatterns.some(pattern => trimmedResponse.startsWith(pattern));
}

/**
 * Sanitizes a message object by cleaning up the content if it's an assistant
 * message that may contain a duplicated user prompt.
 * 
 * @param message - The message object to sanitize
 * @param previousUserMessage - The previous user message in the conversation
 * @returns The sanitized message object
 */
export function sanitizeMessage<T extends { role: string; content: string }>(
  message: T,
  previousUserMessage?: string | null
): T {
  // Only sanitize assistant messages
  if (message.role !== 'assistant' || !previousUserMessage) {
    return message;
  }
  
  const sanitizedContent = sanitizeAssistantResponse(previousUserMessage, message.content);
  
  // Return a new object with sanitized content
  return {
    ...message,
    content: sanitizedContent,
  };
}

/**
 * Sanitizes an array of messages by removing duplicated prompts from
 * assistant responses.
 * 
 * @param messages - Array of messages to sanitize
 * @returns Array of sanitized messages
 */
export function sanitizeMessages<T extends { role: string; content: string }>(
  messages: T[]
): T[] {
  if (!messages || messages.length === 0) {
    return messages;
  }
  
  const sanitized: T[] = [];
  let lastUserMessage: string | null = null;
  
  for (const message of messages) {
    if (message.role === 'user') {
      lastUserMessage = message.content;
      sanitized.push(message);
    } else if (message.role === 'assistant') {
      sanitized.push(sanitizeMessage(message, lastUserMessage));
    } else {
      sanitized.push(message);
    }
  }
  
  return sanitized;
}

export default {
  sanitizeAssistantResponse,
  hasPromptDuplication,
  sanitizeMessage,
  sanitizeMessages,
};
