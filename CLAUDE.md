# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fantasy Football Dashboard is a data pipeline and analytics application that syncs NFL player data and fantasy league rosters from the Sleeper API to a Supabase PostgreSQL database. The project uses Supabase Edge Functions (Deno runtime) for serverless data synchronization and scheduled cron jobs for automated updates.

**Key Technologies:**
- Supabase (PostgreSQL database, Edge Functions, pg_cron)
- TypeScript/Deno (Edge Functions runtime)
- Sleeper API (fantasy football data source)
- GitHub Actions (CI/CD)

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

### Scheduled Jobs

Two pg_cron jobs run daily at 9:00 AM UTC:
1. `sync-nfl-players-daily` - Syncs NFL player data from Sleeper API
2. `sync-league-rosters-daily` - Syncs fantasy league rosters from Sleeper API

Jobs invoke edge functions via `invoke_sync_nfl_players()` and `invoke_sync_league_rosters()` wrapper functions.

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

## Edge Functions Architecture

Both edge functions follow a similar pattern:

1. **Initialization**: Create Supabase client with service role key
2. **API Fetch**: Fetch data from Sleeper API with timeout protection (30s)
3. **Transformation**: Convert API response to database insert format
4. **Batch Processing**: Upsert data in batches (500 records for nfl_players)
5. **Response**: Return JSON with success status, count, and duration

**sync-nfl-players** (`supabase/functions/sync-nfl-players/`)
- Fetches all NFL players from `https://api.sleeper.app/v1/players/nfl`
- Filters out players without names (placeholder entries)
- Upserts to `nfl_players` table with conflict resolution on `player_id`
- Batch size: 500 records

**sync-league-rosters** (`supabase/functions/sync-league-rosters/`)
- Fetches rosters and users in parallel from Sleeper league endpoints
- Merges roster and user data (team_name from user metadata)
- Upserts to `rosters` table with conflict resolution on `roster_id`

### Edge Function Configuration

Configuration is stored in `config.ts` files within each function directory:
- `SLEEPER_LEAGUE_ID` - Hardcoded league ID
- `REQUEST_TIMEOUT_MS` - API request timeout (30 seconds)
- `BATCH_SIZE` - Database batch upsert size

## CI/CD Workflows

GitHub Actions automatically deploy on push to `main`:

**`.github/workflows/deploy-migrations.yml`**
- Triggers on changes to `supabase/migrations/**`
- Runs `supabase db push` to apply migrations

**`.github/workflows/deploy-edge-functions.yml`**
- Triggers on changes to `supabase/functions/**`
- Detects changed functions and deploys only those
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

## Working with Sleeper API

The project integrates with Sleeper's public API. No authentication required.

**NFL Players Endpoint:**
```
GET https://api.sleeper.app/v1/players/nfl
```

**League Rosters Endpoint:**
```
GET https://api.sleeper.app/v1/league/{league_id}/rosters
```

**League Users Endpoint:**
```
GET https://api.sleeper.app/v1/league/{league_id}/users
```

Player data structure includes: player_id, full_name, position, team, college, age, weight, and many other fields (only subset stored in database).

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
SELECT * FROM cron.job WHERE jobname IN ('sync-nfl-players-daily', 'sync-league-rosters-daily');
```

View execution history:
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-nfl-players-daily')
ORDER BY start_time DESC LIMIT 10;
```

Manually trigger sync:
```sql
SELECT invoke_sync_nfl_players();
SELECT invoke_sync_league_rosters();
```

Unschedule a job:
```sql
SELECT cron.unschedule('sync-nfl-players-daily');
```
