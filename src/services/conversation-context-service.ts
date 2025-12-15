/**
 * ConversationContextService
 * 
 * Manages conversation state for the V0/Lovable architecture.
 * Handles loading and saving of messages, file snapshots, and file changes.
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.2, 4.1
 */

import { supabaseServer } from '../../lib/supabase-server'
import type {
  ConversationMessage,
  NewConversationMessage,
  FileSnapshot,
  NewFileSnapshot,
  FileChangesRecord,
  NewFileChangesRecord,
  FileSnapshotData,
  FileChange
} from '../types/database'

export interface ConversationContextServiceInterface {
  loadMessages(projectId: string): Promise<ConversationMessage[]>
  loadLatestSnapshot(projectId: string): Promise<FileSnapshot | null>
  saveMessage(message: Omit<NewConversationMessage, 'turn_index'>): Promise<ConversationMessage>
  saveSnapshot(snapshot: NewFileSnapshot): Promise<FileSnapshot>
  saveChanges(changes: NewFileChangesRecord): Promise<FileChangesRecord>
  getNextTurnIndex(projectId: string): Promise<number>
}

/**
 * Service for managing conversation context in the V0/Lovable architecture.
 * Provides methods to load and save conversation messages, file snapshots, and file changes.
 */
export const conversationContextService: ConversationContextServiceInterface = {
  /**
   * Load all messages for a project ordered by turn_index ascending.
   * Requirements: 2.2 - retrieve all previous messages ordered by turn index
   * 
   * @param projectId - The project ID to load messages for
   * @returns Array of conversation messages ordered by turn_index
   */
  async loadMessages(projectId: string): Promise<ConversationMessage[]> {
    const { data, error } = await supabaseServer
      .from('conversation_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('turn_index', { ascending: true })

    if (error) {
      throw new Error(`Failed to load messages: ${error.message}`)
    }

    return data || []
  },

  /**
   * Load the latest file snapshot for a project.
   * Requirements: 3.2 - retrieve the latest file snapshot for that conversation
   * 
   * @param projectId - The project ID to load snapshot for
   * @returns The latest file snapshot or null if none exists
   */
  async loadLatestSnapshot(projectId: string): Promise<FileSnapshot | null> {
    const { data, error } = await supabaseServer
      .from('file_snapshots')
      .select('*')
      .eq('project_id', projectId)
      .order('turn_index', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // PGRST116 means no rows found, which is valid for new projects
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to load latest snapshot: ${error.message}`)
    }

    return data
  },

  /**
   * Get the next turn index for a project.
   * Requirements: 2.4 - assign a sequential turn index starting from 1
   * 
   * @param projectId - The project ID
   * @returns The next turn index (1 for first message, max+1 for subsequent)
   */
  async getNextTurnIndex(projectId: string): Promise<number> {
    const { data, error } = await supabaseServer
      .from('conversation_messages')
      .select('turn_index')
      .eq('project_id', projectId)
      .order('turn_index', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // PGRST116 means no rows found - this is the first message
      if (error.code === 'PGRST116') {
        return 1
      }
      throw new Error(`Failed to get next turn index: ${error.message}`)
    }

    return (data?.turn_index || 0) + 1
  },

  /**
   * Save a new conversation message with auto-incrementing turn_index.
   * Requirements: 2.1 - save the user message and assistant response to the database
   * Requirements: 2.4 - assign a sequential turn index starting from 1
   * 
   * @param message - The message to save (without turn_index)
   * @returns The saved conversation message
   */
  async saveMessage(message: Omit<NewConversationMessage, 'turn_index'>): Promise<ConversationMessage> {
    // Get the next turn index
    const turnIndex = await conversationContextService.getNextTurnIndex(message.project_id)

    const messageWithTurnIndex: NewConversationMessage = {
      ...message,
      turn_index: turnIndex
    }

    const { data, error } = await supabaseServer
      .from('conversation_messages')
      .insert(messageWithTurnIndex)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save message: ${error.message}`)
    }

    return data
  },

  /**
   * Save a new file snapshot.
   * Requirements: 3.1 - save a complete snapshot of all project files as JSONB
   * 
   * @param snapshot - The file snapshot to save
   * @returns The saved file snapshot
   */
  async saveSnapshot(snapshot: NewFileSnapshot): Promise<FileSnapshot> {
    const { data, error } = await supabaseServer
      .from('file_snapshots')
      .insert(snapshot)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save snapshot: ${error.message}`)
    }

    return data
  },

  /**
   * Save file changes record.
   * Requirements: 4.1 - save a record of which files were created, modified, or deleted
   * 
   * @param changes - The file changes record to save
   * @returns The saved file changes record
   */
  async saveChanges(changes: NewFileChangesRecord): Promise<FileChangesRecord> {
    const { data, error } = await supabaseServer
      .from('file_changes')
      .insert(changes)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save changes: ${error.message}`)
    }

    return data
  }
}

/**
 * Helper function to build conversation history for LLM prompt.
 * Requirements: 2.3 - include the full conversation history as context
 * 
 * @param messages - Array of conversation messages
 * @returns Formatted conversation history string
 */
export function buildConversationHistory(messages: ConversationMessage[]): string {
  if (messages.length === 0) {
    return ''
  }

  return messages
    .map((msg) => {
      let history = `User: ${msg.user_message}`
      if (msg.assistant_response) {
        history += `\n\nAssistant: ${msg.assistant_response}`
      }
      return history
    })
    .join('\n\n---\n\n')
}

/**
 * Helper function to extract file state from snapshot for LLM context.
 * Requirements: 3.5 - include the current file state so the AI can see existing code
 * 
 * @param snapshot - The file snapshot
 * @returns Formatted file state string
 */
export function buildFileStateContext(snapshot: FileSnapshot | null): string {
  if (!snapshot || !snapshot.files_jsonb) {
    return 'No files in project yet.'
  }

  const files = snapshot.files_jsonb as FileSnapshotData
  const filePaths = Object.keys(files)

  if (filePaths.length === 0) {
    return 'No files in project yet.'
  }

  const fileList = filePaths
    .map((path) => {
      const file = files[path]
      return `- ${path} (${file.language}, ${file.size} bytes)`
    })
    .join('\n')

  return `Current project files (${filePaths.length} files):\n${fileList}`
}

export default conversationContextService
