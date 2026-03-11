import { create } from "zustand";
import { z } from "zod";
import { ChatMessage, ChatMessageSchema } from "@/types/chat";

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  fetchHistory: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,

  fetchHistory: async () => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = z.array(ChatMessageSchema).parse(await res.json());
      set({ messages: data });
    } catch {
      set({ messages: [] });
    }
  },

  sendMessage: async (message: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      actions: null,
      created_at: new Date().toISOString(),
    };
    set((state) => ({ messages: [...state.messages, userMsg], isLoading: true }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: body.detail ?? "Failed to get a response",
          actions: null,
          created_at: new Date().toISOString(),
        };
        set((state) => ({ messages: [...state.messages, errMsg] }));
        return;
      }
      // Replace optimistic messages with server-canonical history to avoid duplicate IDs
      await get().fetchHistory();
    } catch {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Failed to get a response",
        actions: null,
        created_at: new Date().toISOString(),
      };
      set((state) => ({ messages: [...state.messages, errMsg] }));
    } finally {
      set({ isLoading: false });
    }
  },
}));
