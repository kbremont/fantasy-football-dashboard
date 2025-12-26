import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ScoringBucket } from '@/lib/league-pulse'

interface ScoringDistributionChartProps {
  distribution: ScoringBucket[]
}

// Gradient from red (low scores) through yellow to green (high scores)
function getBarColor(index: number, total: number): string {
  const ratio = index / (total - 1)

  if (ratio < 0.33) {
    // Red to orange
    const r = 220
    const g = Math.round(80 + ratio * 3 * 100)
    const b = 50
    return `rgb(${r}, ${g}, ${b})`
  } else if (ratio < 0.66) {
    // Orange to yellow-green
    const adjustedRatio = (ratio - 0.33) * 3
    const r = Math.round(220 - adjustedRatio * 100)
    const g = Math.round(180 + adjustedRatio * 40)
    const b = Math.round(50 + adjustedRatio * 30)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Yellow-green to green
    const adjustedRatio = (ratio - 0.66) * 3
    const r = Math.round(120 - adjustedRatio * 80)
    const g = Math.round(220 - adjustedRatio * 30)
    const b = Math.round(80 + adjustedRatio * 40)
    return `rgb(${r}, ${g}, ${b})`
  }
}

export function ScoringDistributionChart({ distribution }: ScoringDistributionChartProps) {
  if (distribution.length === 0) {
    return null
  }

  // Find the peak for highlighting
  const maxCount = Math.max(...distribution.map((d) => d.count))

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ payload: ScoringBucket }>
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload

      return (
        <div className="bg-card/95 backdrop-blur border border-border/50 rounded-lg p-3 shadow-xl">
          <p className="font-display text-sm text-foreground mb-1">
            {data.range} pts
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Count</span>
              <span className="font-medium tabular-nums text-foreground">
                {data.count} {data.count === 1 ? 'game' : 'games'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Percentage</span>
              <span className="font-medium tabular-nums text-primary">
                {data.percentage}%
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={distribution}
        margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
      >
        <defs>
          {/* Gradient for bars */}
          <linearGradient id="scoreBarGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(0, 72%, 51%)" />
            <stop offset="50%" stopColor="hsl(38, 92%, 55%)" />
            <stop offset="100%" stopColor="hsl(142, 76%, 46%)" />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(220, 15%, 18%)"
          strokeOpacity={0.5}
          vertical={false}
        />

        <XAxis
          dataKey="range"
          stroke="hsl(215, 20%, 55%)"
          tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
          axisLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          tickLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          angle={-45}
          textAnchor="end"
          height={60}
          interval={0}
        />

        <YAxis
          stroke="hsl(215, 20%, 55%)"
          tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
          axisLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          tickLine={{ stroke: 'hsl(220, 15%, 18%)' }}
          width={40}
          label={{
            value: 'Games',
            angle: -90,
            position: 'insideLeft',
            fill: 'hsl(215, 20%, 55%)',
            fontSize: 11,
            offset: 10,
          }}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(220, 15%, 15%)', opacity: 0.5 }} />

        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
          {distribution.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getBarColor(index, distribution.length)}
              opacity={entry.count === maxCount ? 1 : 0.8}
              stroke={entry.count === maxCount ? 'hsl(38, 92%, 55%)' : 'transparent'}
              strokeWidth={entry.count === maxCount ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
