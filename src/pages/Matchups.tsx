import { useEffect, useRef, useState } from 'react'
import { supabase, authReady } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Crown, Swords, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  findGameOfTheWeek,
  formatPoints as formatPulsePoints,
  formatMargin,
  type GameOfTheWeek,
  type MatchupPairData,
} from '@/lib/league-pulse'

// =============================================================================
// TYPES
// =============================================================================

interface Season {
  id: number
  season_year: number
  is_current: boolean | null
  total_weeks: number | null
}

interface PlayerPoints {
  player_id: string
  full_name: string
  position: string | null
  team: string | null
  points: number
  isStarter: boolean
}

interface TeamMatchupData {
  roster_id: number
  team_name: string
  points: number
  players: PlayerPoints[]
}

interface MatchupPair {
  matchup_id: number
  team1: TeamMatchupData
  team2: TeamMatchupData
  winner: 'team1' | 'team2' | 'tie' | null
}

// =============================================================================
// CONSTANTS
// =============================================================================

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

/**
 * Calculate approximate date for an NFL week
 * NFL regular season typically starts the Thursday after Labor Day (first Monday in September)
 * Week 1 is around September 5-11, each subsequent week is +7 days
 */
function getApproximateWeekDate(seasonYear: number, week: number): string {
  // Approximate: Week 1 starts around September 7 of the season year
  const weekOneStart = new Date(seasonYear, 8, 7) // September 7
  const weekDate = new Date(weekOneStart)
  weekDate.setDate(weekDate.getDate() + (week - 1) * 7)
  return weekDate.toISOString().split('T')[0] // YYYY-MM-DD
}

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-500/20 text-red-400',
  RB: 'bg-emerald-500/20 text-emerald-400',
  WR: 'bg-blue-500/20 text-blue-400',
  TE: 'bg-orange-500/20 text-orange-400',
  K: 'bg-purple-500/20 text-purple-400',
  DEF: 'bg-amber-500/20 text-amber-400',
}

