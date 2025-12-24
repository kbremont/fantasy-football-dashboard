// Sleeper API endpoint for NFL players
export const SLEEPER_API_URL = 'https://api.sleeper.app/v1/players/nfl';

// Maximum batch size for Supabase upsert operations
// Supabase recommends max 1000 rows per batch
export const BATCH_SIZE = 1000;

// Request timeout in milliseconds (30 seconds)
export const REQUEST_TIMEOUT_MS = 30000;
