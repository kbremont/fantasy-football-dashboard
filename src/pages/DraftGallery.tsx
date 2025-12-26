import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { ArrowLeft, MapPin, Crown, Play, Images } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listDraftMedia, getDraftCoverUrl, type MediaItem } from '@/lib/storage'
import { Lightbox } from '@/components/Lightbox'

// Draft information by year
const DRAFT_INFO: Record<number, { location: string; winner: string }> = {
  2025: { location: 'Playa Del Carmen, MX', winner: 'TBD' },
  2024: { location: 'Hollywood, FL', winner: 'Baker' },
  2023: { location: 'Virtual', winner: 'Steffer' },
}

// Media card component for gallery grid
function MediaCard({
  item,
  index,
  featured = false,
  onClick,
}: {
  item: MediaItem
  index: number
  featured?: boolean
  onClick: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/30',
        'bg-card/30 backdrop-blur-sm cursor-pointer',
        'transition-all duration-500 ease-out',
        'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'animate-fade-up',
        featured ? 'col-span-1 sm:col-span-2 aspect-[16/10]' : 'aspect-square',
        `stagger-${Math.min(index + 1, 10)}`
      )}
    >
      {/* Loading skeleton */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-secondary/50 animate-pulse" />
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/30">
          <Images className="w-8 h-8 text-muted-foreground/30" />
        </div>
      )}

      {/* Media thumbnail */}
      {item.isVideo ? (
        <video
          src={item.url}
          className={cn(
            'w-full h-full object-cover transition-transform duration-700',
            'group-hover:scale-110',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoadedData={() => setLoaded(true)}
          onError={() => setError(true)}
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={item.url}
          alt={item.name}
          className={cn(
            'w-full h-full object-cover transition-transform duration-700',
            'group-hover:scale-110',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
        />
      )}

      {/* Video play indicator */}
      {item.isVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={cn(
              'w-16 h-16 rounded-full',
              'bg-background/80 backdrop-blur-md',
              'flex items-center justify-center',
              'border border-white/20',
              'transition-all duration-300',
              'group-hover:scale-110 group-hover:bg-primary group-hover:border-primary'
            )}
          >
            <Play className="w-7 h-7 text-foreground ml-1 group-hover:text-primary-foreground" />
          </div>
        </div>
      )}

      {/* Hover overlay gradient */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
        )}
      />

      {/* Featured badge for first item */}
      {featured && (
        <div className="absolute top-3 left-3 z-10">
          <span className="px-2 py-1 text-xs font-medium tracking-wider uppercase bg-accent/90 text-accent-foreground rounded">
            Featured
          </span>
        </div>
      )}
    </button>
  )
}

export function DraftGallery() {
  const { year } = useParams<{ year: string }>()
  const yearNum = parseInt(year || '2024', 10)
  const draftInfo = DRAFT_INFO[yearNum] || { location: 'Unknown', winner: 'Unknown' }

  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    async function fetchMedia() {
      setLoading(true)
      const items = await listDraftMedia(yearNum)
      setMedia(items)
      setLoading(false)
    }
    fetchMedia()
  }, [yearNum])

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative -mx-4 md:-mx-8 lg:-mx-12 mb-12 animate-fade-up">
        <div className="relative overflow-hidden rounded-none md:rounded-2xl">
          {/* Background image */}
          <div className="relative aspect-[21/9] md:aspect-[3/1] overflow-hidden bg-secondary/30">
            {/* Loading state */}
            {!heroLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 to-secondary/30 animate-pulse" />
            )}

            <img
              src={getDraftCoverUrl(yearNum)}
              alt={`${yearNum} Draft in ${draftInfo.location}`}
              className={cn(
                'w-full h-full object-cover transition-opacity duration-700',
                heroLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setHeroLoaded(true)}
            />

            {/* Multi-layer gradient overlays for cinematic depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-transparent pointer-events-none" />

            {/* Film grain texture overlay */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              }}
            />

            {/* Decorative accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-80 pointer-events-none" />
          </div>

          {/* Hero content overlay */}
          <div className="absolute inset-0 z-10 flex flex-col justify-between p-6 sm:p-8 md:p-12">
            {/* Back button */}
            <div className="relative z-20 animate-fade-up stagger-1">
              <Link
                to="/"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                  'bg-background/60 backdrop-blur-md border border-white/10',
                  'text-sm font-medium text-foreground/80',
                  'hover:bg-background/80 hover:text-foreground hover:border-white/20',
                  'transition-all duration-300'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </Link>
            </div>

            {/* Year and info */}
            <div className="max-w-4xl">
              {/* Year - massive typographic statement */}
              <div className="relative animate-fade-up stagger-2 pointer-events-none">
                <h1 className="font-display text-[8rem] sm:text-[12rem] md:text-[16rem] lg:text-[20rem] leading-none tracking-wide text-foreground -mb-4 md:-mb-8">
                  {yearNum}
                </h1>
              </div>

              {/* Location and champion info */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 animate-fade-up stagger-3">
                {/* Location badge */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur-sm border border-border/30">
                  <MapPin className="w-5 h-5 text-accent" />
                  <span className="font-display text-xl sm:text-2xl tracking-wide text-foreground">
                    {draftInfo.location}
                  </span>
                </div>

                {/* Champion badge */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 backdrop-blur-sm border border-primary/30">
                  <Crown className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground/80">
                    Champion: <span className="text-primary font-display tracking-wide">{draftInfo.winner}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="space-y-6 animate-fade-up stagger-4">
        {/* Section header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
              <Images className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-foreground">
                GALLERY
              </h2>
              <p className="text-muted-foreground text-sm">
                {loading ? 'Loading...' : `${media.length} photos & videos`}
              </p>
            </div>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent" />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl bg-secondary/30 animate-pulse',
                  i === 0 ? 'col-span-1 sm:col-span-2 aspect-[16/10]' : 'aspect-square'
                )}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && media.length === 0 && (
          <Card className="border-border/30 bg-card/30 backdrop-blur-sm p-12">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center">
                <Images className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <div>
                <h3 className="font-display text-xl tracking-wide text-foreground mb-2">
                  NO MEDIA YET
                </h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Photos and videos from the {yearNum} draft will appear here once uploaded.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Media grid */}
        {!loading && media.length > 0 && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((item, index) => (
              <MediaCard
                key={item.name}
                item={item}
                index={index}
                featured={index === 0}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <Lightbox
          media={media}
          selectedIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNavigate={setSelectedIndex}
        />
      )}
    </div>
  )
}
