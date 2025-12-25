import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Promise that resolves when auth is ready
// Pages should await this before making queries to avoid race conditions
export const authReady = new Promise<void>((resolve) => {
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (!session) {
      await supabase.auth.signInAnonymously()
    }
    resolve()
  })
})
