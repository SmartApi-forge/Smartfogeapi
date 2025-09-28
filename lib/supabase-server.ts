import { createClient } from '@supabase/supabase-js'

// Validate required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || supabaseUrl.trim() === '') {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
    'This should be set to your Supabase project URL (e.g., https://your-project.supabase.co). ' +
    'Please add it to your .env.local file or deployment environment.'
  )
}

if (!supabaseServiceRoleKey || supabaseServiceRoleKey.trim() === '') {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
    'This should be set to your Supabase service role key for server-side operations. ' +
    'You can find this in your Supabase project settings under API keys. ' +
    'Please add it to your .env.local file or deployment environment.'
  )
}

// Server-side Supabase client with service role key for elevated permissions
export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Alias for admin operations
export const supabaseAdmin = supabaseServer

// Database types for TypeScript
export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  type: 'text' | 'image' | 'file' | 'code' | 'result' | 'error'
  sender_id?: string
  receiver_id?: string
  project_id?: string
  created_at: string
  updated_at: string
}

export interface Fragment {
  id: string
  message_id: string
  content: string
  fragment_type?: string
  order_index: number
  metadata?: Record<string, any>
  sandbox_url: string  // Required field based on database schema
  title: string        // Required field based on database schema
  files: Record<string, any>  // Required field based on database schema
  created_at: string
  updated_at: string
}

// Helper functions for database operations
export const messageOperations = {
  // Create a new message
  async create(data: Omit<Message, 'id' | 'created_at' | 'updated_at'>) {
    const { data: message, error } = await supabaseServer
      .from('messages')
      .insert(data)
      .select()
      .single()
    
    if (error) throw error
    return message as Message
  },

  // Get all messages with optional filtering and pagination
  async getAll(options?: {
    role?: 'user' | 'assistant' | 'system';
    type?: 'text' | 'image' | 'file' | 'code' | 'result' | 'error';
    limit?: number;
    offset?: number;
    includeFragment?: boolean;
  }) {
    let query = supabaseServer
      .from('messages')
      .select(options?.includeFragment ? `
        *,
        fragments (
          id,
          message_id,
          sandbox_url,
          title,
          files,
          created_at,
          updated_at
        )
      ` : '*')
      .order('updated_at', { ascending: false })
    
    // Apply role filter if provided
    if (options?.role) {
      query = query.eq('role', options.role)
    }
    
    // Apply type filter if provided
    if (options?.type) {
      query = query.eq('type', options.type)
    }
    
    // Apply pagination
    if (options?.limit !== undefined || options?.offset !== undefined) {
      const limit = options.limit ?? 20
      const offset = options.offset ?? 0
      query = query.range(offset, offset + limit - 1)
    }
    
    const { data: messages, error } = await query
    
    if (error) throw error
    return messages as any
  },

  // Get message by ID
  async getById(id: string) {
    const { data: message, error } = await supabaseServer
      .from('messages')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return message as Message
  },

  // Update message
  async update(id: string, data: Partial<Omit<Message, 'id' | 'created_at' | 'updated_at'>>) {
    const { data: message, error } = await supabaseServer
      .from('messages')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return message as Message
  },

  // Delete message
  async delete(id: string) {
    const { error } = await supabaseServer
      .from('messages')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Get count of messages with optional filtering
  async getCount(filters?: { role?: 'user' | 'assistant'; type?: 'result' | 'error' }) {
    let query = supabaseServer
      .from('messages')
      .select('*', { count: 'exact', head: true })
    
    // Apply role filter if provided
    if (filters?.role) {
      query = query.eq('role', filters.role)
    }
    
    // Apply type filter if provided
    if (filters?.type) {
      query = query.eq('type', filters.type)
    }
    
    const { count, error } = await query
    
    if (error) throw error
    return count || 0
  },

  // Get recent messages with pagination (optimized with ORDER BY and LIMIT/OFFSET)
  async getRecent(limit: number, offset: number) {
    const { data: messages, error } = await supabaseServer
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error
    return messages as Message[]
  },

  // Get messages with their associated fragments using proper Supabase join
  async getWithFragments(options?: { limit?: number; offset?: number }) {
    const limit = options?.limit || 50
    const offset = options?.offset || 0
    
    const { data: messages, error } = await supabaseServer
      .from('messages')
      .select(`
        *,
        fragments (
          id,
          message_id,
          sandbox_url,
          title,
          files,
          created_at,
          updated_at
        )
      `)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error
    return messages as (Message & { fragments: Fragment[] })[]
  }
}

export const fragmentOperations = {
  // Create a new fragment
  async create(data: Omit<Fragment, 'id' | 'created_at' | 'updated_at'>) {
    const { data: fragment, error } = await supabaseServer
      .from('fragments')
      .insert(data)
      .select()
      .single()
    
    if (error) throw error
    return fragment as Fragment
  },

  // Bulk create fragments
  async bulkCreate(dataArray: Omit<Fragment, 'id' | 'created_at' | 'updated_at'>[]): Promise<Fragment[]> {
    const { data: fragments, error } = await supabaseServer
      .from('fragments')
      .insert(dataArray)
      .select()
    
    if (error) throw error
    return fragments as Fragment[]
  },

  // Get fragments by message ID with optional pagination
  async getByMessageId(messageId: string, options?: { limit?: number; offset?: number }) {
    let query = supabaseServer
      .from('fragments')
      .select('*')
      .eq('message_id', messageId)
      .order('order_index', { ascending: true })
    
    // Apply pagination if provided
    if (options?.limit !== undefined) {
      query = query.limit(options.limit)
    }
    if (options?.offset !== undefined) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }
    
    const { data: fragments, error } = await query
    
    if (error) throw error
    return fragments as Fragment[]
  },

  // Search fragments by content with case-insensitive matching and pagination
  async searchByContent(searchTerm: string, options?: { limit?: number; offset?: number }) {
    // Sanitize input to prevent injection
    const sanitizedTerm = searchTerm.replace(/[%_]/g, '\\$&')
    
    let query = supabaseServer
      .from('fragments')
      .select('*')
      .ilike('content', `%${sanitizedTerm}%`)
      .order('created_at', { ascending: false })
    
    // Apply pagination
    const limit = options?.limit || 10
    const offset = options?.offset || 0
    query = query.range(offset, offset + limit - 1)
    
    const { data: fragments, error } = await query
    
    if (error) throw error
    return fragments as Fragment[]
  },

  // Get fragment by ID
  async getById(id: string) {
    const { data: fragment, error } = await supabaseServer
      .from('fragments')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return fragment as Fragment
  },

  // Update fragment
  async update(id: string, data: Partial<Omit<Fragment, 'id' | 'created_at' | 'updated_at'>>) {
    const { data: fragment, error } = await supabaseServer
      .from('fragments')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return fragment as Fragment
  },

  // Delete fragment
  async delete(id: string) {
    const { error } = await supabaseServer
      .from('fragments')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Get count of fragments by message ID
  async getCountByMessageId(messageId: string): Promise<number> {
    const { count, error } = await supabaseServer
      .from('fragments')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', messageId)
    
    if (error) throw error
    return count || 0
  },

  // Get all fragments with optional pagination
  async getAll(options?: { limit?: number; offset?: number }) {
    let query = supabaseServer
      .from('fragments')
      .select('*')
      .order('created_at', { ascending: false })
    
    // Apply pagination
    const limit = options?.limit || 20
    const offset = options?.offset || 0
    query = query.range(offset, offset + limit - 1)
    
    const { data: fragments, error } = await query
    
    if (error) throw error
    return fragments as Fragment[]
  }
}