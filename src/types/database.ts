export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          prompt: string
          framework: 'fastapi' | 'express' | 'nextjs' | 'react' | 'vue' | 'angular' | 'unknown' | 'flask' | 'django' | 'python'
          advanced: boolean
          status: 'generating' | 'completed' | 'failed' | 'deployed'
          openapi_spec: Json | null
          code_url: string | null
          deploy_url: string | null
          swagger_url: string | null
          created_at: string
          updated_at: string
          github_mode: boolean | null
          github_repo_id: string | null
          repo_url: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          prompt: string
          framework: 'fastapi' | 'express' | 'nextjs' | 'react' | 'vue' | 'angular' | 'unknown' | 'flask' | 'django' | 'python'
          advanced?: boolean
          status?: 'generating' | 'completed' | 'failed' | 'deployed'
          openapi_spec?: Json | null
          code_url?: string | null
          deploy_url?: string | null
          swagger_url?: string | null
          created_at?: string
          updated_at?: string
          github_mode?: boolean | null
          github_repo_id?: string | null
          repo_url?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          prompt?: string
          framework?: 'fastapi' | 'express' | 'nextjs' | 'react' | 'vue' | 'angular' | 'unknown' | 'flask' | 'django' | 'python'
          advanced?: boolean
          status?: 'generating' | 'completed' | 'failed' | 'deployed'
          openapi_spec?: Json | null
          code_url?: string | null
          deploy_url?: string | null
          swagger_url?: string | null
          created_at?: string
          updated_at?: string
          github_mode?: boolean | null
          github_repo_id?: string | null
          repo_url?: string | null
        }
      }
      jobs: {
        Row: {
          id: string
          project_id: string | null
          user_id: string
          type: 'generate_api' | 'deploy_api' | 'test_api'
          status: 'pending' | 'running' | 'completed' | 'failed'
          payload: Json | null
          result: Json | null
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          prompt: string | null
          mode: 'standalone' | 'github'
          repo_url: string | null
        }
        Insert: {
          id?: string
          project_id?: string | null
          user_id: string
          type: 'generate_api' | 'deploy_api' | 'test_api'
          status?: 'pending' | 'running' | 'completed' | 'failed'
          payload?: Json | null
          result?: Json | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          prompt?: string | null
          mode?: 'standalone' | 'github'
          repo_url?: string | null
        }
        Update: {
          id?: string
          project_id?: string | null
          user_id?: string
          type?: 'generate_api' | 'deploy_api' | 'test_api'
          status?: 'pending' | 'running' | 'completed' | 'failed'
          payload?: Json | null
          result?: Json | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          prompt?: string | null
          mode?: 'standalone' | 'github'
          repo_url?: string | null
        }
      }
      api_fragments: {
        Row: {
          id: string
          job_id: string
          openapi_spec: Json | null
          implementation_code: Json | null
          requirements: string[] | null
          description: string | null
          validation_results: Json | null
          pr_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          openapi_spec?: Json | null
          implementation_code?: Json | null
          requirements?: string[] | null
          description?: string | null
          validation_results?: Json | null
          pr_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          openapi_spec?: Json | null
          implementation_code?: Json | null
          requirements?: string[] | null
          description?: string | null
          validation_results?: Json | null
          pr_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          prompt_template: string
          framework: 'fastapi' | 'express'
          tags: string[] | null
          is_public: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          prompt_template: string
          framework: 'fastapi' | 'express'
          tags?: string[] | null
          is_public?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          prompt_template?: string
          framework?: 'fastapi' | 'express'
          tags?: string[] | null
          is_public?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          content: string
          role: string
          type: string
          sender_id: string | null
          receiver_id: string | null
          project_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          content: string
          role: string
          type: string
          sender_id?: string | null
          receiver_id?: string | null
          project_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          content?: string
          role?: string
          type?: string
          sender_id?: string | null
          receiver_id?: string | null
          project_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fragments: {
        Row: {
          content: string
          created_at: string | null
          files: Json
          fragment_type: string
          id: string
          message_id: string
          metadata: Json
          order_index: number
          project_id: string | null
          sandbox_url: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          files?: Json
          fragment_type?: string
          id?: string
          message_id: string
          metadata?: Json
          order_index?: number
          project_id?: string | null
          sandbox_url: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          files?: Json
          fragment_type?: string
          id?: string
          message_id?: string
          metadata?: Json
          order_index?: number
          project_id?: string | null
          sandbox_url?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fragments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fragments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      // V0/Lovable Architecture Tables (new)
      conversation_messages: {
        Row: {
          id: string
          project_id: string
          turn_index: number
          user_message: string
          assistant_response: string | null
          model: string
          input_tokens: number | null
          output_tokens: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          turn_index: number
          user_message: string
          assistant_response?: string | null
          model?: string
          input_tokens?: number | null
          output_tokens?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          turn_index?: number
          user_message?: string
          assistant_response?: string | null
          model?: string
          input_tokens?: number | null
          output_tokens?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      file_snapshots: {
        Row: {
          id: string
          project_id: string
          turn_index: number
          files_jsonb: Json
          file_count: number | null
          total_size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          turn_index: number
          files_jsonb?: Json
          file_count?: number | null
          total_size_bytes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          turn_index?: number
          files_jsonb?: Json
          file_count?: number | null
          total_size_bytes?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      file_changes: {
        Row: {
          id: string
          project_id: string
          turn_index: number
          changes: Json
          execution_status: 'pending' | 'success' | 'failed'
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          turn_index: number
          changes?: Json
          execution_status?: 'pending' | 'success' | 'failed'
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          turn_index?: number
          changes?: Json
          execution_status?: 'pending' | 'success' | 'failed'
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_changes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}


// V0/Lovable Architecture Helper Types

/**
 * Structure for files stored in file_snapshots.files_jsonb
 * Key is the file path, value contains file metadata
 */
export interface FileSnapshotData {
  [filePath: string]: {
    content: string
    language: string
    size: number
  }
}

/**
 * Structure for a single file change in file_changes.changes
 */
export interface FileChange {
  file: string
  action: 'create' | 'modify' | 'delete'
  reason: string
}

/**
 * Convenience type for conversation message row
 */
export type ConversationMessage = Database['public']['Tables']['conversation_messages']['Row']
export type NewConversationMessage = Database['public']['Tables']['conversation_messages']['Insert']
export type UpdateConversationMessage = Database['public']['Tables']['conversation_messages']['Update']

/**
 * Convenience type for file snapshot row
 */
export type FileSnapshot = Database['public']['Tables']['file_snapshots']['Row']
export type NewFileSnapshot = Database['public']['Tables']['file_snapshots']['Insert']
export type UpdateFileSnapshot = Database['public']['Tables']['file_snapshots']['Update']

/**
 * Convenience type for file changes row
 */
export type FileChangesRecord = Database['public']['Tables']['file_changes']['Row']
export type NewFileChangesRecord = Database['public']['Tables']['file_changes']['Insert']
export type UpdateFileChangesRecord = Database['public']['Tables']['file_changes']['Update']
