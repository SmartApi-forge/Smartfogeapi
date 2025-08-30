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
          framework: 'fastapi' | 'express'
          advanced: boolean
          status: 'generating' | 'completed' | 'failed' | 'deployed'
          openapi_spec: Json | null
          code_url: string | null
          deploy_url: string | null
          swagger_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          prompt: string
          framework: 'fastapi' | 'express'
          advanced?: boolean
          status?: 'generating' | 'completed' | 'failed' | 'deployed'
          openapi_spec?: Json | null
          code_url?: string | null
          deploy_url?: string | null
          swagger_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          prompt?: string
          framework?: 'fastapi' | 'express'
          advanced?: boolean
          status?: 'generating' | 'completed' | 'failed' | 'deployed'
          openapi_spec?: Json | null
          code_url?: string | null
          deploy_url?: string | null
          swagger_url?: string | null
          created_at?: string
          updated_at?: string
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
