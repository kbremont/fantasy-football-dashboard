import { useEffect, useState, useMemo } from 'react'
import { supabase, authReady } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeftRight,
  ChevronDown,
  Trophy,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface Season {
  id: number
  season_year: number
  is_current: boolean | null
}

interface Roster {
  roster_id: number
  team_name: string | null
}

interface PlayerInfo {
  player_id: string
  full_name: string
  position: string | null
  team: string | null
}

interface DraftPickInfo {
  season: number
  round: number
  roster_id: number
  previous_owner_id?: number
}

interface TradeParty {
  roster_id: number
  team_name: string
  receivedPlayers: PlayerInfo[]
  receivedPicks: DraftPickInfo[]
}

interface TradeDisplay {
  id: number
  transaction_id: string
  week: number
  season_year: number
  teamA: TradeParty
  teamB: TradeParty
  timestamp: number | null
}

interface TradeStats {
  totalTrades: number
  mostActiveTeam: { name: string; count: number } | null
  biggestTrade: { playerCount: number; week: number } | null
}

// =============================================================================
// CONSTANTS
// =============================================================================

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-500/20 text-red-400',
  RB: 'bg-emerald-500/20 text-emerald-400',
  WR: 'bg-blue-500/20 text-blue-400',
  TE: 'bg-orange-500/20 text-orange-400',
  K: 'bg-purple-500/20 text-purple-400',
  DEF: 'bg-amber-500/20 text-amber-400',
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function parseAddsDrops(
  adds: Record<string, number> | null,
  _drops: Record<string, number> | null,
  rosterIds: number[],
  playerMap: Map<string, PlayerInfo>
): { teamA: PlayerInfo[]; teamB: PlayerInfo[] } {
  const teamAId = rosterIds[0]
  const teamBId = rosterIds[1]

  const teamAReceived: PlayerInfo[] = []
  const teamBReceived: PlayerInfo[] = []

  // "adds" maps player_id -> roster_id that received the player
  if (adds) {
    Object.entries(adds).forEach(([playerId, receivingRosterId]) => {
      const player = playerMap.get(playerId) || {
        player_id: playerId,
        full_name: `Player ${playerId}`,
        position: null,
        team: null,
      }
      if (receivingRosterId === teamAId) {
        teamAReceived.push(player)
      } else if (receivingRosterId === teamBId) {
        teamBReceived.push(player)
      }
    })
  }

  return { teamA: teamAReceived, teamB: teamBReceived }
}

function parseDraftPicks(
  draftPicks: Array<{
    season: string
    round: number
    roster_id: number
    previous_owner_id?: number
    owner_id?: number
  }> | null,
  rosterIds: number[]
): { teamA: DraftPickInfo[]; teamB: DraftPickInfo[] } {
  const teamAId = rosterIds[0]
  const teamBId = rosterIds[1]

  const teamAReceived: DraftPickInfo[] = []
  const teamBReceived: DraftPickInfo[] = []

  if (draftPicks && Array.isArray(draftPicks)) {
    draftPicks.forEach((pick) => {
      const pickInfo: DraftPickInfo = {
        season: parseInt(pick.season) || 0,
        round: pick.round,
        roster_id: pick.roster_id,
        previous_owner_id: pick.previous_owner_id,
      }

      // The pick goes to owner_id (new owner), away from previous_owner_id
      // If owner_id matches teamA, teamA received it
      // If owner_id matches teamB, teamB received it
      const newOwner = pick.owner_id ?? pick.roster_id
      if (newOwner === teamAId) {
        teamAReceived.push(pickInfo)
      } else if (newOwner === teamBId) {
        teamBReceived.push(pickInfo)
      }
    })
  }

  return { teamA: teamAReceived, teamB: teamBReceived }
}

