// College Football Scouting - Type definitions and utility functions

import type { Database } from '@/types/database'

export type CFBPlayerStat = Database['public']['Tables']['cfb_player_season_stats']['Row']

// Position color palette
export const POSITION_COLORS: Record<string, string> = {
  QB: 'hsl(200, 70%, 55%)',
  RB: 'hsl(142, 76%, 46%)',
  WR: 'hsl(38, 92%, 55%)',
  TE: 'hsl(280, 65%, 55%)',
  OL: 'hsl(25, 85%, 55%)',
  DL: 'hsl(0, 72%, 51%)',
  LB: 'hsl(340, 75%, 55%)',
  DB: 'hsl(180, 70%, 50%)',
  K: 'hsl(55, 80%, 55%)',
  P: 'hsl(55, 80%, 55%)',
}

// Get CSS class for position badge background
export function getPositionColorClass(position: string | null): string {
  const pos = position?.toUpperCase() || ''
  switch (pos) {
    case 'QB':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'RB':
      return 'bg-primary/20 text-primary border-primary/30'
    case 'WR':
      return 'bg-accent/20 text-accent border-accent/30'
    case 'TE':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'OL':
    case 'OT':
    case 'OG':
    case 'C':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'DL':
    case 'DT':
    case 'DE':
    case 'EDGE':
      return 'bg-destructive/20 text-destructive border-destructive/30'
    case 'LB':
    case 'ILB':
    case 'OLB':
      return 'bg-pink-500/20 text-pink-400 border-pink-500/30'
    case 'DB':
    case 'CB':
    case 'S':
    case 'FS':
    case 'SS':
      return 'bg-teal-500/20 text-teal-400 border-teal-500/30'
    default:
      return 'bg-secondary/50 text-muted-foreground border-border/50'
  }
}

// Fantasy-relevant positions only
export const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE']

// Position groups for filtering
export const POSITION_GROUPS = [
  { label: 'All', value: 'all' },
  { label: 'QB', value: 'QB' },
  { label: 'RB', value: 'RB' },
  { label: 'WR', value: 'WR' },
  { label: 'TE', value: 'TE' },
]

// Major conferences
export const CONFERENCES = [
  { label: 'All Conferences', value: 'all' },
  { label: 'SEC', value: 'SEC' },
  { label: 'Big Ten', value: 'Big Ten' },
  { label: 'Big 12', value: 'Big 12' },
  { label: 'ACC', value: 'ACC' },
  { label: 'Pac-12', value: 'Pac-12' },
  { label: 'American', value: 'American Athletic' },
  { label: 'Mountain West', value: 'Mountain West' },
  { label: 'Sun Belt', value: 'Sun Belt' },
  { label: 'MAC', value: 'Mid-American' },
  { label: 'C-USA', value: 'Conference USA' },
]

// Stat categories by position - primary stats to show on cards
export const POSITION_PRIMARY_STATS: Record<string, { category: string; stats: string[] }[]> = {
  QB: [
    { category: 'passing', stats: ['YDS', 'TD', 'COMPLETIONS', 'INT'] },
    { category: 'rushing', stats: ['YDS', 'TD'] },
  ],
  RB: [
    { category: 'rushing', stats: ['YDS', 'TD', 'CAR', 'YPC'] },
    { category: 'receiving', stats: ['REC', 'YDS'] },
  ],
  WR: [
    { category: 'receiving', stats: ['YDS', 'TD', 'REC', 'YPR'] },
  ],
  TE: [
    { category: 'receiving', stats: ['YDS', 'TD', 'REC', 'YPR'] },
  ],
  DL: [
    { category: 'defensive', stats: ['TOT', 'TFL', 'SACKS', 'QH'] },
  ],
  LB: [
    { category: 'defensive', stats: ['TOT', 'TFL', 'SACKS', 'INT'] },
  ],
  DB: [
    { category: 'defensive', stats: ['TOT', 'INT', 'PD', 'TD'] },
    { category: 'interceptions', stats: ['INT', 'YDS', 'TD'] },
  ],
}

