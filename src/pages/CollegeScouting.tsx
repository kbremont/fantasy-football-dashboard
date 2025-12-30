import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase, authReady } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  GraduationCap,
  Search,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  User,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type CFBPlayerStat,
  type ProspectProfile,
  transformToProspectProfile,
  getSummaryStats,
  getPositionColorClass,
  getAvailableCategories,
  getRadarChartData,
  groupStatsByPlayer,
  FANTASY_POSITIONS,
  POSITION_GROUPS,
  CONFERENCES,
  formatNumber,
} from '@/lib/college-scouting'
import { PlayerRadarChart } from '@/components/charts/PlayerRadarChart'

// Current CFB season (Aug-Dec = current year, Jan-Jul = previous year)
function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 8 ? year : year - 1
}

export function CollegeScouting() {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('all')
  const [selectedConference, setSelectedConference] = useState('all')
  const [selectedSeason, setSelectedSeason] = useState<number>(getCurrentSeason())

  // Data state
  const [players, setPlayers] = useState<Map<string, CFBPlayerStat[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([])

  // Comparison state
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [comparisonOpen, setComparisonOpen] = useState(false)

  // Detail modal state
  const [selectedPlayer, setSelectedPlayer] = useState<ProspectProfile | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Fetch available seasons on mount
  useEffect(() => {
    async function fetchSeasons() {
      await authReady

      const { data, error } = await supabase
        .from('cfb_player_season_stats')
        .select('season')
        .order('season', { ascending: false })

      if (error) {
        console.error('Failed to fetch seasons:', error)
        return
      }

      // Get distinct seasons
      const seasons = [...new Set(data?.map((d) => d.season) || [])]
      setAvailableSeasons(seasons)

      if (seasons.length > 0 && !seasons.includes(selectedSeason)) {
        setSelectedSeason(seasons[0])
      }
    }

    fetchSeasons()
  }, [])

  // Fetch players based on filters
  useEffect(() => {
    async function fetchPlayers() {
      setLoading(true)
      setError(null)

      try {
        await authReady

        let query = supabase
          .from('cfb_player_season_stats')
          .select('*')
          .eq('season', selectedSeason)
          .order('player_name')

        // Apply position filter (fantasy positions only)
        if (selectedPosition === 'all') {
          query = query.in('position', FANTASY_POSITIONS)
        } else {
          query = query.eq('position', selectedPosition)
        }

        // Apply conference filter
        if (selectedConference !== 'all') {
          query = query.eq('conference', selectedConference)
        }

        // Apply search filter
        if (searchQuery.trim()) {
          query = query.ilike('player_name', `%${searchQuery.trim()}%`)
        }

        const { data, error: fetchError } = await query.limit(2000)

        if (fetchError) throw fetchError

        // Group by player
        const grouped = groupStatsByPlayer(data || [])
        setPlayers(grouped)
      } catch (err) {
        console.error('Failed to fetch players:', err)
        setError('Failed to load prospects')
      } finally {
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [selectedSeason, selectedPosition, selectedConference, searchQuery])

  // Get prospect profiles from grouped stats
  const prospectProfiles = useMemo(() => {
    const profiles: ProspectProfile[] = []
    players.forEach((stats) => {
      const profile = transformToProspectProfile(stats)
      if (profile) profiles.push(profile)
    })
    // Sort by player name
    return profiles.sort((a, b) => a.player_name.localeCompare(b.player_name))
  }, [players])

  // Get comparison profiles
  const comparisonProfiles = useMemo(() => {
    return prospectProfiles.filter((p) => compareIds.includes(p.cfbd_player_id))
  }, [prospectProfiles, compareIds])

  // Handle adding/removing from comparison
  const toggleCompare = useCallback((playerId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(playerId)) {
        const newIds = prev.filter((id) => id !== playerId)
        if (newIds.length === 0) setComparisonOpen(false)
        return newIds
      }
      if (prev.length >= 3) return prev // Max 3 players
      setComparisonOpen(true)
      return [...prev, playerId]
    })
  }, [])

  // Handle viewing player details
  const viewPlayerDetail = useCallback(
    async (profile: ProspectProfile) => {
      // If we already have full data, just show modal
      const existingStats = players.get(profile.cfbd_player_id)
      if (existingStats && existingStats.length > 0) {
        setSelectedPlayer(profile)
        return
      }

      // Otherwise fetch all seasons for this player
      setDetailLoading(true)
      try {
        await authReady
        const { data, error } = await supabase
          .from('cfb_player_season_stats')
          .select('*')
          .eq('cfbd_player_id', profile.cfbd_player_id)
          .order('season', { ascending: false })

        if (error) throw error

        const fullProfile = transformToProspectProfile(data || [])
        if (fullProfile) {
          setSelectedPlayer(fullProfile)
        }
      } catch (err) {
        console.error('Failed to fetch player details:', err)
      } finally {
        setDetailLoading(false)
      }
    },
    [players]
  )

  // Clear comparison
  const clearComparison = useCallback(() => {
    setCompareIds([])
    setComparisonOpen(false)
  }, [])

  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between animate-fade-up">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary uppercase tracking-wider">
                Prospect Intelligence
              </p>
              <h1 className="text-4xl md:text-5xl font-display tracking-wide text-foreground">
                COLLEGE SCOUTING
              </h1>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap gap-3">
          {/* Season Selector */}
          <Select
            value={selectedSeason.toString()}
            onValueChange={(v) => setSelectedSeason(Number(v))}
          >
            <SelectTrigger className="w-[130px] bg-secondary/50 border-border/50">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              {availableSeasons.map((season) => (
                <SelectItem key={season} value={season.toString()}>
                  {season} Season
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Position Filter */}
          <Select value={selectedPosition} onValueChange={setSelectedPosition}>
            <SelectTrigger className="w-[110px] bg-secondary/50 border-border/50">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              {POSITION_GROUPS.map((pos) => (
                <SelectItem key={pos.value} value={pos.value}>
                  {pos.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Conference Filter */}
          <Select value={selectedConference} onValueChange={setSelectedConference}>
            <SelectTrigger className="w-[160px] bg-secondary/50 border-border/50">
              <SelectValue placeholder="Conference" />
            </SelectTrigger>
            <SelectContent>
              {CONFERENCES.map((conf) => (
                <SelectItem key={conf.value} value={conf.value}>
                  {conf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative animate-fade-up stagger-1">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <input
          type="text"
          placeholder="Search prospects by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full pl-12 pr-10 py-3 rounded-xl',
            'bg-card border border-border/50',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
            'transition-all duration-200'
          )}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10 animate-fade-up stagger-2">
          <CardContent className="py-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="border-border bg-card animate-fade-up stagger-2">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-primary/30 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-muted-foreground">Scouting prospects...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Count */}
      {!loading && !error && (
        <div className="flex items-center justify-between text-sm text-muted-foreground animate-fade-up stagger-2">
          <span>
            {prospectProfiles.length} prospect{prospectProfiles.length !== 1 && 's'} found
          </span>
          {compareIds.length > 0 && (
            <span className="text-primary">
              {compareIds.length}/3 selected for comparison
            </span>
          )}
        </div>
      )}

      {/* Player Grid */}
      {!loading && !error && prospectProfiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up stagger-3">
          {prospectProfiles.map((profile, index) => (
            <ProspectCard
              key={profile.cfbd_player_id}
              profile={profile}
              season={selectedSeason}
              isComparing={compareIds.includes(profile.cfbd_player_id)}
              canCompare={compareIds.length < 3 || compareIds.includes(profile.cfbd_player_id)}
              onToggleCompare={() => toggleCompare(profile.cfbd_player_id)}
              onViewDetail={() => viewPlayerDetail(profile)}
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && prospectProfiles.length === 0 && (
        <Card className="border-border bg-card animate-fade-up stagger-2">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-full bg-secondary/50">
                <User className="w-12 h-12 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">No prospects found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters or search query
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Panel */}
      <ComparisonPanel
        isOpen={comparisonOpen}
        profiles={comparisonProfiles}
        season={selectedSeason}
        onToggle={() => setComparisonOpen(!comparisonOpen)}
        onClear={clearComparison}
        onRemove={(id) => toggleCompare(id)}
      />

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          profile={selectedPlayer}
          isLoading={detailLoading}
          isComparing={compareIds.includes(selectedPlayer.cfbd_player_id)}
          canCompare={
            compareIds.length < 3 || compareIds.includes(selectedPlayer.cfbd_player_id)
          }
          onClose={() => setSelectedPlayer(null)}
          onToggleCompare={() => toggleCompare(selectedPlayer.cfbd_player_id)}
        />
      )}
    </div>
  )
}

// =============================================================================
// PROSPECT CARD
// =============================================================================

interface ProspectCardProps {
  profile: ProspectProfile
  season: number
  isComparing: boolean
  canCompare: boolean
  onToggleCompare: () => void
  onViewDetail: () => void
  style?: React.CSSProperties
}

function ProspectCard({
  profile,
  season,
  isComparing,
  canCompare,
  onToggleCompare,
  onViewDetail,
  style,
}: ProspectCardProps) {
  const summaryStats = getSummaryStats(profile, season)

  return (
    <Card
      className={cn(
        'border-border bg-card overflow-hidden transition-all duration-200 animate-fade-up',
        'hover:border-border/80 hover:shadow-lg hover:shadow-primary/5',
        isComparing && 'ring-2 ring-primary/50 border-primary/30'
      )}
      style={style}
    >
      <CardContent className="p-4">
        {/* Header: Position Badge + Compare Button */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={cn(
              'px-2 py-0.5 rounded text-xs font-display tracking-wider border',
              getPositionColorClass(profile.position)
            )}
          >
            {profile.position || 'N/A'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleCompare()
            }}
            disabled={!canCompare && !isComparing}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all',
              isComparing
                ? 'bg-primary/20 text-primary border border-primary/30'
                : canCompare
                  ? 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50'
                  : 'bg-secondary/30 text-muted-foreground/50 cursor-not-allowed border border-border/30'
            )}
          >
            {isComparing ? (
              <>
                <X className="w-3 h-3" />
                Remove
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Compare
              </>
            )}
          </button>
        </div>

        {/* Player Info */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{profile.player_name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {profile.team || 'Unknown Team'}
              {profile.conference && ` \u2022 ${profile.conference}`}
            </p>
            <p className="text-xs text-muted-foreground/70">{season} Season</p>
          </div>
        </div>

        {/* Summary Stats */}
        {summaryStats.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 text-center">
              Top Stats
            </div>
            <div className="flex items-center justify-center gap-3 text-sm">
              {summaryStats.map((stat, idx) => (
                <div key={idx} className="text-center">
                  <span className="font-display text-lg text-foreground tabular-nums">
                    {stat.value}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Profile Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewDetail}
          className="w-full justify-center text-primary hover:text-primary hover:bg-primary/10"
        >
          View Profile
          <TrendingUp className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// COMPARISON PANEL
// =============================================================================

interface ComparisonPanelProps {
  isOpen: boolean
  profiles: ProspectProfile[]
  season: number
  onToggle: () => void
  onClear: () => void
  onRemove: (id: string) => void
}

function ComparisonPanel({
  isOpen,
  profiles,
  season,
  onToggle,
  onClear,
  onRemove,
}: ComparisonPanelProps) {
  const radarData = useMemo(() => getRadarChartData(profiles, season), [profiles, season])

  if (profiles.length === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300',
        isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-60px)]'
      )}
    >
      {/* Handle Bar */}
      <div
        onClick={onToggle}
        className="flex items-center justify-center py-3 bg-card border-t border-x border-border rounded-t-xl cursor-pointer mx-4 lg:mx-auto lg:max-w-4xl"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          )}
          <span className="font-display text-sm tracking-wide text-foreground">
            PROSPECT COMPARISON ({profiles.length})
          </span>
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Panel Content */}
      <div className="bg-card border-t border-border shadow-2xl">
        <div className="container mx-auto max-w-4xl px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg tracking-wide text-foreground">
              COMPARING {profiles.length} PROSPECTS
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground hover:text-destructive"
            >
              Clear All
              <X className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Player Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {profiles.map((profile) => (
              <div
                key={profile.cfbd_player_id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {profile.player_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile.position} \u2022 {profile.team}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(profile.cfbd_player_id)}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Radar Chart */}
          {profiles.length >= 2 && radarData.length > 0 && (
            <div className="bg-secondary/20 rounded-xl p-4 border border-border/30">
              <PlayerRadarChart
                data={radarData}
                players={profiles.map((p) => ({
                  cfbd_player_id: p.cfbd_player_id,
                  player_name: p.player_name,
                  position: p.position,
                }))}
              />
            </div>
          )}

          {profiles.length < 2 && (
            <div className="text-center py-8 text-muted-foreground">
              Add at least 2 prospects to compare
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// PLAYER DETAIL MODAL
// =============================================================================

interface PlayerDetailModalProps {
  profile: ProspectProfile
  isLoading: boolean
  isComparing: boolean
  canCompare: boolean
  onClose: () => void
  onToggleCompare: () => void
}

function PlayerDetailModal({
  profile,
  isLoading,
  isComparing,
  canCompare,
  onClose,
  onToggleCompare,
}: PlayerDetailModalProps) {
  const availableCategories = getAvailableCategories(profile)
  const seasons = Object.keys(profile.seasons)
    .map(Number)
    .sort((a, b) => b - a)

  const [activeTab, setActiveTab] = useState<string>(availableCategories[0] || 'passing')
  const [selectedSeason, setSelectedSeason] = useState<number>(profile.latestSeason)

  // Update tab when categories change
  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.includes(activeTab)) {
      setActiveTab(availableCategories[0])
    }
  }, [availableCategories, activeTab])

  const currentSeasonStats = profile.seasons[selectedSeason]
  const currentCategoryStats = currentSeasonStats?.[activeTab as keyof typeof currentSeasonStats]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 border-b border-border/30 bg-gradient-to-b from-secondary/30 to-transparent">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-display tracking-wider border',
                    getPositionColorClass(profile.position)
                  )}
                >
                  {profile.position || 'N/A'}
                </span>
              </div>
              <h2 className="text-2xl font-display tracking-wide text-foreground mb-1">
                {profile.player_name}
              </h2>
              <p className="text-muted-foreground">
                {profile.team || 'Unknown Team'}
                {profile.conference && ` \u2022 ${profile.conference}`}
              </p>
            </div>
          </div>

          {/* Compare Button */}
          <div className="mt-4">
            <Button
              variant={isComparing ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleCompare}
              disabled={!canCompare && !isComparing}
              className={cn(
                isComparing && 'bg-primary hover:bg-primary/90'
              )}
            >
              {isComparing ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Remove from Comparison
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Comparison
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Content */}
        {!isLoading && (
          <div className="p-6">
            {/* Season Selector */}
            {seasons.length > 1 && (
              <div className="mb-6">
                <Select
                  value={selectedSeason.toString()}
                  onValueChange={(v) => setSelectedSeason(Number(v))}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => (
                      <SelectItem key={s} value={s.toString()}>
                        {s} Season
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category Tabs */}
            {availableCategories.length > 0 ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6 flex-wrap h-auto gap-1">
                  {availableCategories.map((cat) => (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      className="capitalize px-4 py-2"
                    >
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {availableCategories.map((cat) => (
                  <TabsContent key={cat} value={cat}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {currentCategoryStats &&
                        Object.entries(currentCategoryStats).map(([stat, value]) => (
                          <div
                            key={stat}
                            className="p-4 rounded-lg bg-secondary/30 border border-border/30"
                          >
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                              {stat}
                            </p>
                            <p className="text-2xl font-display text-foreground tabular-nums">
                              {typeof value === 'number'
                                ? value % 1 === 0
                                  ? formatNumber(value)
                                  : value.toFixed(1)
                                : value}
                            </p>
                          </div>
                        ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No stats available for this player
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
