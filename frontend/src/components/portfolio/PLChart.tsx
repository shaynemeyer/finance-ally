"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePortfolioStore } from "@/store/portfolioStore";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatValue(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PLChart() {
  const history = usePortfolioStore((s) => s.history);

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Collecting portfolio history...
      </div>
    );
  }

  const data = history.map((s) => ({
    time: formatTime(s.recorded_at),
    value: s.total_value,
  }));

  const values = data.map((d) => d.value);
  const min = values.reduce((a, b) => (b < a ? b : a), values[0]);
  const max = values.reduce((a, b) => (b > a ? b : a), values[0]);
  const pad = (max - min) * 0.1 || 100;
  const baseline = data[0].value;
  const isUp = data[data.length - 1].value >= baseline;

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={80}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="time"
          tick={{ fill: "#8b949e", fontSize: 9 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tick={{ fill: "#8b949e", fontSize: 9 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
          width={44}
        />
        <Tooltip
          contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 4 }}
          labelStyle={{ color: "#8b949e", fontSize: 10 }}
          itemStyle={{ color: "#e6edf3", fontSize: 11 }}
          formatter={(v: number | undefined) => [formatValue(v ?? 0), "Portfolio"]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={isUp ? "#22c55e" : "#ef4444"}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: isUp ? "#22c55e" : "#ef4444" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