// Stat display labels
export const STAT_LABELS: Record<string, string> = {
  YDS: 'Yards',
  TD: 'TDs',
  COMPLETIONS: 'Comp',
  ATT: 'Att',
  INT: 'INTs',
  CAR: 'Carries',
  YPC: 'YPC',
  REC: 'Rec',
  YPR: 'YPR',
  TOT: 'Tackles',
  TFL: 'TFL',
  SACKS: 'Sacks',
  QH: 'QB Hits',
  PD: 'Pass Def',
  SOLO: 'Solo',
}

// Transform flat stat rows into nested prospect profile
export interface ProspectSeasonStats {
  passing?: Record<string, number>
  rushing?: Record<string, number>
  receiving?: Record<string, number>
  defensive?: Record<string, number>
  interceptions?: Record<string, number>
  fumbles?: Record<string, number>
  punting?: Record<string, number>
  kicking?: Record<string, number>
}

export interface ProspectProfile {
  cfbd_player_id: string
  player_name: string
  team: string | null
  conference: string | null
  position: string | null
  latestSeason: number
  seasons: Record<number, ProspectSeasonStats>
}

// Transform flat CFB stats into nested structure
export function transformToProspectProfile(stats: CFBPlayerStat[]): ProspectProfile | null {
  if (stats.length === 0) return null

  const first = stats[0]
  const profile: ProspectProfile = {
    cfbd_player_id: first.cfbd_player_id,
    player_name: first.player_name,
    team: first.team,
    conference: first.conference,
    position: first.position,
    latestSeason: first.season,
    seasons: {},
  }

  for (const stat of stats) {
    // Update latest season
    if (stat.season > profile.latestSeason) {
      profile.latestSeason = stat.season
      profile.team = stat.team
      profile.conference = stat.conference
    }

    // Initialize season if needed
    if (!profile.seasons[stat.season]) {
      profile.seasons[stat.season] = {}
    }

    // Get category key
    const categoryKey = stat.category.toLowerCase() as keyof ProspectSeasonStats

    // Initialize category if needed
    if (!profile.seasons[stat.season][categoryKey]) {
      profile.seasons[stat.season][categoryKey] = {}
    }

    // Add stat value
    if (stat.stat_value !== null) {
      profile.seasons[stat.season][categoryKey]![stat.stat_type.toUpperCase()] = stat.stat_value
    }
  }

  return profile
}

// Get summary stats for a player card (3-4 key stats)
export interface SummaryStat {
  label: string
  value: string | number
  category: string
}

