/**
 * Chat UX Type Definitions
 * Requirements: 1.1, 3.1, 5.1
 * 
 * Defines interfaces for:
 * - Attachment handling (images, PDFs, code files)
 * - Chat messages with mode support (Ask/Code)
 * - Context sources for RAG retrieval
 * - Stream events for file reading and context building
 * - Mode and Attachment handler interfaces
 */

// ============================================================================
// Attachment Types
// ============================================================================

/**
 * Supported attachment types
 */
export type AttachmentType = 'image' | 'pdf' | 'markdown' | 'code' | 'other';

/**
 * Attachment interface for files uploaded with prompts
 * Requirements: 5.1
 */
export interface Attachment {
  id: string;
  name: string;
  type: AttachmentType;
  size: number;
  url: string;
  thumbnailUrl?: string;
  content?: string; // For text-based files
  storagePath: string;
  contentHash?: string;
  createdAt: Date;
}

/**
 * Attachment preview modal state
 */
export interface AttachmentPreviewModal {
  isOpen: boolean;
  attachment: Attachment | null;
  onClose: () => void;
}

/**
 * Attachment handler interface for managing file attachments
 * Requirements: 5.1
 */
export interface AttachmentHandler {
  addAttachment(file: File): Promise<Attachment>;
  removeAttachment(id: string): void;
  openPreview(attachment: Attachment): void;
  closePreview(): void;
  getAttachments(): Attachment[];
  validateAttachment(file: File): AttachmentValidationResult;
}


/**
 * Attachment validation result
 */
export interface AttachmentValidationResult {
  valid: boolean;
  error?: string;
  maxSize?: number;
}

// ============================================================================
// Chat Mode Types
// ============================================================================

/**
 * Chat mode - Ask for conversational, Code for file modifications
 * Requirements: 1.1
 */
export type ChatMode = 'ask' | 'code';

/**
 * Mode handler interface for Ask/Code mode switching
 * Requirements: 1.1
 */
export interface ModeHandler {
  setMode(mode: ChatMode): void;
  getMode(): ChatMode;
  generateResponse(prompt: string, context: GenerationContext): AsyncGenerator<ChatStreamEvent>;
}

/**
 * Generation context for AI responses
 */
export interface GenerationContext {
  projectId: string;
  conversationHistory: ChatMessage[];
  attachments: Attachment[];
  contextSources: ContextSource[];
}

// ============================================================================
// Context Source Types
// ============================================================================

/**
 * Context source type for RAG retrieval
 */
export type ContextSourceType = 'file' | 'embedding' | 'project_knowledge' | 'conversation';

/**
 * Context source interface for tracking where context came from
 * Requirements: 3.1
 */
export interface ContextSource {
  type: ContextSourceType;
  path?: string;
  relevanceScore?: number;
  truncated?: boolean;
  memoryLayer?: 'working' | 'long_term';
}

// ============================================================================
// Chat Message Types
// ============================================================================

/**
 * Chat message role
 */
export type MessageRole = 'user' | 'assistant';

/**
 * File reading event for tracking which files were read
 */
export interface FileReadingEvent {
  type: 'file:reading' | 'file:read:complete';
  filePath?: string;
  fileCount?: number;
  timestamp: number;
}

/**
 * Chat message interface with mode and attachment support
 * Requirements: 1.1, 3.1, 5.1
 */
export interface ChatMessage {
  id: string;
  projectId: string;
  role: MessageRole;
  content: string;
  mode: ChatMode;
  attachments: Attachment[];
  contextSources: ContextSource[];
  fileReadingEvents: FileReadingEvent[];
  createdAt: Date;
}


// ============================================================================
// Stream Event Types
// ============================================================================

/**
 * Base stream event with timestamp
 */
export interface BaseStreamEvent {
  timestamp: number;
}

/**
 * File reading stream event - emitted when a file is being read for context
 * Requirements: 3.1
 */
export interface FileReadingStreamEvent extends BaseStreamEvent {
  type: 'file:reading';
  filePath: string;
}

/**
 * File read complete stream event - emitted when all files have been read
 * Requirements: 3.1
 */
