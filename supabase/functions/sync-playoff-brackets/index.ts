import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from '../_shared/supabase-client.ts';
import { syncPlayoffBrackets } from '../_shared/playoff-brackets.ts';
import type { Season } from '../_shared/season-utils.ts';

interface RequestBody {
  season_id?: number;
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
