/**
 * Shared CFBD (College Football Data) API utilities for edge functions
 */

export const CFBD_BASE_URL = 'https://api.collegefootballdata.com';
export const REQUEST_TIMEOUT_MS = 30000;

/**
 * Fetches data from CFBD API with timeout and authentication
 */
export async function fetchFromCFBD<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const apiKey = Deno.env.get('CFBD_API_KEY');
  if (!apiKey) {
    throw new Error('CFBD_API_KEY environment variable not set');
  }

  const url = new URL(`${CFBD_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`CFBD API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`CFBD API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

/**
 * CFBD API response types
 */

export interface CFBDPlayerSeasonStat {
  season: number;
  playerId: string;
  player: string;
  team: string;
  conference: string;
  category: string;
  statType: string;
  stat: number | string;
}

/**
 * Fetch player season statistics
 * @param year - Season year (required)
 * @param options - Optional filters
 */
export async function fetchPlayerSeasonStats(
  year: number,
  options?: {
    team?: string;
    conference?: string;
    startWeek?: number;
    endWeek?: number;
    seasonType?: string;
    category?: string;
  }
): Promise<CFBDPlayerSeasonStat[]> {
  return fetchFromCFBD<CFBDPlayerSeasonStat[]>('/stats/player/season', {
    year,
    team: options?.team,
    conference: options?.conference,
    startWeek: options?.startWeek,
    endWeek: options?.endWeek,
    seasonType: options?.seasonType,
    category: options?.category,
  });
}

/**
 * Get current college football season year
 * CFB season runs Aug-Jan, so use current year if Aug-Dec, previous year if Jan-Jul
 */
export function getCurrentCFBSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 7 = Aug)
  const year = now.getFullYear();

  // If Jan-Jul, we're in the tail end of the previous season
  if (month < 7) {
    return year - 1;
  }
  return year;
}
