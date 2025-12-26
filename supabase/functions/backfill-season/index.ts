import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from '../_shared/supabase-client.ts';
import {
  fetchMatchups,
  fetchTransactions,
  fetchLeague,
  fetchNFLState,
  type SleeperMatchup,
  type SleeperTransaction,
} from '../_shared/sleeper-api.ts';
import {
  getOrCreateSeason,
  getCurrentSeason,
  type Season,
} from '../_shared/season-utils.ts';

interface RequestBody {
  season_year?: number;
  sleeper_league_id?: string;
  start_week?: number;
  end_week?: number;
  discover_previous?: boolean;
}

interface WeekResult {
  week: number;
  matchups: number;
  transactions: number;
  player_points: number;
}

interface PlayerWeeklyPointsInsert {
  player_id: string;
  season_id: number;
  week: number;
  roster_id: number;
  points: number | null;
  is_starter: boolean;
}

/**
 * Transforms and upserts matchup data for a week
 */
async function syncMatchupsForWeek(
  supabase: ReturnType<typeof createServiceClient>,
  seasonId: number,
  leagueId: string,
  week: number
): Promise<{ matchupsCount: number; playerPointsCount: number }> {
  const matchups = await fetchMatchups(leagueId, week);

  // Filter out entries without matchup_id (bye weeks in playoffs)
  const activeMatchups = matchups.filter((m: SleeperMatchup) => m.matchup_id !== null);

  if (activeMatchups.length === 0) return { matchupsCount: 0, playerPointsCount: 0 };

  const matchupInserts = activeMatchups.map((m: SleeperMatchup) => ({
    season_id: seasonId,
    week,
    matchup_id: m.matchup_id,
    roster_id: m.roster_id,
    starters: m.starters || [],
    players: m.players || [],
    points: m.points,
    custom_points: m.custom_points,
    players_points: m.players_points,
  }));

  const rosterInserts = activeMatchups.map((m: SleeperMatchup) => ({
    season_id: seasonId,
    week,
    roster_id: m.roster_id,
    player_ids: m.players || [],
  }));

  // Extract player weekly points from all matchups
  const playerPointsInserts: PlayerWeeklyPointsInsert[] = [];
  for (const m of activeMatchups) {
    if (m.players_points) {
      const starters = m.starters || [];
      for (const [playerId, points] of Object.entries(m.players_points)) {
        playerPointsInserts.push({
          player_id: playerId,
          season_id: seasonId,
          week,
          roster_id: m.roster_id,
          points: points,
          is_starter: starters.includes(playerId),
        });
      }
    }
  }

  // Upsert matchups
  const { error: matchupsError } = await supabase
    .from('matchups')
    .upsert(matchupInserts, {
      onConflict: 'season_id,week,roster_id',
      ignoreDuplicates: false,
    });

  if (matchupsError) {
    throw new Error(`Failed to upsert matchups week ${week}: ${matchupsError.message}`);
  }

  // Upsert weekly rosters
  const { error: rostersError } = await supabase
    .from('weekly_rosters')
    .upsert(rosterInserts, {
      onConflict: 'season_id,week,roster_id',
      ignoreDuplicates: false,
    });

  if (rostersError) {
    throw new Error(`Failed to upsert rosters week ${week}: ${rostersError.message}`);
  }

  // Upsert player weekly points
  if (playerPointsInserts.length > 0) {
    const { error: playerPointsError } = await supabase
      .from('player_weekly_points')
      .upsert(playerPointsInserts, {
        onConflict: 'player_id,season_id,week,roster_id',
        ignoreDuplicates: false,
      });

    if (playerPointsError) {
      throw new Error(`Failed to upsert player weekly points week ${week}: ${playerPointsError.message}`);
    }
  }

  return { matchupsCount: activeMatchups.length, playerPointsCount: playerPointsInserts.length };
}

/**
 * Transforms and upserts transaction data for a week
 */
