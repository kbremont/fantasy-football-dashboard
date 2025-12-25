import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import type { PositionChurn } from '@/lib/transaction-utils'

interface PositionChurnChartProps {
  data: PositionChurn[]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
  }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null

  const adds = payload.find((p) => p.name === 'adds')?.value || 0
  const drops = payload.find((p) => p.name === 'drops')?.value || 0
  const net = adds - drops

  return (
    <div className="bg-card/95 backdrop-blur border border-border/50 rounded-lg p-3 shadow-xl">
      <p className="font-display text-sm text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-primary">Adds:</span>
          <span className="text-xs font-bold text-primary tabular-nums">{adds}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-destructive">Drops:</span>
          <span className="text-xs font-bold text-destructive tabular-nums">{drops}</span>
        </div>
        <div className="border-t border-border/30 pt-1 mt-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Net:</span>
            <span
              className={`text-xs font-bold tabular-nums ${
                net > 0 ? 'text-primary' : net < 0 ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {net > 0 ? '+' : ''}{net}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PositionChurnChart({ data }: PositionChurnChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center h-64">
        <p className="text-muted-foreground">No position data available</p>
      </div>
    )
  }

  // Transform data for chart
  const chartData = data.map((d) => ({
    position: d.position,
    adds: d.adds,
    drops: d.drops,
    net: d.net,
  }))

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          barGap={4}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(222, 47%, 16%)"
            vertical={false}
          />
          <XAxis
            dataKey="position"
            stroke="hsl(215, 20%, 55%)"
            tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(222, 47%, 16%)' }}
          />
          <YAxis
            stroke="hsl(215, 20%, 55%)"
            tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(222, 47%, 16%)' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(222, 47%, 12%)' }} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => (
              <span className="text-sm text-muted-foreground capitalize">{value}</span>
            )}
          />
          <Bar
            dataKey="adds"
            name="adds"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((_, index) => (
              <Cell key={`adds-${index}`} fill="hsl(142, 76%, 46%)" />
            ))}
          </Bar>
          <Bar
            dataKey="drops"
            name="drops"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((_, index) => (
              <Cell key={`drops-${index}`} fill="hsl(0, 72%, 51%)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
