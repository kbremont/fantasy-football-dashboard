import { useEffect, useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  ArrowRightLeft,
  FileText,
  User,
  Calendar,
  Clock,
  UserPlus,
  Shield,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type TransactionData,
  type RosterData,
  type PlayerData,
  type EnrichedTransaction,
  type ManagerActivity,
  type TransactionSummary,
  type PositionChurn,
  type TradeMatrixCell,
  enrichTransactions,
  extractPlayerIds,
  calculateManagerActivity,
  calculatePositionChurn,
  buildTradeMatrix,
  getSummaryStats,
  getTransactionTypeInfo,
} from '@/lib/transaction-utils'
import { TradeMatrixChart } from '@/components/charts/TradeMatrixChart'
import { PositionChurnChart } from '@/components/charts/PositionChurnChart'

interface Season {
  id: number
  season_year: number
  is_current: boolean | null
}

type SortColumn = 'team_name' | 'trades' | 'waivers' | 'free_agents' | 'total'
type SortDirection = 'asc' | 'desc'
type TransactionFilter = 'all' | 'trade' | 'waiver' | 'free_agent'

export function Transactions() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([])
  const [managerActivity, setManagerActivity] = useState<ManagerActivity[]>([])
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [positionChurn, setPositionChurn] = useState<PositionChurn[]>([])
  const [tradeMatrix, setTradeMatrix] = useState<TradeMatrixCell[]>([])
  const [rosters, setRosters] = useState<RosterData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sortColumn, setSortColumn] = useState<SortColumn>('total')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('all')
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())

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

  // Fetch transactions when season changes
  useEffect(() => {
    if (!selectedSeasonId) return

    async function fetchTransactions() {
      setLoading(true)
      setError(null)

      try {
        // Fetch transactions for the selected season
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .eq('season_id', selectedSeasonId!)
          .eq('status', 'complete')
          .order('week', { ascending: false })

        if (transactionsError) throw transactionsError

        // Fetch rosters
        const { data: rostersData, error: rostersError } = await supabase
          .from('rosters')
          .select('roster_id, team_name')

        if (rostersError) throw rostersError

        // Extract player IDs and fetch player data
        const rawTransactions = transactionsData as TransactionData[]
        const playerIds = extractPlayerIds(rawTransactions)

        let playersData: PlayerData[] = []
        if (playerIds.length > 0) {
          const { data: players, error: playersError } = await supabase
            .from('nfl_players')
            .select('player_id, full_name, position')
            .in('player_id', playerIds)

          if (playersError) throw playersError
          playersData = players || []
        }

        const rostersArray = rostersData as RosterData[]

        // Process data using utility functions
        const enrichedTransactions = enrichTransactions(rawTransactions, rostersArray, playersData)
        const activity = calculateManagerActivity(rawTransactions, rostersArray)
        const churn = calculatePositionChurn(rawTransactions, playersData)
        const stats = getSummaryStats(rawTransactions, rostersArray)
        const matrix = buildTradeMatrix(rawTransactions, rostersArray)

        setTransactions(enrichedTransactions)
        setManagerActivity(activity)
        setPositionChurn(churn)
        setSummary(stats)
        setTradeMatrix(matrix)
        setRosters(rostersArray)

        // Auto-expand the first two weeks with transactions
        const weeks = [...new Set(enrichedTransactions.map((t) => t.week))].sort((a, b) => b - a)
        setExpandedWeeks(new Set(weeks.slice(0, 2)))
      } catch (err) {
        console.error(err)
        setError('Failed to load transactions')
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [selectedSeasonId])

  // Sort manager activity
  const sortedActivity = [...managerActivity].sort((a, b) => {
    let aValue: number | string
    let bValue: number | string

    switch (sortColumn) {
      case 'team_name':
        aValue = a.team_name.toLowerCase()
        bValue = b.team_name.toLowerCase()
        break
      case 'trades':
        aValue = a.trades
        bValue = b.trades
        break
      case 'waivers':
        aValue = a.waivers
        bValue = b.waivers
        break
      case 'free_agents':
        aValue = a.free_agents
        bValue = b.free_agents
        break
      default:
        aValue = a.total
        bValue = b.total
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

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    if (transactionFilter === 'all') return true
    return t.type === transactionFilter
  })

  // Group transactions by week
  const transactionsByWeek = filteredTransactions.reduce((acc, t) => {
    if (!acc.has(t.week)) {
      acc.set(t.week, [])
    }
    acc.get(t.week)!.push(t)
    return acc
  }, new Map<number, EnrichedTransaction[]>())

  const sortedWeeks = Array.from(transactionsByWeek.keys()).sort((a, b) => b - a)

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection(column === 'team_name' ? 'asc' : 'desc')
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

  const toggleWeek = (week: number) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(week)) {
      newExpanded.delete(week)
    } else {
      newExpanded.add(week)
    }
    setExpandedWeeks(newExpanded)
  }

  const TransactionIcon = ({ type }: { type: EnrichedTransaction['type'] }) => {
    switch (type) {
      case 'trade':
        return <ArrowRightLeft className="w-4 h-4" />
      case 'waiver':
        return <Clock className="w-4 h-4" />
      case 'free_agent':
        return <UserPlus className="w-4 h-4" />
      case 'commissioner':
        return <Shield className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between animate-fade-up">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-accent/20 border border-purple-500/30">
              <ArrowRightLeft className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-400 uppercase tracking-widest">
                Activity Center
              </p>
              <h1 className="text-5xl md:text-6xl font-display tracking-wide text-gradient">
                TRANSACTION WAR ROOM
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
                <div className="w-12 h-12 border-2 border-purple-500/30 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {!loading && !error && summary && (
        <>
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up stagger-1">
            {/* Total Transactions */}
            <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-secondary/50 via-card/80 to-card/50 backdrop-blur hover:border-border/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-secondary/80 border border-border/30">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <Activity className="w-4 h-4 text-muted-foreground/60" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Total Transactions
                </p>
                <p className="text-3xl font-display text-foreground tabular-nums">
                  {summary.totalTransactions}
                </p>
                <p className="text-xs text-muted-foreground mt-1">this season</p>
              </CardContent>
            </Card>

            {/* Total Trades */}
            <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-purple-500/10 via-card/80 to-card/50 backdrop-blur hover:border-purple-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                    <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-purple-400/60" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Total Trades
                </p>
                <p className="text-3xl font-display text-purple-400 tabular-nums">
                  {summary.totalTrades}
                </p>
                <p className="text-xs text-muted-foreground mt-1">deals made</p>
              </CardContent>
            </Card>

            {/* Most Active Manager */}
            <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-primary/10 via-card/80 to-card/50 backdrop-blur hover:border-primary/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <Sparkles className="w-4 h-4 text-primary/60" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Most Active
                </p>
                <p className="font-display text-lg text-foreground truncate mb-0.5">
                  {summary.mostActiveManager?.team_name || '—'}
                </p>
                <p className="text-2xl font-bold text-primary tabular-nums">
                  {summary.mostActiveManager?.count || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">moves made</p>
              </CardContent>
            </Card>

            {/* Busiest Week */}
            <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-accent/10 via-card/80 to-card/50 backdrop-blur hover:border-accent/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-accent/20 border border-accent/30">
                    <Calendar className="w-5 h-5 text-accent" />
                  </div>
                  <BarChart3 className="w-4 h-4 text-accent/60" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Busiest Week
                </p>
                <p className="text-3xl font-display text-accent tabular-nums">
                  {summary.busiestWeek ? `Week ${summary.busiestWeek.week}` : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.busiestWeek?.count || 0} transactions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabbed Content */}
          <Tabs defaultValue="overview" className="animate-fade-up stagger-2">
            <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex gap-1 bg-secondary/50 p-1.5 rounded-xl border border-border/30">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/30 border border-transparent rounded-lg px-4 py-2 font-medium transition-all"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="timeline"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/30 border border-transparent rounded-lg px-4 py-2 font-medium transition-all"
              >
                Timeline
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/30 border border-transparent rounded-lg px-4 py-2 font-medium transition-all"
              >
                Analysis
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              {/* Trade Matrix */}
              <Card className="border-border/30 bg-card/50 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-border/30 bg-secondary/20">
                  <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                    <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                    TRADE NETWORK
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {tradeMatrix.length > 0 ? (
                    <TradeMatrixChart tradeMatrix={tradeMatrix} rosters={rosters} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ArrowRightLeft className="w-12 h-12 text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No trades this season</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Manager Activity Leaderboard */}
              <Card className="border-border/30 bg-card/50 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-border/30 bg-secondary/20">
                  <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    MANAGER ACTIVITY LEADERBOARD
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/30 hover:bg-transparent">
                          <TableHead className="w-16 text-center font-display text-xs tracking-wider text-muted-foreground">
                            RANK
                          </TableHead>
                          <TableHead
                            className="font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleSort('team_name')}
                          >
                            <span className="inline-flex items-center">
                              TEAM
                              <SortIcon column="team_name" />
                            </span>
                          </TableHead>
                          <TableHead
                            className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleSort('trades')}
                          >
                            <span className="inline-flex items-center justify-center text-purple-400">
                              TRADES
                              <SortIcon column="trades" />
                            </span>
                          </TableHead>
                          <TableHead
                            className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                            onClick={() => handleSort('waivers')}
                          >
                            <span className="inline-flex items-center justify-center text-blue-400">
                              WAIVERS
                              <SortIcon column="waivers" />
                            </span>
                          </TableHead>
                          <TableHead
                            className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                            onClick={() => handleSort('free_agents')}
                          >
                            <span className="inline-flex items-center justify-center text-primary">
                              FA
                              <SortIcon column="free_agents" />
                            </span>
                          </TableHead>
                          <TableHead
                            className="text-center font-display text-xs tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleSort('total')}
                          >
                            <span className="inline-flex items-center justify-center">
                              TOTAL
                              <SortIcon column="total" />
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedActivity.map((manager, index) => (
                          <TableRow
                            key={manager.roster_id}
                            className={cn(
                              'border-border/20 transition-all duration-200',
                              index === 0 && 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-l-4 border-l-primary'
                            )}
                          >
                            <TableCell className="text-center py-4">
                              <div className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center font-display text-lg font-bold mx-auto',
                                index === 0 ? 'bg-gradient-to-br from-primary to-primary/60 text-primary-foreground' :
                                index === 1 ? 'bg-gradient-to-br from-secondary to-secondary/60 text-foreground' :
                                index === 2 ? 'bg-gradient-to-br from-accent/50 to-accent/30 text-accent-foreground' :
                                'bg-secondary/50 text-muted-foreground'
                              )}>
                                {index + 1}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 font-semibold">
                              {manager.team_name}
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 font-bold tabular-nums">
                                {manager.trades}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-4 hidden sm:table-cell">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 font-bold tabular-nums">
                                {manager.waivers}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-4 hidden sm:table-cell">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary font-bold tabular-nums">
                                {manager.free_agents}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <span className="font-display text-xl font-bold tabular-nums">
                                {manager.total}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="mt-6 space-y-6">
              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'All', color: 'text-foreground' },
                  { value: 'trade', label: 'Trades', color: 'text-purple-400' },
                  { value: 'waiver', label: 'Waivers', color: 'text-blue-400' },
                  { value: 'free_agent', label: 'Free Agents', color: 'text-primary' },
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant={transactionFilter === filter.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTransactionFilter(filter.value as TransactionFilter)}
                    className={cn(
                      'rounded-full px-4 transition-all',
                      transactionFilter === filter.value
                        ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30'
                        : 'border-border/50 hover:border-border'
                    )}
                  >
                    <span className={filter.color}>{filter.label}</span>
                  </Button>
                ))}
              </div>

              {/* Empty State for Timeline */}
              {sortedWeeks.length === 0 && (
                <Card className="border-border/30 bg-card/50 backdrop-blur">
                  <CardContent className="py-16">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="p-4 rounded-full bg-secondary/50">
                        <ArrowRightLeft className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-foreground">No transactions found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {transactionFilter !== 'all'
                            ? `No ${transactionFilter.replace('_', ' ')} transactions this season.`
                            : 'There are no transactions recorded for this season yet.'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timeline by Week */}
              <div className="space-y-4">
                {sortedWeeks.map((week) => (
                  <Card
                    key={week}
                    className="border-border/30 bg-card/50 backdrop-blur overflow-hidden"
                  >
                    <button
                      onClick={() => toggleWeek(week)}
                      className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary/80 border border-border/30">
                          <span className="font-display text-lg text-foreground">{week}</span>
                        </div>
                        <div className="text-left">
                          <p className="font-display text-sm text-muted-foreground tracking-wider">WEEK</p>
                          <p className="font-semibold text-foreground">
                            {transactionsByWeek.get(week)?.length || 0} transactions
                          </p>
                        </div>
                      </div>
                      {expandedWeeks.has(week) ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>

                    {expandedWeeks.has(week) && (
                      <div className="border-t border-border/30 divide-y divide-border/20">
                        {transactionsByWeek.get(week)?.map((transaction) => {
                          const typeInfo = getTransactionTypeInfo(transaction.type)
                          return (
                            <div
                              key={transaction.id}
                              className="p-4 hover:bg-secondary/10 transition-colors"
                            >
                              <div className="flex items-start gap-4">
                                {/* Type Badge */}
                                <div className={cn(
                                  'flex items-center justify-center w-10 h-10 rounded-lg',
                                  typeInfo.bgColor
                                )}>
                                  <TransactionIcon type={transaction.type} />
                                </div>

                                {/* Transaction Details */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={cn(
                                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                      typeInfo.bgColor,
                                      typeInfo.color
                                    )}>
                                      {typeInfo.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {transaction.involved_teams.map((t) => t.team_name).join(' ↔ ')}
                                    </span>
                                  </div>

                                  {/* Players Added */}
                                  {transaction.added_players.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <TrendingUp className="w-3 h-3 text-primary" />
                                      {transaction.added_players.map((player, i) => (
                                        <span
                                          key={player.player_id}
                                          className="inline-flex items-center gap-1 text-sm"
                                        >
                                          <span className="font-medium text-foreground">{player.name}</span>
                                          <span className="text-xs text-muted-foreground">({player.position})</span>
                                          <span className="text-xs text-primary">→ {player.to_team}</span>
                                          {i < transaction.added_players.length - 1 && (
                                            <span className="text-muted-foreground">,</span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Players Dropped */}
                                  {transaction.dropped_players.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <TrendingDown className="w-3 h-3 text-destructive" />
                                      {transaction.dropped_players.map((player, i) => (
                                        <span
                                          key={player.player_id}
                                          className="inline-flex items-center gap-1 text-sm"
                                        >
                                          <span className="font-medium text-foreground/70">{player.name}</span>
                                          <span className="text-xs text-muted-foreground">({player.position})</span>
                                          <span className="text-xs text-destructive">dropped</span>
                                          {i < transaction.dropped_players.length - 1 && (
                                            <span className="text-muted-foreground">,</span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Analysis Tab */}
            <TabsContent value="analysis" className="mt-6 space-y-6">
              {/* Position Churn Chart */}
              <Card className="border-border/30 bg-card/50 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-border/30 bg-secondary/20">
                  <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    POSITION CHURN
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <PositionChurnChart data={positionChurn} />
                </CardContent>
              </Card>

              {/* Trade Grades Placeholder */}
              <Card className="border-border/30 bg-card/50 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-border/30 bg-secondary/20">
                  <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-accent" />
                    TRADE GRADES
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium">
                      Coming Soon
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-accent" />
                    </div>
                    <h3 className="font-display text-xl text-foreground mb-2">
                      Trade Analysis Coming Soon
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      We're working on a feature to analyze trade outcomes based on team performance
                      before and after trades. Stay tuned!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Empty State */}
      {!loading && !error && transactions.length === 0 && (
        <Card className="border-border/30 bg-card/50 backdrop-blur">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-full bg-secondary/50">
                <ArrowRightLeft className="w-12 h-12 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">No transactions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  There are no transactions recorded for this season yet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
