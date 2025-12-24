// Sleeper API player object structure
export interface SleeperPlayer {
  player_id: number;
  full_name: string | null;
  position: string | null;
  team: string | null;
  college: string | null;
  age: number | null;
  weight: number | null;
  // Additional fields exist in the API but are not used
}

// Sleeper API response is an object with player_id as keys
export type SleeperPlayersResponse = {
  [playerId: string]: SleeperPlayer;
};

// Valid fantasy positions
export type FantasyPosition = 'QB' | 'RB' | 'WR' | 'TE';

// Type guard to check if position is a valid fantasy position
export function isFantasyPosition(pos: string | null): pos is FantasyPosition {
  return pos !== null && ['QB', 'RB', 'WR', 'TE'].includes(pos);
}

// Filtered player ready for database insert
export interface NFLPlayerInsert {
  player_id: number;
  full_name: string;
  position: FantasyPosition;
  team: string;
  college: string | null;
  age: number | null;
  weight: number | null;
}
