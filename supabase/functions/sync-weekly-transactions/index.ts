import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from '../_shared/supabase-client.ts';
import {
  fetchTransactions,
  fetchNFLState,
  type SleeperTransaction,
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

interface TransactionInsert {
  transaction_id: string;
  season_id: number;
  week: number;
  type: 'trade' | 'free_agent' | 'waiver';
  status: 'complete' | 'failed' | 'pending';
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: unknown | null;
  waiver_budget: unknown | null;
  settings: unknown | null;
  creator_id: string;
  created_at_sleeper: number;
}

/**
 * Transforms Sleeper transaction data into database insert format
 */
function transformTransactions(
  transactions: SleeperTransaction[],
  seasonId: number,
  week: number
): TransactionInsert[] {
  return transactions.map((tx) => ({
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
}

/**
 * Syncs transactions for a single week
 */
async function syncWeek(
  supabase: ReturnType<typeof createServiceClient>,
  season: Season,
  week: number
): Promise<number> {
  console.log(`Syncing transactions for week ${week}, season ${season.season_year}...`);

  // Fetch transactions from Sleeper
  const transactions = await fetchTransactions(season.sleeper_league_id, week);

  if (transactions.length === 0) {
    console.log(`No transactions found for week ${week}`);
    return 0;
  }

  // Transform data
  const inserts = transformTransactions(transactions, season.id, week);

  // Upsert transactions
  const { error } = await supabase
    .from('transactions')
    .upsert(inserts, {
      onConflict: 'transaction_id',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Failed to upsert transactions: ${error.message}`);
  }

  return inserts.length;
}

/**
 * Main edge function handler
 * Syncs weekly transaction data from Sleeper API to Supabase
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
      // Default to current week (transactions happen throughout the week)
      const nflState = await fetchNFLState();
      targetWeek = nflState.week;
    }

    let totalTransactions = 0;
    const weeksProcessed: number[] = [];

    if (body.backfill) {
      // Backfill all weeks from 1 to targetWeek
      for (let week = 1; week <= targetWeek; week++) {
        const count = await syncWeek(supabase, season, week);
        totalTransactions += count;
        weeksProcessed.push(week);

        // Small delay between weeks to avoid rate limiting
        if (week < targetWeek) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } else {
      // Single week sync
      totalTransactions = await syncWeek(supabase, season, targetWeek);
      weeksProcessed.push(targetWeek);
    }

    // Return response
    const duration = Date.now() - startTime;
    const response = {
      success: true,
      season_year: season.season_year,
      weeks_processed: weeksProcessed,
      transactions_synced: totalTransactions,
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
