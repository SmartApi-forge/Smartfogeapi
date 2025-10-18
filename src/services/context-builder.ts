import { VersionManager } from "./version-manager";
import { messageOperations } from "../../lib/supabase-server";
import type { Version } from "../modules/versions/types";
import type { Message } from "../modules/messages/types";

const MAX_CONTEXT_TOKENS = 100000; // ~75K tokens for context, leaving room for response
const CHARS_PER_TOKEN = 4; // Rough estimate
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

export interface GenerationContext {
  conversationHistory: Array<{ role: string; content: string }>;
  previousFiles: Record<string, string>;
  previousVersion: Version | null;
  projectId: string;
  summary: string;
  truncated: boolean;
}

/**
 * Context Builder Service
 * Aggregates conversation history and codebase state for AI generation
 */
export class ContextBuilder {
  /**
   * Build complete context for AI generation
   */
  static async buildContext(
    projectId: string,
    messageLimit: number = 20,
  ): Promise<GenerationContext> {
    // Fetch conversation history
    const messages = await this.fetchConversationHistory(
      projectId,
      messageLimit,
    );

    // Get the latest completed version
    const previousVersion = await VersionManager.getLatestVersion(projectId);

    // Extract files from previous version
    const previousFiles = previousVersion?.files || {};

    // Build conversation history array
    const conversationHistory = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Calculate context size and truncate if needed
    const { truncatedHistory, truncatedFiles, isTruncated } =
      this.truncateIfNeeded(conversationHistory, previousFiles);

    // Generate summary
    const summary = this.generateSummary(
      truncatedHistory,
      truncatedFiles,
      previousVersion,
    );

    return {
      conversationHistory: truncatedHistory,
      previousFiles: truncatedFiles,
      previousVersion,
      projectId,
      summary,
      truncated: isTruncated,
    };
  }

  /**
   * Fetch conversation history from database
   */
  private static async fetchConversationHistory(
    projectId: string,
    limit: number,
  ): Promise<Message[]> {
    try {
      const messages = await messageOperations.getWithFragments({
        projectId,
        limit,
        offset: 0,
        includeFragment: false,
      });

      // Sort by created_at ascending (oldest first)
      return messages.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      return [];
    }
  }

  /**
   * Truncate context if it exceeds token limits
   * Priority: Recent messages > Old messages, Essential files > Large files
   */
  private static truncateIfNeeded(
    conversationHistory: Array<{ role: string; content: string }>,
    previousFiles: Record<string, string>,
  ): {
    truncatedHistory: Array<{ role: string; content: string }>;
    truncatedFiles: Record<string, string>;
    isTruncated: boolean;
  } {
    // Calculate current size
    const historySize = JSON.stringify(conversationHistory).length;
    const filesSize = JSON.stringify(previousFiles).length;
    const totalSize = historySize + filesSize;

    if (totalSize <= MAX_CONTEXT_CHARS) {
      // No truncation needed
      return {
        truncatedHistory: conversationHistory,
        truncatedFiles: previousFiles,
        isTruncated: false,
      };
    }

    console.log(`Context too large (${totalSize} chars), truncating...`);

    // Allocate 40% to history, 60% to files (files are more important for iteration)
    const historyBudget = Math.floor(MAX_CONTEXT_CHARS * 0.4);
    const filesBudget = Math.floor(MAX_CONTEXT_CHARS * 0.6);

    // Truncate conversation history (keep most recent messages)
    const truncatedHistory = this.truncateHistory(
      conversationHistory,
      historyBudget,
    );

    // Truncate files (keep essential files, truncate large ones)
    const truncatedFiles = this.truncateFiles(previousFiles, filesBudget);

    return {
      truncatedHistory,
      truncatedFiles,
      isTruncated: true,
    };
  }

