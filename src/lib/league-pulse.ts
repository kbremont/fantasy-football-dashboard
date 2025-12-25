// League Pulse Calculation Utilities

// Re-export common types
export interface MatchupData {
  roster_id: number
  matchup_id: number
  week: number
  points: number | null
  season_id: number
}

export interface RosterData {
  roster_id: number
  team_name: string | null
}

export interface Season {
  id: number
  season_year: number
  is_current: boolean | null
}

// Weekly high/low scores
export interface WeeklyExtreme {
  week: number
  high: { roster_id: number; team_name: string; points: number }
  low: { roster_id: number; team_name: string; points: number }
  spread: number
}

// Matchup pair with full details
export interface MatchupPairData {
  week: number
  matchup_id: number
  season_id: number
  season_year: number
  team1: { roster_id: number; team_name: string; points: number }
  team2: { roster_id: number; team_name: string; points: number }
  margin: number
  winner: 'team1' | 'team2' | 'tie'
}

// Game of the Week
export interface GameOfTheWeek {
  matchup: MatchupPairData
  excitementScore: number
  reason: 'Photo Finish' | 'Nail-biter' | 'Shootout' | 'Classic Clash' | 'Statement Win'
}

// Weekly trend data point
export interface WeeklyTrendPoint {
  week: number
  avgScore: number
  highScore: number
  lowScore: number
  medianScore: number
}

// Scoring distribution bucket
export interface ScoringBucket {
  range: string
  min: number
  max: number
  count: number
  percentage: number
}

// Parity metrics
export interface ParityMetrics {
  parityIndex: number // 0-100, higher = more competitive
  avgMargin: number
  closeGamePercentage: number // Games decided by < 10 points
  blowoutPercentage: number // Games decided by > 40 points
  totalGames: number
}

// League records
export interface LeagueRecord {
  team_name: string
  value: number
  week: number
  season_year: number
  context?: string
}

export interface LeagueRecords {
  highestScore: LeagueRecord | null
  lowestScore: LeagueRecord | null
  lowestWinningScore: LeagueRecord | null
  biggestBlowout: {
    winner: string
    loser: string
    margin: number
    week: number
    season_year: number
  } | null
  closestGame: {
    winner: string
    loser: string
    margin: number
    week: number
    season_year: number
  } | null
  longestWinStreak: {
    team_name: string
    streak: number
    season_year: number
  } | null
}

// Playoff race status
export interface PlayoffStatus {
  roster_id: number
  team_name: string
  wins: number
  losses: number
  ties: number
  pointsFor: number
  status: 'clinched' | 'contending' | 'eliminated' | 'in_hunt'
  gamesBack: number
}

