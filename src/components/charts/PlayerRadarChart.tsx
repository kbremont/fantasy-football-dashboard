import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { RadarDataPoint } from '@/lib/college-scouting'

interface PlayerInfo {
  cfbd_player_id: string
  player_name: string
  position: string | null
}

interface PlayerRadarChartProps {
  data: RadarDataPoint[]
  players: PlayerInfo[]
}

// Chart colors for up to 3 players
const CHART_COLORS = [
  'hsl(142, 76%, 46%)', // Primary green
  'hsl(38, 92%, 55%)',  // Gold accent
  'hsl(200, 70%, 55%)', // Blue
]

export function PlayerRadarChart({ data, players }: PlayerRadarChartProps) {
  if (data.length === 0 || players.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No comparison data available
      </div>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; color: string; payload?: RadarDataPoint }>
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur border border-border/50 rounded-lg p-3 shadow-xl">
          <p className="font-display text-sm text-foreground mb-2">
            {payload[0]?.payload?.stat}
          </p>
          <div className="space-y-1">
            {payload.map((entry, index) => {
              const player = players.find((p) => p.cfbd_player_id === entry.name)
              return (
                <div
                  key={index}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span
                    className="font-medium truncate max-w-[120px]"
                    style={{ color: entry.color }}
                  >
                    {player?.player_name || entry.name}
                  </span>
                  <span className="font-display tabular-nums text-foreground">
                    {entry.value}
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

  // Custom legend
  const CustomLegend = () => (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {players.map((player, index) => (
        <div key={player.cfbd_player_id} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: CHART_COLORS[index] }}
          />
          <span className="text-sm text-muted-foreground">
            {player.player_name}
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <defs>
            {players.map((player, index) => (
              <linearGradient
                key={player.cfbd_player_id}
                id={`radarGradient-${player.cfbd_player_id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={CHART_COLORS[index]}
                  stopOpacity={0.8}
                />
                <stop
                  offset="100%"
                  stopColor={CHART_COLORS[index]}
                  stopOpacity={0.2}
                />
              </linearGradient>
            ))}
          </defs>

          <PolarGrid
            stroke="hsl(220, 15%, 25%)"
            strokeOpacity={0.6}
          />

          <PolarAngleAxis
            dataKey="stat"
            tick={{
              fill: 'hsl(220, 10%, 70%)',
              fontSize: 11,
              fontFamily: 'var(--font-display)',
            }}
            tickLine={false}
          />

          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />

          {players.map((player, index) => (
            <Radar
              key={player.cfbd_player_id}
              name={player.cfbd_player_id}
              dataKey={player.cfbd_player_id}
              stroke={CHART_COLORS[index]}
              fill={`url(#radarGradient-${player.cfbd_player_id})`}
              fillOpacity={0.4}
              strokeWidth={2}
              dot={{
                r: 4,
                fill: CHART_COLORS[index],
                stroke: 'hsl(220, 20%, 10%)',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: CHART_COLORS[index],
                stroke: 'hsl(220, 20%, 10%)',
                strokeWidth: 2,
              }}
            />
          ))}

          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      <CustomLegend />
    </div>
  )
}
