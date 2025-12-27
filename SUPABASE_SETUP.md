# Supabase NFL Players Database - Setup Complete

## Project Information

- **Project ID:** fnphwakozzgoqpoidpvq
- **Project URL:** https://fnphwakozzgoqpoidpvq.supabase.co
- **Region:** us-east-1
- **Status:** ✅ Active & Healthy

## Database Summary

### Table: `nfl_players`

**Total Records:** 842 NFL players

**Position Breakdown:**
- Quarterbacks (QB): 123
- Running Backs (RB): 197
- Wide Receivers (WR): 327
- Tight Ends (TE): 195

**Schema:**
```sql
- player_id (INTEGER, PRIMARY KEY)
- full_name (TEXT, NOT NULL)
- position (ENUM: 'QB', 'RB', 'WR', 'TE', NOT NULL)
- team (VARCHAR(3), NOT NULL)
- college (TEXT, NULLABLE)
- age (NUMERIC(3,1), NULLABLE)
- weight (INTEGER, NULLABLE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes:**
- `idx_nfl_players_position` - Fast position filtering
- `idx_nfl_players_team` - Fast team filtering
- `idx_nfl_players_position_team` - Combined position+team queries
- `idx_nfl_players_age` - Age-based queries
- `idx_nfl_players_full_name_trgm` - Fuzzy name search (uses pg_trgm)

**Features:**
- Automatic `updated_at` timestamp trigger
- Row Level Security (RLS) enabled - authenticated users only
- Service role has full access for n8n automation

## API Keys

Your Supabase project has the following API keys:

1. **Anon Key (for client-side apps):**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucGh3YWtvenpnb3Fwb2lkcHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MzgzMTEsImV4cCI6MjA4MjExNDMxMX0.IVFhOF4lxq7-HjBUNnkKtfr3fKu35-NzZv-B_2wszTo
   ```

2. **Publishable Key:**
   ```
   sb_publishable_MFBu5CbaYa8uSq32B0U9IQ_XJfWbjxv
   ```

3. **Service Role Key:** (⚠️ Never expose client-side)
   - Find this in your Supabase Dashboard → Project Settings → API
   - Use this for your n8n automation

## TypeScript Integration

TypeScript types have been generated at: `src/types/database.ts`

### Example Usage:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/database'

const supabase = createClient<Database>(
  'https://fnphwakozzgoqpoidpvq.supabase.co',
  'YOUR_ANON_KEY'
)

// Type-safe queries
const { data: players } = await supabase
  .from('nfl_players')
  .select('*')
  .eq('position', 'QB')
  .gte('age', 30)

// Type-safe inserts
const { data } = await supabase
  .from('nfl_players')
  .insert({
    player_id: 99999,
    full_name: 'New Player',
    position: 'QB',
    team: 'KC',
    college: 'Some College',
    age: 25.0,
    weight: 215
  })
```

## Updating Your n8n Automation

To migrate your n8n workflow from Airtable to Supabase:

### Step 1: Add Supabase Credentials in n8n

1. Go to n8n → Credentials
2. Create new "Supabase API" credential
3. Enter:
   - **Project URL:** `https://fnphwakozzgoqpoidpvq.supabase.co`
   - **Service Role Key:** (get from Supabase Dashboard → Settings → API)

### Step 2: Update Your Workflow

Replace Airtable nodes with Supabase nodes:

**For INSERT operations:**
```javascript
// Use Supabase "Insert" node
{
  "table": "nfl_players",
  "records": [
    {
      "player_id": 12345,
      "full_name": "John Doe",
      "position": "QB",
      "team": "KC",
      "college": "Ohio State",
      "age": 28.0,
      "weight": 225
    }
  ]
}
```

**For UPDATE operations:**
```javascript
// Use Supabase "Update" node
{
  "table": "nfl_players",
  "update": {
    "age": 29.0,
    "weight": 230,
    "team": "SF"
  },
  "match": {
    "player_id": 12345
  }
}
```

**For UPSERT operations:**
```javascript
// Use Supabase "Insert" with upsert option
{
  "table": "nfl_players",
  "records": [...],
  "onConflict": "player_id"  // Will update if player_id exists
}
```

### Step 3: RLS Considerations

Since RLS is enabled, your n8n automation **must use the Service Role Key** (not the anon key) to bypass RLS policies and perform write operations.

## Common Queries

### Get all quarterbacks
```sql
SELECT * FROM nfl_players
WHERE position = 'QB'
ORDER BY full_name;
```

### Get team roster
```sql
SELECT * FROM nfl_players
WHERE team = 'KC'
ORDER BY position, full_name;
```

### Search players by name (fuzzy)
```sql
SELECT * FROM nfl_players
WHERE full_name ILIKE '%mahomes%';
```

### Get players by age range
```sql
SELECT * FROM nfl_players
WHERE age BETWEEN 25 AND 30
ORDER BY age DESC;
```

### Position counts by team
```sql
SELECT team, position, COUNT(*) as player_count
FROM nfl_players
GROUP BY team, position
ORDER BY team, position;
```

## Files Created

- `supabase/migrations/20250101000000_create_nfl_players.sql` - Database schema migration
- `src/types/database.ts` - TypeScript type definitions
- `active-players-clean.csv` - Cleaned CSV data (duplicate removed)
- `SUPABASE_SETUP.md` - This file

## Next Steps

1. **Update n8n automation** to use Supabase instead of Airtable
2. **Test UPSERT logic** to ensure player updates work correctly
3. **Monitor RLS policies** to ensure data access is working as expected
4. **Build your dashboard** using the TypeScript types for type safety

## Support Links

- **Supabase Dashboard:** https://supabase.com/dashboard/project/fnphwakozzgoqpoidpvq
- **Table Editor:** https://supabase.com/dashboard/project/fnphwakozzgoqpoidpvq/editor
- **SQL Editor:** https://supabase.com/dashboard/project/fnphwakozzgoqpoidpvq/sql
- **API Docs:** https://supabase.com/dashboard/project/fnphwakozzgoqpoidpvq/api

---

**Migration Completed:** 2025-12-23
**Cost:** $0/month (Free tier)
