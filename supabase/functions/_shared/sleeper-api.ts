/**
 * Shared Sleeper API utilities for edge functions
 */

export const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
export const REQUEST_TIMEOUT_MS = 30000;

/**
 * Fetches data from a URL with timeout protection
 */
export async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
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
 * Fetches NFL state (current week, season info)
 */
export async function fetchNFLState(): Promise<NFLState> {
  const response = await fetchWithTimeout(`${SLEEPER_BASE_URL}/state/nfl`);
  if (!response.ok) {
    throw new Error(`Sleeper NFL state API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches matchups for a specific week
 */
export async function fetchMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  const response = await fetchWithTimeout(`${SLEEPER_BASE_URL}/league/${leagueId}/matchups/${week}`);
  if (!response.ok) {
    throw new Error(`Sleeper matchups API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches transactions for a specific week
 */
export async function fetchTransactions(leagueId: string, week: number): Promise<SleeperTransaction[]> {
  const response = await fetchWithTimeout(`${SLEEPER_BASE_URL}/league/${leagueId}/transactions/${week}`);
  if (!response.ok) {
    throw new Error(`Sleeper transactions API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches league info (includes previous_league_id for season chaining)
 */
export async function fetchLeague(leagueId: string): Promise<SleeperLeague> {
  const response = await fetchWithTimeout(`${SLEEPER_BASE_URL}/league/${leagueId}`);
  if (!response.ok) {
    throw new Error(`Sleeper league API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches rosters for a league
 */
export async function fetchRosters(leagueId: string): Promise<SleeperRoster[]> {
  const response = await fetchWithTimeout(`${SLEEPER_BASE_URL}/league/${leagueId}/rosters`);
  if (!response.ok) {
    throw new Error(`Sleeper rosters API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches users for a league
 */
export async function fetchUsers(leagueId: string): Promise<SleeperUser[]> {
  const response = await fetchWithTimeout(`${SLEEPER_BASE_URL}/league/${leagueId}/users`);
  if (!response.ok) {
    throw new Error(`Sleeper users API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches all drafts for a league
 */
export async function fetchDrafts(leagueId: string): Promise<SleeperDraft[]> {
  const response = await fetchWithTimeout(`${SLEEPER_BASE_URL}/league/${leagueId}/drafts`);
  if (!response.ok) {
    throw new Error(`Sleeper drafts API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches all picks for a draft
 */
export async function fetchDraftPicks(draftId: string): Promise<SleeperDraftPickResult[]> {
  const response = await fetchWithTimeout(`${SLEEPER_BASE_URL}/draft/${draftId}/picks`);
  if (!response.ok) {
    throw new Error(`Sleeper draft picks API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Type definitions for Sleeper API responses

export interface NFLState {
  week: number;
  season: string;
  season_type: string;
  display_week: number;
  leg: number;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  starters: string[];
  players: string[];
  points: number | null;
  custom_points: number | null;
  players_points: Record<string, number> | null;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: 'trade' | 'free_agent' | 'waiver' | 'commissioner';
  status: 'complete' | 'failed' | 'pending';
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: SleeperDraftPick[] | null;
  waiver_budget: SleeperWaiverBudget[] | null;
  settings: Record<string, unknown> | null;
  creator: string;
  created: number;
  leg: number;
}

export interface SleeperDraftPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperWaiverBudget {
  sender: number;
  receiver: number;
  amount: number;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  previous_league_id: string | null;
  total_rosters: number;
  status: string;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[] | null;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata: {
    team_name?: string;
  } | null;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: string;
  type: string;
  status: string;
  start_time: number;
  settings: Record<string, unknown>;
}

export interface SleeperDraftPickResult {
  round: number;
  roster_id: number;
  player_id: string;
  picked_by: string;
  pick_no: number;
  metadata: Record<string, unknown> | null;
  is_keeper: boolean | null;
  draft_slot: number;
  draft_id: string;
}
