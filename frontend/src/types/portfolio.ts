import { z } from "zod";

export const PositionSchema = z.object({
  ticker: z.string(),
  quantity: z.number(),
  avg_cost: z.number(),
  current_price: z.number(),
  value: z.number(),
  unrealized_pnl: z.number(),
  unrealized_pnl_pct: z.number(),
});

export const PortfolioSchema = z.object({
  cash_balance: z.number(),
  total_value: z.number(),
  positions: z.array(PositionSchema),
});

export const SnapshotSchema = z.object({
  total_value: z.number(),
  recorded_at: z.string(),
});

export type Position = z.infer<typeof PositionSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
