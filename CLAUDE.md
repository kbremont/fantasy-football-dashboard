# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fantasy Football Dashboard is a data pipeline and analytics application that syncs NFL player data and fantasy league rosters from the Sleeper API to a Supabase PostgreSQL database. The project uses Supabase Edge Functions (Deno runtime) for serverless data synchronization and scheduled cron jobs for automated updates.

**Key Technologies:**
- Supabase (PostgreSQL database, Edge Functions, pg_cron)
- TypeScript/Deno (Edge Functions runtime)
- Sleeper API (fantasy football data source)
- GitHub Actions (CI/CD)
- Vite + React + TypeScript (Frontend)
- shadcn/ui + Tailwind CSS (UI Components)

**Project ID:** fnphwakozzgoqpoidpvq
**Supabase URL:** https://fnphwakozzgoqpoidpvq.supabase.co
**Sleeper League ID:** 1180722152528445440

## Database Architecture

### Tables

**`nfl_players`** - NFL player roster data
- Primary key: `player_id` (TEXT)
- Includes: full_name, position, team, college, age, weight
- Indexed on: position, team, full_name (fuzzy search with pg_trgm)
- Auto-updated timestamp triggers
- RLS enabled (authenticated users + service role)

**`rosters`** - Fantasy league roster metadata
- Primary key: `roster_id` (INTEGER)
- Includes: owner_id, team_name
- Indexed on: owner_id
- Auto-updated timestamp triggers
- RLS enabled (authenticated users + service role)

**`seasons`** - Multi-season tracking (Sleeper creates new league_id each year)
- Primary key: `id` (SERIAL)
- Includes: season_year, sleeper_league_id, is_current, total_weeks
- Unique constraints on season_year and sleeper_league_id
- Note: Sleeper uses Super Bowl year (2024-25 season = "2025")

**`matchups`** - Weekly matchup results
- Primary key: `id` (BIGSERIAL)
- Includes: season_id, week, matchup_id, roster_id, starters[], players[], points
- Two rosters with same matchup_id played against each other
- GIN indexes on starters and players arrays for player lookups
- Unique constraint: (season_id, week, roster_id)

**`weekly_rosters`** - Weekly roster snapshots
- Primary key: `id` (BIGSERIAL)
- Includes: season_id, week, roster_id, player_ids[]
- GIN index on player_ids for player history queries
- Unique constraint: (season_id, week, roster_id)

**`transactions`** - Trades, waivers, free agent pickups
- Primary key: `id` (BIGSERIAL)
- Includes: transaction_id, season_id, week, type, status, roster_ids[], adds, drops
- Types: trade, free_agent, waiver, commissioner
- JSONB columns for adds/drops (player_id -> roster_id mapping)
- Unique constraint on transaction_id

### Scheduled Jobs

**Daily jobs (9:00 AM UTC):**
1. `sync-nfl-players-daily` - Syncs NFL player data from Sleeper API
2. `sync-league-rosters-daily` - Syncs fantasy league rosters from Sleeper API

**Weekly jobs (Tuesdays 10:00 AM UTC):**
3. `sync-weekly-matchups` - Syncs matchup results for previous week
4. `sync-weekly-transactions` - Syncs transactions for previous week

Jobs invoke edge functions via wrapper functions (e.g., `invoke_sync_nfl_players()`).

## Supabase Commands

### Database Migrations

```bash
# Apply migrations to remote database
supabase db push

# Create a new migration
supabase migration new <migration_name>

# Reset local database (destructive)
supabase db reset

# View migration status
supabase migration list
```

### Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy

# Deploy a specific function
supabase functions deploy sync-nfl-players
supabase functions deploy sync-league-rosters

# Test locally
supabase functions serve

# View function logs
supabase functions logs sync-nfl-players
```

### TypeScript Types

Regenerate database types after schema changes:

```bash
supabase gen types typescript --project-id fnphwakozzgoqpoidpvq > src/types/database.ts
```

### Project Linking

```bash
# Link to remote Supabase project
supabase link --project-ref fnphwakozzgoqpoidpvq
```

## Frontend Application

The frontend is a Vite + React + TypeScript SPA with shadcn/ui components and Tailwind CSS.

### Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Frontend Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components (Table, Card, Select, Button, Tabs)
│   └── Layout.tsx       # App shell with navigation header
├── pages/
│   ├── Standings.tsx    # League standings with W-L records
│   └── Matchups.tsx     # Weekly matchup results
├── lib/
│   ├── supabase.ts      # Supabase client (uses publishable key)
│   └── utils.ts         # shadcn/ui utility (cn function)
├── types/
│   └── database.ts      # Auto-generated Supabase types
├── App.tsx              # React Router setup
├── main.tsx             # Entry point
└── index.css            # Tailwind + custom theme
```

