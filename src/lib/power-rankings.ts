// Power Rankings Calculation Utilities

export interface MatchupData {
  roster_id: number
  matchup_id: number
  week: number
  points: number | null
}

export interface RosterData {
  roster_id: number
  team_name: string | null
}

export interface WeeklyRank {
  week: number
  rank: number
  points: number
}

export interface PowerRankingRow {
  roster_id: number
  team_name: string
  power_rank: number
  power_score: number
  actual_wins: number
  actual_losses: number
  actual_ties: number
  expected_wins: number
  luck_index: number
  should_be_wins: number
  should_be_losses: number
  consistency_score: number
  avg_points: number
  total_points: number
  strength_of_schedule: number
  weekly_ranks: WeeklyRank[]
  weeks_played: number
}

/**
 * Groups matchups by week for easier processing
 */
export function groupMatchupsByWeek(
  matchups: MatchupData[]
): Map<number, MatchupData[]> {
  const byWeek = new Map<number, MatchupData[]>()

  matchups.forEach((m) => {
    if (!byWeek.has(m.week)) {
      byWeek.set(m.week, [])
    }
    byWeek.get(m.week)!.push(m)
  })

  return byWeek
}

/**
 * Calculate expected wins based on points scored vs all opponents each week
 * For each week, count how many teams this team would have beaten
 */
export function calculateExpectedWins(
  rosterId: number,
  matchupsByWeek: Map<number, MatchupData[]>
): number {
  let expectedWins = 0

  matchupsByWeek.forEach((weekMatchups) => {
    const teamMatchup = weekMatchups.find((m) => m.roster_id === rosterId)
    if (!teamMatchup) return

    const teamPoints = teamMatchup.points ?? 0
    const opponents = weekMatchups.filter((m) => m.roster_id !== rosterId)

    if (opponents.length === 0) return

    // Count wins and ties against all other teams
    const winsThisWeek = opponents.filter(
      (opp) => teamPoints > (opp.points ?? 0)
    ).length
    const tiesThisWeek = opponents.filter(
      (opp) => teamPoints === (opp.points ?? 0)
    ).length

    // Normalize to 0-1 scale for this week
    const totalOpponents = opponents.length
    expectedWins += (winsThisWeek + tiesThisWeek * 0.5) / totalOpponents
  })

  return expectedWins
}

/**
 * Calculate actual wins/losses/ties from head-to-head matchups
 */
export function calculateActualRecord(
  rosterId: number,
  matchupsByWeek: Map<number, MatchupData[]>
): { wins: number; losses: number; ties: number } {
  let wins = 0
  let losses = 0
  let ties = 0

  matchupsByWeek.forEach((weekMatchups) => {
    const teamMatchup = weekMatchups.find((m) => m.roster_id === rosterId)
    if (!teamMatchup || teamMatchup.matchup_id === null) return

    // Find opponent (same matchup_id, different roster)
    const opponent = weekMatchups.find(
      (m) =>
        m.matchup_id === teamMatchup.matchup_id && m.roster_id !== rosterId
    )

    if (!opponent) return

    const teamPoints = teamMatchup.points ?? 0
    const oppPoints = opponent.points ?? 0

    if (teamPoints > oppPoints) wins++
    else if (teamPoints < oppPoints) losses++
    else ties++
  })

  return { wins, losses, ties }
}

/**
 * Calculate consistency score (standard deviation of weekly points)
 * Lower = more consistent
 */
export function calculateConsistency(weeklyPoints: number[]): number {
  if (weeklyPoints.length === 0) return 0

  const mean = weeklyPoints.reduce((a, b) => a + b, 0) / weeklyPoints.length
  const squaredDiffs = weeklyPoints.map((p) => Math.pow(p - mean, 2))
  const variance =
    squaredDiffs.reduce((a, b) => a + b, 0) / weeklyPoints.length

  return Math.sqrt(variance)
}

/**
 * Calculate strength of schedule (average points scored by actual opponents)
 */
export function calculateStrengthOfSchedule(
  rosterId: number,
  matchupsByWeek: Map<number, MatchupData[]>
): number {
  let totalOpponentPoints = 0
  let matchCount = 0

  matchupsByWeek.forEach((weekMatchups) => {
    const teamMatchup = weekMatchups.find((m) => m.roster_id === rosterId)
    if (!teamMatchup || teamMatchup.matchup_id === null) return

    // Find the actual opponent
    const opponent = weekMatchups.find(
      (m) =>
        m.matchup_id === teamMatchup.matchup_id && m.roster_id !== rosterId
    )

    if (opponent) {
      totalOpponentPoints += opponent.points ?? 0
      matchCount++
    }
  })

  return matchCount > 0 ? totalOpponentPoints / matchCount : 0
}

