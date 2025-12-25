import { useEffect, useState, useMemo } from 'react'
import { supabase, authReady } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Swords,
  Crown,
  Zap,
  Timer,
  Flame,
  ArrowRight,
  Shield,
  TrendingUp,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calculateRivalryStats,
  formatPoints,
  formatMargin,
  formatMatchupLabel,
  type RivalryStats,
  type RivalryMatchup,
  type RevengeGame,
} from '@/lib/rivalry-stats'
import { RivalryMomentumChart } from '@/components/charts/RivalryMomentumChart'

interface Season {
  id: number
  season_year: number
  is_current: boolean | null
}

interface Roster {
  roster_id: number
  team_name: string | null
}

export function Rivals() {
  // Core state
  const [seasons, setSeasons] = useState<Season[]>([])
  const [rosters, setRosters] = useState<Roster[]>([])
  const [selectedTeamA, setSelectedTeamA] = useState<number | null>(null)
  const [selectedTeamB, setSelectedTeamB] = useState<number | null>(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null) // null = All Time

  // Data state
  const [rivalryStats, setRivalryStats] = useState<RivalryStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)

  // Team names for display
  const teamAName = useMemo(
    () => rosters.find((r) => r.roster_id === selectedTeamA)?.team_name || 'Team A',
    [rosters, selectedTeamA]
  )
  const teamBName = useMemo(
    () => rosters.find((r) => r.roster_id === selectedTeamB)?.team_name || 'Team B',
    [rosters, selectedTeamB]
  )

  // Effect 1: Load rosters and seasons on mount
  useEffect(() => {
    async function fetchInitialData() {
      await authReady

      try {
        const [rostersRes, seasonsRes] = await Promise.all([
          supabase.from('rosters').select('roster_id, team_name').order('team_name'),
          supabase.from('seasons').select('id, season_year, is_current').order('season_year', { ascending: false }),
        ])

        if (rostersRes.error) throw rostersRes.error
        if (seasonsRes.error) throw seasonsRes.error

        setRosters(rostersRes.data || [])
        setSeasons(seasonsRes.data || [])
      } catch (err) {
        console.error('Failed to load initial data:', err)
        setError('Failed to load teams and seasons')
      } finally {
        setInitialLoading(false)
      }
    }

    fetchInitialData()
  }, [])

  // Effect 2: Fetch head-to-head matchups when both teams selected
  useEffect(() => {
    if (!selectedTeamA || !selectedTeamB) {
      setRivalryStats(null)
      return
    }

    if (selectedTeamA === selectedTeamB) {
      setError('Please select two different teams')
      setRivalryStats(null)
      return
    }

    // Capture non-null values for async closure
    const teamA = selectedTeamA
    const teamB = selectedTeamB

    async function fetchRivalryData() {
      setLoading(true)
      setError(null)

      try {
        // Build query
        let query = supabase
          .from('matchups')
          .select('season_id, week, matchup_id, roster_id, points')
          .in('roster_id', [teamA, teamB])

        // Apply season filter if not "All Time"
        if (selectedSeasonId !== null) {
          query = query.eq('season_id', selectedSeasonId)
        }

        const { data: matchups, error: matchupsError } = await query
          .order('season_id')
          .order('week')

        if (matchupsError) throw matchupsError

        // Calculate rivalry stats
        const stats = calculateRivalryStats(
          matchups || [],
          teamA,
          teamB,
          seasons
        )

        setRivalryStats(stats)
      } catch (err) {
        console.error('Failed to load rivalry data:', err)
        setError('Failed to load rivalry history')
      } finally {
        setLoading(false)
      }
    }

    fetchRivalryData()
  }, [selectedTeamA, selectedTeamB, selectedSeasonId, seasons])

  // Determine dominant team
  const dominantTeam = useMemo(() => {
    if (!rivalryStats) return null
    const { teamAWins, teamBWins } = rivalryStats.allTimeRecord
    if (teamAWins > teamBWins) return 'teamA'
    if (teamBWins > teamAWins) return 'teamB'
    return null
  }, [rivalryStats])

  // Season label for headers
  const seasonLabel = useMemo(() => {
    if (selectedSeasonId === null) return 'ALL-TIME'
    const season = seasons.find((s) => s.id === selectedSeasonId)
    if (!season) return 'ALL-TIME'
    return `${season.season_year}-${(season.season_year + 1).toString().slice(-2)}`
  }, [selectedSeasonId, seasons])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between animate-fade-up">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-widest mb-2">
            Head-to-Head History
          </p>
          <h1 className="text-5xl md:text-6xl font-display tracking-wide text-gradient">
            RIVALRY TRACKER
          </h1>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Team A Selector */}
          <div className="w-full sm:w-44">
            <Select
              value={selectedTeamA?.toString() ?? ''}
              onValueChange={(value) => setSelectedTeamA(Number(value))}
            >
              <SelectTrigger className="bg-primary/10 border-primary/30 h-11 hover:bg-primary/20 transition-colors">
                <SelectValue placeholder="Select Team A" />
              </SelectTrigger>
              <SelectContent>
                {rosters.map((roster) => (
                  <SelectItem
                    key={roster.roster_id}
                    value={roster.roster_id.toString()}
                    disabled={roster.roster_id === selectedTeamB}
                  >
                    {roster.team_name || `Team ${roster.roster_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* VS Badge */}
          <div className="hidden sm:flex items-center justify-center w-12">
            <div className="w-8 h-8 rounded-full bg-secondary/50 border border-border/50 flex items-center justify-center">
              <Swords className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Team B Selector */}
          <div className="w-full sm:w-44">
            <Select
              value={selectedTeamB?.toString() ?? ''}
              onValueChange={(value) => setSelectedTeamB(Number(value))}
            >
              <SelectTrigger className="bg-accent/10 border-accent/30 h-11 hover:bg-accent/20 transition-colors">
                <SelectValue placeholder="Select Team B" />
              </SelectTrigger>
              <SelectContent>
                {rosters.map((roster) => (
                  <SelectItem
                    key={roster.roster_id}
                    value={roster.roster_id.toString()}
                    disabled={roster.roster_id === selectedTeamA}
                  >
                    {roster.team_name || `Team ${roster.roster_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Season Filter */}
          <div className="w-full sm:w-40">
            <Select
              value={selectedSeasonId?.toString() ?? 'all'}
              onValueChange={(value) =>
                setSelectedSeasonId(value === 'all' ? null : Number(value))
              }
            >
              <SelectTrigger className="bg-secondary/50 border-border/50 h-11">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id.toString()}>
                    {season.season_year}-{(season.season_year + 1).toString().slice(-2)}
                    {season.is_current && ' (Current)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Initial Loading State */}
      {initialLoading && (
        <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-1">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading teams...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Teams Selected State */}
      {!initialLoading && (!selectedTeamA || !selectedTeamB) && (
        <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-1 overflow-hidden">
          <div className="relative">
            {/* Background gradient effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />

            <CardContent className="py-20 relative">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center">
                    <Swords className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                  {/* Subtle glow rings */}
                  <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
                </div>
                <div>
                  <p className="text-xl font-display tracking-wide text-foreground mb-2">
                    SELECT YOUR RIVALS
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Choose two teams above to view their complete head-to-head history,
                    including wins, scoring comparisons, biggest blowouts, and revenge games.
                  </p>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10 animate-fade-up stagger-1">
          <CardContent className="py-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading Rivalry Data */}
      {loading && selectedTeamA && selectedTeamB && (
        <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-1">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Analyzing rivalry history...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Rivalry Stats */}
      {!loading && !error && rivalryStats && (
        <>
          {/* Hero VS Section */}
          <HeroVSSection
            teamAName={teamAName}
            teamBName={teamBName}
            stats={rivalryStats}
            dominantTeam={dominantTeam}
            seasonLabel={seasonLabel}
          />

          {/* Tale of the Tape */}
          <TaleOfTheTape
            teamAName={teamAName}
            teamBName={teamBName}
            stats={rivalryStats}
          />

          {/* Momentum Chart */}
          {rivalryStats.matchupHistory.length > 1 && (
            <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-4 overflow-hidden">
              <CardHeader className="border-b border-border/30 bg-secondary/20">
                <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  BATTLE MOMENTUM
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <RivalryMomentumChart
                  matchups={rivalryStats.matchupHistory}
                  teamAName={teamAName}
                  teamBName={teamBName}
                />
              </CardContent>
            </Card>
          )}

          {/* Biggest Blowouts */}
          <BiggestBlowoutsCard
            teamAName={teamAName}
            teamBName={teamBName}
            blowouts={rivalryStats.biggestBlowouts}
          />

          {/* Closest Games */}
          {rivalryStats.closestGames.length > 0 && (
            <ClosestGamesCard
              teamAName={teamAName}
              teamBName={teamBName}
              games={rivalryStats.closestGames}
            />
          )}

          {/* Revenge Games */}
          {rivalryStats.revengeGames.length > 0 && (
            <RevengeGamesCard
              teamAName={teamAName}
              teamBName={teamBName}
              revengeGames={rivalryStats.revengeGames}
            />
          )}

          {/* No Matchups Found */}
          {rivalryStats.matchupHistory.length === 0 && (
            <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-2">
              <CardContent className="py-16">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Shield className="w-12 h-12 text-muted-foreground/50" />
                  <div>
                    <p className="text-lg font-medium text-foreground">No Battles Recorded</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      These teams haven't faced each other{' '}
                      {selectedSeasonId !== null ? 'this season' : 'in any recorded season'}.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface HeroVSSectionProps {
  teamAName: string
  teamBName: string
  stats: RivalryStats
  dominantTeam: 'teamA' | 'teamB' | null
  seasonLabel: string
}

function HeroVSSection({ teamAName, teamBName, stats, dominantTeam, seasonLabel }: HeroVSSectionProps) {
  const { teamAWins, teamBWins, ties, totalGames } = stats.allTimeRecord

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur overflow-hidden animate-fade-up stagger-2">
      <div className="relative">
        {/* Spotlight effect behind VS */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 rounded-full bg-gradient-radial from-white/5 to-transparent" />
        </div>

        <CardContent className="p-0">
          <div className="grid grid-cols-[1fr_auto_1fr] min-h-[280px]">
            {/* Team A Side */}
            <div
              className={cn(
                'relative p-8 flex flex-col items-center justify-center transition-all duration-500',
                'bg-gradient-to-br from-primary/15 via-primary/5 to-transparent',
                dominantTeam === 'teamA' && 'from-primary/25 via-primary/10'
              )}
            >
              {dominantTeam === 'teamA' && (
                <div className="absolute top-4 left-4 animate-pulse">
                  <Crown className="w-6 h-6 text-primary" />
                </div>
              )}
              <div className="text-center space-y-4">
                <p className="text-sm font-medium text-primary/70 uppercase tracking-widest">
                  {seasonLabel} RECORD
                </p>
                <h2 className="text-xl md:text-2xl font-display tracking-wide text-foreground truncate max-w-[200px]">
                  {teamAName}
                </h2>
                <p
                  className={cn(
                    'text-6xl md:text-7xl font-display tabular-nums transition-all',
                    dominantTeam === 'teamA' ? 'text-primary glow-primary-text' : 'text-foreground'
                  )}
                >
                  {teamAWins}
                </p>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">
                  {teamAWins === 1 ? 'WIN' : 'WINS'}
                </p>
              </div>
            </div>

            {/* Center VS Badge */}
            <div className="relative flex flex-col items-center justify-center px-6 border-x border-border/20">
              {/* Vertical gradient line */}
              <div className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-primary via-white/50 to-accent" />

              {/* VS Badge */}
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-full bg-background border-2 border-border/50 flex items-center justify-center shadow-xl">
                  <Swords className="w-7 h-7 text-foreground" />
                </div>
              </div>

              {/* Ties indicator */}
              {ties > 0 && (
                <div className="mt-4 px-3 py-1 rounded-full bg-secondary/50 border border-border/30">
                  <p className="text-xs text-muted-foreground font-medium">
                    {ties} {ties === 1 ? 'TIE' : 'TIES'}
                  </p>
                </div>
              )}

              {/* Total games */}
              <div className="mt-3">
                <p className="text-xs text-muted-foreground/60">
                  {totalGames} {totalGames === 1 ? 'game' : 'games'}
                </p>
              </div>
            </div>

            {/* Team B Side */}
            <div
              className={cn(
                'relative p-8 flex flex-col items-center justify-center transition-all duration-500',
                'bg-gradient-to-bl from-accent/15 via-accent/5 to-transparent',
                dominantTeam === 'teamB' && 'from-accent/25 via-accent/10'
              )}
            >
              {dominantTeam === 'teamB' && (
                <div className="absolute top-4 right-4 animate-pulse">
                  <Crown className="w-6 h-6 text-accent" />
                </div>
              )}
              <div className="text-center space-y-4">
                <p className="text-sm font-medium text-accent/70 uppercase tracking-widest">
                  {seasonLabel} RECORD
                </p>
                <h2 className="text-xl md:text-2xl font-display tracking-wide text-foreground truncate max-w-[200px]">
                  {teamBName}
                </h2>
                <p
                  className={cn(
                    'text-6xl md:text-7xl font-display tabular-nums transition-all',
                    dominantTeam === 'teamB' ? 'text-accent glow-gold-text' : 'text-foreground'
                  )}
                >
                  {teamBWins}
                </p>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">
                  {teamBWins === 1 ? 'WIN' : 'WINS'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

interface TaleOfTheTapeProps {
  teamAName: string
  teamBName: string
  stats: RivalryStats
}

function TaleOfTheTape({ teamAName, teamBName, stats }: TaleOfTheTapeProps) {
  const { scoringComparison, allTimeRecord, biggestBlowouts } = stats

  const comparisons = [
    {
      label: 'AVG POINTS',
      teamAValue: scoringComparison.teamAAvg,
      teamBValue: scoringComparison.teamBAvg,
      format: (v: number) => v.toFixed(1),
    },
    {
      label: 'TOTAL POINTS',
      teamAValue: scoringComparison.teamATotal,
      teamBValue: scoringComparison.teamBTotal,
      format: (v: number) => formatPoints(v),
    },
    {
      label: 'WIN %',
      teamAValue:
        allTimeRecord.totalGames > 0
          ? (allTimeRecord.teamAWins / allTimeRecord.totalGames) * 100
          : 0,
      teamBValue:
        allTimeRecord.totalGames > 0
          ? (allTimeRecord.teamBWins / allTimeRecord.totalGames) * 100
          : 0,
      format: (v: number) => `${v.toFixed(0)}%`,
    },
    {
      label: 'BEST WIN MARGIN',
      teamAValue: biggestBlowouts.teamA?.margin ?? 0,
      teamBValue: biggestBlowouts.teamB?.margin ?? 0,
      format: (v: number) => (v > 0 ? `+${v.toFixed(1)}` : '-'),
    },
  ]

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-3 overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-secondary/20">
        <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
          <Target className="w-5 h-5 text-primary" />
          TALE OF THE TAPE
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {/* Team Names Header */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mb-6">
          <p className="text-sm font-medium text-primary text-left truncate">{teamAName}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">VS</p>
          <p className="text-sm font-medium text-accent text-right truncate">{teamBName}</p>
        </div>

        {/* Comparison Bars */}
        <div className="space-y-5">
          {comparisons.map((comp) => {
            const total = comp.teamAValue + comp.teamBValue
            const teamAPercent = total > 0 ? (comp.teamAValue / total) * 100 : 50
            const teamBPercent = total > 0 ? (comp.teamBValue / total) * 100 : 50
            const teamAWinning = comp.teamAValue > comp.teamBValue
            const teamBWinning = comp.teamBValue > comp.teamAValue

            return (
              <div key={comp.label} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      teamAWinning ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {comp.format(comp.teamAValue)}
                  </span>
                  <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                    {comp.label}
                  </span>
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      teamBWinning ? 'text-accent' : 'text-muted-foreground'
                    )}
                  >
                    {comp.format(comp.teamBValue)}
                  </span>
                </div>
                <div className="relative h-2 bg-secondary/50 rounded-full overflow-hidden">
                  {/* Team A bar (from left) */}
                  <div
                    className={cn(
                      'absolute left-0 top-0 bottom-0 rounded-l-full transition-all duration-500',
                      teamAWinning ? 'bg-primary' : 'bg-primary/40'
                    )}
                    style={{ width: `${teamAPercent}%` }}
                  />
                  {/* Team B bar (from right) */}
                  <div
                    className={cn(
                      'absolute right-0 top-0 bottom-0 rounded-r-full transition-all duration-500',
                      teamBWinning ? 'bg-accent' : 'bg-accent/40'
                    )}
                    style={{ width: `${teamBPercent}%` }}
                  />
                  {/* Center divider */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-background/50" />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

interface BiggestBlowoutsCardProps {
  teamAName: string
  teamBName: string
  blowouts: RivalryStats['biggestBlowouts']
}

function BiggestBlowoutsCard({ teamAName, teamBName, blowouts }: BiggestBlowoutsCardProps) {
  if (!blowouts.teamA && !blowouts.teamB) return null

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-5 overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-secondary/20">
        <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
          <Zap className="w-5 h-5 text-destructive" />
          BIGGEST BLOWOUTS
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30">
          {/* Team A's Biggest Win */}
          <BlowoutPanel
            matchup={blowouts.teamA}
            teamName={teamAName}
            isOverallBiggest={blowouts.overall === blowouts.teamA}
            side="left"
          />

          {/* Team B's Biggest Win */}
          <BlowoutPanel
            matchup={blowouts.teamB}
            teamName={teamBName}
            isOverallBiggest={blowouts.overall === blowouts.teamB}
            side="right"
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface BlowoutPanelProps {
  matchup: RivalryMatchup | null
  teamName: string
  isOverallBiggest: boolean
  side: 'left' | 'right'
}

function BlowoutPanel({ matchup, teamName, isOverallBiggest, side }: BlowoutPanelProps) {
  if (!matchup) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[160px]">
        <p className="text-muted-foreground text-sm">No wins recorded</p>
      </div>
    )
  }

  const isTeamA = matchup.winner === 'teamA'
  const winnerPoints = isTeamA ? matchup.teamA_points : matchup.teamB_points
  const loserPoints = isTeamA ? matchup.teamB_points : matchup.teamA_points

  return (
    <div
      className={cn(
        'relative p-6 min-h-[160px]',
        side === 'left'
          ? 'bg-gradient-to-br from-primary/10 to-transparent'
          : 'bg-gradient-to-bl from-accent/10 to-transparent'
      )}
    >
      {/* Crown for overall biggest */}
      {isOverallBiggest && (
        <div className={cn('absolute top-4', side === 'left' ? 'left-4' : 'right-4')}>
          <Crown className="w-5 h-5 text-yellow-500" />
        </div>
      )}

      <div className="space-y-3">
        <p className={cn(
          'text-xs uppercase tracking-wider',
          side === 'left' ? 'text-primary/70' : 'text-accent/70'
        )}>
          {teamName}'s Biggest Win
        </p>

        {/* Margin with explosion effect */}
        <div className="relative inline-block">
          <p className={cn(
            'text-4xl font-display tabular-nums',
            side === 'left' ? 'text-primary' : 'text-accent'
          )}>
            {formatMargin(matchup.margin)}
          </p>
        </div>

        {/* Score */}
        <p className="text-lg font-medium tabular-nums">
          {formatPoints(winnerPoints)}{' '}
          <span className="text-muted-foreground">-</span>{' '}
          <span className="text-muted-foreground">{formatPoints(loserPoints)}</span>
        </p>

        {/* Context */}
        <p className="text-xs text-muted-foreground">
          {formatMatchupLabel(matchup.season_year, matchup.week)}
        </p>
      </div>
    </div>
  )
}

interface ClosestGamesCardProps {
  teamAName: string
  teamBName: string
  games: RivalryMatchup[]
}

function ClosestGamesCard({ teamAName, teamBName, games }: ClosestGamesCardProps) {
  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-6 overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-secondary/20">
        <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
          <Timer className="w-5 h-5 text-accent" />
          NAIL-BITERS
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/20">
          {games.map((game, index) => {
            const isTeamAWinner = game.winner === 'teamA'
            const winnerName = isTeamAWinner ? teamAName : teamBName
            const winnerPoints = isTeamAWinner ? game.teamA_points : game.teamB_points
            const loserPoints = isTeamAWinner ? game.teamB_points : game.teamA_points

            return (
              <div
                key={`${game.season_id}-${game.week}`}
                className="flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors"
              >
                {/* Rank */}
                <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                  <span className="text-sm font-display text-muted-foreground">
                    {index + 1}
                  </span>
                </div>

                {/* Game Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    <span className={isTeamAWinner ? 'text-primary' : 'text-accent'}>
                      {winnerName}
                    </span>{' '}
                    <span className="text-muted-foreground">defeats by</span>{' '}
                    <span className="text-foreground font-display tabular-nums">
                      {game.margin.toFixed(2)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatMatchupLabel(game.season_year, game.week)}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <p className="text-sm tabular-nums">
                    <span className={isTeamAWinner ? 'text-primary' : 'text-accent'}>
                      {formatPoints(winnerPoints)}
                    </span>
                    <span className="text-muted-foreground mx-1">-</span>
                    <span className="text-muted-foreground">{formatPoints(loserPoints)}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

interface RevengeGamesCardProps {
  teamAName: string
  teamBName: string
  revengeGames: RevengeGame[]
}

function RevengeGamesCard({ teamAName, teamBName, revengeGames }: RevengeGamesCardProps) {
  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-7 overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-secondary/20">
        <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
          <Flame className="w-5 h-5 text-orange-500" />
          SWEET REVENGE
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {revengeGames.map((revenge, index) => {
            const avengerName = revenge.avengedBy === 'teamA' ? teamAName : teamBName
            const isTeamA = revenge.avengedBy === 'teamA'

            return (
              <div key={index} className="relative">
                {/* Timeline connector */}
                {index < revengeGames.length - 1 && (
                  <div className="absolute left-6 top-full w-px h-6 bg-border/30" />
                )}

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center shrink-0',
                    isTeamA ? 'bg-primary/20' : 'bg-accent/20'
                  )}>
                    <Flame className={cn(
                      'w-6 h-6',
                      isTeamA ? 'text-primary' : 'text-accent'
                    )} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    {/* Original Loss */}
                    <div className="relative pl-4 border-l-2 border-destructive/30">
                      <div className="absolute left-0 top-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-destructive/50" />
                      <p className="text-sm">
                        <span className="text-muted-foreground line-through">
                          {avengerName} lost{' '}
                          {isTeamA
                            ? `${formatPoints(revenge.lossMatchup.teamA_points)} - ${formatPoints(revenge.lossMatchup.teamB_points)}`
                            : `${formatPoints(revenge.lossMatchup.teamB_points)} - ${formatPoints(revenge.lossMatchup.teamA_points)}`}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {formatMatchupLabel(revenge.lossMatchup.season_year, revenge.lossMatchup.week)}
                      </p>
                    </div>

                    {/* Arrow with weeks */}
                    <div className="flex items-center gap-2 pl-4">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
                        {revenge.weeksBetween} {revenge.weeksBetween === 1 ? 'week' : 'weeks'} later
                      </span>
                    </div>

                    {/* Revenge Win */}
                    <div className={cn(
                      'relative pl-4 border-l-2',
                      isTeamA ? 'border-primary/50' : 'border-accent/50'
                    )}>
                      <div className={cn(
                        'absolute left-0 top-1/2 -translate-x-1/2 w-2 h-2 rounded-full',
                        isTeamA ? 'bg-primary' : 'bg-accent'
                      )} />
                      <p className="text-sm">
                        <span className={isTeamA ? 'text-primary' : 'text-accent'}>
                          {avengerName} won{' '}
                          {isTeamA
                            ? `${formatPoints(revenge.revengeMatchup.teamA_points)} - ${formatPoints(revenge.revengeMatchup.teamB_points)}`
                            : `${formatPoints(revenge.revengeMatchup.teamB_points)} - ${formatPoints(revenge.revengeMatchup.teamA_points)}`}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {formatMatchupLabel(revenge.revengeMatchup.season_year, revenge.revengeMatchup.week)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
