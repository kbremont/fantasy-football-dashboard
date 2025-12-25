import { useMemo } from 'react'
import type { TradeMatrixCell, RosterData } from '@/lib/transaction-utils'
import { cn } from '@/lib/utils'

interface TradeMatrixChartProps {
  tradeMatrix: TradeMatrixCell[]
  rosters: RosterData[]
}

export function TradeMatrixChart({ tradeMatrix, rosters }: TradeMatrixChartProps) {
  // Build a 2D matrix of trade counts
  const { matrix, teamNames, maxCount } = useMemo(() => {
    const teamNames = rosters.map((r) => r.team_name || `Team ${r.roster_id}`)
    const rosterIds = rosters.map((r) => r.roster_id)
    const size = rosters.length

    // Initialize matrix with zeros
    const matrix: number[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => 0)
    )

    // Fill in trade counts
    tradeMatrix.forEach((cell) => {
      const i = rosterIds.indexOf(cell.roster_id_1)
      const j = rosterIds.indexOf(cell.roster_id_2)
      if (i !== -1 && j !== -1) {
        matrix[i][j] = cell.trade_count
        matrix[j][i] = cell.trade_count // Mirror for symmetry
      }
    })

    const maxCount = Math.max(...tradeMatrix.map((c) => c.trade_count), 0)

    return { matrix, teamNames, maxCount }
  }, [tradeMatrix, rosters])

  if (rosters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No roster data available</p>
      </div>
    )
  }

  const getCellColor = (count: number, i: number, j: number) => {
    if (i === j) return 'bg-secondary/30' // Diagonal
    if (count === 0) return 'bg-secondary/10 hover:bg-secondary/20'

    const intensity = maxCount > 0 ? count / maxCount : 0
    if (intensity > 0.75) return 'bg-purple-500/80 hover:bg-purple-500'
    if (intensity > 0.5) return 'bg-purple-500/60 hover:bg-purple-500/80'
    if (intensity > 0.25) return 'bg-purple-500/40 hover:bg-purple-500/60'
    return 'bg-purple-500/20 hover:bg-purple-500/40'
  }

  // Truncate team names for display
  const truncateName = (name: string, maxLen: number = 10) => {
    if (name.length <= maxLen) return name
    return name.slice(0, maxLen - 1) + '…'
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Column Headers */}
        <div className="flex">
          {/* Empty corner cell */}
          <div className="w-24 shrink-0" />
          {/* Team name headers */}
          {teamNames.map((name, i) => (
            <div
              key={i}
              className="w-12 h-20 flex items-end justify-center pb-2 shrink-0"
            >
              <span
                className="text-xs text-muted-foreground font-medium transform -rotate-45 origin-center whitespace-nowrap"
                title={name}
              >
                {truncateName(name, 8)}
              </span>
            </div>
          ))}
        </div>

        {/* Matrix Rows */}
        {matrix.map((row, i) => (
          <div key={i} className="flex">
            {/* Row header */}
            <div className="w-24 shrink-0 flex items-center justify-end pr-2">
              <span
                className="text-xs text-muted-foreground font-medium truncate"
                title={teamNames[i]}
              >
                {truncateName(teamNames[i])}
              </span>
            </div>
            {/* Matrix cells */}
            {row.map((count, j) => (
              <div
                key={j}
                className={cn(
                  'w-12 h-12 shrink-0 flex items-center justify-center rounded-md m-0.5 transition-all cursor-default',
                  getCellColor(count, i, j)
                )}
                title={
                  i === j
                    ? teamNames[i]
                    : `${teamNames[i]} ↔ ${teamNames[j]}: ${count} trade${count !== 1 ? 's' : ''}`
                }
              >
                {i !== j && count > 0 && (
                  <span className="text-sm font-bold text-white tabular-nums">
                    {count}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-500/20" />
          <span className="text-xs text-muted-foreground">1 trade</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-500/50" />
          <span className="text-xs text-muted-foreground">2-3 trades</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-500/80" />
          <span className="text-xs text-muted-foreground">4+ trades</span>
        </div>
      </div>
    </div>
  )
}