function calculateTradeStats(
  trades: TradeDisplay[],
  rosterNames: Map<number, string>
): TradeStats {
  if (trades.length === 0) {
    return { totalTrades: 0, mostActiveTeam: null, biggestTrade: null }
  }

  // Count trades per team
  const teamTradeCounts = new Map<number, number>()
  let biggestTrade: { playerCount: number; week: number } | null = null

  trades.forEach((trade) => {
    // Count for both teams
    teamTradeCounts.set(
      trade.teamA.roster_id,
      (teamTradeCounts.get(trade.teamA.roster_id) || 0) + 1
    )
    teamTradeCounts.set(
      trade.teamB.roster_id,
      (teamTradeCounts.get(trade.teamB.roster_id) || 0) + 1
    )

    // Track biggest trade
    const totalPlayers =
      trade.teamA.receivedPlayers.length +
      trade.teamB.receivedPlayers.length +
      trade.teamA.receivedPicks.length +
      trade.teamB.receivedPicks.length
    if (!biggestTrade || totalPlayers > biggestTrade.playerCount) {
      biggestTrade = { playerCount: totalPlayers, week: trade.week }
    }
  })

  // Find most active team
  let mostActiveTeam: { name: string; count: number } | null = null
  teamTradeCounts.forEach((count, rosterId) => {
    if (!mostActiveTeam || count > mostActiveTeam.count) {
      mostActiveTeam = {
        name: rosterNames.get(rosterId) || `Team ${rosterId}`,
        count,
      }
    }
  })

  return {
    totalTrades: trades.length,
    mostActiveTeam,
    biggestTrade,
  }
}

