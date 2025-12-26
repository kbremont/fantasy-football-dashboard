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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Activity,
  Flame,
  Target,
  Scale,
  Timer,
  TrendingUp,
  TrendingDown,
  Trophy,
  Zap,
  BarChart3,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calculateLeaguePulse,
  calculateLeagueRecords,
  buildMatchupPairs,
  formatPoints,
  formatMargin,
  getParityLabel,
  getMarginLabel,
  type MatchupData,
  type RosterData,
  type Season,
  type LeaguePulseData,
  type LeagueRecords,
  type WeeklyExtreme,
  type PlayoffStatus,
} from '@/lib/league-pulse'
import { ScoringDistributionChart } from '@/components/charts/ScoringDistributionChart'
import { WeeklyTrendChart } from '@/components/charts/WeeklyTrendChart'

export function LeaguePulse() {
  // Core state
  const [seasons, setSeasons] = useState<Season[]>([])
  const [rosters, setRosters] = useState<RosterData[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [recordsSeasonId, setRecordsSeasonId] = useState<number | 'all'>('all')

  // Data state
  const [pulseData, setPulseData] = useState<LeaguePulseData | null>(null)
  const [allMatchups, setAllMatchups] = useState<MatchupData[]>([])
  const [leagueRecords, setLeagueRecords] = useState<LeagueRecords | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Derived state
  const selectedSeason = useMemo(
    () => seasons.find((s) => s.id === selectedSeasonId),
    [seasons, selectedSeasonId]
  )

  const isCurrentSeason = selectedSeason?.is_current ?? false

  // Effect 1: Load seasons and rosters on mount
  useEffect(() => {
    async function fetchInitialData() {
      await authReady

      try {
        const [rostersRes, seasonsRes] = await Promise.all([
          supabase.from('rosters').select('roster_id, team_name'),
          supabase
            .from('seasons')
            .select('id, season_year, is_current')
            .order('season_year', { ascending: false }),
        ])

        if (rostersRes.error) throw rostersRes.error
        if (seasonsRes.error) throw seasonsRes.error

        setRosters(rostersRes.data || [])
        setSeasons(seasonsRes.data || [])

        // Auto-select current season
        const currentSeason =
          seasonsRes.data?.find((s) => s.is_current) || seasonsRes.data?.[0]
        if (currentSeason) {
          setSelectedSeasonId(currentSeason.id)
        }
      } catch (err) {
        console.error('Failed to load initial data:', err)
        setError('Failed to load league data')
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [])

  // Effect 2: Fetch matchup data when season changes
  useEffect(() => {
    if (!selectedSeasonId || rosters.length === 0 || seasons.length === 0) return

    async function fetchPulseData() {
      setLoading(true)
      setError(null)

      try {
        // Fetch all matchups for the selected season
        const { data: seasonMatchups, error: matchupsError } = await supabase
          .from('matchups')
          .select('roster_id, matchup_id, week, points, season_id')
          .eq('season_id', selectedSeasonId!)
          .order('week', { ascending: true })

        if (matchupsError) throw matchupsError

        // Also fetch all-time matchups for records (if not already loaded)
        const { data: allTimeMatchups, error: allTimeError } = await supabase
          .from('matchups')
          .select('roster_id, matchup_id, week, points, season_id')
          .order('week', { ascending: true })

        if (allTimeError) throw allTimeError

        setAllMatchups(allTimeMatchups as MatchupData[])

        // Calculate pulse data
        const pulse = calculateLeaguePulse(
          seasonMatchups as MatchupData[],
          rosters,
          seasons,
          selectedSeasonId!
        )

        setPulseData(pulse)
      } catch (err) {
        console.error('Failed to load pulse data:', err)
        setError('Failed to load league pulse data')
      } finally {
        setLoading(false)
      }
    }

    fetchPulseData()
  }, [selectedSeasonId, rosters, seasons])

  // Effect 3: Calculate league records when records season filter changes
  useEffect(() => {
    if (allMatchups.length === 0 || rosters.length === 0 || seasons.length === 0) return

    const matchupsToUse =
      recordsSeasonId === 'all'
        ? allMatchups
        : allMatchups.filter((m) => m.season_id === recordsSeasonId)

    const matchupPairs = buildMatchupPairs(matchupsToUse, rosters, seasons)
    const records = calculateLeagueRecords(matchupsToUse, matchupPairs, rosters, seasons)

    setLeagueRecords(records)
  }, [allMatchups, rosters, seasons, recordsSeasonId])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between animate-fade-up">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary uppercase tracking-wider">
                League Analytics
              </p>
              <h1 className="text-4xl md:text-5xl font-display tracking-wide text-foreground">
                LEAGUE PULSE
              </h1>
            </div>
          </div>
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
        <Card className="border-destructive/50 bg-destructive/10 animate-fade-up">
          <CardContent className="py-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="border-border bg-card animate-fade-up">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-primary/30 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-muted-foreground">Analyzing league pulse...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {!loading && !error && pulseData && (
        <>
          {/* Summary Stats Cards */}
          <SummaryStatsCards pulseData={pulseData} />

          {/* League Records */}
          <LeagueRecordsCard
            records={leagueRecords}
            seasons={seasons}
            selectedSeasonId={recordsSeasonId}
            onSeasonChange={setRecordsSeasonId}
          />

          {/* Weekly Trends Chart */}
          {pulseData.weeklyTrends.length > 1 && (
            <Card className="border-border bg-card overflow-hidden animate-fade-up stagger-3">
              <CardHeader className="border-b border-border/30 bg-secondary/20">
                <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  SCORING TRENDS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <WeeklyTrendChart trends={pulseData.weeklyTrends} />
              </CardContent>
            </Card>
          )}

          {/* Scoring Distribution */}
          {pulseData.scoringDistribution.length > 0 && (
            <Card className="border-border bg-card overflow-hidden animate-fade-up stagger-4">
              <CardHeader className="border-b border-border/30 bg-secondary/20">
                <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-accent" />
                  SCORING DISTRIBUTION
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ScoringDistributionChart distribution={pulseData.scoringDistribution} />
              </CardContent>
            </Card>
          )}

          {/* Playoff Race - Only show for current season with enough weeks */}
          {isCurrentSeason && pulseData.maxWeek >= 4 && pulseData.playoffRace.length > 0 && (
            <PlayoffRaceCard standings={pulseData.playoffRace} />
          )}

          {/* High/Low Scores Table - Moved to bottom */}
          {pulseData.weeklyExtremes.length > 0 && (
            <HighLowScoresTable extremes={pulseData.weeklyExtremes} />
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !error && !pulseData && (
        <Card className="border-border bg-card animate-fade-up">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-full bg-secondary/50">
                <Activity className="w-12 h-12 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">No data available</p>
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

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SummaryStatsCardsProps {
  pulseData: LeaguePulseData
}

function SummaryStatsCards({ pulseData }: SummaryStatsCardsProps) {
  const { seasonHighScore, parityMetrics } = pulseData

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up stagger-1">
      {/* Season High Score */}
      <Card className="border-border bg-card hover:border-border/80 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Flame className="w-5 h-5 text-primary" />
            </div>
            <Star className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Season High Score
          </p>
          <p className="font-display text-lg text-foreground truncate mb-1">
            {seasonHighScore?.team_name || '—'}
          </p>
          <p className="text-2xl font-display text-primary tabular-nums">
            {seasonHighScore ? formatPoints(seasonHighScore.points) : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {seasonHighScore ? `Week ${seasonHighScore.week}` : '—'}
          </p>
        </CardContent>
      </Card>

      {/* Average Margin */}
      <Card className="border-border bg-card hover:border-border/80 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Target className="w-5 h-5 text-accent" />
            </div>
            {parityMetrics.avgMargin < 20 ? (
              <TrendingDown className="w-4 h-4 text-accent/60" />
            ) : (
              <TrendingUp className="w-4 h-4 text-accent/60" />
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Avg Margin
          </p>
          <p className="text-2xl font-display text-accent tabular-nums">
            {parityMetrics.avgMargin.toFixed(1)} pts
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {getMarginLabel(parityMetrics.avgMargin)}
          </p>
        </CardContent>
      </Card>

      {/* Parity Index */}
      <Card className="border-border bg-card hover:border-border/80 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Scale className="w-5 h-5 text-blue-400" />
            </div>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Parity Index
          </p>
          <p className="text-2xl font-display text-blue-400 tabular-nums">
            {parityMetrics.parityIndex}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {getParityLabel(parityMetrics.parityIndex)}
          </p>
        </CardContent>
      </Card>

      {/* Close Games */}
      <Card className="border-border bg-card hover:border-border/80 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Timer className="w-5 h-5 text-purple-400" />
            </div>
            <Zap className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Close Games
          </p>
          <p className="text-2xl font-display text-purple-400 tabular-nums">
            {parityMetrics.closeGamePercentage}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            decided by &lt;10 pts
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

interface HighLowScoresTableProps {
  extremes: WeeklyExtreme[]
}

function HighLowScoresTable({ extremes }: HighLowScoresTableProps) {
  return (
    <Card className="border-border bg-card animate-fade-up stagger-7">
      <CardHeader className="border-b border-border/30 bg-secondary/20">
        <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary" />
          WEEKLY HIGH/LOW SCORES
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-20 text-center font-display text-xs tracking-wider text-muted-foreground">
                  WEEK
                </TableHead>
                <TableHead className="font-display text-xs tracking-wider text-primary">
                  HIGH SCORE
                </TableHead>
                <TableHead className="font-display text-xs tracking-wider text-destructive">
                  LOW SCORE
                </TableHead>
                <TableHead className="w-24 text-right font-display text-xs tracking-wider text-muted-foreground">
                  SPREAD
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extremes.map((extreme, index) => (
                <TableRow
                  key={extreme.week}
                  className={cn(
                    'border-border/20 transition-colors hover:bg-secondary/30',
                    `animate-fade-up stagger-${Math.min(index + 1, 10)}`
                  )}
                >
                  <TableCell className="text-center py-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary/50 font-display text-sm">
                      {extreme.week}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-primary to-primary/50" />
                      <div>
                        <p className="font-medium text-foreground">{extreme.high.team_name}</p>
                        <p className="text-lg font-display text-primary tabular-nums">
                          {formatPoints(extreme.high.points)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-destructive to-destructive/50" />
                      <div>
                        <p className="font-medium text-foreground">{extreme.low.team_name}</p>
                        <p className="text-lg font-display text-destructive tabular-nums">
                          {formatPoints(extreme.low.points)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <span className="text-lg font-display tabular-nums text-muted-foreground">
                      {formatMargin(extreme.spread)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

interface LeagueRecordsCardProps {
  records: LeagueRecords | null
  seasons: Season[]
  selectedSeasonId: number | 'all'
  onSeasonChange: (value: number | 'all') => void
}

// Helper to format season year as "2024-25" instead of "2024"
function formatSeasonYear(year: number): string {
  return `${year}-${(year + 1).toString().slice(-2)}`
}

function LeagueRecordsCard({
  records,
  seasons,
  selectedSeasonId,
  onSeasonChange,
}: LeagueRecordsCardProps) {
  return (
    <Card className="border-border bg-card animate-fade-up stagger-2">
      <CardHeader className="border-b border-border/30 bg-secondary/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
            <Trophy className="w-5 h-5 text-accent" />
            LEAGUE RECORDS
          </CardTitle>
          <div className="w-full sm:w-44">
            <Select
              value={selectedSeasonId.toString()}
              onValueChange={(value) =>
                onSeasonChange(value === 'all' ? 'all' : Number(value))
              }
            >
              <SelectTrigger className="bg-secondary/50 border-border/50 h-9 text-sm">
                <SelectValue placeholder="All-Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All-Time</SelectItem>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id.toString()}>
                    {season.season_year}-{(season.season_year + 1).toString().slice(-2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {!records ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading records...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Highest Score */}
            <RecordCard
              icon={<Flame className="w-5 h-5 text-primary" />}
              label="Highest Score"
              value={records.highestScore ? formatPoints(records.highestScore.value) : '—'}
              team={records.highestScore?.team_name || '—'}
              context={
                records.highestScore
                  ? `${formatSeasonYear(records.highestScore.season_year)} Week ${records.highestScore.week}`
                  : ''
              }
              color="primary"
            />

            {/* Lowest Score */}
            <RecordCard
              icon={<TrendingDown className="w-5 h-5 text-destructive" />}
              label="Lowest Score"
              value={records.lowestScore ? formatPoints(records.lowestScore.value) : '—'}
              team={records.lowestScore?.team_name || '—'}
              context={
                records.lowestScore
                  ? `${formatSeasonYear(records.lowestScore.season_year)} Week ${records.lowestScore.week}`
                  : ''
              }
              color="destructive"
            />

            {/* Lowest Winning Score */}
            <RecordCard
              icon={<TrendingDown className="w-5 h-5 text-accent" />}
              label="Lowest Winning Score"
              value={records.lowestWinningScore ? formatPoints(records.lowestWinningScore.value) : '—'}
              team={records.lowestWinningScore?.team_name || '—'}
              context={
                records.lowestWinningScore
                  ? `${formatSeasonYear(records.lowestWinningScore.season_year)} Week ${records.lowestWinningScore.week}`
                  : ''
              }
              color="accent"
            />

            {/* Biggest Blowout */}
            <RecordCard
              icon={<Zap className="w-5 h-5 text-orange-400" />}
              label="Biggest Blowout"
              value={records.biggestBlowout ? formatMargin(records.biggestBlowout.margin) : '—'}
              team={records.biggestBlowout?.winner || '—'}
              context={
                records.biggestBlowout
                  ? `vs ${records.biggestBlowout.loser} (${formatSeasonYear(records.biggestBlowout.season_year)} Wk ${records.biggestBlowout.week})`
                  : ''
              }
              color="orange"
            />

            {/* Closest Game */}
            <RecordCard
              icon={<Timer className="w-5 h-5 text-purple-400" />}
              label="Closest Game"
              value={records.closestGame ? `+${records.closestGame.margin.toFixed(2)}` : '—'}
              team={records.closestGame?.winner || '—'}
              context={
                records.closestGame
                  ? `vs ${records.closestGame.loser} (${formatSeasonYear(records.closestGame.season_year)} Wk ${records.closestGame.week})`
                  : ''
              }
              color="purple"
            />

            {/* Longest Win Streak */}
            <RecordCard
              icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
              label="Longest Win Streak"
              value={records.longestWinStreak ? `${records.longestWinStreak.streak} wins` : '—'}
              team={records.longestWinStreak?.team_name || '—'}
              context={records.longestWinStreak ? `${formatSeasonYear(records.longestWinStreak.season_year)} season` : ''}
              color="blue"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface RecordCardProps {
  icon: React.ReactNode
  label: string
  value: string
  team: string
  context: string
  color: 'primary' | 'accent' | 'destructive' | 'purple' | 'blue' | 'orange'
}

function RecordCard({ icon, label, value, team, context, color }: RecordCardProps) {
  const colorClasses = {
    primary: 'from-primary/10 border-primary/30 text-primary',
    accent: 'from-accent/10 border-accent/30 text-accent',
    destructive: 'from-destructive/10 border-destructive/30 text-destructive',
    purple: 'from-purple-500/10 border-purple-500/30 text-purple-400',
    blue: 'from-blue-500/10 border-blue-500/30 text-blue-400',
    orange: 'from-orange-500/10 border-orange-500/30 text-orange-400',
  }

  return (
    <div
      className={cn(
        'relative p-4 rounded-xl border bg-gradient-to-br to-card/50',
        colorClasses[color].split(' ').slice(0, 2).join(' ')
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-2 rounded-lg border',
            colorClasses[color].split(' ').slice(1).join(' ').replace('text-', 'bg-').replace(/\/\d+/, '/20')
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className={cn('text-2xl font-display tabular-nums', colorClasses[color].split(' ').pop())}>
            {value}
          </p>
          <p className="text-sm font-medium text-foreground truncate">{team}</p>
          {context && <p className="text-xs text-muted-foreground mt-0.5">{context}</p>}
        </div>
      </div>
    </div>
  )
}

interface PlayoffRaceCardProps {
  standings: PlayoffStatus[]
}

function PlayoffRaceCard({ standings }: PlayoffRaceCardProps) {
  const getStatusBadge = (status: PlayoffStatus['status']) => {
    switch (status) {
      case 'clinched':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
            CLINCHED
          </span>
        )
      case 'contending':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/30">
            CONTENDING
          </span>
        )
      case 'eliminated':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/20 text-destructive border border-destructive/30 line-through">
            ELIMINATED
          </span>
        )
      case 'in_hunt':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            IN THE HUNT
          </span>
        )
    }
  }

  return (
    <Card className="border-border bg-card animate-fade-up stagger-6">
      <CardHeader className="border-b border-border/30 bg-secondary/20">
        <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
          <Target className="w-5 h-5 text-primary" />
          PLAYOFF RACE
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-12 text-center font-display text-xs tracking-wider text-muted-foreground">
                  #
                </TableHead>
                <TableHead className="font-display text-xs tracking-wider text-muted-foreground">
                  TEAM
                </TableHead>
                <TableHead className="text-center font-display text-xs tracking-wider text-muted-foreground">
                  RECORD
                </TableHead>
                <TableHead className="text-center font-display text-xs tracking-wider text-muted-foreground">
                  PF
                </TableHead>
                <TableHead className="text-center font-display text-xs tracking-wider text-muted-foreground">
                  GB
                </TableHead>
                <TableHead className="text-right font-display text-xs tracking-wider text-muted-foreground">
                  STATUS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((team, index) => (
                <TableRow
                  key={team.roster_id}
                  className={cn(
                    'border-border/20 transition-colors',
                    index < 6 && 'bg-primary/5',
                    team.status === 'eliminated' && 'opacity-50'
                  )}
                >
                  <TableCell className="text-center py-3">
                    <span className="font-display text-sm">{index + 1}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={cn('font-medium', team.status === 'eliminated' && 'line-through')}>
                      {team.team_name}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <span className="font-display tabular-nums">
                      <span className="text-primary">{team.wins}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-destructive">{team.losses}</span>
                      {team.ties > 0 && (
                        <>
                          <span className="text-muted-foreground">-</span>
                          <span className="text-muted-foreground">{team.ties}</span>
                        </>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <span className="font-display tabular-nums text-muted-foreground">
                      {team.pointsFor.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <span className="font-display tabular-nums text-muted-foreground">
                      {team.gamesBack > 0 ? team.gamesBack : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-3">{getStatusBadge(team.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Playoff line indicator */}
        <div className="px-6 py-3 border-t border-border/30 bg-secondary/10">
          <p className="text-xs text-muted-foreground text-center">
            Top 6 teams make the playoffs
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
