import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Auto sign-in anonymously if not authenticated
// This gives users the 'authenticated' role for RLS without requiring login
supabase.auth.getSession().then(({ data: { session } }) => {
  if (!session) {
    supabase.auth.signInAnonymously()
  }
})