export function getSummaryStats(
  profile: ProspectProfile,
  season?: number
): SummaryStat[] {
  const targetSeason = season || profile.latestSeason
  const seasonStats = profile.seasons[targetSeason]
  if (!seasonStats) return []

  const position = profile.position?.toUpperCase() || ''
  const stats: SummaryStat[] = []

  // Get position-specific stats
  if (position === 'QB') {
    if (seasonStats.passing) {
      if (seasonStats.passing.YDS) {
        stats.push({ label: 'YDS', value: formatNumber(seasonStats.passing.YDS), category: 'passing' })
      }
      if (seasonStats.passing.TD) {
        stats.push({ label: 'TD', value: seasonStats.passing.TD, category: 'passing' })
      }
      if (seasonStats.passing.COMPLETIONS && seasonStats.passing.ATT) {
        const compPct = ((seasonStats.passing.COMPLETIONS / seasonStats.passing.ATT) * 100).toFixed(1)
        stats.push({ label: 'COMP%', value: `${compPct}%`, category: 'passing' })
      }
    }
    if (seasonStats.rushing?.YDS && stats.length < 4) {
      stats.push({ label: 'RUSH', value: formatNumber(seasonStats.rushing.YDS), category: 'rushing' })
    }
  } else if (position === 'RB') {
    if (seasonStats.rushing) {
      if (seasonStats.rushing.YDS) {
        stats.push({ label: 'YDS', value: formatNumber(seasonStats.rushing.YDS), category: 'rushing' })
      }
      if (seasonStats.rushing.TD) {
        stats.push({ label: 'TD', value: seasonStats.rushing.TD, category: 'rushing' })
      }
      if (seasonStats.rushing.CAR) {
        stats.push({ label: 'CAR', value: seasonStats.rushing.CAR, category: 'rushing' })
      }
    }
    if (seasonStats.receiving?.REC && stats.length < 4) {
      stats.push({ label: 'REC', value: seasonStats.receiving.REC, category: 'receiving' })
    }
  } else if (position === 'WR' || position === 'TE') {
    if (seasonStats.receiving) {
      if (seasonStats.receiving.YDS) {
        stats.push({ label: 'YDS', value: formatNumber(seasonStats.receiving.YDS), category: 'receiving' })
      }
      if (seasonStats.receiving.TD) {
        stats.push({ label: 'TD', value: seasonStats.receiving.TD, category: 'receiving' })
      }
      if (seasonStats.receiving.REC) {
        stats.push({ label: 'REC', value: seasonStats.receiving.REC, category: 'receiving' })
      }
    }
  } else if (['DL', 'DT', 'DE', 'EDGE'].includes(position)) {
    if (seasonStats.defensive) {
      if (seasonStats.defensive.TOT) {
        stats.push({ label: 'TKL', value: seasonStats.defensive.TOT, category: 'defensive' })
      }
      if (seasonStats.defensive.TFL) {
        stats.push({ label: 'TFL', value: seasonStats.defensive.TFL, category: 'defensive' })
      }
      if (seasonStats.defensive.SACKS) {
        stats.push({ label: 'SACK', value: seasonStats.defensive.SACKS, category: 'defensive' })
      }
    }
  } else if (['LB', 'ILB', 'OLB'].includes(position)) {
    if (seasonStats.defensive) {
      if (seasonStats.defensive.TOT) {
        stats.push({ label: 'TKL', value: seasonStats.defensive.TOT, category: 'defensive' })
      }
      if (seasonStats.defensive.TFL) {
        stats.push({ label: 'TFL', value: seasonStats.defensive.TFL, category: 'defensive' })
      }
      if (seasonStats.defensive.SACKS) {
        stats.push({ label: 'SACK', value: seasonStats.defensive.SACKS, category: 'defensive' })
      }
    }
    if (seasonStats.interceptions?.INT && stats.length < 4) {
      stats.push({ label: 'INT', value: seasonStats.interceptions.INT, category: 'interceptions' })
    }
  } else if (['DB', 'CB', 'S', 'FS', 'SS'].includes(position)) {
    if (seasonStats.interceptions?.INT) {
      stats.push({ label: 'INT', value: seasonStats.interceptions.INT, category: 'interceptions' })
    }
    if (seasonStats.defensive) {
      if (seasonStats.defensive.TOT) {
        stats.push({ label: 'TKL', value: seasonStats.defensive.TOT, category: 'defensive' })
      }
      if (seasonStats.defensive.PD) {
        stats.push({ label: 'PD', value: seasonStats.defensive.PD, category: 'defensive' })
      }
    }
  }

  return stats.slice(0, 4)
}

// Format large numbers with commas
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// Get available stat categories for a player profile
export function getAvailableCategories(profile: ProspectProfile, season?: number): string[] {
  const targetSeason = season || profile.latestSeason
  const seasonStats = profile.seasons[targetSeason]
  if (!seasonStats) return []

  return Object.keys(seasonStats).filter(
    (key) => seasonStats[key as keyof ProspectSeasonStats] !== undefined
  )
}

// Radar chart data for player comparison
export interface RadarDataPoint {
  stat: string
  fullMark: number
  [playerId: string]: string | number
}

