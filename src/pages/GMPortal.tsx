import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Users,
  Trophy,
  ArrowRightLeft,
  Star,
  ChevronRight,
  Clock,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calculateTradeGrade,
  calculateKeeperSuccess,
  calculateLeagueAverageKeeperPoints,
  getDisplayRound,
  formatGMPoints,
  formatDifferential,
  type TradeGrade,
  type Transaction,
  type PlayerWeeklyPoints,
} from '@/lib/gm-stats'

// Types
interface Season {
  id: number
  season_year: number
  is_current: boolean | null
}

interface Roster {
  roster_id: number
  team_name: string | null
}

interface DraftPick {
  player_id: string
  roster_id: number
  round: number
  is_keeper: boolean | null
  draft_id: string
}

interface MatchupRecord {
  roster_id: number
  points: number | null
  matchup_id: number
}

interface KeeperDisplay {
  playerId: string
  playerName: string
  position: string | null
  totalPoints: number
  isTopPerformer: boolean
}

interface TradeDisplay {
  transactionId: string
  week: number
  seasonYear: number
  createdAt: number
  grade: TradeGrade
  tradePartnerName: string
}

export function GMPortal() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Core state
  const [seasons, setSeasons] = useState<Season[]>([])
  const [rosters, setRosters] = useState<Roster[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null)

  // Data state
  const [managerRecords, setManagerRecords] = useState<Map<number, { wins: number; losses: number; ties: number }>>(new Map())
  const [tradeCountsByRoster, setTradeCountsByRoster] = useState<Map<number, number>>(new Map())
  const [keeperSuccessRates, setKeeperSuccessRates] = useState<Map<number, number>>(new Map())
  const [keepersByRosterAndYear, setKeepersByRosterAndYear] = useState<Map<string, KeeperDisplay[]>>(new Map())
  const [tradesByRoster, setTradesByRoster] = useState<Map<number, TradeDisplay[]>>(new Map())
  const [playerNames, setPlayerNames] = useState<Map<string, string>>(new Map())
  const [playerPositions, setPlayerPositions] = useState<Map<string, string | null>>(new Map())
  const [currentWeek, setCurrentWeek] = useState<number>(17)

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read manager from URL on load
  useEffect(() => {
    const managerParam = searchParams.get('manager')
    if (managerParam) {
      setSelectedRosterId(Number(managerParam))
    }
  }, [searchParams])

  // Update URL when manager changes
  useEffect(() => {
    if (selectedRosterId !== null) {
      setSearchParams({ manager: selectedRosterId.toString() })
    }
  }, [selectedRosterId, setSearchParams])

  // Effect 1: Load initial data (seasons, rosters)
  useEffect(() => {
    async function fetchInitialData() {
      await authReady

      try {
        const [seasonsRes, rostersRes] = await Promise.all([
          supabase
            .from('seasons')
            .select('id, season_year, is_current')
            .order('season_year', { ascending: false }),
          supabase.from('rosters').select('roster_id, team_name').order('team_name'),
        ])

        if (seasonsRes.error) throw seasonsRes.error
        if (rostersRes.error) throw rostersRes.error

        setSeasons(seasonsRes.data || [])
        setRosters(rostersRes.data || [])

        // Default to current season
        const currentSeason = seasonsRes.data?.find((s) => s.is_current) || seasonsRes.data?.[0]
        if (currentSeason) {
          setSelectedSeasonId(currentSeason.id)
        }
      } catch (err) {
        console.error('Failed to load initial data:', err)
        setError('Failed to load teams and seasons')
      } finally {
        setInitialLoading(false)
      }
    }

    fetchInitialData()
  }, [])

  // Effect 2: Load manager summary data when season changes
  useEffect(() => {
    if (!selectedSeasonId || rosters.length === 0) return

    async function fetchManagerSummaries() {
      try {
        // Fetch matchups for W-L records
        const { data: matchups, error: matchupsError } = await supabase
          .from('matchups')
          .select('roster_id, points, matchup_id, week')
          .eq('season_id', selectedSeasonId!)

        if (matchupsError) throw matchupsError

        // Calculate W-L records
        const records = new Map<number, { wins: number; losses: number; ties: number }>()
        rosters.forEach((r) => {
          records.set(r.roster_id, { wins: 0, losses: 0, ties: 0 })
        })

        // Group by week and matchup_id
        const weeklyMatchups = new Map<string, MatchupRecord[]>()
        matchups?.forEach((m) => {
          const key = `${m.week}-${m.matchup_id}`
          if (!weeklyMatchups.has(key)) {
            weeklyMatchups.set(key, [])
          }
          weeklyMatchups.get(key)!.push(m)
        })

        // Track max week for currentWeek
        let maxWeek = 0
        matchups?.forEach((m) => {
          if (m.week > maxWeek) maxWeek = m.week
        })
        setCurrentWeek(maxWeek)

        // Process each matchup
        weeklyMatchups.forEach((matchup) => {
          if (matchup.length !== 2) return
          const [team1, team2] = matchup
          const points1 = team1.points ?? 0
          const points2 = team2.points ?? 0

          const record1 = records.get(team1.roster_id)
          const record2 = records.get(team2.roster_id)

          if (!record1 || !record2) return

          if (points1 > points2) {
            record1.wins++
            record2.losses++
          } else if (points2 > points1) {
            record2.wins++
            record1.losses++
          } else {
            record1.ties++
            record2.ties++
          }
        })

        setManagerRecords(records)

        // Fetch trade counts
        const { data: trades, error: tradesError } = await supabase
          .from('transactions')
          .select('roster_ids')
          .eq('season_id', selectedSeasonId!)
          .eq('type', 'trade')
          .eq('status', 'complete')

        if (tradesError) throw tradesError

        const tradeCounts = new Map<number, number>()
        rosters.forEach((r) => tradeCounts.set(r.roster_id, 0))

        trades?.forEach((t) => {
          t.roster_ids?.forEach((rid) => {
            tradeCounts.set(rid, (tradeCounts.get(rid) ?? 0) + 1)
          })
        })

        setTradeCountsByRoster(tradeCounts)

        // Fetch keepers for this season and calculate success rates
        const { data: drafts, error: draftsError } = await supabase
          .from('drafts')
          .select('draft_id, season_id')
          .eq('season_id', selectedSeasonId!)

        if (draftsError) throw draftsError

        if (drafts && drafts.length > 0) {
          const draftIds = drafts.map((d) => d.draft_id)

          const { data: draftPicks, error: picksError } = await supabase
            .from('draft_picks')
            .select('player_id, roster_id, round, is_keeper, draft_id')
            .in('draft_id', draftIds)
            .eq('is_keeper', true)

          if (picksError) throw picksError

          // Get player points for this season
          const { data: playerPoints, error: pointsError } = await supabase
            .from('player_weekly_points')
            .select('player_id, points')
            .eq('season_id', selectedSeasonId!)

          if (pointsError) throw pointsError

          // Aggregate points by player
          const playerTotalPoints = new Map<string, number>()
          playerPoints?.forEach((pp) => {
            const current = playerTotalPoints.get(pp.player_id) ?? 0
            playerTotalPoints.set(pp.player_id, current + (pp.points ?? 0))
          })

          // Group keepers by roster
          const keepersByRoster = new Map<number, { playerId: string; totalPoints: number }[]>()
          draftPicks?.forEach((pick) => {
            if (!keepersByRoster.has(pick.roster_id)) {
              keepersByRoster.set(pick.roster_id, [])
            }
            keepersByRoster.get(pick.roster_id)!.push({
              playerId: pick.player_id,
              totalPoints: playerTotalPoints.get(pick.player_id) ?? 0,
            })
          })

          // Calculate league average
          const allKeepers: { playerId: string; totalPoints: number }[] = []
          keepersByRoster.forEach((keepers) => {
            allKeepers.push(...keepers)
          })
          const leagueAvg = calculateLeagueAverageKeeperPoints(allKeepers)

          // Calculate success rates
          const successRates = new Map<number, number>()
          keepersByRoster.forEach((keepers, rosterId) => {
            successRates.set(rosterId, calculateKeeperSuccess(keepers, leagueAvg))
          })

          setKeeperSuccessRates(successRates)
        }
      } catch (err) {
        console.error('Failed to load manager summaries:', err)
      }
    }

    fetchManagerSummaries()
  }, [selectedSeasonId, rosters])

  // Effect 3: Load detailed data when a manager is selected
  useEffect(() => {
    if (!selectedRosterId || seasons.length === 0) return

    async function fetchManagerDetails() {
      setDetailLoading(true)

      try {
        // Get all season IDs for historical data
        const seasonIds = seasons.map((s) => s.id)
        const seasonYearMap = new Map(seasons.map((s) => [s.id, s.season_year]))

        // Fetch all drafts
        const { data: drafts, error: draftsError } = await supabase
          .from('drafts')
          .select('draft_id, season_id')
          .in('season_id', seasonIds)

        if (draftsError) throw draftsError

        // Fetch keeper picks for this roster across all seasons
        const draftIds = drafts?.map((d) => d.draft_id) ?? []
        let keeperPicks: DraftPick[] = []

        if (draftIds.length > 0 && selectedRosterId !== null) {
          const { data: picks, error: picksError } = await supabase
            .from('draft_picks')
            .select('player_id, roster_id, round, is_keeper, draft_id')
            .in('draft_id', draftIds)
            .eq('roster_id', selectedRosterId)
            .eq('is_keeper', true)

          if (picksError) throw picksError
          keeperPicks = picks ?? []
        }

        // Get unique player IDs from keepers
        const keeperPlayerIds = [...new Set(keeperPicks.map((p) => p.player_id))]

        // Fetch trades for this roster
        // Note: selectedRosterId is guaranteed non-null here due to the guard at the start of useEffect
        const rosterIdForQuery = selectedRosterId as number
        const { data: trades, error: tradesError } = await supabase
          .from('transactions')
          .select('*')
          .in('season_id', seasonIds)
          .eq('type', 'trade')
          .eq('status', 'complete')
          .contains('roster_ids', [rosterIdForQuery])
          .order('created_at_sleeper', { ascending: false })

        if (tradesError) throw tradesError

        // Get all player IDs from trades
        const tradePlayerIds = new Set<string>()
        trades?.forEach((t) => {
          if (t.adds) {
            Object.keys(t.adds as Record<string, number>).forEach((id) =>
              tradePlayerIds.add(id)
            )
          }
          if (t.drops) {
            Object.keys(t.drops as Record<string, number>).forEach((id) =>
              tradePlayerIds.add(id)
            )
          }
        })

        // Combine all player IDs
        const allPlayerIds = [...new Set([...keeperPlayerIds, ...tradePlayerIds])]

        // Fetch player names and positions
        const names = new Map<string, string>()
        const positions = new Map<string, string | null>()

        if (allPlayerIds.length > 0) {
          const { data: players, error: playersError } = await supabase
            .from('nfl_players')
            .select('player_id, full_name, position')
            .in('player_id', allPlayerIds)

          if (playersError) throw playersError

          players?.forEach((p) => {
            names.set(p.player_id, p.full_name)
            positions.set(p.player_id, p.position)
          })
          setPlayerNames(names)
          setPlayerPositions(positions)
        }

        // Fetch player weekly points for trade grading
        const { data: weeklyPoints, error: weeklyError } = await supabase
          .from('player_weekly_points')
          .select('player_id, week, season_id, points')
          .in('season_id', seasonIds)

        if (weeklyError) throw weeklyError

        const playerWeeklyPoints: PlayerWeeklyPoints[] =
          weeklyPoints?.map((wp) => ({
            playerId: wp.player_id,
            week: wp.week,
            seasonId: wp.season_id,
            points: wp.points ?? 0,
          })) ?? []

        // Get current season info
        const currentSeason = seasons.find((s) => s.is_current) ?? seasons[0]
        const currentSeasonId = currentSeason?.id ?? 0

        // Process keepers by year
        const keepersByYear = new Map<string, KeeperDisplay[]>()
        const draftSeasonMap = new Map(drafts?.map((d) => [d.draft_id, d.season_id]) ?? [])

        // Group keepers by season
        const keepersBySeasonId = new Map<number, DraftPick[]>()
        keeperPicks.forEach((pick) => {
          const seasonId = draftSeasonMap.get(pick.draft_id)
          if (seasonId) {
            if (!keepersBySeasonId.has(seasonId)) {
              keepersBySeasonId.set(seasonId, [])
            }
            keepersBySeasonId.get(seasonId)!.push(pick)
          }
        })

        // Calculate points and top performers for each season's keepers
        keepersBySeasonId.forEach((picks, seasonId) => {
          const seasonYear = seasonYearMap.get(seasonId) ?? 0
          const key = `${selectedRosterId}-${seasonYear}`

          // Calculate total points for each keeper this season
          const keeperDisplays: KeeperDisplay[] = picks.map((pick) => {
            const seasonPoints = playerWeeklyPoints
              .filter((wp) => wp.playerId === pick.player_id && wp.seasonId === seasonId)
              .reduce((sum, wp) => sum + wp.points, 0)

            return {
              playerId: pick.player_id,
              playerName: playerNames.get(pick.player_id) ?? `Player ${pick.player_id}`,
              position: playerPositions.get(pick.player_id) ?? null,
              totalPoints: seasonPoints,
              isTopPerformer: false, // Will be set below
            }
          })

          // Mark top 2 performers as top performers
          keeperDisplays.sort((a, b) => b.totalPoints - a.totalPoints)
          keeperDisplays.slice(0, 2).forEach((k) => {
            k.isTopPerformer = true
          })

          // Sort by points for display
          keepersByYear.set(key, keeperDisplays)
        })

        setKeepersByRosterAndYear(keepersByYear)

        // Process trades with grades
        const tradeDisplays: TradeDisplay[] = []

        trades?.forEach((trade) => {
          // Find trade partner
          const partnerRosterId = trade.roster_ids?.find((id: number) => id !== rosterIdForQuery)
          const partnerRoster = rosters.find((r) => r.roster_id === partnerRosterId)
          const tradePartnerName = partnerRoster?.team_name ?? `Team ${partnerRosterId ?? '?'}`

          const transaction: Transaction = {
            transaction_id: trade.transaction_id,
            season_id: trade.season_id,
            week: trade.week,
            type: trade.type,
            status: trade.status,
            roster_ids: trade.roster_ids,
            adds: trade.adds as Record<string, number> | null,
            drops: trade.drops as Record<string, number> | null,
            draft_picks: trade.draft_picks as { season: string; round: number; roster_id: number; previous_owner_id: number; owner_id: number }[] | null,
            created_at_sleeper: trade.created_at_sleeper,
          }

          const grade = calculateTradeGrade(
            transaction,
            rosterIdForQuery,
            playerWeeklyPoints,
            names,
            currentWeek,
            currentSeasonId
          )

          tradeDisplays.push({
            transactionId: trade.transaction_id,
            week: trade.week,
            seasonYear: seasonYearMap.get(trade.season_id) ?? 0,
            createdAt: trade.created_at_sleeper ?? 0,
            grade,
            tradePartnerName,
          })
        })

        const newTradesByRoster = new Map<number, TradeDisplay[]>()
        newTradesByRoster.set(rosterIdForQuery, tradeDisplays)
        setTradesByRoster(newTradesByRoster)
      } catch (err) {
        console.error('Failed to load manager details:', err)
        setError('Failed to load manager details')
      } finally {
        setDetailLoading(false)
      }
    }

    fetchManagerDetails()
  }, [selectedRosterId, seasons, currentWeek])

  // Memoized values
  const selectedRoster = useMemo(
    () => rosters.find((r) => r.roster_id === selectedRosterId),
    [rosters, selectedRosterId]
  )

  const handleManagerSelect = useCallback((rosterId: number) => {
    setSelectedRosterId(rosterId)
  }, [])

  // Get keepers for selected roster grouped by year
  const selectedRosterKeepers = useMemo(() => {
    if (!selectedRosterId) return new Map<number, KeeperDisplay[]>()

    const result = new Map<number, KeeperDisplay[]>()
    keepersByRosterAndYear.forEach((keepers, key) => {
      const [rosterIdStr, yearStr] = key.split('-')
      if (Number(rosterIdStr) === selectedRosterId) {
        result.set(Number(yearStr), keepers)
      }
    })
    return result
  }, [selectedRosterId, keepersByRosterAndYear])

  // Get trades for selected roster
  const selectedRosterTrades = useMemo(
    () => tradesByRoster.get(selectedRosterId ?? 0) ?? [],
    [selectedRosterId, tradesByRoster]
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between animate-fade-up">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-2">
            Keeper League Management
          </p>
          <h1 className="text-4xl md:text-5xl font-display tracking-wide text-foreground">
            GM PORTAL
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
                  {season.season_year}-{(season.season_year + 1).toString().slice(-2)}
                  {season.is_current && ' (Current)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10 animate-fade-up stagger-1">
          <CardContent className="py-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {initialLoading && (
        <Card className="border-border bg-card animate-fade-up stagger-1">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading managers...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager Cards Grid */}
      {!initialLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up stagger-1">
          {rosters.map((roster, index) => {
            const record = managerRecords.get(roster.roster_id) ?? {
              wins: 0,
              losses: 0,
              ties: 0,
            }
            const tradeCount = tradeCountsByRoster.get(roster.roster_id) ?? 0
            const keeperSuccess = keeperSuccessRates.get(roster.roster_id) ?? 0
            const isSelected = selectedRosterId === roster.roster_id

            return (
              <ManagerCard
                key={roster.roster_id}
                roster={roster}
                record={record}
                tradeCount={tradeCount}
                keeperSuccess={keeperSuccess}
                isSelected={isSelected}
                onSelect={handleManagerSelect}
                index={index}
              />
            )
          })}
        </div>
      )}

      {/* Selected Manager Details */}
      {selectedRosterId && !initialLoading && (
        <div className="space-y-6 animate-fade-up stagger-2">
          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary/30 rounded-full border border-border/30">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {selectedRoster?.team_name ?? 'Team Details'}
              </span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {/* Detail Loading */}
          {detailLoading && (
            <Card className="border-border bg-card">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-muted-foreground">Loading keeper and trade history...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Keepers Section */}
          {!detailLoading && selectedRosterKeepers.size > 0 && (
            <KeepersSection keepers={selectedRosterKeepers} playerNames={playerNames} />
          )}

          {/* Trades Section */}
          {!detailLoading && selectedRosterTrades.length > 0 && (
            <TradesSection trades={selectedRosterTrades} />
          )}

          {/* No Data State */}
          {!detailLoading &&
            selectedRosterKeepers.size === 0 &&
            selectedRosterTrades.length === 0 && (
              <Card className="border-border bg-card">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <Users className="w-12 h-12 text-muted-foreground/50" />
                    <div>
                      <p className="text-lg font-medium text-foreground">No History Found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        No keeper or trade data available for this manager.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ManagerCardProps {
  roster: Roster
  record: { wins: number; losses: number; ties: number }
  tradeCount: number
  keeperSuccess: number
  isSelected: boolean
  onSelect: (rosterId: number) => void
  index: number
}

function ManagerCard({
  roster,
  record,
  tradeCount,
  keeperSuccess,
  isSelected,
  onSelect,
  index,
}: ManagerCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-300 overflow-hidden group',
        'border-border bg-card hover:border-primary/50',
        isSelected && 'border-primary ring-2 ring-primary/20 bg-primary/5',
        `animate-fade-up stagger-${Math.min(index + 1, 10)}`
      )}
      onClick={() => onSelect(roster.roster_id)}
    >
      <CardContent className="p-5">
        {/* Team Name */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg tracking-wide text-foreground truncate">
            {roster.team_name ?? `Team ${roster.roster_id}`}
          </h3>
          <ChevronRight
            className={cn(
              'w-5 h-5 text-muted-foreground transition-all duration-300',
              'group-hover:text-primary group-hover:translate-x-1',
              isSelected && 'text-primary rotate-90'
            )}
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50 mb-4" />

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {/* W-L Record */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <span className="text-lg font-display text-primary">{record.wins}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-lg font-display text-destructive">{record.losses}</span>
              {record.ties > 0 && (
                <>
                  <span className="text-muted-foreground">-</span>
                  <span className="text-lg font-display text-muted-foreground">
                    {record.ties}
                  </span>
                </>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Record
            </p>
          </div>

          {/* Trade Count */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <ArrowRightLeft className="w-4 h-4 text-accent" />
              <span className="text-lg font-display text-foreground">{tradeCount}</span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Trades
            </p>
          </div>

          {/* Keeper Success */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-lg font-display text-foreground">
                {keeperSuccess.toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Keeper %
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface KeepersSectionProps {
  keepers: Map<number, KeeperDisplay[]>
  playerNames: Map<string, string>
}

function KeepersSection({ keepers, playerNames }: KeepersSectionProps) {
  // Sort years descending
  const years = Array.from(keepers.keys()).sort((a, b) => b - a)

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-secondary/20">
        <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
          <Trophy className="w-5 h-5 text-primary" />
          KEEPER HISTORY
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/20">
          {years.map((year) => {
            const yearKeepers = keepers.get(year) ?? []

            return (
              <div key={year} className="p-4">
                {/* Year Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-display text-primary">
                    {year} KEEPERS
                  </span>
                  <div className="h-px flex-1 bg-border/30" />
                </div>

                {/* Keeper List */}
                <div className="space-y-2">
                  {yearKeepers
                    .sort((a, b) => b.totalPoints - a.totalPoints)
                    .map((keeper, idx) => (
                      <div
                        key={keeper.playerId}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 rounded-lg',
                          'bg-secondary/30 hover:bg-secondary/50 transition-colors'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-display text-muted-foreground">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {playerNames.get(keeper.playerId) ?? keeper.playerName}
                              </span>
                              {keeper.isTopPerformer && (
                                <Star className="w-4 h-4 text-accent fill-accent" />
                              )}
                            </div>
                            {keeper.position && (
                              <span className="text-xs text-muted-foreground">
                                {keeper.position}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-display text-foreground tabular-nums">
                          {formatGMPoints(keeper.totalPoints)} pts
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

interface TradesSectionProps {
  trades: TradeDisplay[]
}

function TradesSection({ trades }: TradesSectionProps) {
  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-secondary/20">
        <CardTitle className="text-lg font-display tracking-wide flex items-center gap-3">
          <ArrowRightLeft className="w-5 h-5 text-accent" />
          TRADE HISTORY
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/20">
          {trades.map((trade) => (
            <TradeCard key={trade.transactionId} trade={trade} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface TradeCardProps {
  trade: TradeDisplay
}

function TradeCard({ trade }: TradeCardProps) {
  const { grade } = trade

  return (
    <div className="p-4">
      {/* Trade Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Week {trade.week}, {trade.seasonYear}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Traded with</span>
            <span className="font-display text-accent">{trade.tradePartnerName}</span>
          </div>
        </div>
        <TradeGradeIcon grade={grade} />
      </div>

      {/* Trade Details */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Received */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <Check className="w-3 h-3 text-primary" />
            RECEIVED
          </div>
          <div className="space-y-1">
            {grade.acquired.map((player) => (
              <div
                key={player.playerId}
                className="flex items-center justify-between px-3 py-2 rounded bg-primary/10"
              >
                <span className="text-sm font-medium text-foreground">{player.name}</span>
                <span className="text-xs text-primary tabular-nums">
                  +{formatGMPoints(player.points)}
                </span>
              </div>
            ))}
            {grade.picksReceived.map((pick, idx) => (
              <div
                key={`pick-${idx}`}
                className="flex items-center justify-between px-3 py-2 rounded bg-accent/10"
              >
                <span className="text-sm font-medium text-foreground">
                  {getDisplayRound(pick.round)} ({pick.season})
                </span>
                <span className="text-xs text-accent tabular-nums">
                  +{pick.value} value
                </span>
              </div>
            ))}
            {grade.acquired.length === 0 && grade.picksReceived.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">None</div>
            )}
          </div>
        </div>

        {/* Gave Up */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <X className="w-3 h-3 text-destructive" />
            GAVE UP
          </div>
          <div className="space-y-1">
            {grade.lost.map((player) => (
              <div
                key={player.playerId}
                className="flex items-center justify-between px-3 py-2 rounded bg-destructive/10"
              >
                <span className="text-sm font-medium text-foreground">{player.name}</span>
                <span className="text-xs text-destructive tabular-nums">
                  -{formatGMPoints(player.points)}
                </span>
              </div>
            ))}
            {grade.picksGiven.map((pick, idx) => (
              <div
                key={`pick-${idx}`}
                className="flex items-center justify-between px-3 py-2 rounded bg-destructive/10"
              >
                <span className="text-sm font-medium text-foreground">
                  {getDisplayRound(pick.round)} ({pick.season})
                </span>
                <span className="text-xs text-destructive tabular-nums">
                  -{pick.value} value
                </span>
              </div>
            ))}
            {grade.lost.length === 0 && grade.picksGiven.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">None</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TradeGradeIconProps {
  grade: TradeGrade
}

function TradeGradeIcon({ grade }: TradeGradeIconProps) {
  if (grade.grade === 'tbd') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/30">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">TBD</span>
        <span className="text-xs text-muted-foreground/70">
          ({grade.weeksAnalyzed}/4 weeks)
        </span>
      </div>
    )
  }

  const isPear = grade.grade === 'pear'

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full',
        isPear ? 'bg-primary/20' : 'bg-destructive/20'
      )}
    >
      <span className="text-lg" role="img" aria-label={isPear ? 'Good trade' : 'Bad trade'}>
        {isPear ? '\uD83C\uDF50' : '\uD83C\uDF47'}
      </span>
      <span
        className={cn(
          'text-sm font-display tabular-nums',
          isPear ? 'text-primary' : 'text-destructive'
        )}
      >
        {formatDifferential(grade.totalDifferential)}
      </span>
      {grade.pickValue !== 0 && (
        <span className="text-xs text-muted-foreground">
          (incl. {formatDifferential(grade.pickValue)} pick value)
        </span>
      )}
    </div>
  )
}
