import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { Database } from '../../../src/types/database.ts';
import type {
  SleeperRoster,
  SleeperUser,
  RosterInsert
} from './types.ts';
import {
  SLEEPER_ROSTERS_URL,
  SLEEPER_USERS_URL,
  REQUEST_TIMEOUT_MS
} from './config.ts';

/**
 * Fetches data from a URL with timeout protection
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Merges roster and user data to create roster inserts
 */
function mergeRosterData(rosters: SleeperRoster[], users: SleeperUser[]): RosterInsert[] {
  // Create a map of user_id -> team_name for quick lookup
  const userTeamMap = new Map<string, string | null>();
  for (const user of users) {
    userTeamMap.set(user.user_id, user.metadata?.team_name || null);
  }

  // Map rosters with team names from users
  return rosters.map((roster) => ({
    roster_id: roster.roster_id,
    owner_id: roster.owner_id,
    team_name: userTeamMap.get(roster.owner_id) || null,
  }));
}

/**
 * Main edge function handler
 * Fetches league rosters from Sleeper API and upserts them to Supabase
 */
Deno.serve(async (_req: Request) => {
  const startTime = Date.now();

  try {
    // 1. Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient<Database>(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: { persistSession: false }
      }
    );

    // 2. Fetch rosters and users from Sleeper API in parallel
    console.log('Fetching league rosters and users from Sleeper API...');
    const [rostersResponse, usersResponse] = await Promise.all([
      fetchWithTimeout(SLEEPER_ROSTERS_URL, REQUEST_TIMEOUT_MS),
      fetchWithTimeout(SLEEPER_USERS_URL, REQUEST_TIMEOUT_MS),
    ]);

    if (!rostersResponse.ok) {
      throw new Error(
        `Sleeper rosters API error: ${rostersResponse.status} ${rostersResponse.statusText}`
      );
    }

    if (!usersResponse.ok) {
      throw new Error(
        `Sleeper users API error: ${usersResponse.status} ${usersResponse.statusText}`
      );
    }

    const rosters: SleeperRoster[] = await rostersResponse.json();
    const users: SleeperUser[] = await usersResponse.json();

    console.log(`Fetched ${rosters.length} rosters and ${users.length} users`);

    // 3. Merge roster and user data
    const rosterInserts = mergeRosterData(rosters, users);

    if (rosterInserts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No rosters to sync',
          rostersProcessed: 0
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // 4. Upsert to Supabase
    console.log(`Upserting ${rosterInserts.length} rosters...`);

    const { error } = await supabase
      .from('rosters')
      .upsert(rosterInserts, {
        onConflict: 'roster_id',
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Database upsert failed: ${error.message}`);
    }

    // 5. Return response
    const duration = Date.now() - startTime;
    const response = {
      success: true,
      rostersProcessed: rosterInserts.length,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    };

    console.log('Sync complete:', response);

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Fatal error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
