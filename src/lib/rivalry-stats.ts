/**
 * Rivalry Statistics Utilities
 * Calculate head-to-head statistics between two fantasy football teams
 */

// Types
export interface RivalryMatchup {
  season_id: number
  season_year: number
  week: number
  teamA_roster_id: number
  teamB_roster_id: number
  teamA_points: number
  teamB_points: number
  winner: 'teamA' | 'teamB' | 'tie'
  margin: number
}

export interface RivalryStats {
  allTimeRecord: {
    teamAWins: number
    teamBWins: number
    ties: number
    totalGames: number
  }
  scoringComparison: {
    teamAAvg: number
    teamBAvg: number
    teamATotal: number
    teamBTotal: number
  }
  biggestBlowouts: {
    teamA: RivalryMatchup | null
    teamB: RivalryMatchup | null
    overall: RivalryMatchup | null
  }
  closestGames: RivalryMatchup[]
  revengeGames: RevengeGame[]
  matchupHistory: RivalryMatchup[]
}

export interface RevengeGame {
  lossMatchup: RivalryMatchup
  revengeMatchup: RivalryMatchup
  weeksBetween: number
  avengedBy: 'teamA' | 'teamB'
}

interface RawMatchup {
  season_id: number
  week: number
  matchup_id: number
  roster_id: number
  points: number | null
}

interface Season {
  id: number
  season_year: number
}

/**
 * Find all head-to-head matchups between two teams
 * Groups by season_id + week + matchup_id and keeps pairs where both teams faced each other
 */