// Normalize stats to 0-100 scale for radar chart
const STAT_MAXIMUMS: Record<string, number> = {
  // Passing
  'passing.YDS': 5000,
  'passing.TD': 50,
  'passing.COMPLETIONS': 400,
  'passing.ATT': 600,
  // Rushing
  'rushing.YDS': 2000,
  'rushing.TD': 25,
  'rushing.CAR': 350,
  // Receiving
  'receiving.YDS': 1800,
  'receiving.TD': 20,
  'receiving.REC': 120,
  // Defensive
  'defensive.TOT': 150,
  'defensive.TFL': 25,
  'defensive.SACKS': 15,
  'defensive.INT': 10,
  'defensive.PD': 20,
  // Interceptions
  'interceptions.INT': 10,
  'interceptions.YDS': 200,
}

export function getRadarChartData(
  profiles: ProspectProfile[],
  season?: number
): RadarDataPoint[] {
  if (profiles.length === 0) return []

  // Get common position for all profiles
  const position = profiles[0].position?.toUpperCase() || ''

  // Define stats to compare based on position
  let statsToCompare: { category: string; stat: string; label: string }[] = []

  if (position === 'QB') {
    statsToCompare = [
      { category: 'passing', stat: 'YDS', label: 'Pass Yds' },
      { category: 'passing', stat: 'TD', label: 'Pass TD' },
      { category: 'passing', stat: 'COMPLETIONS', label: 'Comp' },
      { category: 'rushing', stat: 'YDS', label: 'Rush Yds' },
      { category: 'rushing', stat: 'TD', label: 'Rush TD' },
    ]
  } else if (position === 'RB') {
    statsToCompare = [
      { category: 'rushing', stat: 'YDS', label: 'Rush Yds' },
      { category: 'rushing', stat: 'TD', label: 'Rush TD' },
      { category: 'rushing', stat: 'CAR', label: 'Carries' },
      { category: 'receiving', stat: 'REC', label: 'Rec' },
      { category: 'receiving', stat: 'YDS', label: 'Rec Yds' },
    ]
  } else if (position === 'WR' || position === 'TE') {
    statsToCompare = [
      { category: 'receiving', stat: 'YDS', label: 'Rec Yds' },
      { category: 'receiving', stat: 'TD', label: 'Rec TD' },
      { category: 'receiving', stat: 'REC', label: 'Receptions' },
    ]
  } else {
    // Defensive players
    statsToCompare = [
      { category: 'defensive', stat: 'TOT', label: 'Tackles' },
      { category: 'defensive', stat: 'TFL', label: 'TFL' },
      { category: 'defensive', stat: 'SACKS', label: 'Sacks' },
      { category: 'interceptions', stat: 'INT', label: 'INTs' },
    ]
  }

  const radarData: RadarDataPoint[] = []

  for (const { category, stat, label } of statsToCompare) {
    const dataPoint: RadarDataPoint = {
      stat: label,
      fullMark: 100,
    }

    const maxKey = `${category}.${stat}`
    const maxValue = STAT_MAXIMUMS[maxKey] || 100

    for (const profile of profiles) {
      const targetSeason = season || profile.latestSeason
      const seasonStats = profile.seasons[targetSeason]
      const categoryStats = seasonStats?.[category as keyof ProspectSeasonStats]
      const value = categoryStats?.[stat] || 0

      // Normalize to 0-100 scale
      const normalized = Math.min((value / maxValue) * 100, 100)
      dataPoint[profile.cfbd_player_id] = Math.round(normalized)
    }

    radarData.push(dataPoint)
  }

  return radarData
}

// Get distinct players from stats for initial grid
export interface ProspectSummary {
  cfbd_player_id: string
  player_name: string
  team: string | null
  conference: string | null
  position: string | null
  season: number
}

export function groupStatsByPlayer(stats: CFBPlayerStat[]): Map<string, CFBPlayerStat[]> {
  const grouped = new Map<string, CFBPlayerStat[]>()

  for (const stat of stats) {
    const existing = grouped.get(stat.cfbd_player_id) || []
    existing.push(stat)
    grouped.set(stat.cfbd_player_id, existing)
  }

  return grouped
}
