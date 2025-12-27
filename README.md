# Fantasy Football Dashboard

A full-stack fantasy football analytics application that syncs data from the Sleeper API and displays league standings, matchup history, power rankings, rivalry stats, and more.

**Live Site:** [greasygooblins.com](https://greasygooblins.com)

## Features

- **League Standings** - Team rankings with W-L records, points for/against, and streaks
- **Matchup History** - Weekly head-to-head results with winner highlighting
- **Power Rankings** - Advanced analytics with composite scores, expected wins, luck index
- **League Pulse** - League-wide analytics, records, scoring trends, and playoff race
- **Rivalry Tracker** - Head-to-head comparisons with momentum charts and revenge games
- **Fattest Rosters** - Fun roster weight rankings using player data
- **Draft Gallery** - Photo/video galleries from annual destination drafts
- **Multi-Season Support** - Browse historical seasons with full data

## Tech Stack

### Frontend
- **Vite + React + TypeScript** - Fast, type-safe development
- **shadcn/ui + Tailwind CSS** - Modern component library with custom dark theme
- **Recharts** - Data visualization for analytics pages
- **React Router** - Client-side routing

### Backend
- **Supabase** - PostgreSQL database with Row Level Security
- **Edge Functions (Deno)** - Serverless data sync functions
- **pg_cron** - Scheduled jobs for automated updates
- **Supabase Storage** - Media storage for draft galleries

### Data Source
- **Sleeper API** - Fantasy football league data (no auth required)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase CLI (for database management)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd fantasy-dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### Development

```bash
# Start the dev server
npm run dev

# Build for production
npm run build
```

The app will be available at `http://localhost:5173`.

## Project Structure

```
fantasy-dashboard/
├── src/
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   ├── charts/         # Recharts visualizations
│   │   ├── Layout.tsx      # App shell with navigation
│   │   └── Lightbox.tsx    # Media viewer for galleries
│   ├── pages/
│   │   ├── Home.tsx        # Landing page
│   │   ├── Standings.tsx   # League standings
│   │   ├── Matchups.tsx    # Weekly matchups
│   │   ├── PowerRankings.tsx
│   │   ├── LeaguePulse.tsx
│   │   ├── Rivals.tsx
│   │   ├── FattestRosters.tsx
│   │   └── DraftGallery.tsx
│   ├── lib/                # Utilities and analytics
│   └── types/              # TypeScript types
├── supabase/
│   ├── functions/          # Edge Functions (Deno)
│   └── migrations/         # Database migrations
└── .github/workflows/      # CI/CD (auto-deploy on push)
```

## Database Schema

| Table | Description |
|-------|-------------|
| `nfl_players` | NFL player roster data (name, position, team, weight) |
| `rosters` | Fantasy team metadata |
| `seasons` | Multi-season tracking with Sleeper league IDs |
| `matchups` | Weekly matchup results with starters and points |
| `weekly_rosters` | Weekly roster snapshots |
| `transactions` | Trades, waivers, free agent pickups |
| `drafts` | Draft metadata per season |
| `draft_picks` | Individual draft picks with keeper tracking |
| `player_weekly_points` | Player scoring by week |

## Edge Functions

| Function | Description |
|----------|-------------|
| `sync-nfl-players` | Syncs all NFL players from Sleeper |
| `sync-league-rosters` | Syncs fantasy team rosters |
| `sync-weekly-matchups` | Syncs matchup results for a week |
| `sync-weekly-transactions` | Syncs transactions for a week |
| `sync-drafts` | Syncs draft picks with keeper detection |
| `backfill-season` | Orchestrates full season data backfill |

## Scheduled Jobs

- **Daily (9 AM UTC)**: Sync NFL players, league rosters
- **Weekly (Tue 10 AM UTC)**: Sync matchups, transactions

## Deployment

**Frontend:** Deployed to [Vercel](https://vercel.com) with automatic deployments on push to `main`.

**Backend:** GitHub Actions CI/CD for Supabase:
- Database migrations auto-deploy on changes to `supabase/migrations/`
- Edge functions auto-deploy on changes to `supabase/functions/`

**Important:** Always apply database migrations through the CI/CD pipeline by pushing to `main`. Do not run `supabase db push` manually against production.

## License

MIT
