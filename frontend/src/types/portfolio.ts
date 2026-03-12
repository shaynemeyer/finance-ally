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

export const TradeSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  side: z.string(),
  quantity: z.number(),
  price: z.number(),
  realized_pnl: z.number().nullable(),
  executed_at: z.string(),
});

export const TradeHistorySchema = z.object({
  trades: z.array(TradeSchema),
  aggregate_realized_pnl: z.number(),
});

export type Position = z.infer<typeof PositionSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type Trade = z.infer<typeof TradeSchema>;
export type TradeHistory = z.infer<typeof TradeHistorySchema>;
