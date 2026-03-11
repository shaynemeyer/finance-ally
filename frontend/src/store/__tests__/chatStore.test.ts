import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatStore } from "../chatStore";

const mockHistory = [
  { id: "1", role: "user", content: "Hello", actions: null, created_at: "2024-01-01T00:00:00Z" },
  { id: "2", role: "assistant", content: "Hi there", actions: null, created_at: "2024-01-01T00:00:01Z" },
];

const mockAssistantReply = {
  id: "3",
  role: "assistant",
  content: "I bought 5 AAPL for you.",
  actions: [{ type: "trade", ok: true, ticker: "AAPL", side: "buy", quantity: 5, price: 200 }],
  created_at: "2024-01-01T00:00:02Z",
};

beforeEach(() => {
  useChatStore.setState({ messages: [], isLoading: false });
  vi.restoreAllMocks();
  vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
});

describe("chatStore.fetchHistory", () => {
  it("sets messages on successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHistory,
    }));
    await useChatStore.getState().fetchHistory();
    expect(useChatStore.getState().messages).toHaveLength(2);
    expect(useChatStore.getState().messages[0].content).toBe("Hello");
  });

  it("preserves existing messages when response is not ok", async () => {
    useChatStore.setState({ messages: [{ id: "x", role: "user", content: "Hi", actions: null, created_at: "" }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await useChatStore.getState().fetchHistory();
    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  it("resets to empty on Zod parse failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ bad: "shape" }],
    }));
    await useChatStore.getState().fetchHistory();
    expect(useChatStore.getState().messages).toEqual([]);
  });

  it("resets to empty on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    await useChatStore.getState().fetchHistory();
    expect(useChatStore.getState().messages).toEqual([]);
  });
});

describe("chatStore.sendMessage", () => {
  it("optimistically adds user message and sets isLoading", async () => {
    let resolveFetch!: (v: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    vi.stubGlobal("fetch", vi.fn()
      .mockReturnValueOnce(fetchPromise)
      .mockResolvedValue({ ok: true, json: async () => [] })
    );

    const sendPromise = useChatStore.getState().sendMessage("Buy AAPL");
    // Optimistic update should have fired before fetch resolves
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].role).toBe("user");
    expect(useChatStore.getState().isLoading).toBe(true);

    resolveFetch({ ok: true, json: async () => mockAssistantReply });
    await sendPromise;
  });

  it("replaces messages with server history on success", async () => {
    // First call (POST) returns the assistant reply; second call (GET fetchHistory) returns full history
    const serverHistory = [
      { id: "u1", role: "user", content: "Buy AAPL", actions: null, created_at: "" },
      { ...mockAssistantReply },
    ];
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAssistantReply }) // POST /api/chat
      .mockResolvedValueOnce({ ok: true, json: async () => serverHistory })        // GET /api/chat
    );
    await useChatStore.getState().sendMessage("Buy AAPL");
    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe("u1");
    expect(messages[1].content).toBe("I bought 5 AAPL for you.");
    expect(useChatStore.getState().isLoading).toBe(false);
  });

  it("appends error message on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "LLM error: timeout" }),
    }));
    await useChatStore.getState().sendMessage("Analyze portfolio");
    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("LLM error: timeout");
    expect(useChatStore.getState().isLoading).toBe(false);
  });

  it("appends fallback error message on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    await useChatStore.getState().sendMessage("Hello");
    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[1].content).toBe("Failed to get a response");
    expect(useChatStore.getState().isLoading).toBe(false);
  });
});
