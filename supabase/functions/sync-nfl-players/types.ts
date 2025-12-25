// Sleeper API player object structure
export interface SleeperPlayer {
  player_id: string;
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

// Player ready for database insert
export interface NFLPlayerInsert {
  player_id: string;
  full_name: string;
  position: string | null;
  team: string | null;
  college: string | null;
  age: number | null;
  weight: number | null;
}