function getTradePreview(trade: TradeDisplay): string {
  const formatSide = (players: number, picks: number) => {
    const parts: string[] = []
    if (players > 0) parts.push(`${players} player${players > 1 ? 's' : ''}`)
    if (picks > 0) parts.push(`${picks} pick${picks > 1 ? 's' : ''}`)
    return parts.join(' + ') || 'N/A'
  }

  const teamADesc = formatSide(
    trade.teamA.receivedPlayers.length,
    trade.teamA.receivedPicks.length
  )
  const teamBDesc = formatSide(
    trade.teamB.receivedPlayers.length,
    trade.teamB.receivedPicks.length
  )

  return `${teamADesc} for ${teamBDesc}`
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GMTrades() {
  // Core state
  const [seasons, setSeasons] = useState<Season[]>([])
  const [rosters, setRosters] = useState<Roster[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null) // null = All Teams

  // Data state
  const [trades, setTrades] = useState<TradeDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedTrades, setExpandedTrades] = useState<Set<number>>(new Set())

  // Roster name lookup
  const rosterNames = useMemo(
    () => new Map(rosters.map((r) => [r.roster_id, r.team_name || `Team ${r.roster_id}`])),
    [rosters]
  )

  // Filtered trades based on selected roster
  const filteredTrades = useMemo(() => {
    if (selectedRosterId === null) return trades
    return trades.filter(
      (t) =>
        t.teamA.roster_id === selectedRosterId ||
        t.teamB.roster_id === selectedRosterId
    )
  }, [trades, selectedRosterId])

  // Trade statistics
  const tradeStats = useMemo(
    () => calculateTradeStats(filteredTrades, rosterNames),
    [filteredTrades, rosterNames]
  )

  // Toggle expand
  const toggleExpand = (tradeId: number) => {
    setExpandedTrades((prev) => {
      const next = new Set(prev)
      if (next.has(tradeId)) next.delete(tradeId)
      else next.add(tradeId)
      return next
    })
  }

  // Effect 1: Load seasons and rosters on mount
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

        // Set default to current season
        const currentSeason =
          seasonsRes.data?.find((s) => s.is_current) || seasonsRes.data?.[0]
        if (currentSeason) {
          setSelectedSeasonId(currentSeason.id)
        }
      } catch (err) {
        console.error('Failed to load initial data:', err)
        setError('Failed to load seasons and teams')
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [])

  // Effect 2: Fetch trades when season changes
  useEffect(() => {
    if (!selectedSeasonId) return

    // Capture non-null value for async closure
    const seasonId = selectedSeasonId

    async function fetchTrades() {
      setLoading(true)
      setError(null)
      setExpandedTrades(new Set())

      try {
        // Fetch trades
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .eq('season_id', seasonId)
          .eq('type', 'trade')
          .order('week', { ascending: false })

        if (transactionsError) throw transactionsError

        if (!transactionsData || transactionsData.length === 0) {
          setTrades([])
          setLoading(false)
          return
        }

        // Collect all player IDs from adds
        const playerIds = new Set<string>()
        transactionsData.forEach((t) => {
          if (t.adds) {
            Object.keys(t.adds as Record<string, number>).forEach((id) =>
              playerIds.add(id)
            )
          }
        })

        // Fetch player details
        let playerMap = new Map<string, PlayerInfo>()
        if (playerIds.size > 0) {
          const { data: playersData } = await supabase
            .from('nfl_players')
            .select('player_id, full_name, position, team')
            .in('player_id', Array.from(playerIds))

          if (playersData) {
            playerMap = new Map(playersData.map((p) => [p.player_id, p]))
          }
        }

        // Get season year
        const seasonYear =
          seasons.find((s) => s.id === seasonId)?.season_year || 0

        // Transform transactions to TradeDisplay
        const tradeDisplays: TradeDisplay[] = transactionsData
          .filter((t) => t.roster_ids && t.roster_ids.length === 2)
          .map((t) => {
            const rosterIds = t.roster_ids as number[]
            const { teamA: teamAPlayers, teamB: teamBPlayers } = parseAddsDrops(
              t.adds as Record<string, number> | null,
              t.drops as Record<string, number> | null,
              rosterIds,
              playerMap
            )
            const { teamA: teamAPicks, teamB: teamBPicks } = parseDraftPicks(
              t.draft_picks as Array<{
                season: string
                round: number
                roster_id: number
                previous_owner_id?: number
                owner_id?: number
              }> | null,
              rosterIds
            )

            return {
              id: t.id,
              transaction_id: t.transaction_id,
              week: t.week,
              season_year: seasonYear,
              teamA: {
                roster_id: rosterIds[0],
                team_name:
                  rosters.find((r) => r.roster_id === rosterIds[0])?.team_name ||
                  `Team ${rosterIds[0]}`,
                receivedPlayers: teamAPlayers,
                receivedPicks: teamAPicks,
              },
              teamB: {
                roster_id: rosterIds[1],
                team_name:
                  rosters.find((r) => r.roster_id === rosterIds[1])?.team_name ||
                  `Team ${rosterIds[1]}`,
                receivedPlayers: teamBPlayers,
                receivedPicks: teamBPicks,
              },
              timestamp: t.created_at_sleeper,
            }
          })

        setTrades(tradeDisplays)
      } catch (err) {
        console.error('Failed to load trades:', err)
        setError('Failed to load trades')
      } finally {
        setLoading(false)
      }
    }

    fetchTrades()
  }, [selectedSeasonId, seasons, rosters])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between animate-fade-up">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-2">
            The Trade Block
          </p>
          <h1 className="text-4xl md:text-5xl font-display tracking-wide text-foreground">
            GM TRADES
          </h1>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Season Selector */}
          <div className="w-full sm:w-48">
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
                    {season.season_year}-{(season.season_year + 1).toString().slice(-2)}{' '}
                    Season
                    {season.is_current && ' (Current)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* GM Filter */}
          <div className="w-full sm:w-48">
            <Select
              value={selectedRosterId?.toString() ?? 'all'}
              onValueChange={(value) =>
                setSelectedRosterId(value === 'all' ? null : Number(value))
              }
            >
              <SelectTrigger className="bg-secondary/50 border-border/50 h-11">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {rosters.map((roster) => (
                  <SelectItem key={roster.roster_id} value={roster.roster_id.toString()}>
                    {roster.team_name || `Team ${roster.roster_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Trade Stats Card */}
      {!loading && !error && filteredTrades.length > 0 && (
        <Card className="border-border bg-card animate-fade-up stagger-1 overflow-hidden">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
            <CardContent className="p-6 relative">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Total Trades */}
                <div className="text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <ArrowLeftRight className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total Trades
                    </span>
                  </div>
                  <p className="text-3xl font-display text-foreground">
                    {tradeStats.totalTrades}
                  </p>
                </div>

                {/* Most Active */}
                {tradeStats.mostActiveTeam && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-accent" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Most Active
                      </span>
                    </div>
                    <p className="text-lg font-display text-foreground truncate">
                      {tradeStats.mostActiveTeam.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {tradeStats.mostActiveTeam.count} trades
                    </p>
                  </div>
                )}

                {/* Biggest Trade */}
                {tradeStats.biggestTrade && (
                  <div className="text-center sm:text-right">
                    <div className="flex items-center justify-center sm:justify-end gap-2 mb-2">
                      <Zap className="w-4 h-4 text-destructive" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Biggest Trade
                      </span>
                    </div>
                    <p className="text-lg font-display text-foreground">
                      {tradeStats.biggestTrade.playerCount} pieces
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Week {tradeStats.biggestTrade.week}
                    </p>
                  </div>
                )}
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

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border bg-card animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-secondary/50 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Trade Cards */}
      {!loading && !error && filteredTrades.length > 0 && (
        <div className="space-y-4">
          {filteredTrades.map((trade, index) => (
            <TradeCard
              key={trade.id}
              trade={trade}
              isExpanded={expandedTrades.has(trade.id)}
              onToggle={() => toggleExpand(trade.id)}
              className={cn('animate-fade-up', `stagger-${Math.min(index + 2, 10)}`)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredTrades.length === 0 && (
        <Card className="border-border bg-card animate-fade-up stagger-1 overflow-hidden">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
            <CardContent className="py-20 relative">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center">
                    <ArrowLeftRight className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-display tracking-wide text-foreground mb-2">
                    NO TRADES RECORDED
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    {selectedRosterId !== null
                      ? 'This team hasn\'t made any trades this season.'
                      : 'No trades have been recorded for this season yet.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      )}
    </div>
  )
}

// =============================================================================
// TRADE CARD COMPONENT
// =============================================================================

interface TradeCardProps {
  trade: TradeDisplay
  isExpanded: boolean
  onToggle: () => void
  className?: string
}

function TradeCard({ trade, isExpanded, onToggle, className }: TradeCardProps) {
  const preview = getTradePreview(trade)

  return (
    <Card className={cn('border-border bg-card overflow-hidden', className)}>
      <CardContent className="p-0">
        {/* Collapsed Header - Clickable */}
        <div
          className="relative cursor-pointer group"
          onClick={onToggle}
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 opacity-50" />

          <div className="relative p-4 sm:p-6">
            <div className="flex items-center gap-4">
              {/* Week Badge */}
              <div className="shrink-0">
                <div className="px-3 py-1.5 rounded-lg bg-secondary/80 border border-border/50">
                  <span className="text-xs font-display tracking-wider text-muted-foreground">
                    WEEK {trade.week}
                  </span>
                </div>
              </div>

              {/* Teams */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <span className="font-semibold text-foreground truncate">
                    {trade.teamA.team_name}
                  </span>
                  <div className="shrink-0 w-8 h-8 rounded-full bg-secondary/50 border border-border/50 flex items-center justify-center">
                    <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="font-semibold text-foreground truncate">
                    {trade.teamB.team_name}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {preview}
                </p>
              </div>

              {/* Expand Indicator */}
              <div className="shrink-0">
                <div className="p-2 rounded-full bg-secondary/50 group-hover:bg-secondary transition-colors">
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform duration-300',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        <div
          className={cn(
            'grid transition-all duration-300 ease-out',
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <div className="overflow-hidden">
            <TradeDetails trade={trade} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// TRADE DETAILS COMPONENT
// =============================================================================

interface TradeDetailsProps {
  trade: TradeDisplay
}

function TradeDetails({ trade }: TradeDetailsProps) {
  return (
    <div className="border-t border-border/30 bg-secondary/20">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] divide-y md:divide-y-0 md:divide-x divide-border/30">
        {/* Team A Side */}
        <TradePartyPanel party={trade.teamA} side="left" />

        {/* Center Divider - Desktop */}
        <div className="hidden md:flex flex-col items-center justify-center px-4 py-6">
          <div className="w-12 h-12 rounded-full bg-background border-2 border-border/50 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">
            Trade
          </p>
        </div>

        {/* Team B Side */}
        <TradePartyPanel party={trade.teamB} side="right" />
      </div>
    </div>
  )
}

// =============================================================================
// TRADE PARTY PANEL
// =============================================================================

interface TradePartyPanelProps {
  party: TradeParty
  side: 'left' | 'right'
}

function TradePartyPanel({ party, side }: TradePartyPanelProps) {
  const hasContent = party.receivedPlayers.length > 0 || party.receivedPicks.length > 0

  return (
    <div
      className={cn(
        'p-4 sm:p-6',
        side === 'left'
          ? 'bg-gradient-to-br from-primary/5 to-transparent'
          : 'bg-gradient-to-bl from-accent/5 to-transparent'
      )}
    >
      {/* Team Header */}
      <div className={cn('mb-4', side === 'right' && 'md:text-right')}>
        <p
          className={cn(
            'text-xs font-medium uppercase tracking-wider mb-1',
            side === 'left' ? 'text-primary/70' : 'text-accent/70'
          )}
        >
          {party.team_name} Receives
        </p>
      </div>

      {/* Content */}
      {hasContent ? (
        <div className="space-y-4">
          {/* Players */}
          {party.receivedPlayers.length > 0 && (
            <div className="space-y-2">
              {party.receivedPlayers.map((player) => (
                <PlayerCard key={player.player_id} player={player} side={side} />
              ))}
            </div>
          )}

          {/* Draft Picks */}
          {party.receivedPicks.length > 0 && (
            <div className="space-y-2">
              {party.receivedPicks.map((pick, index) => (
                <DraftPickBadge key={index} pick={pick} side={side} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">Nothing received</p>
      )}
    </div>
  )
}

// =============================================================================
// PLAYER CARD
// =============================================================================

interface PlayerCardProps {
  player: PlayerInfo
  side: 'left' | 'right'
}

function PlayerCard({ player, side }: PlayerCardProps) {
  const positionColor =
    POSITION_COLORS[player.position || ''] || 'bg-secondary text-muted-foreground'

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg bg-background/50',
        side === 'right' && 'md:flex-row-reverse'
      )}
    >
      {/* Position Badge */}
      <span
        className={cn(
          'shrink-0 w-10 text-center py-1 rounded text-xs font-semibold',
          positionColor
        )}
      >
        {player.position || '?'}
      </span>

      {/* Player Info */}
      <div className={cn('flex-1 min-w-0', side === 'right' && 'md:text-right')}>
        <p className="font-medium text-foreground truncate">{player.full_name}</p>
        {player.team && (
          <p className="text-xs text-muted-foreground">{player.team}</p>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// DRAFT PICK BADGE
// =============================================================================

interface DraftPickBadgeProps {
  pick: DraftPickInfo
  side: 'left' | 'right'
}

function DraftPickBadge({ pick, side }: DraftPickBadgeProps) {
  const roundSuffix = pick.round === 1 ? 'st' : pick.round === 2 ? 'nd' : pick.round === 3 ? 'rd' : 'th'

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg bg-accent/10 border border-accent/20',
        side === 'right' && 'md:flex-row-reverse'
      )}
    >
      <Trophy className="w-4 h-4 text-accent shrink-0" />
      <p className={cn('text-sm font-medium text-accent', side === 'right' && 'md:text-right')}>
        {pick.season} {pick.round}{roundSuffix} Round Pick
      </p>
    </div>
  )
}