  /**
   * Truncate conversation history to fit budget
   * Keeps most recent messages, truncates older ones
   */
  private static truncateHistory(
    history: Array<{ role: string; content: string }>,
    budget: number,
  ): Array<{ role: string; content: string }> {
    const truncated: Array<{ role: string; content: string }> = [];
    let currentSize = 0;

    // Start from most recent and work backwards
    for (let i = history.length - 1; i >= 0; i--) {
      const message = history[i];
      const messageSize = JSON.stringify(message).length;

      if (currentSize + messageSize <= budget) {
        truncated.unshift(message);
        currentSize += messageSize;
      } else if (truncated.length === 0) {
        // Must include at least the last message, even if truncated
        const truncatedContent = message.content.slice(0, budget);
        truncated.unshift({
          role: message.role,
          content: truncatedContent + "... [truncated]",
        });
        break;
      } else {
        break;
      }
    }

    return truncated;
  }

  /**
   * Truncate files to fit budget
   * Priority: package.json, openapi.json, index files, then others
   */
  private static truncateFiles(
    files: Record<string, string>,
    budget: number,
  ): Record<string, string> {
    const essentialFiles = ["package.json", "openapi.json", "README.md"];
    const indexFiles = Object.keys(files).filter(
      (f) => f.includes("index") || f.includes("main") || f.includes("app"),
    );

    // Sort files by priority
    const sortedFiles = Object.keys(files).sort((a, b) => {
      const aIsEssential = essentialFiles.includes(a) ? -3 : 0;
      const bIsEssential = essentialFiles.includes(b) ? -3 : 0;
      const aIsIndex = indexFiles.includes(a) ? -2 : 0;
      const bIsIndex = indexFiles.includes(b) ? -2 : 0;
      const aSize = files[a].length;
      const bSize = files[b].length;

      // Prioritize: essential > index > smaller files
      return (
        aIsEssential +
        aIsIndex +
        aSize * 0.001 -
        (bIsEssential + bIsIndex + bSize * 0.001)
      );
    });

    const truncated: Record<string, string> = {};
    let currentSize = 0;

    for (const filename of sortedFiles) {
      const content = files[filename];
      const fileSize = content.length;

      if (currentSize + fileSize <= budget) {
        // Include full file
        truncated[filename] = content;
        currentSize += fileSize;
      } else if (currentSize < budget) {
        // Include truncated version
        const remaining = budget - currentSize;
        truncated[filename] = content.slice(0, remaining) + "\n... [truncated]";
        currentSize = budget;
        break;
      } else {
        break;
      }
    }

    return truncated;
  }

  /**
   * Generate a human-readable summary of the context
   */
  private static generateSummary(
    history: Array<{ role: string; content: string }>,
    files: Record<string, string>,
    previousVersion: Version | null,
  ): string {
    const messageCount = history.length;
    const fileCount = Object.keys(files).length;
    const versionInfo = previousVersion
      ? `v${previousVersion.version_number} (${previousVersion.name})`
      : "no previous version";

    return `Context: ${messageCount} messages, ${fileCount} files from ${versionInfo}`;
  }

  /**
   * Format context for AI prompt
   * Returns a structured prompt string
   */
  static formatForPrompt(
    context: GenerationContext,
    newPrompt: string,
  ): string {
    const sections: string[] = [];

    // Add conversation history
    if (context.conversationHistory.length > 0) {
      sections.push("## Conversation History\n");
      context.conversationHistory.forEach((msg) => {
        sections.push(`**${msg.role}**: ${msg.content}\n`);
      });
    }

    // Add previous codebase state
    if (Object.keys(context.previousFiles).length > 0) {
      sections.push("\n## Current Codebase\n");
      Object.entries(context.previousFiles).forEach(([filename, content]) => {
        sections.push(`### ${filename}\n\`\`\`\n${content}\n\`\`\`\n`);
      });
    }

    // Add new request
    sections.push("\n## New Request\n");
    sections.push(newPrompt);

    // Add truncation warning if needed
    if (context.truncated) {
      sections.push("\n*Note: Context was truncated to fit token limits*\n");
    }

    return sections.join("\n");
  }

  /**
   * Extract file list from context
   */
  static getFileList(context: GenerationContext): string[] {
    return Object.keys(context.previousFiles);
  }
}
