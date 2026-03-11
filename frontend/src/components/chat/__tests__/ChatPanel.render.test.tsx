import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPanel } from "../ChatPanel";
import { useChatStore } from "@/store/chatStore";

const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockFetchHistory = vi.fn().mockResolvedValue(undefined);

vi.mock("@/store/chatStore", () => ({
  useChatStore: vi.fn((selector) =>
    selector({
      messages: [],
      isLoading: false,
      fetchHistory: mockFetchHistory,
      sendMessage: mockSendMessage,
    })
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("ChatPanel render", () => {
  it("renders the AI Chat header", () => {
    render(<ChatPanel />);
    expect(screen.getByText("AI Chat")).toBeInTheDocument();
  });

  it("shows empty state message when no messages", () => {
    render(<ChatPanel />);
    expect(screen.getByText(/Ask Finance Ally/)).toBeInTheDocument();
  });

  it("calls fetchHistory on mount", () => {
    render(<ChatPanel />);
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
  });

  it("renders Send button disabled when input is empty", () => {
    render(<ChatPanel />);
    expect(screen.getByText("Send")).toBeDisabled();
  });

  it("enables Send button when input has text", () => {
    render(<ChatPanel />);
    fireEvent.change(screen.getByPlaceholderText("Ask Finance Ally..."), {
      target: { value: "Hello" },
    });
    expect(screen.getByText("Send")).not.toBeDisabled();
  });

  it("calls sendMessage and clears input on Send click", async () => {
    render(<ChatPanel />);
    const input = screen.getByPlaceholderText("Ask Finance Ally...");
    fireEvent.change(input, { target: { value: "Buy 5 AAPL" } });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith("Buy 5 AAPL");
    });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("calls sendMessage on Enter key", async () => {
    render(<ChatPanel />);
    const input = screen.getByPlaceholderText("Ask Finance Ally...");
    fireEvent.change(input, { target: { value: "Analyze portfolio" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith("Analyze portfolio");
    });
  });

  it("collapses panel when X button is clicked", () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByLabelText("Collapse chat"));
    expect(screen.getByLabelText("Expand chat")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Ask Finance Ally...")).not.toBeInTheDocument();
  });

  it("expands panel when collapsed button is clicked", () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByLabelText("Collapse chat"));
    fireEvent.click(screen.getByLabelText("Expand chat"));
    expect(screen.getByPlaceholderText("Ask Finance Ally...")).toBeInTheDocument();
  });
});

describe("ChatPanel with messages", () => {
  it("renders user and assistant messages", () => {
    vi.mocked(useChatStore).mockImplementation((selector) =>
      selector({
        messages: [
          { id: "1", role: "user", content: "Buy AAPL", actions: null, created_at: "" },
          { id: "2", role: "assistant", content: "Done!", actions: null, created_at: "" },
        ],
        isLoading: false,
        fetchHistory: mockFetchHistory,
        sendMessage: mockSendMessage,
      })
    );
    render(<ChatPanel />);
    expect(screen.getByText("Buy AAPL")).toBeInTheDocument();
    expect(screen.getByText("Done!")).toBeInTheDocument();
  });

  it("renders trade action badge for successful trade", () => {
    vi.mocked(useChatStore).mockImplementation((selector) =>
      selector({
        messages: [
          {
            id: "1",
            role: "assistant",
            content: "Executed trade.",
            actions: [{ type: "trade", ok: true, ticker: "AAPL", side: "buy", quantity: 5, price: 200 }],
            created_at: "",
          },
        ],
        isLoading: false,
        fetchHistory: mockFetchHistory,
        sendMessage: mockSendMessage,
      })
    );
    render(<ChatPanel />);
    expect(screen.getByText(/Bought 5 AAPL/)).toBeInTheDocument();
  });

  it("renders trade error badge for failed trade", () => {
    vi.mocked(useChatStore).mockImplementation((selector) =>
      selector({
        messages: [
          {
            id: "1",
            role: "assistant",
            content: "Could not execute trade.",
            actions: [{ type: "trade", ok: false, ticker: "AAPL", error: "Insufficient cash" }],
            created_at: "",
          },
        ],
        isLoading: false,
        fetchHistory: mockFetchHistory,
        sendMessage: mockSendMessage,
      })
    );
    render(<ChatPanel />);
    expect(screen.getByText(/Insufficient cash/)).toBeInTheDocument();
  });

  it("renders watchlist action badge", () => {
    vi.mocked(useChatStore).mockImplementation((selector) =>
      selector({
        messages: [
          {
            id: "1",
            role: "assistant",
            content: "Added to watchlist.",
            actions: [{ type: "watchlist", ok: true, ticker: "PYPL", action: "add" }],
            created_at: "",
          },
        ],
        isLoading: false,
        fetchHistory: mockFetchHistory,
        sendMessage: mockSendMessage,
      })
    );
    render(<ChatPanel />);
    expect(screen.getByText(/Added PYPL/)).toBeInTheDocument();
  });

  it("shows loading indicator when isLoading is true", () => {
    vi.mocked(useChatStore).mockImplementation((selector) =>
      selector({
        messages: [],
        isLoading: true,
        fetchHistory: mockFetchHistory,
        sendMessage: mockSendMessage,
      })
    );
    render(<ChatPanel />);
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });
});