async function syncTransactionsForWeek(
  supabase: ReturnType<typeof createServiceClient>,
  seasonId: number,
  leagueId: string,
  week: number
): Promise<number> {
  const transactions = await fetchTransactions(leagueId, week);

  if (transactions.length === 0) return 0;

  const inserts = transactions.map((tx: SleeperTransaction) => ({
    transaction_id: tx.transaction_id,
    season_id: seasonId,
    week,
    type: tx.type,
    status: tx.status,
    roster_ids: tx.roster_ids || [],
    adds: tx.adds,
    drops: tx.drops,
    draft_picks: tx.draft_picks,
    waiver_budget: tx.waiver_budget,
    settings: tx.settings,
    creator_id: tx.creator,
    created_at_sleeper: tx.created,
  }));

  const { error } = await supabase
    .from('transactions')
    .upsert(inserts, {
      onConflict: 'transaction_id',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Failed to upsert transactions week ${week}: ${error.message}`);
  }

  return transactions.length;
}

/**
 * Backfills a single season
 */
async function backfillSeason(
  supabase: ReturnType<typeof createServiceClient>,
  season: Season,
  startWeek: number,
  endWeek: number
): Promise<WeekResult[]> {
  const results: WeekResult[] = [];

  for (let week = startWeek; week <= endWeek; week++) {
    console.log(`Backfilling week ${week} of season ${season.season_year}...`);

    const { matchupsCount, playerPointsCount } = await syncMatchupsForWeek(
      supabase,
      season.id,
      season.sleeper_league_id,
      week
    );

    const transactionsCount = await syncTransactionsForWeek(
      supabase,
      season.id,
      season.sleeper_league_id,
      week
    );

    results.push({
      week,
      matchups: matchupsCount,
      transactions: transactionsCount,
      player_points: playerPointsCount,
    });

    // Delay between weeks to avoid rate limiting
    if (week < endWeek) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Main edge function handler
 * Orchestrates full season backfill, optionally discovering previous seasons
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

    // Determine which seasons to backfill
    const seasonsToBackfill: { season: Season; endWeek: number }[] = [];

    if (body.discover_previous) {
      // Auto-discover previous seasons by following previous_league_id chain
      console.log('Discovering previous seasons...');

      let currentLeagueId: string;
      if (body.sleeper_league_id) {
        currentLeagueId = body.sleeper_league_id;
      } else {
        const currentSeason = await getCurrentSeason(supabase);
        currentLeagueId = currentSeason.sleeper_league_id;
      }

      let leagueId: string | null = currentLeagueId;
      while (leagueId) {
        const league = await fetchLeague(leagueId);
        const seasonYear = parseInt(league.season);

        console.log(`Found season ${seasonYear} with league_id ${league.league_id}`);

        const season = await getOrCreateSeason(
          supabase,
          seasonYear,
          league.league_id,
          leagueId === currentLeagueId // Mark first one as current
        );

        // Determine end week (18 for completed seasons, current week for ongoing)
        let endWeek = 18;
        if (leagueId === currentLeagueId) {
          const nflState = await fetchNFLState();
          if (nflState.season === league.season) {
            endWeek = Math.max(1, nflState.week - 1); // Previous completed week
          }
        }

        seasonsToBackfill.push({ season, endWeek });

        // Move to previous season
        leagueId = league.previous_league_id;

        // Delay between API calls
        if (leagueId) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } else if (body.season_year && body.sleeper_league_id) {
      // Specific season provided
      const season = await getOrCreateSeason(
        supabase,
        body.season_year,
        body.sleeper_league_id
      );

      const endWeek = body.end_week || 18;
      seasonsToBackfill.push({ season, endWeek });
    } else {
      // Default to current season
      const season = await getCurrentSeason(supabase);
      const nflState = await fetchNFLState();
      const endWeek = body.end_week || Math.max(1, nflState.week - 1);
      seasonsToBackfill.push({ season, endWeek });
    }

    // Backfill each season
    const allResults: {
      season_year: number;
      weeks: WeekResult[];
    }[] = [];

    for (const { season, endWeek } of seasonsToBackfill) {
      const startWeek = body.start_week || 1;
      console.log(`Backfilling season ${season.season_year} weeks ${startWeek}-${endWeek}...`);

      const weekResults = await backfillSeason(supabase, season, startWeek, endWeek);
      allResults.push({
        season_year: season.season_year,
        weeks: weekResults,
      });
    }

    // Return response
    const duration = Date.now() - startTime;
    const response = {
      success: true,
      seasons_processed: allResults.length,
      results: allResults,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };

    console.log('Backfill complete:', JSON.stringify(response, null, 2));

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
