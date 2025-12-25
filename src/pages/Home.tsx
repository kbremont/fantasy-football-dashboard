import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, MapPin, Crown, Plane, Calendar, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

// Supabase Storage base URL for draft-media bucket
const STORAGE_URL = 'https://fnphwakozzgoqpoidpvq.supabase.co/storage/v1/object/public/draft-media'

// Hero image path in storage
const HERO_IMAGE_URL = `${STORAGE_URL}/league/hero.jpg`

interface DestinationDraft {
  year: number
  location: string
  winner: string
}

// Placeholder data - update with actual draft information
const DESTINATION_DRAFTS: DestinationDraft[] = [
  { year: 2025, location: 'Playa Del Carmen, MX', winner: 'TBD' },
  { year: 2024, location: 'Hollywood, FL', winner: 'Baker' },
  { year: 2023, location: 'Virtual', winner: 'Steffer' },
]

// Helper to get draft cover image URL from storage
const getDraftImageUrl = (year: number) => `${STORAGE_URL}/drafts/${year}/cover.jpg`

function DraftCard({ draft, index }: { draft: DestinationDraft; index: number }) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <Card
      className={cn(
        'group border-border/30 bg-card/50 backdrop-blur overflow-hidden animate-fade-up',
        'hover:border-primary/50 hover:bg-card/70 transition-all duration-500',
        `stagger-${Math.min(index + 3, 10)}`
      )}
    >
      {/* Image container */}
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/30">
        {/* Year badge - prominent overlay */}
        <div className="absolute top-0 left-0 z-20">
          <div className="relative">
            <div className="bg-gradient-to-br from-primary to-primary/80 px-4 py-2 font-display text-2xl text-primary-foreground tracking-wide">
              {draft.year}
            </div>
            {/* Decorative corner cut */}
            <div className="absolute -bottom-2 left-0 w-0 h-0 border-l-[16px] border-l-transparent border-t-[8px] border-t-primary/80" />
          </div>
        </div>

        {!imageError ? (
          <>
            {/* Loading skeleton */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-secondary/50 animate-pulse" />
            )}
            <img
              src={getDraftImageUrl(draft.year)}
              alt={`${draft.year} Draft in ${draft.location}`}
              className={cn(
                'w-full h-full object-cover transition-all duration-700',
                'group-hover:scale-110',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </>
        ) : (
          // Fallback placeholder
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/50">
            <Plane className="w-12 h-12" />
            <span className="font-display text-sm tracking-wider">PHOTO COMING SOON</span>
          </div>
        )}

        {/* Bottom gradient for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/80 to-transparent" />
      </div>

      {/* Content */}
      <CardContent className="p-4 pt-0 -mt-8 relative z-10">
        {/* Location */}
        <div className="flex items-center gap-2 text-foreground mb-2">
          <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="font-display text-lg tracking-wide truncate">
            {draft.location}
          </span>
        </div>

        {/* Winner */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Crown className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="truncate">Champion: {draft.winner}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function Home() {
  const [heroImageError, setHeroImageError] = useState(false)
  const [heroImageLoaded, setHeroImageLoaded] = useState(false)

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative -mx-4 md:-mx-8 lg:-mx-12 animate-fade-up">
        <div className="relative overflow-hidden rounded-none md:rounded-2xl">
          {/* Background image with overlays */}
          <div className="relative aspect-[16/10] sm:aspect-[21/9] md:aspect-[3/1] overflow-hidden bg-secondary/30">
            {!heroImageError ? (
              <>
                {/* Loading state */}
                {!heroImageLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 to-secondary/30 animate-pulse" />
                )}
                <img
                  src={HERO_IMAGE_URL}
                  alt="Greasy Gooblins League"
                  className={cn(
                    'w-full h-full object-cover transition-opacity duration-700',
                    heroImageLoaded ? 'opacity-100' : 'opacity-0'
                  )}
                  onLoad={() => setHeroImageLoaded(true)}
                  onError={() => setHeroImageError(true)}
                />
              </>
            ) : (
              // Fallback gradient when no image
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary to-accent/10" />
            )}

            {/* Multi-layer gradient overlays for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />

            {/* Decorative accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-80" />
          </div>

          {/* Hero content */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 md:p-12 lg:p-16">
            <div className="max-w-3xl">
              {/* Eyebrow text */}
              <p className="text-sm sm:text-base font-medium text-primary uppercase tracking-[0.3em] mb-3 animate-fade-up stagger-1">
                Fantasy Football League
              </p>

              {/* Main title - dramatic scale */}
              <h1 className="font-display tracking-wide leading-none animate-fade-up stagger-2">
                <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl text-gradient">
                  GREASY
                </span>
                <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl text-foreground -mt-1 md:-mt-2">
                  GOOBLINS
                </span>
              </h1>

              {/* Subtitle with decorative elements */}
              <div className="flex items-center gap-3 mt-4 animate-fade-up stagger-3">
                <div className="w-8 h-px bg-gradient-to-r from-primary to-transparent" />
                <p className="text-muted-foreground text-sm sm:text-base tracking-widest uppercase">
                  Est. 2023 &bull; Destination Draft League
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="animate-fade-up stagger-2">
        <Card className="border-border/30 bg-card/50 backdrop-blur overflow-hidden">
          {/* Decorative top border */}
          <div className="h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="p-6 sm:p-8 md:p-10">
            <div className="flex flex-col md:flex-row gap-8 md:gap-12">
              {/* Icon column */}
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center glow-primary">
                  <Users className="w-8 h-8 text-primary" />
                </div>
              </div>

              {/* Content column */}
              <div className="flex-1 space-y-4">
                <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-foreground">
                  ABOUT THE LEAGUE
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    The Greasy Gooblins isn't just a fantasy football league—it's a brotherhood
                    forged through trash talk, clutch victories, and devastating defeats.
                    Founded in 2023, our keeper league brings friends together from across the country
                    for an annual tradition unlike any other.
                  </p>
                  <p>
                    As a keeper league, each team retains 6 players at the end of every season—building
                    dynasties, making tough decisions, and adding real stakes to every trade and pickup.
                    And every year, we gather in a new destination for our live draft, transforming
                    draft day into an unforgettable weekend of camaraderie and strategy debates.
                  </p>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-6 pt-4 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" />
                    <span className="text-foreground font-display text-lg">{DESTINATION_DRAFTS.length}</span>
                    <span className="text-muted-foreground text-sm">Seasons</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-accent" />
                    <span className="text-foreground font-display text-lg">{DESTINATION_DRAFTS.length - 1}</span>
                    <span className="text-muted-foreground text-sm">Destinations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-accent" />
                    <span className="text-foreground font-display text-lg">6</span>
                    <span className="text-muted-foreground text-sm">Keepers Per Team</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Destination Drafts Section */}
      <section className="space-y-8 animate-fade-up stagger-3">
        {/* Section header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
              <Plane className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-gradient">
                DESTINATION DRAFTS
              </h2>
              <p className="text-muted-foreground text-sm tracking-wide mt-0.5">
                Where the magic happens
              </p>
            </div>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent hidden sm:block" />
        </div>

        {/* Drafts grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DESTINATION_DRAFTS.map((draft, index) => (
            <DraftCard key={draft.year} draft={draft} index={index} />
          ))}
        </div>
      </section>
    </div>
  )
}
