import { useEffect, useState } from 'react'
import { supabase, authReady } from '@/lib/supabase'
import {
  calculatePowerRankings,
  getSummaryStats,
  type PowerRankingRow,
  type MatchupData,
  type RosterData,
} from '@/lib/power-rankings'
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
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Shield,
  Flame,
  Crown,
  Activity,
  BarChart3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { RankingTrendChart } from '@/components/charts/RankingTrendChart'
import { cn } from '@/lib/utils'

interface Season {
  id: number
  season_year: number
  is_current: boolean | null
}

type SortColumn =
  | 'power_rank'
  | 'team_name'
  | 'actual_wins'
  | 'expected_wins'
  | 'luck_index'
  | 'should_be_wins'
  | 'consistency_score'
  | 'strength_of_schedule'
  | 'avg_points'

type SortDirection = 'asc' | 'desc'

export function PowerRankings() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [rankings, setRankings] = useState<PowerRankingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('power_rank')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Fetch seasons on mount
  useEffect(() => {
    async function fetchSeasons() {
      await authReady

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

      const currentSeason = data?.find((s) => s.is_current) || data?.[0]
      if (currentSeason) {
        setSelectedSeasonId(currentSeason.id)
      }
    }

    fetchSeasons()
  }, [])

  // Fetch rankings when season changes
  useEffect(() => {
    if (!selectedSeasonId) return

    async function fetchRankings() {
      setLoading(true)
      setError(null)

      try {
        const { data: matchups, error: matchupsError } = await supabase
          .from('matchups')
          .select('roster_id, matchup_id, week, points')
          .eq('season_id', selectedSeasonId!)
          .order('week', { ascending: true })

        if (matchupsError) throw matchupsError

        const { data: rosters, error: rostersError } = await supabase
          .from('rosters')
          .select('roster_id, team_name')

        if (rostersError) throw rostersError

        const calculatedRankings = calculatePowerRankings(
          matchups as MatchupData[],
          rosters as RosterData[]
        )

        setRankings(calculatedRankings)
      } catch (err) {
        console.error(err)
        setError('Failed to load power rankings')
      } finally {
        setLoading(false)
      }
    }

    fetchRankings()
  }, [selectedSeasonId])

  const summaryStats = getSummaryStats(rankings)
  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId)

  // Sort rankings based on current sort column and direction
  const sortedRankings = [...rankings].sort((a, b) => {
    let aValue: number | string
    let bValue: number | string

    switch (sortColumn) {
      case 'power_rank':
        aValue = a.power_rank
        bValue = b.power_rank
        break
      case 'team_name':
        aValue = a.team_name.toLowerCase()
        bValue = b.team_name.toLowerCase()
        break
      case 'actual_wins':
        aValue = a.actual_wins
        bValue = b.actual_wins
        break
      case 'expected_wins':
        aValue = a.expected_wins
        bValue = b.expected_wins
        break
      case 'luck_index':
        aValue = a.luck_index
        bValue = b.luck_index
        break
      case 'should_be_wins':
        aValue = a.should_be_wins
        bValue = b.should_be_wins
        break
      case 'consistency_score':
        aValue = a.consistency_score
        bValue = b.consistency_score
        break
      case 'strength_of_schedule':
        aValue = a.strength_of_schedule
        bValue = b.strength_of_schedule
        break
      case 'avg_points':
        aValue = a.avg_points
        bValue = b.avg_points
        break
      default:
        aValue = a.power_rank
        bValue = b.power_rank
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    return sortDirection === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number)
  })

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column with smart default direction
      setSortColumn(column)
      // Most metrics should default to desc (higher is better), except:
      // - power_rank (lower is better)
      // - consistency_score (lower is better)
      // - team_name (alphabetical)
      const defaultDesc = !['power_rank', 'consistency_score', 'team_name'].includes(column)
      setSortDirection(defaultDesc ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-primary" />
    )
  }

  const getRankStyle = (rank: number) => {
    if (rank === 1)
      return 'bg-gradient-to-r from-yellow-500/20 via-yellow-500/10 to-transparent border-l-4 border-l-yellow-500'
    if (rank === 2)
      return 'bg-gradient-to-r from-slate-400/15 via-slate-400/5 to-transparent border-l-4 border-l-slate-400'
    if (rank === 3)
      return 'bg-gradient-to-r from-orange-600/15 via-orange-600/5 to-transparent border-l-4 border-l-orange-600'
    return ''
  }

  // Solid opaque backgrounds for sticky cells - prevents content bleeding through
  const getStickyCellBg = (rank: number) => {
    if (rank === 1) return 'bg-[hsl(45_30%_12%)]' // Solid gold-tinted dark
    if (rank === 2) return 'bg-[hsl(215_15%_14%)]' // Solid silver-tinted dark
    if (rank === 3) return 'bg-[hsl(25_25%_12%)]' // Solid bronze-tinted dark
    return 'bg-card'
  }

  const getRankBadge = (rank: number) => {
    const baseClasses =
      'w-10 h-10 rounded-lg flex items-center justify-center font-display text-xl font-bold'

    if (rank === 1) {
      return (
        <div className={cn(baseClasses, 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-950 shadow-lg shadow-yellow-500/30')}>
          <Crown className="w-5 h-5" />
        </div>
      )
    }
    if (rank === 2) {
      return (
        <div className={cn(baseClasses, 'bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 shadow-lg shadow-slate-400/20')}>
          {rank}
        </div>
      )
    }
    if (rank === 3) {
      return (
        <div className={cn(baseClasses, 'bg-gradient-to-br from-orange-500 to-orange-700 text-orange-100 shadow-lg shadow-orange-500/20')}>
          {rank}
        </div>
      )
    }
    return (
      <div className={cn(baseClasses, 'bg-secondary/80 text-muted-foreground border border-border/50')}>
        {rank}
      </div>
    )
  }

  const formatLuck = (luck: number) => {
    const formatted = luck.toFixed(1)
    return luck > 0 ? `+${formatted}` : formatted
  }

  const formatPoints = (points: number) => {
    return points.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between animate-fade-up">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary uppercase tracking-widest">
                Advanced Analytics
              </p>
              <h1 className="text-5xl md:text-6xl font-display tracking-wide text-gradient">
                POWER RANKINGS
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
              <div className="relative">
                <div className="w-12 h-12 border-2 border-primary/30 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-muted-foreground">Calculating power rankings...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {!loading && !error && rankings.length > 0 && (
        <>
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up stagger-1">
            {/* Luckiest Team */}
            <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-primary/10 via-card/80 to-card/50 backdrop-blur hover:border-primary/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-primary/60" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Luckiest Team
                </p>
                <p className="font-display text-lg text-foreground truncate mb-1">
                  {summaryStats.luckiest?.team_name || '—'}
                </p>
                <p className="text-2xl font-bold text-primary tabular-nums">
                  {summaryStats.luckiest ? formatLuck(summaryStats.luckiest.luck_index) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">wins above expected</p>
              </CardContent>
            </Card>

            {/* Unluckiest Team */}
            <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-destructive/10 via-card/80 to-card/50 backdrop-blur hover:border-destructive/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-destructive/20 border border-destructive/30">
                    <Flame className="w-5 h-5 text-destructive" />
                  </div>
                  <TrendingDown className="w-4 h-4 text-destructive/60" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Unluckiest Team
                </p>
                <p className="font-display text-lg text-foreground truncate mb-1">
                  {summaryStats.unluckiest?.team_name || '—'}
                </p>
                <p className="text-2xl font-bold text-destructive tabular-nums">
                  {summaryStats.unluckiest ? formatLuck(summaryStats.unluckiest.luck_index) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">wins below expected</p>
              </CardContent>
            </Card>

            {/* Most Consistent */}
            <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-accent/10 via-card/80 to-card/50 backdrop-blur hover:border-accent/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-accent/20 border border-accent/30">
                    <Target className="w-5 h-5 text-accent" />
                  </div>
                  <Activity className="w-4 h-4 text-accent/60" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Most Consistent
                </p>
                <p className="font-display text-lg text-foreground truncate mb-1">
                  {summaryStats.mostConsistent?.team_name || '—'}
                </p>
                <p className="text-2xl font-bold text-accent tabular-nums">
                  {summaryStats.mostConsistent?.consistency_score.toFixed(1) || '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">points std deviation</p>
              </CardContent>
            </Card>

            {/* Toughest Schedule */}
            <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-blue-500/10 via-card/80 to-card/50 backdrop-blur hover:border-blue-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <BarChart3 className="w-4 h-4 text-blue-400/60" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Toughest Schedule
                </p>
                <p className="font-display text-lg text-foreground truncate mb-1">
                  {summaryStats.toughestSchedule?.team_name || '—'}
                </p>
                <p className="text-2xl font-bold text-blue-400 tabular-nums">
                  {summaryStats.toughestSchedule?.strength_of_schedule.toFixed(1) || '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">avg opponent points</p>
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          {rankings[0]?.weekly_ranks?.length > 1 && (
            <Card className="border-border/30 bg-card/50 backdrop-blur overflow-hidden animate-fade-up stagger-2">
              <CardHeader className="border-b border-border/30 bg-secondary/20">
                <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                  <Activity className="w-5 h-5 text-primary" />
                  POWER RANKING TRENDS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <RankingTrendChart rankings={rankings} />
              </CardContent>
            </Card>
          )}

          {/* Power Rankings Table */}
          <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-3">
            <CardHeader className="border-b border-border/30 bg-secondary/20">
              <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                {selectedSeason
                  ? `${selectedSeason.season_year}-${(selectedSeason.season_year + 1).toString().slice(-2)} POWER RANKINGS`
                  : 'POWER RANKINGS'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead
                        className="w-16 text-center font-display text-xs tracking-wider text-muted-foreground sticky left-0 z-20 bg-card cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('power_rank')}
                      >
                        <span className="inline-flex items-center justify-center">
                          RANK
                          <SortIcon column="power_rank" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="font-display text-xs tracking-wider text-muted-foreground min-w-[140px] cursor-pointer hover:text-foreground transition-colors sticky left-14 z-10 bg-card shadow-[8px_0_12px_-4px_rgba(0,0,0,0.4)]"
                        onClick={() => handleSort('team_name')}
                      >
                        <span className="inline-flex items-center">
                          TEAM
                          <SortIcon column="team_name" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('actual_wins')}
                      >
                        <span className="inline-flex items-center justify-center">
                          RECORD
                          <SortIcon column="actual_wins" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('expected_wins')}
                      >
                        <span className="inline-flex items-center justify-center">
                          EXP W
                          <SortIcon column="expected_wins" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('luck_index')}
                      >
                        <span className="inline-flex items-center justify-center">
                          LUCK
                          <SortIcon column="luck_index" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('should_be_wins')}
                      >
                        <span className="inline-flex items-center justify-center">
                          VS MED
                          <SortIcon column="should_be_wins" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('consistency_score')}
                      >
                        <span className="inline-flex items-center justify-center">
                          CONS
                          <SortIcon column="consistency_score" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('strength_of_schedule')}
                      >
                        <span className="inline-flex items-center justify-center">
                          SOS
                          <SortIcon column="strength_of_schedule" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-right font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('avg_points')}
                      >
                        <span className="inline-flex items-center justify-end">
                          AVG PTS
                          <SortIcon column="avg_points" />
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRankings.map((team) => (
                      <TableRow
                        key={team.roster_id}
                        className={cn(
                          'border-border/20 transition-all duration-200',
                          getRankStyle(team.power_rank)
                        )}
                      >
                        <TableCell className={cn("text-center py-4 sticky left-0 z-20", getStickyCellBg(team.power_rank))}>
                          {getRankBadge(team.power_rank)}
                        </TableCell>
                        <TableCell className={cn("py-4 sticky left-14 z-10 shadow-[8px_0_12px_-4px_rgba(0,0,0,0.4)]", getStickyCellBg(team.power_rank))}>
                          <div className="space-y-0.5">
                            <span className={cn(
                              'font-semibold text-base block',
                              team.power_rank <= 3 && 'text-foreground'
                            )}>
                              {team.team_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Score: {(team.power_score * 100).toFixed(0)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-primary font-bold text-lg font-display">
                              {team.actual_wins}
                            </span>
                            <span className="text-muted-foreground">-</span>
                            <span className="text-destructive font-bold text-lg font-display">
                              {team.actual_losses}
                            </span>
                            {team.actual_ties > 0 && (
                              <>
                                <span className="text-muted-foreground">-</span>
                                <span className="text-muted-foreground font-bold text-lg font-display">
                                  {team.actual_ties}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <span className="tabular-nums text-muted-foreground">
                            {team.expected_wins.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <div
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold tabular-nums',
                              team.luck_index > 0.5 && 'bg-primary/20 text-primary',
                              team.luck_index < -0.5 && 'bg-destructive/20 text-destructive',
                              team.luck_index >= -0.5 && team.luck_index <= 0.5 && 'bg-secondary text-muted-foreground'
                            )}
                          >
                            {team.luck_index > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : team.luck_index < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}
                            {formatLuck(team.luck_index)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <span className="tabular-nums">
                            <span className="text-primary">{team.should_be_wins}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className="text-destructive">{team.should_be_losses}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <span className="tabular-nums text-muted-foreground">
                            {team.consistency_score.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <span className="tabular-nums text-muted-foreground">
                            {team.strength_of_schedule.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <span className="tabular-nums font-medium">
                            {formatPoints(team.avg_points)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* How Power Rankings Work */}
          <Card className="border-border/30 bg-card/50 backdrop-blur animate-fade-up stagger-4">
            <CardHeader className="border-b border-border/30 bg-secondary/20">
              <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                <Zap className="w-5 h-5 text-accent" />
                HOW POWER RANKINGS WORK
              </CardTitle>
            </CardHeader>
            <CardContent className="py-6">
              <div className="space-y-6">
                {/* Power Score Formula */}
                <div>
                  <h3 className="font-display text-base text-foreground mb-3">Power Score Formula</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Unlike standings which rank by wins, Power Rankings use a weighted composite score
                    that considers multiple factors to identify the truly best teams:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
                      <div className="text-2xl font-display text-primary">35%</div>
                      <div className="text-xs text-muted-foreground">Actual Record</div>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
                      <div className="text-2xl font-display text-primary">30%</div>
                      <div className="text-xs text-muted-foreground">Average Points</div>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
                      <div className="text-2xl font-display text-primary">20%</div>
                      <div className="text-xs text-muted-foreground">Expected Wins</div>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
                      <div className="text-2xl font-display text-primary">15%</div>
                      <div className="text-xs text-muted-foreground">Consistency</div>
                    </div>
                  </div>
                </div>

                {/* Metrics Explained */}
                <div>
                  <h3 className="font-display text-base text-foreground mb-3">Metrics Explained</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Target className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">Expected Wins (EXP W)</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Each week, we calculate how many teams you would have beaten based on your score.
                          Sum across all weeks for total expected wins.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">Luck Index (LUCK)</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Actual wins minus expected wins. Positive means lucky (winning more than points suggest),
                          negative means unlucky.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">vs Median (VS MED)</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Your record if you played the league median score each week. Shows how often
                          you're a top-half scorer.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">Consistency (CONS)</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Standard deviation of weekly scores. Lower = more reliable week-to-week.
                          High consistency teams are less likely to bust.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">Strength of Schedule (SOS)</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Average points scored by your actual opponents. Higher = you've faced tougher teams.
                          Helps contextualize your record.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">Why This Matters</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          A 7-4 team with high expected wins and tough schedule might be better than an
                          8-3 team who got lucky against weak opponents.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!loading && !error && rankings.length === 0 && (
        <Card className="border-border/30 bg-card/50 backdrop-blur">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-full bg-secondary/50">
                <BarChart3 className="w-12 h-12 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">No ranking data</p>
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
