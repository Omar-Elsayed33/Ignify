"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { clsx } from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  response: string;
  metadata?: Record<string, unknown> | null;
}

// conversation_history format expected by the backend
type HistoryEntry = { role: string; content: string };

// ── Component ──────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const t = useTranslations("assistantPage");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: t("welcome") },
  ]);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSend = async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
    };

    // Optimistic update
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Build conversation history from current messages (excluding the welcome message)
    const history: HistoryEntry[] = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const data = await api.post<ChatResponse>("/api/v1/assistant/chat", {
        message: messageText,
        conversation_history: history,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          err instanceof Error ? err.message : t("errorResponse"),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts: string[] = [
    t("prompt1"),
    t("prompt2"),
    t("prompt3"),
    t("prompt4"),
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="flex h-[calc(100vh-8rem)] flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={clsx(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={clsx(
                    "max-w-[75%] rounded-2xl px-4 py-3",
                    msg.role === "user"
                      ? "rounded-ee-sm bg-primary text-white"
                      : "rounded-es-sm bg-surface text-text-primary shadow-sm"
                  )}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading bubble */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl rounded-es-sm bg-surface px-4 py-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggested prompts — only shown before any user message */}
        {messages.filter((m) => m.role === "user").length === 0 && !loading && (
          <div className="border-t border-border bg-surface px-6 py-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-text-secondary">
              <Sparkles className="h-4 w-4 text-accent" />
              {t("suggestedPrompts")}
            </p>
            <div className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-2">
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="rounded-lg border border-border bg-background px-4 py-2.5 text-start text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border bg-surface p-4">
          <div className="mx-auto flex max-w-3xl gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              disabled={loading}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
