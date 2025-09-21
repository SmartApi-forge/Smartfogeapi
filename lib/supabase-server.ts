import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role key for elevated permissions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Database types for TypeScript
export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  type: 'result' | 'error'
  created_at: string
  updated_at: string
}

export interface Fragment {
  id: string
  message_id: string
  sandbox_url: string
  title: string
  files: Record<string, any>
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

  // Get all messages
  async getAll() {
    const { data: messages, error } = await supabaseServer
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return messages as Message[]
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

  // Get fragments by message ID
  async getByMessageId(messageId: string) {
    const { data: fragments, error } = await supabaseServer
      .from('fragments')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: false })
    
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
  }
}