"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useChatStore } from "@/store/chatStore";
import { Action, ChatMessage } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ActionBadge({ action }: { action: Action }) {
  if (action.type === "trade") {
    if (!action.ok) {
      return (
        <span className="text-xs text-destructive">
          Trade failed: {action.error}
        </span>
      );
    }
    return (
      <span className="text-xs text-green-400 font-mono">
        {action.side === "buy" ? "Bought" : "Sold"} {action.quantity ?? "?"} {action.ticker} @ ${action.price != null ? action.price.toFixed(2) : "?"}
      </span>
    );
  }

  if (action.type === "watchlist") {
    if (!action.ok) {
      return (
        <span className="text-xs text-destructive">
          Watchlist failed: {action.error}
        </span>
      );
    }
    return (
      <span className="text-xs text-primary font-mono">
        {action.action === "add" ? "Added" : "Removed"} {action.ticker} {action.note ? `(${action.note})` : ""}
      </span>
    );
  }

  return null;
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded px-2.5 py-1.5 text-xs leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {msg.content}
      </div>
      {msg.actions && msg.actions.length > 0 && (
        <div className="flex flex-col gap-0.5 max-w-[85%]">
          {msg.actions.map((action, i) => (
            <ActionBadge key={i} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const fetchHistory = useChatStore((s) => s.fetchHistory);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  if (collapsed) {
    return (
      <div className="flex flex-col border-l border-border w-10 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="flex-1 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Expand chat"
        >
          <span className="text-xs font-semibold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
            AI Chat
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-l border-border w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          AI Chat
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          aria-label="Collapse chat"
        >
          &#x2715;
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Ask Finance Ally to analyze your portfolio or execute trades.
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {isLoading && (
          <div className="flex items-start gap-1.5">
            <div className="bg-muted rounded px-2.5 py-1.5 text-xs text-muted-foreground animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-1.5 p-2 border-t border-border shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Finance Ally..."
          className="h-7 text-xs flex-1"
          disabled={isLoading}
        />
        <Button
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