/**
 * Calculate "should be" record (wins/losses vs league median each week)
 */
export function calculateShouldBeRecord(
  rosterId: number,
  matchupsByWeek: Map<number, MatchupData[]>
): { wins: number; losses: number } {
  let wins = 0
  let losses = 0

  matchupsByWeek.forEach((weekMatchups) => {
    const teamMatchup = weekMatchups.find((m) => m.roster_id === rosterId)
    if (!teamMatchup) return

    // Get all points for this week and find median
    const allPoints = weekMatchups
      .map((m) => m.points ?? 0)
      .sort((a, b) => a - b)

    if (allPoints.length === 0) return

    const midIndex = Math.floor(allPoints.length / 2)
    const median =
      allPoints.length % 2 === 0
        ? (allPoints[midIndex - 1] + allPoints[midIndex]) / 2
        : allPoints[midIndex]

    const teamPoints = teamMatchup.points ?? 0

    if (teamPoints > median) wins++
    else if (teamPoints < median) losses++
    // Ties vs median count as nothing (or could be 0.5 wins)
  })

  return { wins, losses }
}

/**
 * Get weekly points for a team
 */
export function getWeeklyPoints(
  rosterId: number,
  matchupsByWeek: Map<number, MatchupData[]>
): number[] {
  const points: number[] = []

  // Sort weeks to get them in order
  const sortedWeeks = Array.from(matchupsByWeek.keys()).sort((a, b) => a - b)

  sortedWeeks.forEach((week) => {
    const weekMatchups = matchupsByWeek.get(week)!
    const teamMatchup = weekMatchups.find((m) => m.roster_id === rosterId)
    if (teamMatchup) {
      points.push(teamMatchup.points ?? 0)
    }
  })

  return points
}

/**
 * Calculate weekly power ranks for trend chart
 */
export function calculateWeeklyRanks(
  rosterId: number,
  matchupsByWeek: Map<number, MatchupData[]>,
  allRosterIds: number[]
): WeeklyRank[] {
  const weeklyRanks: WeeklyRank[] = []
  const sortedWeeks = Array.from(matchupsByWeek.keys()).sort((a, b) => a - b)

  // Track cumulative stats for each roster up to each week
  sortedWeeks.forEach((week, weekIndex) => {
    // Calculate cumulative expected wins for each roster up to this week
    const cumulativeWeeks = new Map<number, MatchupData[]>()
    sortedWeeks.slice(0, weekIndex + 1).forEach((w) => {
      cumulativeWeeks.set(w, matchupsByWeek.get(w)!)
    })

    // Calculate power scores for all rosters at this point
    const scores: { rosterId: number; score: number; points: number }[] = []

    allRosterIds.forEach((rid) => {
      const weeklyPoints = getWeeklyPoints(rid, cumulativeWeeks)
      const totalPoints = weeklyPoints.reduce((a, b) => a + b, 0)
      const avgPoints = weeklyPoints.length > 0 ? totalPoints / weeklyPoints.length : 0
      const expectedWins = calculateExpectedWins(rid, cumulativeWeeks)
      const { wins } = calculateActualRecord(rid, cumulativeWeeks)
      const consistency = calculateConsistency(weeklyPoints)

      // Simplified power score for weekly ranking
      const maxConsistency = 50 // Normalize consistency
      const normalizedConsistency = Math.max(0, 1 - consistency / maxConsistency)

      const score =
        wins * 0.35 +
        avgPoints * 0.003 + // Scale down points
        expectedWins * 0.2 +
        normalizedConsistency * 0.1

      scores.push({ rosterId: rid, score, points: avgPoints })
    })

    // Sort by score descending to get ranks
    scores.sort((a, b) => b.score - a.score)

    // Find this team's rank
    const rankIndex = scores.findIndex((s) => s.rosterId === rosterId)
    const teamScore = scores.find((s) => s.rosterId === rosterId)

    if (rankIndex !== -1) {
      weeklyRanks.push({
        week,
        rank: rankIndex + 1,
        points: teamScore?.points ?? 0,
      })
    }
  })

  return weeklyRanks
}

/**
 * Calculate composite power score for final ranking
 */
