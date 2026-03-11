"use client";

import { ResponsiveContainer, Treemap } from "recharts";
import { usePortfolioStore } from "@/store/portfolioStore";

function pnlColor(pct: number): string {
  if (pct > 5) return "#15803d";
  if (pct > 2) return "#16a34a";
  if (pct > 0) return "#22c55e";
  if (pct < -5) return "#991b1b";
  if (pct < -2) return "#dc2626";
  if (pct < 0) return "#ef4444";
  return "#4b5563";
}

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  pnlPct?: number;
}

function HeatmapCell({ x = 0, y = 0, width = 0, height = 0, name = "", pnlPct = 0 }: CellProps) {
  if (width < 10 || height < 10) return null;
  const fill = pnlColor(pnlPct);
  const showLabel = width > 36 && height > 28;
  const showPct = width > 50 && height > 44;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#0d1117" strokeWidth={2} rx={2} />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showPct ? -7 : 4)}
          textAnchor="middle"
          fill="#fff"
          fontSize={11}
          fontWeight="600"
          fontFamily="monospace"
        >
          {name}
        </text>
      )}
      {showPct && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 9}
          textAnchor="middle"
          fill="rgba(255,255,255,0.8)"
          fontSize={9}
          fontFamily="monospace"
        >
          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

export function PortfolioHeatmap() {
  const portfolio = usePortfolioStore((s) => s.portfolio);

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        No positions
      </div>
    );
  }

  const data = portfolio.positions.map((p) => ({
    name: p.ticker,
    size: Math.max(p.value, 1),
    pnlPct: p.unrealized_pnl_pct,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={data}
        dataKey="size"
        content={(props: CellProps) => <HeatmapCell {...props} />}
      />
    </ResponsiveContainer>
  );
}
