/**
 * GM Portal Statistics Utilities
 * Calculate trade grades, keeper success, and manager performance metrics
 */

// Types
export interface TradeGrade {
  grade: 'pear' | 'grape' | 'tbd'
  playerDifferential: number
  pickValue: number
  totalDifferential: number
  weeksAnalyzed: number
  acquired: { playerId: string; name: string; points: number }[]
  lost: { playerId: string; name: string; points: number }[]
  picksReceived: { round: number; season: number; value: number }[]
  picksGiven: { round: number; season: number; value: number }[]
}

export interface ManagerStats {
  rosterId: number
  teamName: string
  wins: number
  losses: number
  ties: number
  tradeCount: number
  keeperSuccessRate: number
  keepersByYear: Map<number, KeeperInfo[]>
  trades: TradeInfo[]
}

export interface KeeperInfo {
  playerId: string
  playerName: string
  position: string | null
  round: number
  totalPoints: number
  isTopPerformer: boolean
}

export interface TradeInfo {
  transactionId: string
  week: number
  seasonId: number
  seasonYear: number
  createdAt: number
  grade: TradeGrade
}

export interface PlayerWeeklyPoints {
  playerId: string
  week: number
  seasonId: number
  points: number
}

export interface Transaction {
  transaction_id: string
  season_id: number
  week: number
  type: string
  status: string
  roster_ids: number[] | null
  adds: Record<string, number> | null
  drops: Record<string, number> | null
  draft_picks: DraftPickTrade[] | null
  created_at_sleeper: number | null
}

export interface DraftPickTrade {
  season: string
  round: number
  roster_id: number
  previous_owner_id: number
  owner_id: number
}

// Draft pick value tiers (Sleeper rounds 7+ are tradeable)
// Round 7 = "1st round" in keeper league terminology
const PICK_VALUES: Record<number, number> = {
  7: 30,   // "1st round"
  8: 20,   // "2nd round"
  9: 12,   // "3rd round"
  10: 12,  // "4th round"
  11: 6,   // "5th round"
  12: 6,   // "6th round"
}
const DEFAULT_PICK_VALUE = 3  // 7th+ round

// Number of weeks to analyze after a trade
const WEEKS_TO_ANALYZE = 4

/**
 * Get the value of a draft pick based on its round
 */
export function getPickValue(round: number): number {
  return PICK_VALUES[round] ?? DEFAULT_PICK_VALUE
}

/**
 * Calculate trade grade by comparing points of acquired vs lost players
 * for 4 weeks after the trade, plus factoring in pick values
 */
