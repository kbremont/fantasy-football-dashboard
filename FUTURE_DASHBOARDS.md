# Future Dashboard Ideas

This document outlines potential dashboard features to build for the Greasy Gooblins League Dashboard, leveraging the rich data available in Supabase.

---

## 1. Power Rankings Dashboard

A dynamic weekly ranking system that goes beyond simple W-L records to show the "true" strength of each team.

### Features
- **Luck Index**: Compare actual wins vs expected wins based on points scored
  - Teams that score a lot but lose due to tough matchups are "unlucky"
  - Teams that win despite low scores are "lucky"
- **Consistency Score**: Standard deviation of weekly scores — how reliable is each team?
- **Strength of Schedule**: Average opponent points scored — who's faced the toughest slate?
- **Power Ranking Trend Chart**: Week-over-week movement visualization
- **"Should-Be" Record**: What their record would be if they played the league average each week
- **Win Probability Model**: Expected wins remaining based on scoring trends

### Data Sources
- `matchups` table (points, week, roster_id)
- `rosters` table (team names)
- `seasons` table (week context)

---

## 2. Transaction War Room

Visualize all trades, waivers, and free agent pickups throughout the season.

### Features
- **Trade Network Graph**: Interactive visualization showing who trades with whom
  - Node size = trade frequency
  - Edge thickness = number of deals between two managers
- **Activity Timeline**: Chronological view of all moves as they happened
- **Trade Grades**: Track if a trade was a win/loss based on subsequent player performance
- **Most Active Managers**: Leaderboard of transaction volume
- **Waiver Wire Winners**: Who finds the best free agents? Track points produced by pickups
- **Trade Balance Sheet**: Net player value gained/lost per team
- **Position Churn**: Which positions see the most roster turnover?

### Data Sources
- `transactions` table (type, adds, drops, roster_ids, week)
- `nfl_players` table (player names, positions)
- `matchups` table (to calculate player production post-transaction)

---

## 3. Head-to-Head Rivalry Tracker

Deep dive into the historical matchup record between any two teams.

### Features
- **All-Time Record**: W-L-T between selected teams across all seasons
- **Point Differential Trends**: Chart showing margin of victory over time
- **Biggest Blowouts**: Largest margin wins for each side
- **Closest Games**: Nail-biters decided by smallest margins
- **Revenge Game Tracker**: Did a team avenge a previous loss?
- **Scoring Comparison**: Side-by-side average points when facing each other
- **Home/Away Splits**: If applicable to league format

### Data Sources
- `matchups` table (matchup_id pairs teams, points, week)
- `seasons` table (multi-season history)
- `rosters` table (team names)

---

## 4. Team Deep Dive / Manager Profile

Single-team analytics page for drilling into one manager's performance.

### Features
- **Points Scored Chart**: Line graph of weekly scoring over the season
- **Roster Composition Heatmap**: Visual grid showing which players were on the team each week
- **Transaction History Timeline**: All adds, drops, and trades with dates
- **Best/Worst Performances**: Highlight highest and lowest scoring weeks
- **H2H Record Grid**: Record against every other team in the league
- **Starter Efficiency**: Points from starters vs bench (missed opportunity analysis)
- **Position Breakdown**: Points by position (QB, RB, WR, TE, etc.)
- **Playoff Odds**: Current trajectory and scenarios

### Data Sources
- `matchups` table (points, starters[], players[])
- `weekly_rosters` table (player_ids[] snapshots)
- `transactions` table (team-specific moves)
- `nfl_players` table (player details, positions)
- `rosters` table (team info)

---

## 5. League Pulse Dashboard

Big-picture league health, trends, and competitive balance metrics.

### Features
- **Weekly High/Low Scores**: Track the boom and bust each week
- **Average Margin of Victory**: Is the league full of blowouts or close games?
- **Parity Index**: Measure of competitive balance (are the same teams always winning?)
- **Playoff Race Visualization**: Current standings with clinch/elimination scenarios
- **Scoring Distribution**: Histogram of all scores — where does the league cluster?
- **Week-over-Week Trends**: Is scoring going up or down as the season progresses?
- **League Records**: All-time high score, biggest blowout, longest win streak, etc.
- **"Game of the Week"**: Automatically highlight the most exciting matchup

### Data Sources
- `matchups` table (all scoring data)
- `seasons` table (multi-season context)
- `rosters` table (team names)

---

## Implementation Notes

### Charting Library
The current app has no charting library. Recommended options:
- **Recharts** — React-native, composable, great for dashboards
- **Chart.js + react-chartjs-2** — Widely used, good documentation
- **Visx** — Low-level, maximum customization (from Airbnb)
- **Nivo** — Beautiful defaults, good for quick implementation

### Suggested Priority Order
1. **Power Rankings** — High value, uses existing data, most requested feature type
2. **Team Deep Dive** — Natural extension of standings, per-team analytics
3. **League Pulse** — Big picture stats are fun and easy to compute
4. **Rivalry Tracker** — Great for engagement, head-to-head always interesting
5. **Transaction War Room** — Most complex, requires transaction data to be meaningful

### UI/UX Considerations
- Maintain dark sports-editorial theme (navy, green, gold accents)
- Add dashboard navigation to existing header
- Consider tab-based layouts within each dashboard
- Mobile-responsive charts
- Loading skeletons for data fetches

### New Routes
```
/power-rankings    → Power Rankings Dashboard
/team/:rosterId    → Team Deep Dive
/rivals            → Rivalry Tracker (with team selector)
/transactions      → Transaction War Room
/league            → League Pulse Dashboard
```

---

## Data Gaps to Address

Some features may require additional data:
- **Player weekly points**: Currently only team totals stored; individual player scores would enable deeper analysis
- **Projections**: Sleeper API provides projections that could power "vs expected" metrics
- **Draft data**: Could add draft analysis if draft picks are synced

---

*Last updated: December 2024*
