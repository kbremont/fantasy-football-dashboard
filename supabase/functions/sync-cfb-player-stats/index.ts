import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  fetchPlayerSeasonStats,
  fetchTeamRoster,
  getCurrentCFBSeason,
  type CFBDPlayerSeasonStat,
} from '../_shared/cfbd-api.ts';

const BATCH_SIZE = 1000;

interface CFBPlayerStatsInsert {
  cfbd_player_id: string;
  player_name: string;
  season: number;
  team: string | null;
  conference: string | null;
  position: string | null;
  category: string;
  stat_type: string;
  stat_value: number | null;
}

interface RequestBody {
  year?: number;
  backfill_years?: number;
}

/**
 * Splits an array into batches of specified size
 */
function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Transforms CFBD API response to database insert format
 */
function transformStats(stats: CFBDPlayerSeasonStat[]): CFBPlayerStatsInsert[] {
  return stats
    .filter((stat) => stat.playerId && stat.player)
    .map((stat) => ({
      cfbd_player_id: String(stat.playerId),
      player_name: stat.player,
      season: stat.season,
      team: stat.team || null,
      conference: stat.conference || null,
      position: null, // Position not always included in stats response
      category: stat.category,
      stat_type: stat.statType,
      stat_value: typeof stat.stat === 'number' ? stat.stat : parseFloat(String(stat.stat)) || null,
    }));
}

/**
 * Syncs player stats for a single season
 */
async function syncSeason(
  supabase: ReturnType<typeof createClient>,
  year: number
): Promise<{ count: number; errors: string[]; teams: string[] }> {
  console.log(`Fetching stats for ${year} season...`);

  const stats = await fetchPlayerSeasonStats(year);
  console.log(`Fetched ${stats.length} stat records for ${year}`);

  if (stats.length === 0) {
    return { count: 0, errors: [], teams: [] };
  }

  // Extract unique teams from stats data
  const teams = [...new Set(stats.map((s) => s.team).filter(Boolean))];

  const inserts = transformStats(stats);
  console.log(`Transformed ${inserts.length} records for upsert`);

  const batches = batchArray(inserts, BATCH_SIZE);
  let totalUpserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} records)`);

    const { error } = await supabase
      .from('cfb_player_season_stats')
      .upsert(batch, {
        onConflict: 'cfbd_player_id,season,category,stat_type',
        ignoreDuplicates: false,
      });

    if (error) {
      const errorMsg = `Batch ${i + 1} for ${year} failed: ${error.message}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    } else {
      totalUpserted += batch.length;
    }
  }

  return { count: totalUpserted, errors, teams };
}

/**
 * Populates position data for a season by fetching roster data
 */
async function populatePositions(
  supabase: ReturnType<typeof createClient>,
  year: number,
  teams: string[]
): Promise<{ positionsUpdated: number; errors: string[] }> {
  console.log(`Populating positions for ${year} season (${teams.length} teams)...`);
  const errors: string[] = [];

  if (teams.length === 0) {
    return { positionsUpdated: 0, errors };
  }

  // Fetch roster for each team and build position map
  const positionMap = new Map<string, string>(); // playerId -> position
  let teamsProcessed = 0;

  for (const team of teams) {
    try {
      const roster = await fetchTeamRoster(year, team);
      for (const player of roster) {
        if (player.athlete_id && player.position) {
          positionMap.set(String(player.athlete_id), player.position);
        }
      }
      teamsProcessed++;

      // Rate limiting: small delay between requests
      if (teamsProcessed % 10 === 0) {
        console.log(`Processed ${teamsProcessed}/${teams.length} teams`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      // Some teams may not have roster data, log but continue
      console.warn(`Failed to fetch roster for ${team}: ${err}`);
    }
  }

  console.log(`Built position map with ${positionMap.size} players`);

  // 3. Update positions in database (one update per player covers all their stat rows)
  let positionsUpdated = 0;
  const playerIds = Array.from(positionMap.keys());
  const batches = batchArray(playerIds, 50);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    for (const playerId of batch) {
      const position = positionMap.get(playerId);
      if (!position) continue;

      const { error } = await supabase
        .from('cfb_player_season_stats')
        .update({ position })
        .eq('cfbd_player_id', playerId)
        .eq('season', year);

      if (!error) {
        positionsUpdated++;
      }
    }

    if ((i + 1) % 10 === 0) {
      console.log(`Updated positions batch ${i + 1}/${batches.length}`);
    }
  }

  console.log(`Updated positions for ${positionsUpdated} players`);
  return { positionsUpdated, errors };
}

/**
 * Main edge function handler
 * Syncs college football player season stats from CFBD API
 */
Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  try {
    // 1. Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { auth: { persistSession: false } }
    );

    // 2. Parse request body
    let body: RequestBody = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        // Empty body is fine, use defaults
      }
    }

    // 3. Determine which years to sync
    const currentSeason = getCurrentCFBSeason();
    let yearsToSync: number[] = [];

    if (body.backfill_years && body.backfill_years > 0) {
      // Backfill mode: sync last N years
      for (let i = 0; i < body.backfill_years; i++) {
        yearsToSync.push(currentSeason - i);
      }
      console.log(`Backfill mode: syncing ${body.backfill_years} seasons (${yearsToSync.join(', ')})`);
    } else if (body.year) {
      // Single year mode
      yearsToSync = [body.year];
      console.log(`Single year mode: syncing ${body.year}`);
    } else {
      // Default: current season only
      yearsToSync = [currentSeason];
      console.log(`Default mode: syncing current season (${currentSeason})`);
    }

    // 4. Sync each year (stats + positions)
    let totalProcessed = 0;
    let totalPositionsUpdated = 0;
    const allErrors: string[] = [];
    const yearResults: Record<number, { stats: number; positions: number }> = {};

    for (const year of yearsToSync) {
      // Sync stats
      const { count, errors, teams } = await syncSeason(supabase, year);
      totalProcessed += count;
      allErrors.push(...errors);

      // Populate positions from roster data
      const { positionsUpdated, errors: posErrors } = await populatePositions(supabase, year, teams);
      totalPositionsUpdated += positionsUpdated;
      allErrors.push(...posErrors);

      yearResults[year] = { stats: count, positions: positionsUpdated };

      // Add delay between years to avoid rate limiting
      if (yearsToSync.length > 1 && year !== yearsToSync[yearsToSync.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // 5. Return response
    const duration = Date.now() - startTime;
    const response = {
      success: allErrors.length === 0,
      statsProcessed: totalProcessed,
      positionsUpdated: totalPositionsUpdated,
      yearResults,
      seasonsProcessed: yearsToSync.length,
      errors: allErrors.length > 0 ? allErrors : undefined,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    };

    console.log('Sync complete:', response);

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
        },
        status: allErrors.length === 0 ? 200 : 207,
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
