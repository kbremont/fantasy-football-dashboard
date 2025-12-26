import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from '../_shared/supabase-client.ts';
import {
  fetchMatchups,
  fetchNFLState,
  type SleeperMatchup,
} from '../_shared/sleeper-api.ts';
import {
  getCurrentSeason,
  getSeasonById,
  type Season,
} from '../_shared/season-utils.ts';

interface RequestBody {
  week?: number;
  season_id?: number;
  backfill?: boolean;
}

interface MatchupInsert {
  season_id: number;
  week: number;
  matchup_id: number;
  roster_id: number;
  starters: string[];
  players: string[];
  points: number | null;
  custom_points: number | null;
  players_points: Record<string, number> | null;
}

interface WeeklyRosterInsert {
  season_id: number;
  week: number;
  roster_id: number;
  player_ids: string[];
}

/**
 * Transforms Sleeper matchup data into database insert format
 * Filters out entries without matchup_id (bye weeks in playoffs)
 */
function transformMatchups(
  matchups: SleeperMatchup[],
  seasonId: number,
  week: number
): { matchupInserts: MatchupInsert[]; rosterInserts: WeeklyRosterInsert[] } {
  const matchupInserts: MatchupInsert[] = [];
  const rosterInserts: WeeklyRosterInsert[] = [];

  // Filter out entries without matchup_id (bye weeks in playoffs)
  const activeMatchups = matchups.filter((m) => m.matchup_id !== null);

  for (const matchup of activeMatchups) {
    // Matchup insert
    matchupInserts.push({
      season_id: seasonId,
      week,
      matchup_id: matchup.matchup_id,
      roster_id: matchup.roster_id,
      starters: matchup.starters || [],
      players: matchup.players || [],
      points: matchup.points,
      custom_points: matchup.custom_points,
      players_points: matchup.players_points,
    });

    // Weekly roster snapshot insert
    rosterInserts.push({
      season_id: seasonId,
      week,
      roster_id: matchup.roster_id,
      player_ids: matchup.players || [],
    });
  }

  return { matchupInserts, rosterInserts };
}

/**
 * Syncs matchups for a single week
 */
async function syncWeek(
  supabase: ReturnType<typeof createServiceClient>,
  season: Season,
  week: number
): Promise<{ matchupsCount: number; rostersCount: number }> {
  console.log(`Syncing week ${week} for season ${season.season_year}...`);

  // Fetch matchups from Sleeper
  const matchups = await fetchMatchups(season.sleeper_league_id, week);

  if (matchups.length === 0) {
    console.log(`No matchups found for week ${week}`);
    return { matchupsCount: 0, rostersCount: 0 };
  }

  // Transform data
  const { matchupInserts, rosterInserts } = transformMatchups(
    matchups,
    season.id,
    week
  );

  // Upsert matchups
  const { error: matchupsError } = await supabase
    .from('matchups')
    .upsert(matchupInserts, {
      onConflict: 'season_id,week,roster_id',
      ignoreDuplicates: false,
    });

  if (matchupsError) {
    throw new Error(`Failed to upsert matchups: ${matchupsError.message}`);
  }

  // Upsert weekly rosters
  const { error: rostersError } = await supabase
    .from('weekly_rosters')
    .upsert(rosterInserts, {
      onConflict: 'season_id,week,roster_id',
      ignoreDuplicates: false,
    });

  if (rostersError) {
    throw new Error(`Failed to upsert weekly rosters: ${rostersError.message}`);
  }

  return {
    matchupsCount: matchupInserts.length,
    rostersCount: rosterInserts.length,
  };
}

/**
 * Main edge function handler
 * Syncs weekly matchup data from Sleeper API to Supabase
 */
Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  try {
    // Parse request body
    let body: RequestBody = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        // Empty body is fine, use defaults
      }
    }

    // Initialize Supabase client
    const supabase = createServiceClient();

    // Get season
    let season: Season;
    if (body.season_id) {
      season = await getSeasonById(supabase, body.season_id);
    } else {
      season = await getCurrentSeason(supabase);
    }

    // Get week
    let targetWeek = body.week;
    if (!targetWeek) {
      // Default to previous completed week
      const nflState = await fetchNFLState();
      targetWeek = Math.max(1, nflState.week - 1);
    }

    let totalMatchups = 0;
    let totalRosters = 0;
    const weeksProcessed: number[] = [];

    if (body.backfill) {
      // Backfill all weeks from 1 to targetWeek
      for (let week = 1; week <= targetWeek; week++) {
        const { matchupsCount, rostersCount } = await syncWeek(supabase, season, week);
        totalMatchups += matchupsCount;
        totalRosters += rostersCount;
        weeksProcessed.push(week);

        // Small delay between weeks to avoid rate limiting
        if (week < targetWeek) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } else {
      // Single week sync
      const { matchupsCount, rostersCount } = await syncWeek(supabase, season, targetWeek);
      totalMatchups = matchupsCount;
      totalRosters = rostersCount;
      weeksProcessed.push(targetWeek);
    }

    // Return response
    const duration = Date.now() - startTime;
    const response = {
      success: true,
      season_year: season.season_year,
      weeks_processed: weeksProcessed,
      matchups_synced: totalMatchups,
      rosters_synced: totalRosters,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };

    console.log('Sync complete:', response);

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
      },
      status: 200,
    });
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
