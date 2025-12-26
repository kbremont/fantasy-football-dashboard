import { useEffect, useState } from 'react'
import { supabase, authReady } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Scale, Crown, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SleeperRoster {
  roster_id: number
  owner_id: string
  players: string[] | null
}

interface SleeperUser {
  user_id: string
  display_name: string
  metadata?: {
    team_name?: string
  }
}

interface PlayerWeight {
  player_id: string
  full_name: string
  position: string | null
  weight: number | null
}

interface RosterWeight {
  roster_id: number
  team_name: string
  total_weight: number
  player_count: number
  heaviest_player: {
    name: string
    weight: number
    position: string | null
  } | null
}

export function FattestRosters() {
  const [rosterWeights, setRosterWeights] = useState<RosterWeight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        await authReady

        // 1. Get current league_id from seasons table
        const { data: seasonData, error: seasonError } = await supabase
          .from('seasons')
          .select('sleeper_league_id')
          .eq('is_current', true)
          .single()

        if (seasonError || !seasonData) {
          throw new Error('Failed to get current season')
        }

        const leagueId = seasonData.sleeper_league_id

        // 2. Fetch rosters and users from Sleeper API in parallel
        const [rostersRes, usersRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
        ])

        if (!rostersRes.ok || !usersRes.ok) {
          throw new Error('Failed to fetch data from Sleeper API')
        }

        const rosters: SleeperRoster[] = await rostersRes.json()
        const users: SleeperUser[] = await usersRes.json()

        // 3. Create user lookup for team names
        const userMap = new Map<string, string>()
        users.forEach((user) => {
          const teamName = user.metadata?.team_name || user.display_name
          userMap.set(user.user_id, teamName)
        })

        // 4. Collect all player IDs
        const allPlayerIds = new Set<string>()
        rosters.forEach((roster) => {
          roster.players?.forEach((id) => allPlayerIds.add(id))
        })

        // 5. Fetch player weights from Supabase
        const { data: players, error: playersError } = await supabase
          .from('nfl_players')
          .select('player_id, full_name, position, weight')
          .in('player_id', Array.from(allPlayerIds))

        if (playersError) {
          throw new Error('Failed to fetch player data')
        }

        // 6. Create player lookup
        const playerMap = new Map<string, PlayerWeight>()
        players?.forEach((player) => {
          playerMap.set(player.player_id, player)
        })

        // 7. Calculate roster weights
        const weights: RosterWeight[] = rosters.map((roster) => {
          const teamName = userMap.get(roster.owner_id) || `Team ${roster.roster_id}`
          const rosterPlayers = (roster.players || [])
            .map((id) => playerMap.get(id))
            .filter((p): p is PlayerWeight => p !== undefined && p.weight !== null)

          const totalWeight = rosterPlayers.reduce((sum, p) => sum + (p.weight || 0), 0)

          // Find heaviest player
          const heaviest = rosterPlayers.reduce<PlayerWeight | null>(
            (max, p) => (!max || (p.weight || 0) > (max.weight || 0) ? p : max),
            null
          )

          return {
            roster_id: roster.roster_id,
            team_name: teamName,
            total_weight: totalWeight,
            player_count: rosterPlayers.length,
            heaviest_player: heaviest
              ? {
                  name: heaviest.full_name,
                  weight: heaviest.weight || 0,
                  position: heaviest.position,
                }
              : null,
          }
        })

        // 8. Sort by total weight descending
        weights.sort((a, b) => b.total_weight - a.total_weight)

        setRosterWeights(weights)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const maxWeight = rosterWeights.length > 0 ? rosterWeights[0].total_weight : 1

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-l-4 border-l-yellow-500'
    if (rank === 2) return 'bg-gradient-to-r from-slate-400/15 to-slate-500/5 border-l-4 border-l-slate-400'
    if (rank === 3) return 'bg-gradient-to-r from-orange-600/15 to-orange-700/5 border-l-4 border-l-orange-600'
    return ''
  }

  const getStickyCellBg = (rank: number) => {
    if (rank === 1) return 'bg-[hsl(45_30%_12%)]'
    if (rank === 2) return 'bg-[hsl(215_15%_14%)]'
    if (rank === 3) return 'bg-[hsl(25_25%_12%)]'
    return 'bg-card'
  }

  const getRankBadge = (rank: number) => {
    const baseClasses = 'w-8 h-8 rounded-full flex items-center justify-center font-display text-lg font-bold'

    if (rank === 1) {
      return (
        <div className={cn(baseClasses, 'bg-yellow-500 text-yellow-950')}>
          <Crown className="w-4 h-4" />
        </div>
      )
    }
    if (rank === 2) {
      return (
        <div className={cn(baseClasses, 'bg-slate-400 text-slate-900')}>
          {rank}
        </div>
      )
    }
    if (rank === 3) {
      return (
        <div className={cn(baseClasses, 'bg-orange-600 text-orange-100')}>
          {rank}
        </div>
      )
    }
    return (
      <div className={cn(baseClasses, 'bg-secondary text-muted-foreground')}>
        {rank}
      </div>
    )
  }

  const formatWeight = (weight: number) => {
    return weight.toLocaleString('en-US')
  }

  const champion = rosterWeights[0]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between animate-fade-up">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-2">
            Roster Mass Index
          </p>
          <h1 className="text-4xl md:text-5xl font-display tracking-wide text-foreground">
            HEAVYWEIGHT ROSTERS
          </h1>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="border-border bg-card">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading roster weights...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Champion Card */}
      {!loading && !error && champion && (
        <Card className="relative overflow-hidden border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 via-yellow-600/5 to-transparent animate-fade-up stagger-1">
          <div className="absolute top-4 right-4 text-7xl opacity-10">
            <Crown className="w-20 h-20" />
          </div>
          <CardHeader className="pb-2">
            <p className="text-yellow-500 font-display text-sm tracking-widest uppercase">
              Heavyweight Champion
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h2 className="text-3xl md:text-4xl font-display tracking-wide text-foreground">
                  {champion.team_name}
                </h2>
                <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span className="text-sm">
                    Heaviest: <span className="text-foreground font-medium">{champion.heaviest_player?.name}</span>
                    {champion.heaviest_player && (
                      <span className="text-yellow-500 ml-1">({formatWeight(champion.heaviest_player.weight)} lbs)</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-5xl md:text-6xl font-display text-yellow-500">
                  {formatWeight(champion.total_weight)}
                </p>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">
                  Total Pounds
                </p>
              </div>
            </div>
            {/* Weight bar */}
            <div className="mt-6 h-3 bg-secondary/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full transition-all duration-1000"
                style={{ width: '100%' }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rankings Table */}
      {!loading && !error && rosterWeights.length > 1 && (
        <Card className="border-border bg-card animate-fade-up stagger-2">
          <CardHeader className="border-b border-border/30 bg-secondary/30">
            <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
              <Scale className="w-5 h-5 text-primary" />
              WEIGHT CLASS RANKINGS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="w-16 text-center font-display text-xs tracking-wider text-muted-foreground sticky left-0 z-20 bg-card">
                      RANK
                    </TableHead>
                    <TableHead className="font-display text-xs tracking-wider text-muted-foreground sticky left-12 z-10 bg-card shadow-[8px_0_12px_-4px_rgba(0,0,0,0.4)]">
                      TEAM
                    </TableHead>
                    <TableHead className="text-right font-display text-xs tracking-wider text-muted-foreground">
                      TOTAL WEIGHT
                    </TableHead>
                    <TableHead className="font-display text-xs tracking-wider text-muted-foreground hidden md:table-cell">
                      WEIGHT BAR
                    </TableHead>
                    <TableHead className="font-display text-xs tracking-wider text-muted-foreground">
                      HEAVIEST PLAYER
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterWeights.slice(1).map((roster, index) => {
                    const rank = index + 2
                    const weightPercentage = (roster.total_weight / maxWeight) * 100

                    return (
                      <TableRow
                        key={roster.roster_id}
                        className={cn(
                          'border-border/20 transition-all duration-200 animate-fade-up',
                          getRankStyle(rank),
                          `stagger-${Math.min(rank, 10)}`
                        )}
                      >
                        <TableCell className={cn('text-center py-4 sticky left-0 z-20', getStickyCellBg(rank))}>
                          {getRankBadge(rank)}
                        </TableCell>
                        <TableCell className={cn('py-4 sticky left-12 z-10 shadow-[8px_0_12px_-4px_rgba(0,0,0,0.4)]', getStickyCellBg(rank))}>
                          <span className={cn('font-semibold text-base', rank <= 3 && 'text-foreground')}>
                            {roster.team_name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <span className="font-display text-lg tabular-nums">
                            {formatWeight(roster.total_weight)}
                          </span>
                          <span className="text-muted-foreground text-sm ml-1">lbs</span>
                        </TableCell>
                        <TableCell className="py-4 hidden md:table-cell">
                          <div className="w-full max-w-[200px] h-2 bg-secondary/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-700"
                              style={{ width: `${weightPercentage}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {roster.heaviest_player && (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {roster.heaviest_player.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {roster.heaviest_player.position} &middot; {formatWeight(roster.heaviest_player.weight)} lbs
                              </span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && rosterWeights.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <Scale className="w-12 h-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-medium text-foreground">No roster data</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Unable to load current roster weights.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
