// Sleeper API roster object structure
export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[] | null;
  // Additional fields exist in the API but are not used
}

// Sleeper API user object structure
export interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata: {
    team_name?: string;
  } | null;
  // Additional fields exist in the API but are not used
}

// Roster ready for database insert
export interface RosterInsert {
  roster_id: number;
  owner_id: string;
  team_name: string | null;
}