// Defense IDs are 2-4 letter team abbreviations (e.g., "SEA", "CHI", "LAR")
const isDefenseId = (playerId: string): boolean => {
  return /^[A-Z]{2,4}$/.test(playerId)
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const sortPlayersByPosition = (players: PlayerPoints[]): PlayerPoints[] => {
  return [...players].sort((a, b) => {
    const posA = POSITION_ORDER.indexOf(a.position || '')
    const posB = POSITION_ORDER.indexOf(b.position || '')
    // Unknown positions go to the end
    const orderA = posA === -1 ? 999 : posA
    const orderB = posB === -1 ? 999 : posB
    if (orderA !== orderB) return orderA - orderB
    return b.points - a.points // Within same position, sort by points desc
  })
}

const formatPoints = (points: number) => {
  return points.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function Matchups() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [matchups, setMatchups] = useState<MatchupPair[]>([])
  const [maxWeek, setMaxWeek] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameOfTheWeek, setGameOfTheWeek] = useState<GameOfTheWeek | null>(null)
  const [expandedMatchups, setExpandedMatchups] = useState<Set<number>>(new Set())
  const [gotwExpanded, setGotwExpanded] = useState(false)
  const weekRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const toggleExpand = (matchupId: number) => {
    setExpandedMatchups((prev) => {
      const next = new Set(prev)
      if (next.has(matchupId)) next.delete(matchupId)
      else next.add(matchupId)
      return next
    })
  }

  // Fetch seasons on mount
  useEffect(() => {
    async function fetchSeasons() {
      await authReady

      const { data, error } = await supabase
        .from('seasons')
        .select('id, season_year, is_current, total_weeks')
        .order('season_year', { ascending: false })

      if (error) {
        setError('Failed to load seasons')
        setLoading(false)
        return
      }

      setSeasons(data || [])

      const currentSeason = data?.find((s) => s.is_current) || data?.[0]
      if (currentSeason) {
        setSelectedSeasonId(currentSeason.id)
      }
    }

    fetchSeasons()
  }, [])

  // Fetch max week when season changes
  useEffect(() => {
    if (!selectedSeasonId) return

    async function fetchMaxWeek() {
      const { data, error } = await supabase
        .from('matchups')
        .select('week')
        .eq('season_id', selectedSeasonId!)
        .order('week', { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0) {
        setMaxWeek(data[0].week)
        setSelectedWeek(data[0].week) // Start at most recent week
      } else {
        setMaxWeek(1)
        setSelectedWeek(1)
      }
    }

    fetchMaxWeek()
  }, [selectedSeasonId])

  // Fetch matchups when season or week changes
  useEffect(() => {
    if (!selectedSeasonId) return

    async function fetchMatchups() {
      setLoading(true)
      setError(null)
      setExpandedMatchups(new Set()) // Reset expanded state on week change
      setGotwExpanded(false)

      try {
        // Fetch matchups for the selected week (now including player data)
        const { data: matchupsData, error: matchupsError } = await supabase
          .from('matchups')
          .select('roster_id, matchup_id, points, players_points, players, starters')
          .eq('season_id', selectedSeasonId!)
          .eq('week', selectedWeek)

        if (matchupsError) throw matchupsError

        // Fetch rosters for team names
        const { data: rosters, error: rostersError } = await supabase
          .from('rosters')
          .select('roster_id, team_name')

        if (rostersError) throw rostersError

        // Collect all unique player IDs
        const allPlayerIds = new Set<string>()
        matchupsData?.forEach((m) => {
          m.players?.forEach((id: string) => allPlayerIds.add(id))
        })

        // Fetch NFL player details (name and position)
        let nflPlayersMap = new Map<string, { full_name: string; position: string | null; team: string | null }>()
        if (allPlayerIds.size > 0) {
          const { data: nflPlayers } = await supabase
            .from('nfl_players')
            .select('player_id, full_name, position, team')
            .in('player_id', Array.from(allPlayerIds))

          if (nflPlayers) {
            nflPlayersMap = new Map(
              nflPlayers.map((p) => [p.player_id, { full_name: p.full_name, position: p.position, team: p.team }])
            )
          }

          // Fetch historical team data for point-in-time accuracy
          const seasonYear = seasons.find((s) => s.id === selectedSeasonId)?.season_year
          if (seasonYear) {
            const matchupDate = getApproximateWeekDate(seasonYear, selectedWeek)

            // Get all team history records for these players up to the matchup date
            // Type assertion needed until types are regenerated after migration
            const { data: teamHistory } = await (supabase
              .from('player_team_history' as 'nfl_players')
              .select('player_id, team, effective_date')
              .in('player_id', Array.from(allPlayerIds))
              .lte('effective_date', matchupDate)
              .order('effective_date', { ascending: false }) as unknown as Promise<{
                data: { player_id: string; team: string | null; effective_date: string }[] | null
              }>)

            if (teamHistory) {
              // Build a map of player_id -> most recent team (first record for each player due to DESC order)
              const historicalTeams = new Map<string, string | null>()
              for (const record of teamHistory) {
                if (!historicalTeams.has(record.player_id)) {
                  historicalTeams.set(record.player_id, record.team)
                }
              }

              // Override teams in nflPlayersMap with historical data
              for (const [playerId, historicalTeam] of historicalTeams) {
                const playerData = nflPlayersMap.get(playerId)
                if (playerData) {
                  nflPlayersMap.set(playerId, { ...playerData, team: historicalTeam })
                }
              }
            }
          }
        }

        // Build roster name lookup
        const rosterNames = new Map(
          rosters?.map((r) => [r.roster_id, r.team_name || `Team ${r.roster_id}`])
        )

        // Group matchups by matchup_id
        const matchupGroups = new Map<number, typeof matchupsData>()
        matchupsData?.forEach((m) => {
          if (!matchupGroups.has(m.matchup_id)) {
            matchupGroups.set(m.matchup_id, [])
          }
          matchupGroups.get(m.matchup_id)!.push(m)
        })

        // Build matchup pairs
        const pairs: MatchupPair[] = []
        matchupGroups.forEach((group, matchupId) => {
          if (group.length !== 2) return

          const [m1, m2] = group
          const points1 = m1.points ?? 0
          const points2 = m2.points ?? 0

          let winner: 'team1' | 'team2' | 'tie' | null = null
          if (points1 > 0 || points2 > 0) {
            if (points1 > points2) winner = 'team1'
            else if (points2 > points1) winner = 'team2'
            else winner = 'tie'
          }

          // Build player arrays for each team
          const buildPlayerArray = (
            players: string[] | null,
            starters: string[] | null,
            playersPoints: Record<string, number> | null
          ): PlayerPoints[] => {
            if (!players) return []
            const startersSet = new Set(starters || [])
            return players.map((playerId) => {
              // Defense IDs are team abbreviations (e.g., "SEA", "CHI")
              if (isDefenseId(playerId)) {
                return {
                  player_id: playerId,
                  full_name: playerId, // Use the team abbreviation as the name
                  position: 'DEF',
                  team: null,
                  points: playersPoints?.[playerId] ?? 0,
                  isStarter: startersSet.has(playerId),
                }
              }
              const playerInfo = nflPlayersMap.get(playerId)
              return {
                player_id: playerId,
                full_name: playerInfo?.full_name || `Player ${playerId}`,
                position: playerInfo?.position || null,
                team: playerInfo?.team || null,
                points: playersPoints?.[playerId] ?? 0,
                isStarter: startersSet.has(playerId),
              }
            })
          }

          pairs.push({
            matchup_id: matchupId,
            team1: {
              roster_id: m1.roster_id,
              team_name: rosterNames.get(m1.roster_id) || `Team ${m1.roster_id}`,
              points: points1,
              players: buildPlayerArray(m1.players, m1.starters, m1.players_points as Record<string, number> | null),
            },
            team2: {
              roster_id: m2.roster_id,
              team_name: rosterNames.get(m2.roster_id) || `Team ${m2.roster_id}`,
              points: points2,
              players: buildPlayerArray(m2.players, m2.starters, m2.players_points as Record<string, number> | null),
            },
            winner,
          })
        })

        // Sort by matchup_id for consistent ordering
        pairs.sort((a, b) => a.matchup_id - b.matchup_id)

        setMatchups(pairs)

        // Calculate game of the week (only for completed matchups with a winner)
        const completedPairs = pairs.filter((p) => p.winner !== null)
        const matchupPairData: MatchupPairData[] = completedPairs.map((p) => ({
          matchup_id: p.matchup_id,
          week: selectedWeek,
          season_id: selectedSeasonId!,
          season_year: seasons.find((s) => s.id === selectedSeasonId)?.season_year || 0,
          team1: p.team1,
          team2: p.team2,
          winner: p.winner as 'team1' | 'team2' | 'tie',
          margin: Math.abs(p.team1.points - p.team2.points),
        }))
        const gotw = findGameOfTheWeek(matchupPairData, selectedWeek)
        setGameOfTheWeek(gotw)
      } catch (err) {
        console.error(err)
        setError('Failed to load matchups')
      } finally {
        setLoading(false)
      }
    }

    fetchMatchups()
  }, [selectedSeasonId, selectedWeek, seasons])

  // Scroll to selected week when it changes
  useEffect(() => {
    const selectedButton = weekRefs.current.get(selectedWeek)
    if (selectedButton) {
      selectedButton.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [selectedWeek, maxWeek])

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId)

  // Generate week numbers for navigation
  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1)

  // Find GOTW matchup data for player breakdown
  const gotwMatchup = gameOfTheWeek
    ? matchups.find((m) => m.matchup_id === gameOfTheWeek.matchup.matchup_id)
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between animate-fade-up">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-2">
            Weekly Results
          </p>
          <h1 className="text-4xl md:text-5xl font-display tracking-wide text-foreground">
            MATCHUPS
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

      {/* Week Navigation */}
      <div className="animate-fade-up stagger-1">
        <Card className="border-border bg-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Previous Week Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
                disabled={selectedWeek <= 1}
                className="shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              {/* Week Pills */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-hide">
                <div className="flex gap-2 justify-start md:justify-center min-w-max px-2">
                  {weeks.map((week) => (
                    <button
                      key={week}
                      ref={(el) => {
                        if (el) weekRefs.current.set(week, el)
                      }}
                      onClick={() => setSelectedWeek(week)}
                      className={cn(
                        'relative px-4 py-2 rounded-lg font-display text-sm tracking-wide transition-all duration-200',
                        selectedWeek === week
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      {week}
                      {selectedWeek === week && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Next Week Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedWeek((w) => Math.min(maxWeek, w + 1))}
                disabled={selectedWeek >= maxWeek}
                className="shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Week Title */}
      <div className="flex items-center gap-3 animate-fade-up stagger-2">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="text-2xl font-display tracking-wide">
          WEEK {selectedWeek}
          {selectedSeason && (
            <span className="text-muted-foreground ml-2 text-lg">
              &middot; {selectedSeason.season_year}-{(selectedSeason.season_year + 1).toString().slice(-2)}
            </span>
          )}
        </h2>
      </div>

      {/* Game of the Week */}
      {!loading && !error && gameOfTheWeek && gotwMatchup && (
        <GameOfTheWeekCard
          gameOfTheWeek={gameOfTheWeek}
          matchupData={gotwMatchup}
          isExpanded={gotwExpanded}
          onToggle={() => setGotwExpanded(!gotwExpanded)}
        />
      )}

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
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-border bg-card animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-secondary/50 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Matchup Cards */}
      {!loading && !error && matchups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {matchups.map((matchup, index) => (
            <ExpandableMatchupCard
              key={matchup.matchup_id}
              matchup={matchup}
              isExpanded={expandedMatchups.has(matchup.matchup_id)}
              onToggle={() => toggleExpand(matchup.matchup_id)}
              className={cn('animate-fade-up', `stagger-${Math.min(index + 3, 10)}`)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && matchups.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <Swords className="w-12 h-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-medium text-foreground">No matchups found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  There are no matchups recorded for Week {selectedWeek}.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// =============================================================================
// EXPANDABLE MATCHUP CARD
// =============================================================================

interface ExpandableMatchupCardProps {
  matchup: MatchupPair
  isExpanded: boolean
  onToggle: () => void
  className?: string
}

function ExpandableMatchupCard({ matchup, isExpanded, onToggle, className }: ExpandableMatchupCardProps) {
  return (
    <Card className={cn('border-border bg-card overflow-hidden', className)}>
      <CardContent className="p-0">
        {/* Clickable Score Section */}
        <div
          className="relative cursor-pointer group"
          onClick={onToggle}
        >
          {/* VS Badge */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-12 h-12 rounded-full bg-secondary border-2 border-border/50 flex items-center justify-center">
              <Swords className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-2">
            {/* Team 1 */}
            <div
              className={cn(
                'relative p-6 transition-all duration-300',
                matchup.winner === 'team1' && 'bg-gradient-to-r from-primary/20 to-transparent'
              )}
            >
              {matchup.winner === 'team1' && (
                <div className="absolute top-3 left-3">
                  <Crown className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className="text-center space-y-2">
                <p
                  className={cn(
                    'font-semibold text-sm truncate',
                    matchup.winner === 'team1'
                      ? 'text-foreground'
                      : matchup.winner === 'team2'
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                  )}
                >
                  {matchup.team1.team_name}
                </p>
                <p
                  className={cn(
                    'font-display text-4xl tracking-wide tabular-nums',
                    matchup.winner === 'team1'
                      ? 'text-primary'
                      : matchup.winner === 'team2'
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                  )}
                >
                  {formatPoints(matchup.team1.points)}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30" />

            {/* Team 2 */}
            <div
              className={cn(
                'relative p-6 transition-all duration-300',
                matchup.winner === 'team2' && 'bg-gradient-to-l from-primary/20 to-transparent'
              )}
            >
              {matchup.winner === 'team2' && (
                <div className="absolute top-3 right-3">
                  <Crown className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className="text-center space-y-2">
                <p
                  className={cn(
                    'font-semibold text-sm truncate',
                    matchup.winner === 'team2'
                      ? 'text-foreground'
                      : matchup.winner === 'team1'
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                  )}
                >
                  {matchup.team2.team_name}
                </p>
                <p
                  className={cn(
                    'font-display text-4xl tracking-wide tabular-nums',
                    matchup.winner === 'team2'
                      ? 'text-primary'
                      : matchup.winner === 'team1'
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                  )}
                >
                  {formatPoints(matchup.team2.points)}
                </p>
              </div>
            </div>
          </div>

          {/* Expand Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center">
            <div className="p-1 rounded-full bg-secondary/50 group-hover:bg-secondary transition-colors">
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform duration-300',
                  isExpanded && 'rotate-180'
                )}
              />
            </div>
          </div>
        </div>

        {/* Expandable Player Breakdown */}
        <div
          className={cn(
            'grid transition-all duration-300 ease-out',
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <div className="overflow-hidden">
            <PlayerBreakdown team1={matchup.team1} team2={matchup.team2} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// PLAYER BREAKDOWN
// =============================================================================

interface PlayerBreakdownProps {
  team1: TeamMatchupData
  team2: TeamMatchupData
}

function PlayerBreakdown({ team1, team2 }: PlayerBreakdownProps) {
  const team1Starters = sortPlayersByPosition(team1.players.filter((p) => p.isStarter))
  const team1Bench = sortPlayersByPosition(team1.players.filter((p) => !p.isStarter))
  const team2Starters = sortPlayersByPosition(team2.players.filter((p) => p.isStarter))
  const team2Bench = sortPlayersByPosition(team2.players.filter((p) => !p.isStarter))

  return (
    <div className="border-t border-border/30 bg-secondary/20">
      <div className="grid grid-cols-2 divide-x divide-border/30">
        {/* Team 1 Players */}
        <div className="p-3 sm:p-4 space-y-3">
          {/* Starters */}
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              Starters
            </p>
            <div className="space-y-1">
              {team1Starters.map((player) => (
                <PlayerRow key={player.player_id} player={player} />
              ))}
            </div>
          </div>

          {/* Bench */}
          {team1Bench.length > 0 && (
            <div>
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Bench
              </p>
              <div className="space-y-1">
                {team1Bench.map((player) => (
                  <PlayerRow key={player.player_id} player={player} isBench />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Team 2 Players */}
        <div className="p-3 sm:p-4 space-y-3">
          {/* Starters */}
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              Starters
            </p>
            <div className="space-y-1">
              {team2Starters.map((player) => (
                <PlayerRow key={player.player_id} player={player} />
              ))}
            </div>
          </div>

          {/* Bench */}
          {team2Bench.length > 0 && (
            <div>
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Bench
              </p>
              <div className="space-y-1">
                {team2Bench.map((player) => (
                  <PlayerRow key={player.player_id} player={player} isBench />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// PLAYER ROW
// =============================================================================

interface PlayerRowProps {
  player: PlayerPoints
  isBench?: boolean
}

function PlayerRow({ player, isBench }: PlayerRowProps) {
  const positionColor = POSITION_COLORS[player.position || ''] || 'bg-secondary text-muted-foreground'

  return (
    <div className={cn('flex items-center gap-2 text-xs sm:text-sm', isBench && 'opacity-70')}>
      {/* Position Badge */}
      <span
        className={cn(
          'shrink-0 w-6 sm:w-8 text-center py-0.5 rounded text-[10px] sm:text-xs font-semibold',
          positionColor
        )}
      >
        {player.position || '?'}
      </span>

      {/* Player Name & Team */}
      <div className="flex-1 min-w-0">
        <span className="truncate block text-foreground">{player.full_name}</span>
        {player.team && (
          <span className="text-[10px] text-muted-foreground hidden sm:inline"> · {player.team}</span>
        )}
      </div>

      {/* Points */}
      <span className="shrink-0 font-display tabular-nums text-foreground">
        {formatPoints(player.points)}
      </span>
    </div>
  )
}

// =============================================================================
// GAME OF THE WEEK CARD
// =============================================================================

interface GameOfTheWeekCardProps {
  gameOfTheWeek: GameOfTheWeek
  matchupData: MatchupPair
  isExpanded: boolean
  onToggle: () => void
}

function GameOfTheWeekCard({ gameOfTheWeek, matchupData, isExpanded, onToggle }: GameOfTheWeekCardProps) {
  const { matchup, reason } = gameOfTheWeek

  const isTeam1Winner = matchup.winner === 'team1'
  const isTeam2Winner = matchup.winner === 'team2'
  const isTie = matchup.winner === 'tie'

  // Badge color based on reason
  const badgeStyles: Record<string, string> = {
    'Photo Finish': 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    'Nail-biter': 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
    Shootout: 'bg-gradient-to-r from-orange-500 to-red-500 text-white',
    'Classic Clash': 'bg-gradient-to-r from-primary to-accent text-white',
    'Statement Win': 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white',
  }

  return (
    <Card className="border-border bg-card overflow-hidden animate-fade-up stagger-3">
      <div className="relative">
        {/* Radial spotlight */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 rounded-full bg-gradient-radial from-white/5 to-transparent" />
        </div>

        <CardContent className="p-0">
          {/* Header badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-border/30 bg-secondary/20">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-accent" />
              <span className="font-display text-base sm:text-lg tracking-wide">GAME OF THE WEEK</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', badgeStyles[reason])}>
                {reason.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Clickable VS Layout */}
          <div className="cursor-pointer group" onClick={onToggle}>
            <div className="grid grid-cols-[1fr_auto_1fr] min-h-[160px] sm:min-h-[180px]">
              {/* Team 1 */}
              <div
                className={cn(
                  'relative p-4 sm:p-6 flex flex-col items-center justify-center transition-all duration-500',
                  isTeam1Winner && 'bg-gradient-to-br from-primary/20 via-primary/10 to-transparent'
                )}
              >
                {isTeam1Winner && (
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4">
                    <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                )}
                <div className="text-center space-y-2 sm:space-y-3">
                  <h3 className="text-sm sm:text-lg md:text-xl font-display tracking-wide text-foreground truncate max-w-[100px] sm:max-w-[180px]">
                    {matchup.team1.team_name}
                  </h3>
                  <p
                    className={cn(
                      'text-2xl sm:text-4xl md:text-5xl font-display tabular-nums transition-all',
                      isTeam1Winner
                        ? 'text-primary'
                        : isTie
                          ? 'text-accent'
                          : 'text-muted-foreground'
                    )}
                  >
                    {formatPulsePoints(matchup.team1.points)}
                  </p>
                </div>
              </div>

              {/* VS Badge */}
              <div className="relative flex flex-col items-center justify-center px-3 sm:px-6 border-x border-border/20">
                <div className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-primary via-white/50 to-accent" />
                <div className="relative z-10 w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-background border-2 border-border/50 flex items-center justify-center shadow-xl">
                  <Swords className="w-4 h-4 sm:w-6 sm:h-6 text-foreground" />
                </div>
                <div className="mt-2 sm:mt-3 text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Margin</p>
                  <p className="text-sm sm:text-lg font-display text-foreground tabular-nums">
                    {formatMargin(matchup.margin)}
                  </p>
                </div>
              </div>

              {/* Team 2 */}
              <div
                className={cn(
                  'relative p-4 sm:p-6 flex flex-col items-center justify-center transition-all duration-500',
                  isTeam2Winner && 'bg-gradient-to-bl from-accent/20 via-accent/10 to-transparent'
                )}
              >
                {isTeam2Winner && (
                  <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                    <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                  </div>
                )}
                <div className="text-center space-y-2 sm:space-y-3">
                  <h3 className="text-sm sm:text-lg md:text-xl font-display tracking-wide text-foreground truncate max-w-[100px] sm:max-w-[180px]">
                    {matchup.team2.team_name}
                  </h3>
                  <p
                    className={cn(
                      'text-2xl sm:text-4xl md:text-5xl font-display tabular-nums transition-all',
                      isTeam2Winner
                        ? 'text-accent'
                        : isTie
                          ? 'text-accent'
                          : 'text-muted-foreground'
                    )}
                  >
                    {formatPulsePoints(matchup.team2.points)}
                  </p>
                </div>
              </div>
            </div>

            {/* Expand Indicator */}
            <div className="flex items-center justify-center py-2 border-t border-border/20">
              <div className="p-1 rounded-full bg-secondary/50 group-hover:bg-secondary transition-colors">
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform duration-300',
                    isExpanded && 'rotate-180'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Expandable Player Breakdown */}
          <div
            className={cn(
              'grid transition-all duration-300 ease-out',
              isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            )}
          >
            <div className="overflow-hidden">
              <PlayerBreakdown team1={matchupData.team1} team2={matchupData.team2} />
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}
