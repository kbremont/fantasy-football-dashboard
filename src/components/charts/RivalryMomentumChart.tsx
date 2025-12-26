import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { RivalryMatchup } from '@/lib/rivalry-stats'
import { formatPoints } from '@/lib/rivalry-stats'

interface RivalryMomentumChartProps {
  matchups: RivalryMatchup[]
  teamAName: string
  teamBName: string
}

interface ChartDataPoint {
  label: string
  margin: number
  teamAPoints: number
  teamBPoints: number
  winner: 'teamA' | 'teamB' | 'tie'
  week: number
  seasonYear: number
}

export function RivalryMomentumChart({
  matchups,
  teamAName,
  teamBName,
}: RivalryMomentumChartProps) {
  // Transform data for chart
  const chartData: ChartDataPoint[] = matchups.map((m) => ({
    label: `'${m.season_year.toString().slice(-2)} W${m.week}`,
    margin: m.winner === 'teamA' ? m.margin : m.winner === 'teamB' ? -m.margin : 0,
    teamAPoints: m.teamA_points,
    teamBPoints: m.teamB_points,
    winner: m.winner,
    week: m.week,
    seasonYear: m.season_year,
  }))

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{
      payload: ChartDataPoint
    }>
  }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload
      const isTeamAWinner = data.winner === 'teamA'
      const isTie = data.winner === 'tie'

      return (
        <div className="bg-card/95 backdrop-blur border border-border/50 rounded-lg p-4 shadow-xl min-w-[200px]">
          <p className="font-display text-sm text-foreground mb-3">
            {data.seasonYear}-{(data.seasonYear + 1).toString().slice(-2)} Week {data.week}
          </p>

          <div className="space-y-2">
            {/* Team A Score */}
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isTeamAWinner ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                {teamAName}
              </span>
              <span className={`font-display tabular-nums ${isTeamAWinner ? 'text-primary' : 'text-muted-foreground'}`}>
                {formatPoints(data.teamAPoints)}
              </span>
            </div>

            {/* Team B Score */}
            <div className="flex items-center justify-between">
              <span className={`text-sm ${!isTeamAWinner && !isTie ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
                {teamBName}
              </span>
              <span className={`font-display tabular-nums ${!isTeamAWinner && !isTie ? 'text-accent' : 'text-muted-foreground'}`}>
                {formatPoints(data.teamBPoints)}
              </span>
            </div>

            {/* Margin */}
            <div className="pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                {isTie ? (
                  'Tie game'
                ) : (
                  <>
                    <span className={isTeamAWinner ? 'text-primary' : 'text-accent'}>
                      {isTeamAWinner ? teamAName : teamBName}
                    </span>
                    {' wins by '}
                    <span className="font-medium text-foreground">
                      {Math.abs(data.margin).toFixed(2)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span className="text-muted-foreground">{teamAName} wins</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-accent" />
          <span className="text-muted-foreground">{teamBName} wins</span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
        >
          <defs>
            {/* Team A gradient (positive - green) */}
            <linearGradient id="teamAGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.6} />
              <stop offset="100%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.05} />
            </linearGradient>
            {/* Team B gradient (negative - gold) */}
            <linearGradient id="teamBGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.6} />
              <stop offset="100%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(220, 15%, 18%)"
            strokeOpacity={0.5}
            vertical={false}
          />

          <XAxis
            dataKey="label"
            stroke="hsl(215, 20%, 55%)"
            tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(220, 15%, 18%)' }}
            tickLine={{ stroke: 'hsl(220, 15%, 18%)' }}
            interval="preserveStartEnd"
          />

          <YAxis
            stroke="hsl(215, 20%, 55%)"
            tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(220, 15%, 18%)' }}
            tickLine={{ stroke: 'hsl(220, 15%, 18%)' }}
            tickFormatter={(value) => {
              if (value === 0) return '0'
              return value > 0 ? `+${value}` : `${value}`
            }}
            width={45}
          />

          <ReferenceLine
            y={0}
            stroke="hsl(215, 20%, 45%)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Split area - positive for Team A */}
          <Area
            type="monotone"
            dataKey={(d: ChartDataPoint) => (d.margin > 0 ? d.margin : 0)}
            stroke="hsl(142, 76%, 46%)"
            strokeWidth={2}
            fill="url(#teamAGradient)"
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

          {/* Split area - negative for Team B */}
          <Area
            type="monotone"
            dataKey={(d: ChartDataPoint) => (d.margin < 0 ? d.margin : 0)}
            stroke="hsl(38, 92%, 55%)"
            strokeWidth={2}
            fill="url(#teamBGradient)"
            dot={{
              fill: 'hsl(38, 92%, 55%)',
              strokeWidth: 0,
              r: 4,
            }}
            activeDot={{
              r: 6,
              fill: 'hsl(38, 92%, 55%)',
              stroke: 'hsl(220, 20%, 7%)',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Axis labels */}
      <div className="flex justify-between text-xs text-muted-foreground/60 px-12">
        <span>← {teamAName} dominance</span>
        <span>{teamBName} dominance →</span>
      </div>
    </div>
  )
}
