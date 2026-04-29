import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Server-side Supabase admin client.
 * Uses the service_role key — bypasses RLS.
 * ONLY import this in:
 *   - Next.js API routes (app/api/*)
 *   - Server Actions
 *   - Edge Functions
 * NEVER import in client components or expose to the browser.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
