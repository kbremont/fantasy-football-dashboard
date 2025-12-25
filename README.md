# Fantasy Football Dashboard

A full-stack fantasy football analytics application that syncs data from the Sleeper API and displays league standings, matchup history, and more.

## Features

- **League Standings** - View team rankings with W-L records, points for/against, and streaks
- **Matchup History** - Browse weekly head-to-head results with winner highlighting
- **Multi-Season Support** - Switch between historical seasons
- **Automated Sync** - Daily player/roster updates, weekly matchup syncs via cron jobs

## Tech Stack

### Frontend
- **Vite + React + TypeScript** - Fast, type-safe development
- **shadcn/ui + Tailwind CSS** - Modern component library with custom dark theme
- **React Router** - Client-side routing

### Backend
- **Supabase** - PostgreSQL database with Row Level Security
- **Edge Functions (Deno)** - Serverless data sync functions
- **pg_cron** - Scheduled jobs for automated updates

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
├── src/                    # Frontend source
│   ├── components/         # React components
│   ├── pages/              # Page components (Standings, Matchups)
│   ├── lib/                # Utilities (Supabase client)
│   └── types/              # TypeScript types
├── supabase/
│   ├── functions/          # Edge Functions (Deno)
│   └── migrations/         # Database migrations
└── .github/workflows/      # CI/CD (auto-deploy on push)
```

## Database Schema

| Table | Description |
|-------|-------------|
| `nfl_players` | NFL player roster data |
| `rosters` | Fantasy team metadata |
| `seasons` | Multi-season tracking |
| `matchups` | Weekly matchup results |
| `weekly_rosters` | Weekly roster snapshots |
| `transactions` | Trades, waivers, pickups |

## Scheduled Jobs

- **Daily (9 AM UTC)**: Sync NFL players, league rosters
- **Weekly (Tue 10 AM UTC)**: Sync matchups, transactions

## Deployment

The project uses GitHub Actions for CI/CD:
- Database migrations auto-deploy on changes to `supabase/migrations/`
- Edge functions auto-deploy on changes to `supabase/functions/`

## License

MIT
