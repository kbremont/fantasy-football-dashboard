import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Season {
  id: number
  season_year: number
  is_current: boolean | null
}

interface StandingRow {
  roster_id: number
  team_name: string
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  streak: number
  streak_type: 'W' | 'L' | null
}

export function Standings() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch seasons on mount
  useEffect(() => {
    async function fetchSeasons() {
      const { data, error } = await supabase
        .from('seasons')
        .select('id, season_year, is_current')
        .order('season_year', { ascending: false })

      if (error) {
        setError('Failed to load seasons')
        setLoading(false)
        return
      }

      setSeasons(data || [])

      // Default to current season or most recent
      const currentSeason = data?.find((s) => s.is_current) || data?.[0]
      if (currentSeason) {
        setSelectedSeasonId(currentSeason.id)
      }
    }

    fetchSeasons()
  }, [])

  // Fetch standings when season changes
  useEffect(() => {
    if (!selectedSeasonId) return

    async function fetchStandings() {
      setLoading(true)
      setError(null)

      try {
        // Fetch all matchups for the season
        const { data: matchups, error: matchupsError } = await supabase
          .from('matchups')
          .select('roster_id, matchup_id, week, points')
          .eq('season_id', selectedSeasonId!)
          .order('week', { ascending: true })

        if (matchupsError) throw matchupsError

        // Fetch rosters for team names
        const { data: rosters, error: rostersError } = await supabase
          .from('rosters')
          .select('roster_id, team_name')

        if (rostersError) throw rostersError

        // Calculate standings
        const standingsMap = new Map<number, StandingRow>()

        // Initialize all rosters
        rosters?.forEach((roster) => {
          standingsMap.set(roster.roster_id, {
            roster_id: roster.roster_id,
            team_name: roster.team_name || `Team ${roster.roster_id}`,
            wins: 0,
            losses: 0,
            ties: 0,
            points_for: 0,
            points_against: 0,
            streak: 0,
            streak_type: null,
          })
        })

        // Group matchups by week and matchup_id
        const weeklyMatchups = new Map<string, typeof matchups>()
        matchups?.forEach((m) => {
          const key = `${m.week}-${m.matchup_id}`
          if (!weeklyMatchups.has(key)) {
            weeklyMatchups.set(key, [])
          }
          weeklyMatchups.get(key)!.push(m)
        })

        // Track results by week for streak calculation
        const resultsByRoster = new Map<number, ('W' | 'L' | 'T')[]>()

        // Process each matchup
        weeklyMatchups.forEach((matchup) => {
          if (matchup.length !== 2) return // Skip incomplete matchups

          const [team1, team2] = matchup
          const points1 = team1.points ?? 0
          const points2 = team2.points ?? 0

          const standing1 = standingsMap.get(team1.roster_id)
          const standing2 = standingsMap.get(team2.roster_id)

          if (!standing1 || !standing2) return

          // Update points
          standing1.points_for += points1
          standing1.points_against += points2
          standing2.points_for += points2
          standing2.points_against += points1

          // Determine winner
          if (points1 > points2) {
            standing1.wins++
            standing2.losses++
            if (!resultsByRoster.has(team1.roster_id)) resultsByRoster.set(team1.roster_id, [])
            if (!resultsByRoster.has(team2.roster_id)) resultsByRoster.set(team2.roster_id, [])
            resultsByRoster.get(team1.roster_id)!.push('W')
            resultsByRoster.get(team2.roster_id)!.push('L')
          } else if (points2 > points1) {
            standing2.wins++
            standing1.losses++
            if (!resultsByRoster.has(team1.roster_id)) resultsByRoster.set(team1.roster_id, [])
            if (!resultsByRoster.has(team2.roster_id)) resultsByRoster.set(team2.roster_id, [])
            resultsByRoster.get(team1.roster_id)!.push('L')
            resultsByRoster.get(team2.roster_id)!.push('W')
          } else {
            standing1.ties++
            standing2.ties++
            if (!resultsByRoster.has(team1.roster_id)) resultsByRoster.set(team1.roster_id, [])
            if (!resultsByRoster.has(team2.roster_id)) resultsByRoster.set(team2.roster_id, [])
            resultsByRoster.get(team1.roster_id)!.push('T')
            resultsByRoster.get(team2.roster_id)!.push('T')
          }
        })

        // Calculate streaks
        resultsByRoster.forEach((results, rosterId) => {
          const standing = standingsMap.get(rosterId)
          if (!standing || results.length === 0) return

          const lastResult = results[results.length - 1]
          if (lastResult === 'T') {
            standing.streak = 0
            standing.streak_type = null
            return
          }

          let streak = 1
          for (let i = results.length - 2; i >= 0; i--) {
            if (results[i] === lastResult) {
              streak++
            } else {
              break
            }
          }
          standing.streak = streak
          standing.streak_type = lastResult === 'W' ? 'W' : 'L'
        })

        // Sort by wins (desc), then points_for (desc)
        const sortedStandings = Array.from(standingsMap.values()).sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins
          return b.points_for - a.points_for
        })

        setStandings(sortedStandings)
      } catch (err) {
        console.error(err)
        setError('Failed to load standings')
      } finally {
        setLoading(false)
      }
    }

    fetchStandings()
  }, [selectedSeasonId])

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-l-4 border-l-yellow-500'
    if (rank === 2) return 'bg-gradient-to-r from-slate-400/15 to-slate-500/5 border-l-4 border-l-slate-400'
    if (rank === 3) return 'bg-gradient-to-r from-orange-600/15 to-orange-700/5 border-l-4 border-l-orange-600'
    return ''
  }

  const getRankBadge = (rank: number) => {
    const baseClasses = 'w-8 h-8 rounded-full flex items-center justify-center font-display text-lg font-bold'

    if (rank === 1) {
      return (
        <div className={cn(baseClasses, 'bg-yellow-500 text-yellow-950 glow-gold')}>
          <Trophy className="w-4 h-4" />
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

  const formatPoints = (points: number) => {
    return points.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const getPointsDiff = (pf: number, pa: number) => {
    const diff = pf - pa
    return diff
  }

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between animate-fade-up">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-widest mb-2">
            League Rankings
          </p>
          <h1 className="text-5xl md:text-6xl font-display tracking-wide text-gradient">
            STANDINGS
          </h1>
        </div>

        {/* Season Selector */}
        <div className="w-full md:w-48">
          <Select
            value={selectedSeasonId?.toString()}
            onValueChange={(value) => setSelectedSeasonId(Number(value))}
          >
            <SelectTrigger className="bg-secondary/50 border-border/50 h-11">
              <SelectValue placeholder="Select Season" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={season.id.toString()}>
                  {season.season_year}-{(season.season_year + 1).toString().slice(-2)} Season
                  {season.is_current && ' (Current)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Card className="border-border/30 bg-card/50 backdrop-blur">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading standings...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standings Table */}
      {!loading && !error && standings.length > 0 && (
        <Card className="border-border/30 bg-card/50 backdrop-blur overflow-hidden animate-fade-up stagger-1">
          <CardHeader className="border-b border-border/30 bg-secondary/30">
            <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
              <Trophy className="w-5 h-5 text-primary" />
              {selectedSeason
                ? `${selectedSeason.season_year}-${(selectedSeason.season_year + 1).toString().slice(-2)} STANDINGS`
                : 'SEASON STANDINGS'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="w-16 text-center font-display text-xs tracking-wider text-muted-foreground">
                    RANK
                  </TableHead>
                  <TableHead className="font-display text-xs tracking-wider text-muted-foreground">
                    TEAM
                  </TableHead>
                  <TableHead className="text-center font-display text-xs tracking-wider text-muted-foreground">
                    RECORD
                  </TableHead>
                  <TableHead className="text-center font-display text-xs tracking-wider text-muted-foreground hidden sm:table-cell">
                    STREAK
                  </TableHead>
                  <TableHead className="text-right font-display text-xs tracking-wider text-muted-foreground">
                    PF
                  </TableHead>
                  <TableHead className="text-right font-display text-xs tracking-wider text-muted-foreground hidden md:table-cell">
                    PA
                  </TableHead>
                  <TableHead className="text-right font-display text-xs tracking-wider text-muted-foreground hidden lg:table-cell">
                    DIFF
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((team, index) => {
                  const rank = index + 1
                  const diff = getPointsDiff(team.points_for, team.points_against)

                  return (
                    <TableRow
                      key={team.roster_id}
                      className={cn(
                        'border-border/20 transition-all duration-200 animate-fade-up',
                        getRankStyle(rank),
                        `stagger-${Math.min(rank, 10)}`
                      )}
                    >
                      <TableCell className="text-center py-4">
                        {getRankBadge(rank)}
                      </TableCell>
                      <TableCell className="py-4">
                        <span className={cn(
                          'font-semibold text-base',
                          rank <= 3 && 'text-foreground'
                        )}>
                          {team.team_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-primary font-bold text-lg font-display">
                            {team.wins}
                          </span>
                          <span className="text-muted-foreground">-</span>
                          <span className="text-destructive font-bold text-lg font-display">
                            {team.losses}
                          </span>
                          {team.ties > 0 && (
                            <>
                              <span className="text-muted-foreground">-</span>
                              <span className="text-muted-foreground font-bold text-lg font-display">
                                {team.ties}
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-4 hidden sm:table-cell">
                        {team.streak_type ? (
                          <div className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium',
                            team.streak_type === 'W'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-destructive/20 text-destructive'
                          )}>
                            {team.streak_type === 'W' ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {team.streak_type}{team.streak}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-muted-foreground">
                            <Minus className="w-3 h-3" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-4 tabular-nums font-medium">
                        {formatPoints(team.points_for)}
                      </TableCell>
                      <TableCell className="text-right py-4 tabular-nums text-muted-foreground hidden md:table-cell">
                        {formatPoints(team.points_against)}
                      </TableCell>
                      <TableCell className="text-right py-4 hidden lg:table-cell">
                        <span className={cn(
                          'tabular-nums font-medium',
                          diff > 0 && 'text-primary',
                          diff < 0 && 'text-destructive',
                          diff === 0 && 'text-muted-foreground'
                        )}>
                          {diff > 0 && '+'}
                          {formatPoints(diff)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && standings.length === 0 && (
        <Card className="border-border/30 bg-card/50 backdrop-blur">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-medium text-foreground">No standings data</p>
                <p className="text-sm text-muted-foreground mt-1">
                  There are no matchups recorded for this season yet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
