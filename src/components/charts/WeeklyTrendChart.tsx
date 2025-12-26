import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import type { WeeklyTrendPoint } from '@/lib/league-pulse'

interface WeeklyTrendChartProps {
  trends: WeeklyTrendPoint[]
}

export function WeeklyTrendChart({ trends }: WeeklyTrendChartProps) {
  if (trends.length === 0) {
    return null
  }

  // Calculate season average for reference line
  const allAvgs = trends.map((t) => t.avgScore)
  const seasonAvg = allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length

  // Get min/max for Y axis domain
  const allPoints = trends.flatMap((t) => [t.highScore, t.lowScore])
  const minScore = Math.floor(Math.min(...allPoints) / 10) * 10
  const maxScore = Math.ceil(Math.max(...allPoints) / 10) * 10

  // Custom tooltip
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
      // Sort by value descending
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value)

      return (
        <div className="bg-card/95 backdrop-blur border border-border/50 rounded-lg p-3 shadow-xl">
          <p className="font-display text-sm text-foreground mb-2">Week {label}</p>
          <div className="space-y-1">
            {sortedPayload.map((entry) => {
              let displayName = entry.name
              if (entry.name === 'highScore') displayName = 'High'
              if (entry.name === 'avgScore') displayName = 'Average'
              if (entry.name === 'lowScore') displayName = 'Low'
              if (entry.name === 'medianScore') displayName = 'Median'

              return (
                <div
                  key={entry.name}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-muted-foreground">{displayName}</span>
                  </div>
                  <span className="font-medium tabular-nums text-foreground">
                    {entry.value.toFixed(1)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={trends}
        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
      >
        <defs>
          {/* Gradient fill for average area */}
          <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.05} />
          </linearGradient>

          {/* Gradient for the range between high and low */}
          <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.15} />
            <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.15} />
          </linearGradient>
        </defs>

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
          domain={[minScore, maxScore]}
          stroke="hsl(215, 20%, 55%)"
          tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
          axisLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          tickLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          width={50}
          tickFormatter={(value) => `${value}`}
        />

        <Tooltip content={<CustomTooltip />} />

        {/* Season average reference line */}
        <ReferenceLine
          y={seasonAvg}
          stroke="hsl(215, 20%, 55%)"
          strokeDasharray="8 4"
          strokeOpacity={0.6}
          label={{
            value: `Avg: ${seasonAvg.toFixed(1)}`,
            position: 'right',
            fill: 'hsl(215, 20%, 55%)',
            fontSize: 10,
          }}
        />

        <Legend
          wrapperStyle={{ paddingTop: '20px' }}
          formatter={(value: string) => {
            let displayName = value
            if (value === 'highScore') displayName = 'High Score'
            if (value === 'avgScore') displayName = 'Average'
            if (value === 'lowScore') displayName = 'Low Score'

            return <span className="text-xs text-muted-foreground">{displayName}</span>
          }}
        />

        {/* High score line (dashed) */}
        <Area
          type="monotone"
          dataKey="highScore"
          stroke="hsl(38, 92%, 55%)"
          strokeWidth={2}
          strokeDasharray="6 3"
          fill="transparent"
          dot={{
            fill: 'hsl(38, 92%, 55%)',
            strokeWidth: 0,
            r: 3,
          }}
          activeDot={{
            r: 5,
            fill: 'hsl(38, 92%, 55%)',
            stroke: 'hsl(220, 20%, 7%)',
            strokeWidth: 2,
          }}
        />

        {/* Average score line (solid with fill) */}
        <Area
          type="monotone"
          dataKey="avgScore"
          stroke="hsl(142, 76%, 46%)"
          strokeWidth={2.5}
          fill="url(#avgGradient)"
          dot={{
            fill: 'hsl(142, 76%, 46%)',
            strokeWidth: 0,
            r: 4,
          }}
          activeDot={{
            r: 6,
            fill: 'hsl(142, 76%, 46%)',
            stroke: 'hsl(220, 20%, 7%)',
            strokeWidth: 2,
          }}
        />

        {/* Low score line (dashed) */}
        <Area
          type="monotone"
          dataKey="lowScore"
          stroke="hsl(0, 72%, 51%)"
          strokeWidth={2}
          strokeDasharray="6 3"
          fill="transparent"
          dot={{
            fill: 'hsl(0, 72%, 51%)',
            strokeWidth: 0,
            r: 3,
          }}
          activeDot={{
            r: 5,
            fill: 'hsl(0, 72%, 51%)',
            stroke: 'hsl(220, 20%, 7%)',
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
