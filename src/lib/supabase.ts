import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser/client-side Supabase client (uses anon/publishable key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types — expand as we build out the schema
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
        }
        Update: {
          full_name?: string | null
        }
      }
      websites: {
        Row: {
          id: string
          owner_id: string
          subdomain: string
          name: string
          html_content: string
          update_email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          owner_id: string
          subdomain: string
          name: string
          html_content: string
          update_email: string
        }
        Update: {
          name?: string
          html_content?: string
        }
      }
      editors: {
        Row: {
          id: string
          website_id: string
          email: string
          added_by: string
          created_at: string
        }
        Insert: {
          website_id: string
          email: string
          added_by: string
        }
        Update: never
      }
    }
  }
}
