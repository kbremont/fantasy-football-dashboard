// Transaction War Room Utilities

// Raw transaction data from database
export interface TransactionData {
  id: number
  transaction_id: string
  season_id: number
  week: number
  type: 'trade' | 'free_agent' | 'waiver' | 'commissioner'
  status: 'complete' | 'failed' | 'pending'
  roster_ids: number[] | null
  adds: Record<string, number> | null // player_id -> roster_id
  drops: Record<string, number> | null // player_id -> roster_id
  created_at_sleeper: number | null
}

export interface RosterData {
  roster_id: number
  team_name: string | null
}

export interface PlayerData {
  player_id: string
  full_name: string | null
  position: string | null
}

// Enriched transaction with resolved names
export interface EnrichedTransaction extends TransactionData {
  involved_teams: { roster_id: number; team_name: string }[]
  added_players: {
    player_id: string
    name: string
    position: string
    to_roster_id: number
    to_team: string
  }[]
  dropped_players: {
    player_id: string
    name: string
    position: string
    from_roster_id: number
    from_team: string
  }[]
}

// Manager activity stats
export interface ManagerActivity {
  roster_id: number
  team_name: string
  trades: number
  waivers: number
  free_agents: number
  commissioner: number
  total: number
}

// Trade matrix cell for heatmap
export interface TradeMatrixCell {
  roster_id_1: number
  roster_id_2: number
  team_name_1: string
  team_name_2: string
  trade_count: number
}

// Position churn data
export interface PositionChurn {
  position: string
  adds: number
  drops: number
  net: number
}

// Summary stats
export interface TransactionSummary {
  totalTransactions: number
  totalTrades: number
  totalWaivers: number
  totalFreeAgents: number
  busiestWeek: { week: number; count: number } | null
  mostActiveManager: { roster_id: number; team_name: string; count: number } | null
}

/**
 * Extract all unique player IDs from transaction adds/drops
 */
export function extractPlayerIds(transactions: TransactionData[]): string[] {
  const playerIds = new Set<string>()

  transactions.forEach((t) => {
    if (t.adds) {
      Object.keys(t.adds).forEach((id) => playerIds.add(id))
    }
    if (t.drops) {
      Object.keys(t.drops).forEach((id) => playerIds.add(id))
    }
  })

  return Array.from(playerIds)
}

/**
 * Enrich transactions with resolved team and player names
 */
export function enrichTransactions(
  transactions: TransactionData[],
  rosters: RosterData[],
  players: PlayerData[]
): EnrichedTransaction[] {
  const rosterMap = new Map(rosters.map((r) => [r.roster_id, r.team_name || `Team ${r.roster_id}`]))
  const playerMap = new Map(
    players.map((p) => [
      p.player_id,
      { name: p.full_name || 'Unknown', position: p.position || 'N/A' },
    ])
  )

  return transactions.map((t) => {
    // Resolve involved teams
    const involved_teams = (t.roster_ids || []).map((rid) => ({
      roster_id: rid,
      team_name: rosterMap.get(rid) || `Team ${rid}`,
    }))

    // Resolve added players
    const added_players = Object.entries(t.adds || {}).map(([playerId, rosterId]) => {
      const player = playerMap.get(playerId) || { name: 'Unknown', position: 'N/A' }
      return {
        player_id: playerId,
        name: player.name,
        position: player.position,
        to_roster_id: rosterId,
        to_team: rosterMap.get(rosterId) || `Team ${rosterId}`,
      }
    })

    // Resolve dropped players
    const dropped_players = Object.entries(t.drops || {}).map(([playerId, rosterId]) => {
      const player = playerMap.get(playerId) || { name: 'Unknown', position: 'N/A' }
      return {
        player_id: playerId,
        name: player.name,
        position: player.position,
        from_roster_id: rosterId,
        from_team: rosterMap.get(rosterId) || `Team ${rosterId}`,
      }
    })

    return {
      ...t,
      involved_teams,
      added_players,
      dropped_players,
    }
  })
}

/**
 * Calculate activity stats per manager
 */
export function calculateManagerActivity(
  transactions: TransactionData[],
  rosters: RosterData[]
): ManagerActivity[] {
  const rosterMap = new Map(rosters.map((r) => [r.roster_id, r.team_name || `Team ${r.roster_id}`]))
  const activityMap = new Map<number, ManagerActivity>()

  // Initialize all rosters
  rosters.forEach((r) => {
    activityMap.set(r.roster_id, {
      roster_id: r.roster_id,
      team_name: rosterMap.get(r.roster_id) || `Team ${r.roster_id}`,
      trades: 0,
      waivers: 0,
      free_agents: 0,
      commissioner: 0,
      total: 0,
    })
  })

  // Count transactions per roster
  transactions.forEach((t) => {
    const rosterIds = t.roster_ids || []
    rosterIds.forEach((rid) => {
      const activity = activityMap.get(rid)
      if (!activity) return

      switch (t.type) {
        case 'trade':
          activity.trades++
          break
        case 'waiver':
          activity.waivers++
          break
        case 'free_agent':
          activity.free_agents++
          break
        case 'commissioner':
          activity.commissioner++
          break
      }
      activity.total++
    })
  })

  return Array.from(activityMap.values()).sort((a, b) => b.total - a.total)
}

/**
 * Build trade matrix for heatmap visualization
 */