export interface FileReadCompleteStreamEvent extends BaseStreamEvent {
  type: 'file:read:complete';
  fileCount: number;
  filePaths: string[];
}

/**
 * Context building stage
 */
export type ContextBuildingStage = 'working_memory' | 'long_term_memory' | 'rag_retrieval';

/**
 * Context building stream event - emitted during context assembly
 * Requirements: 3.1
 */
export interface ContextBuildingStreamEvent extends BaseStreamEvent {
  type: 'context:building';
  stage: ContextBuildingStage;
  progress: number; // 0-100
}

/**
 * Context retrieved stream event - emitted when RAG retrieval completes
 * Requirements: 3.1
 */
export interface ContextRetrievedStreamEvent extends BaseStreamEvent {
  type: 'context:retrieved';
  sources: ContextSource[];
  truncated: boolean;
  tokenCount: number;
}

/**
 * Thinking indicator stream event - emitted immediately on prompt receipt
 */
export interface ThinkingStreamEvent extends BaseStreamEvent {
  type: 'thinking';
  message: string;
}

/**
 * Text chunk stream event - for Ask mode responses
 */
export interface TextChunkStreamEvent extends BaseStreamEvent {
  type: 'text:chunk';
  content: string;
}

/**
 * Message saved stream event - emitted when message is persisted
 */
export interface MessageSavedStreamEvent extends BaseStreamEvent {
  type: 'message:saved';
  messageId: string;
}

/**
 * Union type for all chat-specific stream events
 */
export type ChatStreamEvent =
  | FileReadingStreamEvent
  | FileReadCompleteStreamEvent
  | ContextBuildingStreamEvent
  | ContextRetrievedStreamEvent
  | ThinkingStreamEvent
  | TextChunkStreamEvent
  | MessageSavedStreamEvent;


// ============================================================================
// Streaming Service Types
// ============================================================================

/**
 * Stream request for direct streaming API
 */
export interface StreamRequest {
  projectId: string;
  prompt: string;
  mode: ChatMode;
  attachments?: Attachment[];
  conversationHistory: ChatMessage[];
}

/**
 * Connection status for SSE
 */
export interface ConnectionStatus {
  connected: boolean;
  lastEventTime: number;
  reconnectAttempts: number;
}

/**
 * Direct streaming service interface
 */
export interface DirectStreamingService {
  streamResponse(request: StreamRequest): ReadableStream<Uint8Array>;
  emitEvent(event: ChatStreamEvent): void;
  getConnectionStatus(): ConnectionStatus;
}

// ============================================================================
// Mode Response Types
// ============================================================================

/**
 * Ask mode response - conversational without file modifications
 */
export interface AskModeResponse {
  type: 'text';
  content: string;
  sources: ContextSource[];
}

/**
 * Code mode response - with file modifications
 */
export interface CodeModeResponse {
  type: 'code';
  modifiedFiles: Record<string, string>;
  newFiles: Record<string, string>;
  deletedFiles: string[];
  description: string;
}

// ============================================================================
// Clickable File Path Types
// ============================================================================

/**
 * File path status for UI indicators
 */
export type FilePathStatus = 'reading' | 'generating' | 'modified' | 'complete';

/**
 * Clickable file path component props
 */
export interface ClickableFilePathProps {
  path: string;
  status?: FilePathStatus;
  onClick: (path: string) => void;
}

// ============================================================================
// Token Buffer Types
// ============================================================================

/**
 * Token buffer interface for smooth streaming display
 */
export interface TokenBuffer {
  addToken(token: string): void;
  flush(): string;
  setFlushInterval(ms: number): void;
  clear(): void;
}

// ============================================================================
// Database Types (for Supabase)
// ============================================================================

/**
 * Database row type for message_attachments table
 */
export interface MessageAttachmentRow {
  id: string;
  message_id: string | null;
  project_id: string;
  name: string;
  type: AttachmentType;
  size: number;
  storage_path: string;
  thumbnail_path: string | null;
  content_hash: string | null;
  created_at: string;
}

/**
 * Database row type for messages table (extended columns)
 */
export interface MessageRowExtension {
  mode: ChatMode;
  context_sources: ContextSource[];
  file_reading_events: FileReadingEvent[];
}
