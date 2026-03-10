import { z } from "zod";

export const PriceEventSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  prev_price: z.number(),
  prev_close: z.number(),
  change: z.number(),
  change_pct: z.number(),
  timestamp: z.number(),
});

export type PriceEvent = z.infer<typeof PriceEventSchema>;

export const WatchlistItemSchema = z.object({
  ticker: z.string(),
  added_at: z.string(),
  price: z.number().nullable(),
  change: z.number().nullable(),
  change_pct: z.number().nullable(),
});

export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;
