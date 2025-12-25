import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from '../_shared/supabase-client.ts';
import {
  fetchRosters,
  fetchUsers,
  type SleeperRoster,
  type SleeperUser,
} from '../_shared/sleeper-api.ts';
import { getCurrentLeagueId } from '../_shared/season-utils.ts';

// Roster ready for database insert
interface RosterInsert {
  roster_id: number;
  owner_id: string;
  team_name: string | null;
}

/**
 * Merges roster and user data to create roster inserts
 */
function mergeRosterData(rosters: SleeperRoster[], users: SleeperUser[]): RosterInsert[] {
  // Create a map of user_id -> team_name for quick lookup
  const userTeamMap = new Map<string, string | null>();
  for (const user of users) {
    userTeamMap.set(user.user_id, user.metadata?.team_name || null);
  }

  // Map rosters with team names from users
  return rosters.map((roster) => ({
    roster_id: roster.roster_id,
    owner_id: roster.owner_id,
    team_name: userTeamMap.get(roster.owner_id) || null,
  }));
}

/**
 * Main edge function handler
 * Fetches league rosters from Sleeper API and upserts them to Supabase
 */
Deno.serve(async (_req: Request) => {
  const startTime = Date.now();

  try {
    // 1. Initialize Supabase client with service role
    const supabase = createServiceClient();

    // 2. Get the current league ID from the seasons table
    console.log('Getting current league ID from seasons table...');
    const leagueId = await getCurrentLeagueId(supabase);
    console.log(`Using league ID: ${leagueId}`);

    // 3. Fetch rosters and users from Sleeper API in parallel
    console.log('Fetching league rosters and users from Sleeper API...');
    const [rosters, users] = await Promise.all([
      fetchRosters(leagueId),
      fetchUsers(leagueId),
    ]);

    console.log(`Fetched ${rosters.length} rosters and ${users.length} users`);

    // 4. Merge roster and user data
    const rosterInserts = mergeRosterData(rosters, users);

    if (rosterInserts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No rosters to sync',
          rostersProcessed: 0
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // 5. Upsert to Supabase
    console.log(`Upserting ${rosterInserts.length} rosters...`);

    const { error } = await supabase
      .from('rosters')
      .upsert(rosterInserts, {
        onConflict: 'roster_id',
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Database upsert failed: ${error.message}`);
    }

    // 6. Return response
    const duration = Date.now() - startTime;
    const response = {
      success: true,
      leagueId,
      rostersProcessed: rosterInserts.length,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    };

    console.log('Sync complete:', response);

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Fatal error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
