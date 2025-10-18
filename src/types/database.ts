export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          prompt: string;
          framework: "fastapi" | "express";
          advanced: boolean;
          status: "generating" | "completed" | "failed" | "deployed";
          openapi_spec: Json | null;
          code_url: string | null;
          deploy_url: string | null;
          swagger_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          prompt: string;
          framework: "fastapi" | "express";
          advanced?: boolean;
          status?: "generating" | "completed" | "failed" | "deployed";
          openapi_spec?: Json | null;
          code_url?: string | null;
          deploy_url?: string | null;
          swagger_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          prompt?: string;
          framework?: "fastapi" | "express";
          advanced?: boolean;
          status?: "generating" | "completed" | "failed" | "deployed";
          openapi_spec?: Json | null;
          code_url?: string | null;
          deploy_url?: string | null;
          swagger_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          project_id: string | null;
          user_id: string;
          type: "generate_api" | "deploy_api" | "test_api";
          status: "pending" | "running" | "completed" | "failed";
          payload: Json | null;
          result: Json | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          prompt: string | null;
          mode: "standalone" | "github";
          repo_url: string | null;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          user_id: string;
          type: "generate_api" | "deploy_api" | "test_api";
          status?: "pending" | "running" | "completed" | "failed";
          payload?: Json | null;
          result?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          prompt?: string | null;
          mode?: "standalone" | "github";
          repo_url?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          user_id?: string;
          type?: "generate_api" | "deploy_api" | "test_api";
          status?: "pending" | "running" | "completed" | "failed";
          payload?: Json | null;
          result?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          prompt?: string | null;
          mode?: "standalone" | "github";
          repo_url?: string | null;
        };
      };
      api_fragments: {
        Row: {
          id: string;
          job_id: string;
          openapi_spec: Json | null;
          implementation_code: Json | null;
          requirements: string[] | null;
          description: string | null;
          validation_results: Json | null;
          pr_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          openapi_spec?: Json | null;
          implementation_code?: Json | null;
          requirements?: string[] | null;
          description?: string | null;
          validation_results?: Json | null;
          pr_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          openapi_spec?: Json | null;
          implementation_code?: Json | null;
          requirements?: string[] | null;
          description?: string | null;
          validation_results?: Json | null;
          pr_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string;
          prompt_template: string;
          framework: "fastapi" | "express";
          tags: string[] | null;
          is_public: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category: string;
          prompt_template: string;
          framework: "fastapi" | "express";
          tags?: string[] | null;
          is_public?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string;
          prompt_template?: string;
          framework?: "fastapi" | "express";
          tags?: string[] | null;
          is_public?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          content: string;
          role: string;
          type: string;
          sender_id: string | null;
          receiver_id: string | null;
          project_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          content: string;
          role: string;
          type: string;
          sender_id?: string | null;
          receiver_id?: string | null;
          project_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          content?: string;
          role?: string;
          type?: string;
          sender_id?: string | null;
          receiver_id?: string | null;
          project_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      fragments: {
        Row: {
          content: string;
          created_at: string | null;
          files: Json;
          fragment_type: string;
          id: string;
          message_id: string;
          metadata: Json;
          order_index: number;
          project_id: string | null;
          sandbox_url: string;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          content?: string;
          created_at?: string | null;
          files?: Json;
          fragment_type?: string;
          id?: string;
          message_id: string;
          metadata?: Json;
          order_index?: number;
          project_id?: string | null;
          sandbox_url: string;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          files?: Json;
          fragment_type?: string;
          id?: string;
          message_id?: string;
          metadata?: Json;
          order_index?: number;
          project_id?: string | null;
          sandbox_url?: string;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fragments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fragments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