export function buildTradeMatrix(
  transactions: TransactionData[],
  rosters: RosterData[]
): TradeMatrixCell[] {
  const rosterMap = new Map(rosters.map((r) => [r.roster_id, r.team_name || `Team ${r.roster_id}`]))
  const tradeCountMap = new Map<string, number>()

  // Count trades between pairs
  transactions
    .filter((t) => t.type === 'trade' && t.roster_ids?.length === 2)
    .forEach((t) => {
      const [rid1, rid2] = t.roster_ids!.sort((a, b) => a - b)
      const key = `${rid1}-${rid2}`
      tradeCountMap.set(key, (tradeCountMap.get(key) || 0) + 1)
    })

  // Convert to matrix cells
  const cells: TradeMatrixCell[] = []
  tradeCountMap.forEach((count, key) => {
    const [rid1, rid2] = key.split('-').map(Number)
    cells.push({
      roster_id_1: rid1,
      roster_id_2: rid2,
      team_name_1: rosterMap.get(rid1) || `Team ${rid1}`,
      team_name_2: rosterMap.get(rid2) || `Team ${rid2}`,
      trade_count: count,
    })
  })

  return cells.sort((a, b) => b.trade_count - a.trade_count)
}

/**
 * Calculate position churn (adds/drops by position)
 */
export function calculatePositionChurn(
  transactions: TransactionData[],
  players: PlayerData[]
): PositionChurn[] {
  const playerMap = new Map(players.map((p) => [p.player_id, p.position || 'Unknown']))
  const churnMap = new Map<string, { adds: number; drops: number }>()

  // Initialize common positions
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
  positions.forEach((pos) => {
    churnMap.set(pos, { adds: 0, drops: 0 })
  })

  // Count adds and drops by position
  transactions.forEach((t) => {
    Object.keys(t.adds || {}).forEach((playerId) => {
      const position = playerMap.get(playerId) || 'Unknown'
      const current = churnMap.get(position) || { adds: 0, drops: 0 }
      current.adds++
      churnMap.set(position, current)
    })

    Object.keys(t.drops || {}).forEach((playerId) => {
      const position = playerMap.get(playerId) || 'Unknown'
      const current = churnMap.get(position) || { adds: 0, drops: 0 }
      current.drops++
      churnMap.set(position, current)
    })
  })

  // Convert to array and calculate net
  return Array.from(churnMap.entries())
    .filter(([pos]) => positions.includes(pos)) // Only include main positions
    .map(([position, data]) => ({
      position,
      adds: data.adds,
      drops: data.drops,
      net: data.adds - data.drops,
    }))
    .sort((a, b) => {
      // Sort by position in standard fantasy order
      const order = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
      return order.indexOf(a.position) - order.indexOf(b.position)
    })
}

/**
 * Calculate summary statistics
 */
export function getSummaryStats(
  transactions: TransactionData[],
  rosters: RosterData[]
): TransactionSummary {
  if (transactions.length === 0) {
    return {
      totalTransactions: 0,
      totalTrades: 0,
      totalWaivers: 0,
      totalFreeAgents: 0,
      busiestWeek: null,
      mostActiveManager: null,
    }
  }

  const totalTrades = transactions.filter((t) => t.type === 'trade').length
  const totalWaivers = transactions.filter((t) => t.type === 'waiver').length
  const totalFreeAgents = transactions.filter((t) => t.type === 'free_agent').length

  // Find busiest week
  const weekCounts = new Map<number, number>()
  transactions.forEach((t) => {
    weekCounts.set(t.week, (weekCounts.get(t.week) || 0) + 1)
  })

  let busiestWeek: { week: number; count: number } | null = null
  weekCounts.forEach((count, week) => {
    if (!busiestWeek || count > busiestWeek.count) {
      busiestWeek = { week, count }
    }
  })

  // Find most active manager
  const managerActivity = calculateManagerActivity(transactions, rosters)
  const mostActive = managerActivity[0]
  const mostActiveManager = mostActive
    ? {
        roster_id: mostActive.roster_id,
        team_name: mostActive.team_name,
        count: mostActive.total,
      }
    : null

  return {
    totalTransactions: transactions.length,
    totalTrades,
    totalWaivers,
    totalFreeAgents,
    busiestWeek,
    mostActiveManager,
  }
}

/**
 * Group transactions by week for timeline display
 */
export function groupTransactionsByWeek(
  transactions: EnrichedTransaction[]
): Map<number, EnrichedTransaction[]> {
  const byWeek = new Map<number, EnrichedTransaction[]>()

  transactions.forEach((t) => {
    if (!byWeek.has(t.week)) {
      byWeek.set(t.week, [])
    }
    byWeek.get(t.week)!.push(t)
  })

  return byWeek
}

/**
 * Filter transactions by type
 */
export function filterTransactionsByType(
  transactions: EnrichedTransaction[],
  types: ('trade' | 'free_agent' | 'waiver' | 'commissioner')[]
): EnrichedTransaction[] {
  if (types.length === 0) return transactions
  return transactions.filter((t) => types.includes(t.type))
}

/**
 * Get transaction type display properties
 */
export function getTransactionTypeInfo(type: TransactionData['type']): {
  label: string
  color: string
  bgColor: string
} {
  switch (type) {
    case 'trade':
      return {
        label: 'Trade',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
      }
    case 'waiver':
      return {
        label: 'Waiver',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
      }
    case 'free_agent':
      return {
        label: 'Free Agent',
        color: 'text-primary',
        bgColor: 'bg-primary/20',
      }
    case 'commissioner':
      return {
        label: 'Commissioner',
        color: 'text-accent',
        bgColor: 'bg-accent/20',
      }
    default:
      return {
        label: 'Unknown',
        color: 'text-muted-foreground',
        bgColor: 'bg-secondary',
      }
  }
}