export function calculateTradeGrade(
  transaction: Transaction,
  rosterId: number,
  playerWeeklyPoints: PlayerWeeklyPoints[],
  playerNames: Map<string, string>,
  currentWeek: number,
  currentSeasonId: number
): TradeGrade {
  const adds = transaction.adds ?? {}
  const drops = transaction.drops ?? {}
  const draftPicks = transaction.draft_picks ?? []

  // Find players this roster acquired and lost
  const acquiredPlayerIds: string[] = []
  const lostPlayerIds: string[] = []

  for (const [playerId, toRosterId] of Object.entries(adds)) {
    if (toRosterId === rosterId) {
      acquiredPlayerIds.push(playerId)
    }
  }

  for (const [playerId, fromRosterId] of Object.entries(drops)) {
    if (fromRosterId === rosterId) {
      lostPlayerIds.push(playerId)
    }
  }

  // Find picks this roster received and gave away
  const picksReceived: { round: number; season: number; value: number }[] = []
  const picksGiven: { round: number; season: number; value: number }[] = []

  for (const pick of draftPicks) {
    const seasonNum = parseInt(pick.season, 10)
    if (pick.owner_id === rosterId && pick.previous_owner_id !== rosterId) {
      // Received this pick
      picksReceived.push({
        round: pick.round,
        season: seasonNum,
        value: getPickValue(pick.round),
      })
    } else if (pick.previous_owner_id === rosterId && pick.owner_id !== rosterId) {
      // Gave away this pick
      picksGiven.push({
        round: pick.round,
        season: seasonNum,
        value: getPickValue(pick.round),
      })
    }
  }

  // Calculate weeks to analyze
  const tradeWeek = transaction.week
  const tradeSeasonId = transaction.season_id
  const weeksAfterTrade: { seasonId: number; week: number }[] = []

  // Determine how many weeks we can analyze
  // If the trade happened in a previous season, we need full 4 weeks
  // If it's current season, we might have fewer weeks available
  const maxWeeksAvailable =
    tradeSeasonId < currentSeasonId
      ? WEEKS_TO_ANALYZE
      : Math.max(0, currentWeek - tradeWeek)

  for (let i = 1; i <= Math.min(WEEKS_TO_ANALYZE, maxWeeksAvailable); i++) {
    weeksAfterTrade.push({
      seasonId: tradeSeasonId,
      week: tradeWeek + i,
    })
  }

  // Calculate points for acquired players
  const acquired: { playerId: string; name: string; points: number }[] = []
  let totalAcquiredPoints = 0

  for (const playerId of acquiredPlayerIds) {
    let playerPoints = 0
    for (const weekInfo of weeksAfterTrade) {
      const weeklyPoints = playerWeeklyPoints.find(
        (p) =>
          p.playerId === playerId &&
          p.seasonId === weekInfo.seasonId &&
          p.week === weekInfo.week
      )
      if (weeklyPoints) {
        playerPoints += weeklyPoints.points
      }
    }
    acquired.push({
      playerId,
      name: playerNames.get(playerId) ?? `Player ${playerId}`,
      points: playerPoints,
    })
    totalAcquiredPoints += playerPoints
  }

  // Calculate points for lost players
  const lost: { playerId: string; name: string; points: number }[] = []
  let totalLostPoints = 0

  for (const playerId of lostPlayerIds) {
    let playerPoints = 0
    for (const weekInfo of weeksAfterTrade) {
      const weeklyPoints = playerWeeklyPoints.find(
        (p) =>
          p.playerId === playerId &&
          p.seasonId === weekInfo.seasonId &&
          p.week === weekInfo.week
      )
      if (weeklyPoints) {
        playerPoints += weeklyPoints.points
      }
    }
    lost.push({
      playerId,
      name: playerNames.get(playerId) ?? `Player ${playerId}`,
      points: playerPoints,
    })
    totalLostPoints += playerPoints
  }

  // Calculate pick value differential
  const totalPicksReceivedValue = picksReceived.reduce((sum, p) => sum + p.value, 0)
  const totalPicksGivenValue = picksGiven.reduce((sum, p) => sum + p.value, 0)
  const pickValue = totalPicksReceivedValue - totalPicksGivenValue

  // Calculate player point differential
  const playerDifferential = totalAcquiredPoints - totalLostPoints

  // Total differential includes pick value
  const totalDifferential = playerDifferential + pickValue

  // Determine grade
  // If we don't have enough weeks to analyze, it's TBD
  const weeksAnalyzed = weeksAfterTrade.length
  let grade: 'pear' | 'grape' | 'tbd' = 'tbd'

  if (weeksAnalyzed >= WEEKS_TO_ANALYZE) {
    if (totalDifferential >= 0) {
      grade = 'pear'
    } else {
      grade = 'grape'
    }
  }

  return {
    grade,
    playerDifferential,
    pickValue,
    totalDifferential,
    weeksAnalyzed,
    acquired,
    lost,
    picksReceived,
    picksGiven,
  }
}

/**
 * Calculate keeper success rate - percentage of keepers who scored above league average
 */
export function calculateKeeperSuccess(
  keepers: { playerId: string; totalPoints: number }[],
  leagueAverageKeeperPoints: number
): number {
  if (keepers.length === 0) return 0

  const aboveAverage = keepers.filter(
    (k) => k.totalPoints > leagueAverageKeeperPoints
  ).length

  return (aboveAverage / keepers.length) * 100
}

/**
 * Calculate league average points for keepers to determine success rate
 */
export function calculateLeagueAverageKeeperPoints(
  allKeepers: { playerId: string; totalPoints: number }[]
): number {
  if (allKeepers.length === 0) return 0

  const total = allKeepers.reduce((sum, k) => sum + k.totalPoints, 0)
  return total / allKeepers.length
}

/**
 * Get the display round for a draft pick (converts Sleeper rounds to league rounds)
 * Sleeper round 7 = "1st round" in keeper league terminology
 */
export function getDisplayRound(sleeperRound: number): string {
  const displayRound = sleeperRound - 6
  if (displayRound <= 0) return 'Keeper'
  return `Round ${displayRound}`
}

/**
 * Format points for display
 */
export function formatGMPoints(points: number): string {
  return points.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/**
 * Format differential for display (with sign)
 */
export function formatDifferential(diff: number): string {
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${diff.toFixed(1)}`
}
