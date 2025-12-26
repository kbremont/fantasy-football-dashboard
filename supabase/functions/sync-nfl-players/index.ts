import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { Database } from '../../../src/types/database.ts';
import type {
  SleeperPlayersResponse,
  NFLPlayerInsert,
  SleeperPlayer
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
 * Transforms Sleeper API players to database insert format
 * Only filters out players without a name (placeholder entries)
 * @param playersObj - Sleeper API response object
 * @returns Array of players ready for database insert
 */
function transformPlayers(playersObj: SleeperPlayersResponse): NFLPlayerInsert[] {
  return Object.entries(playersObj)
    .map(([_, player]) => player)
    .filter((player): player is SleeperPlayer & { full_name: string } => {
      return player.full_name !== null &&
             player.full_name !== undefined &&
             player.full_name.trim() !== '';
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
 * Detects team changes and records them in player_team_history
 * @param supabase - Supabase client
 * @param incomingPlayers - Players from Sleeper API
 * @returns Object with teamChanges count and any errors
 */
async function recordTeamChanges(
  supabase: ReturnType<typeof createClient<Database>>,
  incomingPlayers: NFLPlayerInsert[]
): Promise<{ teamChanges: number; errors: string[] }> {
  const errors: string[] = [];

  // Get current teams from nfl_players in batches to avoid URL length limits
  const playerIds = incomingPlayers.map(p => p.player_id);
  const idBatches = batchArray(playerIds, BATCH_SIZE);
  const allCurrentPlayers: { player_id: string; team: string | null }[] = [];

  for (const idBatch of idBatches) {
    const { data: batchPlayers, error: fetchError } = await supabase
      .from('nfl_players')
      .select('player_id, team')
      .in('player_id', idBatch);

    if (fetchError) {
      errors.push(`Failed to fetch current players: ${fetchError.message}`);
      return { teamChanges: 0, errors };
    }

    if (batchPlayers) {
      allCurrentPlayers.push(...batchPlayers);
    }
  }

  const currentPlayers = allCurrentPlayers;

  // Build lookup of current teams
  const currentTeams = new Map<string, string | null>(
    currentPlayers?.map(p => [p.player_id, p.team]) || []
  );

  // Find players whose team has changed
  const teamChanges: { player_id: string; team: string | null; effective_date: string; source: string }[] = [];
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  for (const player of incomingPlayers) {
    const currentTeam = currentTeams.get(player.player_id);

    // Only record if:
    // 1. Player exists in current data (we have a baseline)
    // 2. Team has actually changed (including to/from null)
    if (currentTeams.has(player.player_id) && currentTeam !== player.team) {
      teamChanges.push({
        player_id: player.player_id,
        team: player.team,
        effective_date: today,
        source: 'daily_sync',
      });
    }
  }

  if (teamChanges.length === 0) {
    return { teamChanges: 0, errors };
  }

  console.log(`Detected ${teamChanges.length} team changes, recording to history...`);

  // Insert team changes in batches
  const changeBatches = batchArray(teamChanges, BATCH_SIZE);
  for (const batch of changeBatches) {
    const { error: insertError } = await supabase
      .from('player_team_history')
      .insert(batch);

    if (insertError) {
      errors.push(`Failed to insert team history: ${insertError.message}`);
    }
  }

  return { teamChanges: teamChanges.length, errors };
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

    // 3. Transform players for database insert
    const players = transformPlayers(playersData);
    console.log(`Transformed ${players.length} players with valid names`);

    if (players.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No players to sync',
          playersProcessed: 0
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // 4. Record team changes BEFORE upserting (so we can compare old vs new)
    const { teamChanges, errors: historyErrors } = await recordTeamChanges(supabase, players);
    if (teamChanges > 0) {
      console.log(`Recorded ${teamChanges} team changes to history`);
    }

    // 5. Batch upsert to Supabase
    const batches = batchArray(players, BATCH_SIZE);
    console.log(`Upserting in ${batches.length} batch(es)...`);

    let totalUpserted = 0;
    const errors: string[] = [...historyErrors];

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

    // 6. Return response
    const duration = Date.now() - startTime;
    const response = {
      success: errors.length === 0,
      playersProcessed: totalUpserted,
      totalPlayers: players.length,
      batchesProcessed: batches.length,
      teamChangesRecorded: teamChanges,
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