### Pages

**Standings (`/`)**
- Displays league standings with W-L-T records
- Season selector dropdown
- Calculates wins/losses from matchups table
- Shows Points For, Points Against, Point Differential
- Tracks winning/losing streaks
- Podium-style highlighting for top 3 teams

**Matchups (`/matchups`)**
- Displays weekly head-to-head matchup results
- Week navigation with scrollable pills
- Season selector dropdown
- Scoreboard-style cards with VS divider
- Winner highlighted with crown icon

### Environment Variables

Create `.env` in project root:

```env
VITE_SUPABASE_URL=https://fnphwakozzgoqpoidpvq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key (not anon key) is used for client-side access. Get it from Supabase Dashboard > Settings > API.

### Design System

- **Theme**: Dark sports-editorial with navy background
- **Fonts**: Bebas Neue (display), DM Sans (body)
- **Colors**: Primary green (wins), Destructive red (losses), Gold accent
- **Effects**: Gradient backgrounds, glow effects, fade-up animations

## Edge Functions Architecture

All edge functions follow a similar pattern:

1. **Initialization**: Create Supabase client with service role key
2. **API Fetch**: Fetch data from Sleeper API with timeout protection (30s)
3. **Transformation**: Convert API response to database insert format
4. **Batch Processing**: Upsert data in batches
5. **Response**: Return JSON with success status, count, and duration

### Shared Utilities (`supabase/functions/_shared/`)

Common utilities used across all edge functions:
- `sleeper-api.ts` - Sleeper API fetch functions with timeout
- `supabase-client.ts` - Service role client initialization
- `season-utils.ts` - Season lookup and creation helpers

### Edge Functions

**sync-nfl-players** (`supabase/functions/sync-nfl-players/`)
- Fetches all NFL players from `https://api.sleeper.app/v1/players/nfl`
- Filters out players without names (placeholder entries)
- Upserts to `nfl_players` table with conflict resolution on `player_id`
- Batch size: 1000 records

**sync-league-rosters** (`supabase/functions/sync-league-rosters/`)
- Gets current league_id from `seasons` table (dynamic, not hardcoded)
- Fetches rosters and users in parallel from Sleeper league endpoints
- Merges roster and user data (team_name from user metadata)
- Upserts to `rosters` table with conflict resolution on `roster_id`

**sync-weekly-matchups** (`supabase/functions/sync-weekly-matchups/`)
- Syncs matchup data for a specific week
- Parameters: `{ week?, season_id?, backfill? }`
- Upserts to `matchups` and `weekly_rosters` tables
- Filters out null matchup_id (playoff bye weeks)

**sync-weekly-transactions** (`supabase/functions/sync-weekly-transactions/`)
- Syncs transaction data for a specific week
- Parameters: `{ week?, season_id?, backfill? }`
- Handles types: trade, free_agent, waiver, commissioner

**backfill-season** (`supabase/functions/backfill-season/`)
- Orchestrates full season backfill
- Parameters: `{ season_year?, sleeper_league_id?, start_week?, end_week?, discover_previous? }`
- With `discover_previous: true`, follows `previous_league_id` chain to find and backfill all historical seasons

## CI/CD Workflows

GitHub Actions automatically deploy on push to `main`:

**`.github/workflows/deploy-migrations.yml`**
- Triggers on changes to `supabase/migrations/**`
- Runs `supabase db push` to apply migrations

**`.github/workflows/deploy-edge-functions.yml`**
- Triggers on changes to `supabase/functions/**`
- Detects changed functions and deploys only those
- Excludes directories starting with `_` (like `_shared/`)
- Can manually trigger with `workflow_dispatch` to deploy specific function

**`.github/workflows/preview-migrations.yml`**
- Preview migration changes before deploying

**Required Secret:** `SUPABASE_ACCESS_TOKEN` must be set in GitHub repository secrets

