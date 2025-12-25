/**
 * Shared Supabase client initialization for edge functions
 */

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { Database } from '../../../src/types/database.ts';

/**
 * Creates a Supabase client with service role key
 * Service role bypasses RLS for automated sync operations
 */
export function createServiceClient(): SupabaseClient<Database> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: { persistSession: false }
    }
  );
}

export type { Database };
