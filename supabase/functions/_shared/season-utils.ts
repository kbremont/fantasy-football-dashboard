/**
 * Shared season utilities for edge functions
 */

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { Database } from '../../../src/types/database.ts';

export interface Season {
  id: number;
  season_year: number;
  sleeper_league_id: string;
  is_current: boolean;
  total_weeks: number;
}

/**
 * Gets the current season from the database
 * @throws Error if no current season is configured
 */
export async function getCurrentSeason(
  supabase: SupabaseClient<Database>
): Promise<Season> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_current', true)
    .single();

  if (error) {
    throw new Error(`Failed to get current season: ${error.message}`);
  }

  if (!data) {
    throw new Error('No current season configured. Please add a season with is_current = true.');
  }

  return data as Season;
}

/**
 * Gets a season by ID
 */
export async function getSeasonById(
  supabase: SupabaseClient<Database>,
  seasonId: number
): Promise<Season> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', seasonId)
    .single();

  if (error) {
    throw new Error(`Failed to get season ${seasonId}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Season ${seasonId} not found.`);
  }

  return data as Season;
}

/**
 * Gets a season by year, creates it if it doesn't exist
 */
export async function getOrCreateSeason(
  supabase: SupabaseClient<Database>,
  seasonYear: number,
  sleeperLeagueId: string,
  isCurrent: boolean = false
): Promise<Season> {
  // Try to get existing season
  const { data: existing } = await supabase
    .from('seasons')
    .select('*')
    .eq('season_year', seasonYear)
    .single();

  if (existing) {
    return existing as Season;
  }

  // Create new season
  const { data, error } = await supabase
    .from('seasons')
    .insert({
      season_year: seasonYear,
      sleeper_league_id: sleeperLeagueId,
      is_current: isCurrent,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create season ${seasonYear}: ${error.message}`);
  }

  return data as Season;
}

/**
 * Gets the current league ID from the seasons table
 * This replaces the hardcoded SLEEPER_LEAGUE_ID
 */
export async function getCurrentLeagueId(
  supabase: SupabaseClient<Database>
): Promise<string> {
  const season = await getCurrentSeason(supabase);
  return season.sleeper_league_id;
}