// Full pulse data
export interface LeaguePulseData {
  weeklyExtremes: WeeklyExtreme[]
  gameOfTheWeek: GameOfTheWeek | null
  allMatchupPairs: MatchupPairData[]
  weeklyTrends: WeeklyTrendPoint[]
  scoringDistribution: ScoringBucket[]
  parityMetrics: ParityMetrics
  leagueRecords: LeagueRecords
  playoffRace: PlayoffStatus[]
  maxWeek: number
  seasonHighScore: {
    team_name: string
    points: number
    week: number
  } | null
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
 * Build matchup pairs from raw matchup data
 */
export function buildMatchupPairs(
  matchups: MatchupData[],
  rosters: RosterData[],
  seasons: Season[]
): MatchupPairData[] {
  const rosterMap = new Map(rosters.map((r) => [r.roster_id, r.team_name || `Team ${r.roster_id}`]))
  const seasonMap = new Map(seasons.map((s) => [s.id, s.season_year]))

  // Group by season, week, and matchup_id
  const grouped = new Map<string, MatchupData[]>()

  matchups.forEach((m) => {
    if (m.matchup_id === null) return
    const key = `${m.season_id}-${m.week}-${m.matchup_id}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(m)
  })

  const pairs: MatchupPairData[] = []

  grouped.forEach((pair) => {
    if (pair.length !== 2) return

    const [m1, m2] = pair.sort((a, b) => a.roster_id - b.roster_id)
    const points1 = m1.points ?? 0
    const points2 = m2.points ?? 0
    const margin = Math.abs(points1 - points2)

    let winner: 'team1' | 'team2' | 'tie' = 'tie'
    if (points1 > points2) winner = 'team1'
    else if (points2 > points1) winner = 'team2'

    // Skip matchups with 0-0 scores (likely incomplete data)
    if (points1 === 0 && points2 === 0) return

    pairs.push({
      week: m1.week,
      matchup_id: m1.matchup_id,
      season_id: m1.season_id,
      season_year: seasonMap.get(m1.season_id) ?? 0,
      team1: {
        roster_id: m1.roster_id,
        team_name: rosterMap.get(m1.roster_id) || `Team ${m1.roster_id}`,
        points: points1,
      },
      team2: {
        roster_id: m2.roster_id,
        team_name: rosterMap.get(m2.roster_id) || `Team ${m2.roster_id}`,
        points: points2,
      },
      margin,
      winner,
    })
  })

  return pairs.sort((a, b) => a.week - b.week)
}

/**
 * Calculate weekly high/low scores
 */
export function calculateWeeklyExtremes(
  matchups: MatchupData[],
  rosters: RosterData[]
): WeeklyExtreme[] {
  const rosterMap = new Map(rosters.map((r) => [r.roster_id, r.team_name || `Team ${r.roster_id}`]))
  const byWeek = groupMatchupsByWeek(matchups)
  const extremes: WeeklyExtreme[] = []

  const sortedWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b)

  sortedWeeks.forEach((week) => {
    const weekMatchups = byWeek.get(week)!
    const validMatchups = weekMatchups.filter((m) => m.points !== null && m.points > 0)

    if (validMatchups.length === 0) return

    const sorted = [...validMatchups].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    const highest = sorted[0]
    const lowest = sorted[sorted.length - 1]

    extremes.push({
      week,
      high: {
        roster_id: highest.roster_id,
        team_name: rosterMap.get(highest.roster_id) || `Team ${highest.roster_id}`,
        points: highest.points ?? 0,
      },
      low: {
        roster_id: lowest.roster_id,
        team_name: rosterMap.get(lowest.roster_id) || `Team ${lowest.roster_id}`,
        points: lowest.points ?? 0,
      },
      spread: (highest.points ?? 0) - (lowest.points ?? 0),
    })
  })

  return extremes
}

/**
 * Calculate excitement score for a matchup
 */
function calculateExcitementScore(matchup: MatchupPairData, avgScore: number): number {
  // Closeness score: 0-100, closer games score higher
  const closenessScore = Math.max(0, 50 - matchup.margin) * 2

  // Combined scoring score: higher combined scores = more exciting
  const combinedScore = matchup.team1.points + matchup.team2.points
  const scoringScore = Math.min(100, (combinedScore / (avgScore * 2)) * 50)

  // Weight: 60% closeness, 40% scoring
  return closenessScore * 0.6 + scoringScore * 0.4
}

/**
 * Determine reason label for game of the week
 */
function determineReason(matchup: MatchupPairData): GameOfTheWeek['reason'] {
  const combined = matchup.team1.points + matchup.team2.points

  if (matchup.margin < 3) return 'Photo Finish'
  if (matchup.margin < 10) return 'Nail-biter'
  if (combined > 280) return 'Shootout'
  if (matchup.margin > 50) return 'Statement Win'
  return 'Classic Clash'
}

/**
 * Find the game of the week (most exciting matchup in the most recent week)
 */
export function findGameOfTheWeek(
  matchupPairs: MatchupPairData[],
  maxWeek: number
): GameOfTheWeek | null {
  // Filter to most recent week with data
  const currentWeekMatchups = matchupPairs.filter((m) => m.week === maxWeek)

  if (currentWeekMatchups.length === 0) return null

  // Calculate average score for context
  const allPoints = currentWeekMatchups.flatMap((m) => [m.team1.points, m.team2.points])
  const avgScore = allPoints.reduce((a, b) => a + b, 0) / allPoints.length

  // Score each matchup
  const scored = currentWeekMatchups.map((matchup) => ({
    matchup,
    excitementScore: calculateExcitementScore(matchup, avgScore),
    reason: determineReason(matchup),
  }))

  // Return the most exciting
  return scored.sort((a, b) => b.excitementScore - a.excitementScore)[0]
}

/**
 * Calculate weekly trend data
 */
export function calculateWeeklyTrends(matchups: MatchupData[]): WeeklyTrendPoint[] {
  const byWeek = groupMatchupsByWeek(matchups)
  const trends: WeeklyTrendPoint[] = []

  const sortedWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b)

  sortedWeeks.forEach((week) => {
    const weekMatchups = byWeek.get(week)!
    const points = weekMatchups
      .filter((m) => m.points !== null && m.points > 0)
      .map((m) => m.points!)
      .sort((a, b) => a - b)

    if (points.length === 0) return

    const sum = points.reduce((a, b) => a + b, 0)
    const avg = sum / points.length
    const mid = Math.floor(points.length / 2)
    const median = points.length % 2 === 0 ? (points[mid - 1] + points[mid]) / 2 : points[mid]

    trends.push({
      week,
      avgScore: Math.round(avg * 10) / 10,
      highScore: points[points.length - 1],
      lowScore: points[0],
      medianScore: Math.round(median * 10) / 10,
    })
  })

  return trends
}

/**
 * Build scoring distribution histogram
 */
export function buildScoringDistribution(
  matchups: MatchupData[],
  bucketSize: number = 10
): ScoringBucket[] {
  const points = matchups
    .filter((m) => m.points !== null && m.points > 0)
    .map((m) => m.points!)

  if (points.length === 0) return []

  const min = Math.floor(Math.min(...points) / bucketSize) * bucketSize
  const max = Math.ceil(Math.max(...points) / bucketSize) * bucketSize

  const buckets: ScoringBucket[] = []

  for (let start = min; start < max; start += bucketSize) {
    const end = start + bucketSize
    const count = points.filter((p) => p >= start && p < end).length

    buckets.push({
      range: `${start}-${end}`,
      min: start,
      max: end,
      count,
      percentage: Math.round((count / points.length) * 100),
    })
  }

  return buckets
}

/**
 * Calculate parity metrics
 */
export function calculateParityMetrics(matchupPairs: MatchupPairData[]): ParityMetrics {
  if (matchupPairs.length === 0) {
    return {
      parityIndex: 0,
      avgMargin: 0,
      closeGamePercentage: 0,
      blowoutPercentage: 0,
      totalGames: 0,
    }
  }

  const margins = matchupPairs.map((m) => m.margin)
  const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length

  const closeGames = matchupPairs.filter((m) => m.margin < 10).length
  const blowouts = matchupPairs.filter((m) => m.margin > 40).length

  const closeGamePercentage = Math.round((closeGames / matchupPairs.length) * 100)
  const blowoutPercentage = Math.round((blowouts / matchupPairs.length) * 100)

  // Parity Index: 100 = perfectly competitive, 0 = all blowouts
  // Based on average margin and distribution
  // Lower average margin = higher parity
  // More close games = higher parity
  const marginFactor = Math.max(0, 100 - avgMargin * 2)
  const closeFactor = closeGamePercentage
  const parityIndex = Math.round(marginFactor * 0.6 + closeFactor * 0.4)

  return {
    parityIndex,
    avgMargin: Math.round(avgMargin * 10) / 10,
    closeGamePercentage,
    blowoutPercentage,
    totalGames: matchupPairs.length,
  }
}

/**
 * Calculate league records
 */
export function calculateLeagueRecords(
  matchups: MatchupData[],
  matchupPairs: MatchupPairData[],
  rosters: RosterData[],
  seasons: Season[]
): LeagueRecords {
  const rosterMap = new Map(rosters.map((r) => [r.roster_id, r.team_name || `Team ${r.roster_id}`]))
  const seasonMap = new Map(seasons.map((s) => [s.id, s.season_year]))

  // Highest score ever
  const validMatchups = matchups.filter((m) => m.points !== null && m.points > 0)
  const sortedByPoints = [...validMatchups].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))

  const highestScoreMatchup = sortedByPoints[0]
  const highestScore: LeagueRecord | null = highestScoreMatchup
    ? {
        team_name: rosterMap.get(highestScoreMatchup.roster_id) || 'Unknown',
        value: highestScoreMatchup.points ?? 0,
        week: highestScoreMatchup.week,
        season_year: seasonMap.get(highestScoreMatchup.season_id) ?? 0,
      }
    : null

  // Lowest score ever
  const lowestScoreMatchup = sortedByPoints[sortedByPoints.length - 1]
  const lowestScore: LeagueRecord | null = lowestScoreMatchup
    ? {
        team_name: rosterMap.get(lowestScoreMatchup.roster_id) || 'Unknown',
        value: lowestScoreMatchup.points ?? 0,
        week: lowestScoreMatchup.week,
        season_year: seasonMap.get(lowestScoreMatchup.season_id) ?? 0,
      }
    : null

  // Find winning scores and lowest winning score
  const winningScores: { roster_id: number; points: number; week: number; season_id: number }[] = []

  matchupPairs.forEach((pair) => {
    if (pair.winner === 'team1') {
      winningScores.push({
        roster_id: pair.team1.roster_id,
        points: pair.team1.points,
        week: pair.week,
        season_id: pair.season_id,
      })
    } else if (pair.winner === 'team2') {
      winningScores.push({
        roster_id: pair.team2.roster_id,
        points: pair.team2.points,
        week: pair.week,
        season_id: pair.season_id,
      })
    }
  })

  const sortedWinningScores = [...winningScores].sort((a, b) => a.points - b.points)
  const lowestWinMatchup = sortedWinningScores[0]
  const lowestWinningScore: LeagueRecord | null = lowestWinMatchup
    ? {
        team_name: rosterMap.get(lowestWinMatchup.roster_id) || 'Unknown',
        value: lowestWinMatchup.points,
        week: lowestWinMatchup.week,
        season_year: seasonMap.get(lowestWinMatchup.season_id) ?? 0,
      }
    : null

  // Biggest blowout
  const sortedByMargin = [...matchupPairs].sort((a, b) => b.margin - a.margin)
  const biggestBlowoutMatch = sortedByMargin[0]
  const biggestBlowout = biggestBlowoutMatch
    ? {
        winner:
          biggestBlowoutMatch.winner === 'team1'
            ? biggestBlowoutMatch.team1.team_name
            : biggestBlowoutMatch.team2.team_name,
        loser:
          biggestBlowoutMatch.winner === 'team1'
            ? biggestBlowoutMatch.team2.team_name
            : biggestBlowoutMatch.team1.team_name,
        margin: biggestBlowoutMatch.margin,
        week: biggestBlowoutMatch.week,
        season_year: biggestBlowoutMatch.season_year,
      }
    : null

  // Closest game (excluding ties with 0 margin if they're not real close games)
  const nonTieGames = matchupPairs.filter((m) => m.winner !== 'tie' && m.margin > 0)
  const sortedByCloseness = [...nonTieGames].sort((a, b) => a.margin - b.margin)
  const closestMatch = sortedByCloseness[0]
  const closestGame = closestMatch
    ? {
        winner:
          closestMatch.winner === 'team1'
            ? closestMatch.team1.team_name
            : closestMatch.team2.team_name,
        loser:
          closestMatch.winner === 'team1'
            ? closestMatch.team2.team_name
            : closestMatch.team1.team_name,
        margin: closestMatch.margin,
        week: closestMatch.week,
        season_year: closestMatch.season_year,
      }
    : null

  // Longest win streak
  const streaks = calculateWinStreaks(matchupPairs, rosters)
  let longestWinStreak: LeagueRecords['longestWinStreak'] = null

  streaks.forEach((streak, rosterId) => {
    if (!longestWinStreak || streak.longest > longestWinStreak.streak) {
      longestWinStreak = {
        team_name: rosterMap.get(rosterId) || 'Unknown',
        streak: streak.longest,
        season_year: streak.season_year,
      }
    }
  })

  return {
    highestScore,
    lowestScore,
    lowestWinningScore,
    biggestBlowout,
    closestGame,
    longestWinStreak,
  }
}

/**
 * Calculate win streaks for all teams
 */
export function calculateWinStreaks(
  matchupPairs: MatchupPairData[],
  rosters: RosterData[]
): Map<number, { current: number; longest: number; season_year: number }> {
  const streaks = new Map<number, { current: number; longest: number; season_year: number }>()

  rosters.forEach((r) => {
    streaks.set(r.roster_id, { current: 0, longest: 0, season_year: 0 })
  })

  // Sort matchups by season and week
  const sorted = [...matchupPairs].sort((a, b) => {
    if (a.season_id !== b.season_id) return a.season_id - b.season_id
    return a.week - b.week
  })

  // Track current streaks per team
  const currentStreaks = new Map<number, number>()
  rosters.forEach((r) => currentStreaks.set(r.roster_id, 0))

  sorted.forEach((matchup) => {
    const winnerId =
      matchup.winner === 'team1'
        ? matchup.team1.roster_id
        : matchup.winner === 'team2'
          ? matchup.team2.roster_id
          : null

    const loserId =
      matchup.winner === 'team1'
        ? matchup.team2.roster_id
        : matchup.winner === 'team2'
          ? matchup.team1.roster_id
          : null

    // Winner extends streak
    if (winnerId !== null) {
      const current = (currentStreaks.get(winnerId) ?? 0) + 1
      currentStreaks.set(winnerId, current)

      const streakData = streaks.get(winnerId)!
      if (current > streakData.longest) {
        streakData.longest = current
        streakData.season_year = matchup.season_year
      }
      streakData.current = current
    }

    // Loser resets streak
    if (loserId !== null) {
      currentStreaks.set(loserId, 0)
      const streakData = streaks.get(loserId)
      if (streakData) {
        streakData.current = 0
      }
    }
  })

  return streaks
}

/**
 * Calculate playoff race standings
 */
export function calculatePlayoffRace(
  matchupPairs: MatchupPairData[],
  rosters: RosterData[],
  playoffSpots: number = 6
): PlayoffStatus[] {
  const standings = new Map<
    number,
    { wins: number; losses: number; ties: number; pointsFor: number; team_name: string }
  >()

  rosters.forEach((r) => {
    standings.set(r.roster_id, {
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      team_name: r.team_name || `Team ${r.roster_id}`,
    })
  })

  // Accumulate records
  matchupPairs.forEach((matchup) => {
    const team1 = standings.get(matchup.team1.roster_id)
    const team2 = standings.get(matchup.team2.roster_id)

    if (team1) {
      team1.pointsFor += matchup.team1.points
      if (matchup.winner === 'team1') team1.wins++
      else if (matchup.winner === 'team2') team1.losses++
      else team1.ties++
    }

    if (team2) {
      team2.pointsFor += matchup.team2.points
      if (matchup.winner === 'team2') team2.wins++
      else if (matchup.winner === 'team1') team2.losses++
      else team2.ties++
    }
  })

  // Convert to array and sort
  const sorted = Array.from(standings.entries())
    .map(([roster_id, data]) => ({
      roster_id,
      ...data,
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.pointsFor - a.pointsFor
    })

  // Calculate games back from playoff spot
  const playoffCutoff = sorted[playoffSpots - 1]?.wins ?? 0

  return sorted.map((team, index) => {
    const gamesBack = playoffCutoff - team.wins

    let status: PlayoffStatus['status'] = 'in_hunt'
    if (index < playoffSpots) {
      if (gamesBack <= -3) {
        status = 'clinched'
      } else {
        status = 'contending'
      }
    } else {
      if (gamesBack > 4) {
        status = 'eliminated'
      } else {
        status = 'in_hunt'
      }
    }

    return {
      roster_id: team.roster_id,
      team_name: team.team_name,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      pointsFor: Math.round(team.pointsFor * 10) / 10,
      status,
      gamesBack: Math.max(0, gamesBack),
    }
  })
}

/**
 * Calculate all league pulse data
 */
export function calculateLeaguePulse(
  matchups: MatchupData[],
  rosters: RosterData[],
  seasons: Season[],
  currentSeasonId: number
): LeaguePulseData {
  // Filter to current season for most metrics
  const seasonMatchups = matchups.filter((m) => m.season_id === currentSeasonId)

  const allMatchupPairs = buildMatchupPairs(matchups, rosters, seasons)
  const seasonMatchupPairs = allMatchupPairs.filter((m) => m.season_id === currentSeasonId)

  const weeklyExtremes = calculateWeeklyExtremes(seasonMatchups, rosters)
  const maxWeek = weeklyExtremes.length > 0 ? Math.max(...weeklyExtremes.map((e) => e.week)) : 0

  const gameOfTheWeek = findGameOfTheWeek(seasonMatchupPairs, maxWeek)
  const weeklyTrends = calculateWeeklyTrends(seasonMatchups)
  const scoringDistribution = buildScoringDistribution(seasonMatchups)
  const parityMetrics = calculateParityMetrics(seasonMatchupPairs)
  const playoffRace = calculatePlayoffRace(seasonMatchupPairs, rosters)

  // Find season high score
  const seasonHighScoreExtreme = weeklyExtremes.reduce<WeeklyExtreme | null>((best, current) => {
    if (!best || current.high.points > best.high.points) {
      return current
    }
    return best
  }, null)

  const seasonHighScore = seasonHighScoreExtreme
    ? {
        team_name: seasonHighScoreExtreme.high.team_name,
        points: seasonHighScoreExtreme.high.points,
        week: seasonHighScoreExtreme.week,
      }
    : null

  return {
    weeklyExtremes,
    gameOfTheWeek,
    allMatchupPairs,
    weeklyTrends,
    scoringDistribution,
    parityMetrics,
    leagueRecords: {
      highestScore: null,
      lowestScore: null,
      lowestWinningScore: null,
      biggestBlowout: null,
      closestGame: null,
      longestWinStreak: null,
    }, // Will be calculated separately for all-time
    playoffRace,
    maxWeek,
    seasonHighScore,
  }
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
 * Format margin for display
 */
export function formatMargin(margin: number): string {
  return `+${margin.toFixed(2)}`
}

/**
 * Get parity label based on index
 */
export function getParityLabel(index: number): string {
  if (index >= 80) return 'Highly Competitive'
  if (index >= 60) return 'Well-Balanced'
  if (index >= 40) return 'Moderate'
  if (index >= 20) return 'Top-Heavy'
  return 'Dominated'
}

/**
 * Get margin interpretation
 */
export function getMarginLabel(avgMargin: number): string {
  if (avgMargin < 10) return 'Nail-biters'
  if (avgMargin < 20) return 'Competitive'
  if (avgMargin < 30) return 'Moderate'
  return 'Blowout-Heavy'
}
