import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from '../_shared/supabase-client.ts';
import {
  fetchDrafts,
  fetchDraftPicks,
  type SleeperDraft,
  type SleeperDraftPickResult,
} from '../_shared/sleeper-api.ts';
import type { Season } from '../_shared/season-utils.ts';

// Number of keeper rounds - first 6 picks per team are keepers
const KEEPER_ROUNDS = 6;

interface DraftInsert {
  draft_id: string;
  season_id: number;
  league_id: string;
  type: string | null;
  status: string | null;
  start_time: number | null;
}

interface DraftPickInsert {
  draft_id: string;
  round: number;
  pick_no: number;
  roster_id: number;
  player_id: string;
  is_keeper: boolean;
  metadata: Record<string, unknown> | null;
}

/**
 * Transforms Sleeper draft data into database insert format
 */
function transformDraft(draft: SleeperDraft, seasonId: number): DraftInsert {
  return {
    draft_id: draft.draft_id,
    season_id: seasonId,
    league_id: draft.league_id,
    type: draft.type || null,
    status: draft.status || null,
    start_time: draft.start_time || null,
  };
}

/**
 * Transforms Sleeper draft pick data into database insert format
 * Marks picks in rounds 1-6 as keepers (6-keeper league)
 */
function transformDraftPicks(picks: SleeperDraftPickResult[]): DraftPickInsert[] {
  return picks.map((pick) => ({
    draft_id: pick.draft_id,
    round: pick.round,
    pick_no: pick.pick_no,
    roster_id: pick.roster_id,
    player_id: pick.player_id,
    // Mark rounds 1-6 as keepers (or use Sleeper's is_keeper if available)
    is_keeper: pick.is_keeper ?? pick.round <= KEEPER_ROUNDS,
    metadata: pick.metadata,
  }));
}

/**
 * Syncs drafts and picks for a single season
 */
async function syncSeasonDrafts(
  supabase: ReturnType<typeof createServiceClient>,
  season: Season
): Promise<{ draftsCount: number; picksCount: number }> {
  console.log(`Syncing drafts for season ${season.season_year} (league: ${season.sleeper_league_id})...`);

  // Fetch drafts from Sleeper
  const drafts = await fetchDrafts(season.sleeper_league_id);

  if (drafts.length === 0) {
    console.log(`No drafts found for season ${season.season_year}`);
    return { draftsCount: 0, picksCount: 0 };
  }

  console.log(`Found ${drafts.length} draft(s) for season ${season.season_year}`);

  let totalPicks = 0;

  // Process each draft
  for (const draft of drafts) {
    // Transform and upsert draft metadata
    const draftInsert = transformDraft(draft, season.id);

    const { error: draftError } = await supabase
      .from('drafts')
      .upsert(draftInsert, {
        onConflict: 'draft_id',
        ignoreDuplicates: false,
      });

    if (draftError) {
      throw new Error(`Failed to upsert draft ${draft.draft_id}: ${draftError.message}`);
    }

    console.log(`Upserted draft ${draft.draft_id} (type: ${draft.type}, status: ${draft.status})`);

    // Fetch and sync picks for this draft
    const picks = await fetchDraftPicks(draft.draft_id);

    if (picks.length === 0) {
      console.log(`No picks found for draft ${draft.draft_id}`);
      continue;
    }

    // Transform picks
    const pickInserts = transformDraftPicks(picks);

    // Upsert picks in batches
    const batchSize = 100;
    for (let i = 0; i < pickInserts.length; i += batchSize) {
      const batch = pickInserts.slice(i, i + batchSize);

      const { error: picksError } = await supabase
        .from('draft_picks')
        .upsert(batch, {
          onConflict: 'draft_id,round,pick_no',
          ignoreDuplicates: false,
        });

      if (picksError) {
        throw new Error(`Failed to upsert picks for draft ${draft.draft_id}: ${picksError.message}`);
      }
    }

    const keeperCount = pickInserts.filter((p) => p.is_keeper).length;
    console.log(`Upserted ${pickInserts.length} picks (${keeperCount} keepers) for draft ${draft.draft_id}`);
    totalPicks += pickInserts.length;

    // Small delay between drafts to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return { draftsCount: drafts.length, picksCount: totalPicks };
}

/**
 * Main edge function handler
 * Syncs draft data from Sleeper API to Supabase
 */
Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  try {
    // Parse request body (optional season_id filter)
    let seasonId: number | undefined;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        seasonId = body.season_id;
      } catch {
        // Empty body is fine, sync all seasons
      }
    }

    // Initialize Supabase client
    const supabase = createServiceClient();

    // Get seasons to sync
    let seasons: Season[];

    if (seasonId) {
      // Sync specific season
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('id', seasonId)
        .single();

      if (error || !data) {
        throw new Error(`Season ${seasonId} not found: ${error?.message}`);
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

    console.log(`Syncing drafts for ${seasons.length} season(s)...`);

    let totalDrafts = 0;
    let totalPicks = 0;
    const seasonResults: Array<{ season_year: number; drafts: number; picks: number }> = [];

    // Process each season
    for (const season of seasons) {
      const { draftsCount, picksCount } = await syncSeasonDrafts(supabase, season);
      totalDrafts += draftsCount;
      totalPicks += picksCount;
      seasonResults.push({
        season_year: season.season_year,
        drafts: draftsCount,
        picks: picksCount,
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
      total_drafts: totalDrafts,
      total_picks: totalPicks,
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
