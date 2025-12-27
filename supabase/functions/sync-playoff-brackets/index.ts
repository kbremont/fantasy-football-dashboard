import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from '../_shared/supabase-client.ts';
import {
  fetchWinnersBracket,
  fetchLosersBracket,
  type SleeperPlayoffMatchup,
} from '../_shared/sleeper-api.ts';
import type { Season } from '../_shared/season-utils.ts';

interface RequestBody {
  season_id?: number;
}

interface PlayoffBracketInsert {
  season_id: number;
  bracket_type: 'winners' | 'losers';
  round: number;
  match_id: number;
  roster_id_1: number | null;
  roster_id_2: number | null;
  winner_roster_id: number | null;
  loser_roster_id: number | null;
  t1_from: { w?: number; l?: number } | null;
  t2_from: { w?: number; l?: number } | null;
  playoff_week: number | null;
  final_position: number | null;
}

/**
 * Extracts roster_id from t1/t2 field which can be a number or advancement reference
 */
function extractRosterId(t: number | { w: number } | { l: number } | null): number | null {
  if (t === null) return null;
  if (typeof t === 'number') return t;
  // If it's an object like {w: 1} or {l: 1}, there's no direct roster_id yet
  return null;
}

/**
 * Extracts t1_from/t2_from advancement info
 */
function extractFromInfo(matchup: SleeperPlayoffMatchup, team: 't1' | 't2'): { w?: number; l?: number } | null {
  const fromField = team === 't1' ? matchup.t1_from : matchup.t2_from;
  if (fromField) return fromField;

  // If t1/t2 is an object like {w: 1}, extract it as from info
  const teamValue = matchup[team];
  if (teamValue !== null && typeof teamValue === 'object') {
    if ('w' in teamValue) return { w: teamValue.w };
    if ('l' in teamValue) return { l: teamValue.l };
  }

  return null;
}

/**
 * Transforms Sleeper playoff matchup into database insert format
 */
function transformPlayoffMatchup(
  matchup: SleeperPlayoffMatchup,
  seasonId: number,
  bracketType: 'winners' | 'losers'
): PlayoffBracketInsert {
  return {
    season_id: seasonId,
    bracket_type: bracketType,
    round: matchup.r,
    match_id: matchup.m,
    roster_id_1: extractRosterId(matchup.t1),
    roster_id_2: extractRosterId(matchup.t2),
    winner_roster_id: matchup.w,
    loser_roster_id: matchup.l,
    t1_from: extractFromInfo(matchup, 't1'),
    t2_from: extractFromInfo(matchup, 't2'),
    playoff_week: null, // Will be derived from round + league settings if needed
    final_position: matchup.p ?? null,
  };
}

/**
 * Syncs playoff brackets for a single season
 */
export async function syncPlayoffBrackets(
  supabase: ReturnType<typeof createServiceClient>,
  season: Season
): Promise<{ winnersCount: number; losersCount: number }> {
  console.log(`Syncing playoff brackets for season ${season.season_year} (league: ${season.sleeper_league_id})...`);

  // Fetch both brackets in parallel
  const [winnersBracket, losersBracket] = await Promise.all([
    fetchWinnersBracket(season.sleeper_league_id),
    fetchLosersBracket(season.sleeper_league_id),
  ]);

  console.log(`Found ${winnersBracket.length} winners matchups, ${losersBracket.length} losers matchups`);

  // Transform winners bracket
  const winnersInserts = winnersBracket.map((m) =>
    transformPlayoffMatchup(m, season.id, 'winners')
  );

  // Transform losers bracket
  const losersInserts = losersBracket.map((m) =>
    transformPlayoffMatchup(m, season.id, 'losers')
  );

  // Combine all inserts
  const allInserts = [...winnersInserts, ...losersInserts];

  if (allInserts.length === 0) {
    console.log('No playoff bracket data found');
    return { winnersCount: 0, losersCount: 0 };
  }

  // Upsert all bracket matchups
  const { error } = await supabase
    .from('playoff_brackets')
    .upsert(allInserts, {
      onConflict: 'season_id,bracket_type,match_id',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Failed to upsert playoff brackets: ${error.message}`);
  }

  console.log(`Upserted ${winnersInserts.length} winners + ${losersInserts.length} losers bracket matchups`);

  return {
    winnersCount: winnersInserts.length,
    losersCount: losersInserts.length,
  };
}

/**
 * Main edge function handler
 * Syncs playoff bracket data from Sleeper API to Supabase
 */
Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  try {
    // Parse request body (optional season_id filter)
    let body: RequestBody = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        // Empty body is fine, sync all seasons
      }
    }

    // Initialize Supabase client
    const supabase = createServiceClient();

    // Get seasons to sync
    let seasons: Season[];

    if (body.season_id) {
      // Sync specific season
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('id', body.season_id)
        .single();

      if (error || !data) {
        throw new Error(`Season ${body.season_id} not found: ${error?.message}`);
      }
      seasons = [data as Season];
    } else {
      // Sync all seasons
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('season_year', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch seasons: ${error.message}`);
      }
      seasons = (data || []) as Season[];
    }

    if (seasons.length === 0) {
      throw new Error('No seasons found to sync');
    }

    console.log(`Syncing playoff brackets for ${seasons.length} season(s)...`);

    let totalWinners = 0;
    let totalLosers = 0;
    const seasonResults: Array<{
      season_year: number;
      winners: number;
      losers: number;
    }> = [];

    // Process each season
    for (const season of seasons) {
      const { winnersCount, losersCount } = await syncPlayoffBrackets(supabase, season);
      totalWinners += winnersCount;
      totalLosers += losersCount;
      seasonResults.push({
        season_year: season.season_year,
        winners: winnersCount,
        losers: losersCount,
      });

      // Small delay between seasons to avoid rate limiting
      if (seasons.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Return response
    const duration = Date.now() - startTime;
    const response = {
      success: true,
      seasons_processed: seasonResults,
      total_winners_matchups: totalWinners,
      total_losers_matchups: totalLosers,
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