export function calculatePowerScore(
  actualWins: number,
  avgPoints: number,
  expectedWins: number,
  consistency: number,
  allTeamStats: {
    wins: number
    avgPoints: number
    expectedWins: number
    consistency: number
  }[]
): number {
  // Get max values for normalization
  const maxWins = Math.max(...allTeamStats.map((t) => t.wins), 1)
  const maxPoints = Math.max(...allTeamStats.map((t) => t.avgPoints), 1)
  const maxExpectedWins = Math.max(...allTeamStats.map((t) => t.expectedWins), 1)
  const maxConsistency = Math.max(...allTeamStats.map((t) => t.consistency), 1)

  // Normalize each metric to 0-1 scale
  const normalizedRecord = actualWins / maxWins
  const normalizedPoints = avgPoints / maxPoints
  const normalizedExpected = expectedWins / maxExpectedWins
  const normalizedConsistency = 1 - consistency / maxConsistency // Invert so lower is better

  // Weighted composite
  const WEIGHT_RECORD = 0.35
  const WEIGHT_AVG_POINTS = 0.30
  const WEIGHT_EXPECTED_WINS = 0.20
  const WEIGHT_CONSISTENCY = 0.15

  return (
    normalizedRecord * WEIGHT_RECORD +
    normalizedPoints * WEIGHT_AVG_POINTS +
    normalizedExpected * WEIGHT_EXPECTED_WINS +
    normalizedConsistency * WEIGHT_CONSISTENCY
  )
}

/**
 * Main function to calculate all power rankings
 */
export function calculatePowerRankings(
  matchups: MatchupData[],
  rosters: RosterData[]
): PowerRankingRow[] {
  const matchupsByWeek = groupMatchupsByWeek(matchups)
  const allRosterIds = rosters.map((r) => r.roster_id)

  // First pass: calculate all raw stats
  const rawStats = rosters.map((roster) => {
    const weeklyPoints = getWeeklyPoints(roster.roster_id, matchupsByWeek)
    const totalPoints = weeklyPoints.reduce((a, b) => a + b, 0)
    const avgPoints = weeklyPoints.length > 0 ? totalPoints / weeklyPoints.length : 0
    const record = calculateActualRecord(roster.roster_id, matchupsByWeek)
    const expectedWins = calculateExpectedWins(roster.roster_id, matchupsByWeek)
    const consistency = calculateConsistency(weeklyPoints)
    const sos = calculateStrengthOfSchedule(roster.roster_id, matchupsByWeek)
    const shouldBe = calculateShouldBeRecord(roster.roster_id, matchupsByWeek)
    const weeklyRanks = calculateWeeklyRanks(
      roster.roster_id,
      matchupsByWeek,
      allRosterIds
    )

    return {
      roster_id: roster.roster_id,
      team_name: roster.team_name || `Team ${roster.roster_id}`,
      actual_wins: record.wins,
      actual_losses: record.losses,
      actual_ties: record.ties,
      expected_wins: expectedWins,
      luck_index: record.wins - expectedWins,
      should_be_wins: shouldBe.wins,
      should_be_losses: shouldBe.losses,
      consistency_score: consistency,
      avg_points: avgPoints,
      total_points: totalPoints,
      strength_of_schedule: sos,
      weekly_ranks: weeklyRanks,
      weeks_played: weeklyPoints.length,
    }
  })

  // Collect stats for normalization
  const allTeamStats = rawStats.map((s) => ({
    wins: s.actual_wins,
    avgPoints: s.avg_points,
    expectedWins: s.expected_wins,
    consistency: s.consistency_score,
  }))

  // Second pass: calculate power scores and ranks
  const withScores = rawStats.map((stats) => ({
    ...stats,
    power_score: calculatePowerScore(
      stats.actual_wins,
      stats.avg_points,
      stats.expected_wins,
      stats.consistency_score,
      allTeamStats
    ),
    power_rank: 0, // Will be set after sorting
  }))

  // Sort by power score descending
  withScores.sort((a, b) => b.power_score - a.power_score)

  // Assign ranks
  withScores.forEach((team, index) => {
    team.power_rank = index + 1
  })

  return withScores
}

/**
 * Get summary stats (luckiest, unluckiest, most consistent, toughest schedule)
 */
export function getSummaryStats(rankings: PowerRankingRow[]) {
  if (rankings.length === 0) {
    return {
      luckiest: null,
      unluckiest: null,
      mostConsistent: null,
      toughestSchedule: null,
    }
  }

  const luckiest = [...rankings].sort((a, b) => b.luck_index - a.luck_index)[0]
  const unluckiest = [...rankings].sort((a, b) => a.luck_index - b.luck_index)[0]
  const mostConsistent = [...rankings].sort(
    (a, b) => a.consistency_score - b.consistency_score
  )[0]
  const toughestSchedule = [...rankings].sort(
    (a, b) => b.strength_of_schedule - a.strength_of_schedule
  )[0]

  return {
    luckiest,
    unluckiest,
    mostConsistent,
    toughestSchedule,
  }
}
