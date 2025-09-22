/**
 * TypeScript interfaces for Inngest functions
 */

/**
 * Interface for AI agent state data structure
 * Used to strongly type AI-generated results from the network
 */
export interface AgentState {
  summary: string;
  files: { [path: string]: string }; // key = file path, value = content
}

/**
 * Interface for AI result structure
 */
export interface AIResult {
  state: {
    data: AgentState;
  };
}