/**
 * Shared playoff brackets sync utility
 * Used by both sync-weekly-matchups (during postseason) and sync-playoff-brackets edge functions
 */

import { createServiceClient } from './supabase-client.ts';
import {
  fetchWinnersBracket,
  fetchLosersBracket,
  type SleeperPlayoffMatchup,
} from './sleeper-api.ts';
import type { Season } from './season-utils.ts';

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
