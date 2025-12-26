import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { PowerRankingRow } from '@/lib/power-rankings'

interface RankingTrendChartProps {
  rankings: PowerRankingRow[]
}

// Chart colors matching our theme
const CHART_COLORS = [
  'hsl(142, 76%, 46%)',  // Primary green
  'hsl(38, 92%, 55%)',   // Gold accent
  'hsl(200, 80%, 55%)',  // Blue
  'hsl(280, 70%, 55%)',  // Purple
  'hsl(340, 75%, 55%)',  // Pink
  'hsl(25, 90%, 55%)',   // Orange
  'hsl(180, 60%, 45%)',  // Teal
  'hsl(310, 60%, 50%)',  // Magenta
  'hsl(60, 70%, 50%)',   // Yellow
  'hsl(0, 70%, 50%)',    // Red
]

interface ChartDataPoint {
  week: number
  [teamName: string]: number
}

export function RankingTrendChart({ rankings }: RankingTrendChartProps) {
  // Transform data for Recharts
  // We need: [{ week: 1, "Team A": 1, "Team B": 2, ... }, ...]
  const chartData: ChartDataPoint[] = []

  // Get all weeks from the first team's data
  if (rankings.length === 0 || rankings[0].weekly_ranks.length === 0) {
    return null
  }

  const weeks = rankings[0].weekly_ranks.map((wr) => wr.week)

  weeks.forEach((week) => {
    const dataPoint: ChartDataPoint = { week }

    rankings.forEach((team) => {
      const weekRank = team.weekly_ranks.find((wr) => wr.week === week)
      if (weekRank) {
        dataPoint[team.team_name] = weekRank.rank
      }
    })

    chartData.push(dataPoint)
  })

  // Custom tooltip styling
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; color: string }>
    label?: number
  }) => {
    if (active && payload && payload.length) {
      // Sort by rank (value) ascending
      const sortedPayload = [...payload].sort((a, b) => a.value - b.value)

      return (
        <div className="bg-card/95 backdrop-blur border border-border/50 rounded-lg p-3 shadow-xl">
          <p className="font-display text-sm text-foreground mb-2">Week {label}</p>
          <div className="space-y-1">
            {sortedPayload.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-muted-foreground truncate max-w-[120px]">
                    {entry.name}
                  </span>
                </div>
                <span className="font-medium tabular-nums text-foreground">
                  #{entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(220, 15%, 18%)"
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="week"
          stroke="hsl(215, 20%, 55%)"
          tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
          axisLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          tickLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          label={{
            value: 'Week',
            position: 'insideBottomRight',
            offset: -5,
            fill: 'hsl(215, 20%, 55%)',
            fontSize: 11,
          }}
        />
        <YAxis
          reversed // Rank 1 at top
          domain={[1, rankings.length]}
          stroke="hsl(215, 20%, 55%)"
          tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
          axisLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          tickLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          tickFormatter={(value) => `#${value}`}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{
            paddingTop: '20px',
          }}
          formatter={(value: string) => (
            <span className="text-xs text-muted-foreground">{value}</span>
          )}
        />
        {rankings.map((team, index) => (
          <Line
            key={team.roster_id}
            type="monotone"
            dataKey={team.team_name}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{
              fill: CHART_COLORS[index % CHART_COLORS.length],
              strokeWidth: 0,
              r: 3,
            }}
            activeDot={{
              r: 5,
              fill: CHART_COLORS[index % CHART_COLORS.length],
              stroke: 'hsl(220, 20%, 7%)',
              strokeWidth: 2,
            }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
