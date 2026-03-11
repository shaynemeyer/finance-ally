import { z } from "zod";

export const TradeActionSchema = z.object({
  type: z.literal("trade"),
  ok: z.boolean(),
  ticker: z.string(),
  side: z.enum(["buy", "sell"]).optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  error: z.string().optional(),
});

export const WatchlistActionSchema = z.object({
  type: z.literal("watchlist"),
  ok: z.boolean(),
  ticker: z.string(),
  action: z.enum(["add", "remove"]).optional(),
  note: z.string().optional(),
  error: z.string().optional(),
});

export const ActionSchema = z.discriminatedUnion("type", [
  TradeActionSchema,
  WatchlistActionSchema,
]);

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  actions: z.array(ActionSchema).nullable(),
  created_at: z.string(),
});

export type TradeAction = z.infer<typeof TradeActionSchema>;
export type WatchlistAction = z.infer<typeof WatchlistActionSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