## Migration Naming Convention

Migrations follow timestamp-based naming: `YYYYMMDDHHMMSS_description.sql`

Key migrations:
- `20251224025517_create_nfl_players.sql` - Initial nfl_players table and RLS
- `20251224213157_setup_pg_cron.sql` - pg_cron setup and sync-nfl-players schedule
- `20251224235855_player_id_to_text.sql` - Changed player_id from INTEGER to TEXT
- `20251225002121_create_rosters.sql` - Created rosters table
- `20251225002227_schedule_sync_rosters.sql` - Added roster sync cron job
- `20251225005811_create_seasons_table.sql` - Multi-season support
- `20251225005812_create_weekly_rosters_table.sql` - Weekly roster snapshots
- `20251225005813_create_matchups_table.sql` - Matchup results tracking
- `20251225005814_create_transactions_table.sql` - Transaction history
- `20251225005815_schedule_weekly_sync.sql` - Weekly matchup/transaction cron jobs

## Working with Sleeper API

The project integrates with Sleeper's public API. No authentication required.

**NFL Players:**
```
GET https://api.sleeper.app/v1/players/nfl
```

**NFL State (current week/season):**
```
GET https://api.sleeper.app/v1/state/nfl
```

**League Info (includes previous_league_id for season chaining):**
```
GET https://api.sleeper.app/v1/league/{league_id}
```

**League Rosters:**
```
GET https://api.sleeper.app/v1/league/{league_id}/rosters
```

**League Users:**
```
GET https://api.sleeper.app/v1/league/{league_id}/users
```

**Weekly Matchups:**
```
GET https://api.sleeper.app/v1/league/{league_id}/matchups/{week}
```

**Weekly Transactions:**
```
GET https://api.sleeper.app/v1/league/{league_id}/transactions/{week}
```

**Note:** Sleeper uses the Super Bowl year for season naming. The 2024-25 NFL season is labeled "2025" in Sleeper.

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:
- **SELECT**: Authenticated users and service role
- **INSERT/UPDATE**: Authenticated users and service role
- **DELETE**: Service role only

Edge functions use service role key to bypass RLS for automated syncing.

## Type Safety

TypeScript types are auto-generated from database schema in `src/types/database.ts`. Import and use with Supabase client:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/database'

const supabase = createClient<Database>(url, key)

// Type-safe queries
const { data } = await supabase
  .from('nfl_players')
  .select('*')
  .eq('position', 'QB')
```

## Monitoring Cron Jobs

View scheduled jobs:
```sql
SELECT * FROM cron.job WHERE jobname IN (
  'sync-nfl-players-daily',
  'sync-league-rosters-daily',
  'sync-weekly-matchups',
  'sync-weekly-transactions'
);
```

View execution history:
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-weekly-matchups')
ORDER BY start_time DESC LIMIT 10;
```

Manually trigger sync:
```sql
SELECT invoke_sync_nfl_players();
SELECT invoke_sync_league_rosters();
SELECT invoke_sync_weekly_matchups();
SELECT invoke_sync_weekly_transactions();
```

Unschedule a job:
```sql
SELECT cron.unschedule('sync-weekly-matchups');
```

## Historical Data Queries

Example queries for matchup and transaction data:

```sql
-- Get all matchups for a specific week
SELECT m1.roster_id as team1, m1.points as team1_pts,
       m2.roster_id as team2, m2.points as team2_pts
FROM matchups m1
JOIN matchups m2 ON m1.matchup_id = m2.matchup_id
  AND m1.season_id = m2.season_id AND m1.week = m2.week
  AND m1.roster_id < m2.roster_id
JOIN seasons s ON m1.season_id = s.id
WHERE s.season_year = 2025 AND m1.week = 10;

-- Get all trades for a season
SELECT t.*, s.season_year
FROM transactions t
JOIN seasons s ON t.season_id = s.id
WHERE t.type = 'trade' AND s.season_year = 2025;

-- Find which weeks a player was on a roster
SELECT wr.week, r.team_name
FROM weekly_rosters wr
JOIN rosters r ON wr.roster_id = r.roster_id
JOIN seasons s ON wr.season_id = s.id
WHERE '4034' = ANY(wr.player_ids) AND s.season_year = 2025
ORDER BY wr.week;
```
