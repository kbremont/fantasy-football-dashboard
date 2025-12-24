import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { Database } from '../../../src/types/database.ts';
import type {
  SleeperPlayersResponse,
  NFLPlayerInsert,
  SleeperPlayer
} from './types.ts';
import {
  isFantasyPosition
} from './types.ts';
import {
  SLEEPER_API_URL,
  BATCH_SIZE,
  REQUEST_TIMEOUT_MS
} from './config.ts';

/**
 * Fetches data from a URL with timeout protection
 * @param url - URL to fetch
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise resolving to Response object
 * @throws Error if request times out or fails
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
 * Filters and transforms Sleeper API players to active fantasy players
 * @param playersObj - Sleeper API response object
 * @returns Array of filtered players ready for database insert
 */
function filterActivePlayers(playersObj: SleeperPlayersResponse): NFLPlayerInsert[] {
  return Object.entries(playersObj)
    .map(([_, player]) => player)
    .filter((player): player is Required<Pick<SleeperPlayer,
      'player_id' | 'full_name' | 'position' | 'team'
    >> & SleeperPlayer => {
      return (
        player.full_name !== null &&
        player.team !== null &&
        isFantasyPosition(player.position)
      );
    })
    .map((player) => ({
      player_id: player.player_id,
      full_name: player.full_name,
      position: player.position,
      team: player.team,
      college: player.college || null,
      age: player.age || null,
      weight: player.weight || null,
    }));
}

/**
 * Splits an array into batches of specified size
 * @param array - Array to batch
 * @param batchSize - Maximum size of each batch
 * @returns Array of batches
 */
function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Main edge function handler
 * Fetches NFL players from Sleeper API and upserts them to Supabase
 */
Deno.serve(async (req: Request) => {
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

    // 2. Fetch from Sleeper API
    console.log('Fetching NFL players from Sleeper API...');
    const sleeperResponse = await fetchWithTimeout(
      SLEEPER_API_URL,
      REQUEST_TIMEOUT_MS
    );

    if (!sleeperResponse.ok) {
      throw new Error(
        `Sleeper API error: ${sleeperResponse.status} ${sleeperResponse.statusText}`
      );
    }

    const playersData: SleeperPlayersResponse = await sleeperResponse.json();
    console.log(`Fetched ${Object.keys(playersData).length} total players`);

    // 3. Filter to active fantasy players
    const activePlayers = filterActivePlayers(playersData);
    console.log(`Filtered to ${activePlayers.length} active fantasy players`);

    if (activePlayers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active players to sync',
          playersProcessed: 0
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // 4. Batch upsert to Supabase
    const batches = batchArray(activePlayers, BATCH_SIZE);
    console.log(`Upserting in ${batches.length} batch(es)...`);

    let totalUpserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} players)`);

      const { data, error } = await supabase
        .from('nfl_players')
        .upsert(batch, {
          onConflict: 'player_id',
          ignoreDuplicates: false,
        });

      if (error) {
        const errorMsg = `Batch ${i + 1} failed: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      } else {
        totalUpserted += batch.length;
      }
    }

    // 5. Return response
    const duration = Date.now() - startTime;
    const response = {
      success: errors.length === 0,
      playersProcessed: totalUpserted,
      totalPlayers: activePlayers.length,
      batchesProcessed: batches.length,
      errors: errors.length > 0 ? errors : undefined,
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
        status: errors.length === 0 ? 200 : 207,
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