export function findHeadToHeadMatchups(
  allMatchups: RawMatchup[],
  teamARosterId: number,
  teamBRosterId: number,
  seasons: Season[]
): RivalryMatchup[] {
  const seasonYearMap = new Map(seasons.map((s) => [s.id, s.season_year]))

  // Group matchups by season_id + week + matchup_id
  const groups = new Map<string, RawMatchup[]>()

  allMatchups.forEach((m) => {
    const key = `${m.season_id}-${m.week}-${m.matchup_id}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(m)
  })

  const headToHead: RivalryMatchup[] = []

  groups.forEach((group) => {
    // Only keep groups where both selected teams are present
    const teamAMatch = group.find((m) => m.roster_id === teamARosterId)
    const teamBMatch = group.find((m) => m.roster_id === teamBRosterId)

    if (teamAMatch && teamBMatch) {
      const teamAPoints = teamAMatch.points ?? 0
      const teamBPoints = teamBMatch.points ?? 0
      const margin = Math.abs(teamAPoints - teamBPoints)

      let winner: 'teamA' | 'teamB' | 'tie' = 'tie'
      if (teamAPoints > teamBPoints) winner = 'teamA'
      else if (teamBPoints > teamAPoints) winner = 'teamB'

      headToHead.push({
        season_id: teamAMatch.season_id,
        season_year: seasonYearMap.get(teamAMatch.season_id) ?? 0,
        week: teamAMatch.week,
        teamA_roster_id: teamARosterId,
        teamB_roster_id: teamBRosterId,
        teamA_points: teamAPoints,
        teamB_points: teamBPoints,
        winner,
        margin,
      })
    }
  })

  // Sort chronologically
  headToHead.sort((a, b) => {
    if (a.season_year !== b.season_year) return a.season_year - b.season_year
    return a.week - b.week
  })

  return headToHead
}

/**
 * Calculate all-time record between two teams
 */
export function calculateAllTimeRecord(matchups: RivalryMatchup[]): RivalryStats['allTimeRecord'] {
  let teamAWins = 0
  let teamBWins = 0
  let ties = 0

  matchups.forEach((m) => {
    if (m.winner === 'teamA') teamAWins++
    else if (m.winner === 'teamB') teamBWins++
    else ties++
  })

  return {
    teamAWins,
    teamBWins,
    ties,
    totalGames: matchups.length,
  }
}

/**
 * Calculate scoring averages and totals for both teams
 */
export function calculateScoringComparison(
  matchups: RivalryMatchup[]
): RivalryStats['scoringComparison'] {
  if (matchups.length === 0) {
    return { teamAAvg: 0, teamBAvg: 0, teamATotal: 0, teamBTotal: 0 }
  }

  const teamATotal = matchups.reduce((sum, m) => sum + m.teamA_points, 0)
  const teamBTotal = matchups.reduce((sum, m) => sum + m.teamB_points, 0)

  return {
    teamAAvg: teamATotal / matchups.length,
    teamBAvg: teamBTotal / matchups.length,
    teamATotal,
    teamBTotal,
  }
}

/**
 * Find the biggest blowout win for each team and overall
 */
export function findBiggestBlowouts(matchups: RivalryMatchup[]): RivalryStats['biggestBlowouts'] {
  let teamABiggest: RivalryMatchup | null = null
  let teamBBiggest: RivalryMatchup | null = null

  for (const m of matchups) {
    if (m.winner === 'teamA') {
      if (!teamABiggest || m.margin > teamABiggest.margin) {
        teamABiggest = m
      }
    } else if (m.winner === 'teamB') {
      if (!teamBBiggest || m.margin > teamBBiggest.margin) {
        teamBBiggest = m
      }
    }
  }

  // Determine overall biggest
  let overall: RivalryMatchup | null = null
  if (teamABiggest !== null && teamBBiggest !== null) {
    overall = teamABiggest.margin >= teamBBiggest.margin ? teamABiggest : teamBBiggest
  } else if (teamABiggest !== null) {
    overall = teamABiggest
  } else {
    overall = teamBBiggest
  }

  return { teamA: teamABiggest, teamB: teamBBiggest, overall }
}

/**
 * Find the N closest games by margin
 */
export function findClosestGames(matchups: RivalryMatchup[], limit: number = 5): RivalryMatchup[] {
  // Filter out ties (margin = 0) as they're not "close games" in the exciting sense
  const decidedGames = matchups.filter((m) => m.winner !== 'tie')

  return [...decidedGames].sort((a, b) => a.margin - b.margin).slice(0, limit)
}

/**
 * Track revenge games: when a team loses then beats the same opponent later
 */
export function trackRevengeGames(matchups: RivalryMatchup[]): RevengeGame[] {
  const revengeGames: RevengeGame[] = []

  // Track last loss for each team
  let teamALastLoss: RivalryMatchup | null = null
  let teamBLastLoss: RivalryMatchup | null = null

  // Matchups should already be sorted chronologically
  matchups.forEach((m) => {
    if (m.winner === 'teamA') {
      // Team A won - check if they're avenging a previous loss
      if (teamALastLoss) {
        const weeksBetween = calculateWeeksBetween(teamALastLoss, m)
        revengeGames.push({
          lossMatchup: teamALastLoss,
          revengeMatchup: m,
          weeksBetween,
          avengedBy: 'teamA',
        })
        teamALastLoss = null // Reset - they've avenged
      }
      // Team B just lost
      teamBLastLoss = m
    } else if (m.winner === 'teamB') {
      // Team B won - check if they're avenging a previous loss
      if (teamBLastLoss) {
        const weeksBetween = calculateWeeksBetween(teamBLastLoss, m)
        revengeGames.push({
          lossMatchup: teamBLastLoss,
          revengeMatchup: m,
          weeksBetween,
          avengedBy: 'teamB',
        })
        teamBLastLoss = null // Reset - they've avenged
      }
      // Team A just lost
      teamALastLoss = m
    }
    // Ties don't count as losses or wins for revenge tracking
  })

  return revengeGames
}

/**
 * Calculate approximate weeks between two matchups
 */
function calculateWeeksBetween(earlier: RivalryMatchup, later: RivalryMatchup): number {
  if (earlier.season_year === later.season_year) {
    return later.week - earlier.week
  }

  // Cross-season calculation (approximate)
  const seasonsApart = later.season_year - earlier.season_year
  const weeksInSeason = 17 // Approximate

  return seasonsApart * weeksInSeason + (later.week - earlier.week)
}

/**
 * Prepare chart data for point differential over time
 */
export function prepareChartData(matchups: RivalryMatchup[]): {
  label: string
  margin: number
  winner: 'teamA' | 'teamB' | 'tie'
  teamAPoints: number
  teamBPoints: number
  week: number
  seasonYear: number
}[] {
  return matchups.map((m) => ({
    label: `${m.season_year.toString().slice(-2)}W${m.week}`,
    margin: m.winner === 'teamA' ? m.margin : m.winner === 'teamB' ? -m.margin : 0,
    winner: m.winner,
    teamAPoints: m.teamA_points,
    teamBPoints: m.teamB_points,
    week: m.week,
    seasonYear: m.season_year,
  }))
}

/**
 * Main function to calculate all rivalry stats
 */
export function calculateRivalryStats(
  allMatchups: RawMatchup[],
  teamARosterId: number,
  teamBRosterId: number,
  seasons: Season[]
): RivalryStats {
  const headToHead = findHeadToHeadMatchups(allMatchups, teamARosterId, teamBRosterId, seasons)

  return {
    allTimeRecord: calculateAllTimeRecord(headToHead),
    scoringComparison: calculateScoringComparison(headToHead),
    biggestBlowouts: findBiggestBlowouts(headToHead),
    closestGames: findClosestGames(headToHead, 5),
    revengeGames: trackRevengeGames(headToHead),
    matchupHistory: headToHead,
  }
}

/**
 * Format matchup label for display
 */
export function formatMatchupLabel(seasonYear: number, week: number): string {
  return `${seasonYear}-${(seasonYear + 1).toString().slice(-2)} Week ${week}`
}

/**
 * Format points for display
 */
export function formatPoints(points: number): string {
  return points.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format margin for display (with + prefix for positive)
 */
export function formatMargin(margin: number): string {
  const formatted = margin.toFixed(2)
  return `+${formatted}`
}
